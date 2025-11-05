import { Observable } from 'rxjs'
import { interval } from 'rxjs'
import { switchMap, startWith, share } from 'rxjs/operators'

import log from '@/log'
import Mutex from './mutex'

export default class BaseDevice {

  constructor(connection) {
    this.connection = connection
    this.services   = {}
    this.characs    = {}
    this.observes   = {}
    this.mutex      = new Mutex
  }

  name() {
    return this.connection.device.name
  }

  disconnect() {
    // Clear cached services and characteristics before disconnecting
    this.clearCache()
    
    if (this.connection) {
      this.connection.disconnect()
    }
  }

  onDisconnect(handler) {
    if (this.connection && this.connection.device) {
      this.connection.device.addEventListener('gattserverdisconnected', handler)
    } else {
      console.warn('BaseDevice: Cannot set disconnect handler - no connection or device available');
    }
  }

  // Clear cached services and characteristics
  clearCache() {
    this.services = {}
    this.characs = {}
    
    // Also clear any active observables
    for (const key in this.observes) {
      if (this.observes[key]) {
        try {
          // The observables themselves don't need unsubscribing here
          // as that happens at the component level, but we should
          // clear the reference
          this.observes[key] = null
        } catch (e) {
          log.debug('Error clearing observable:', e)
        }
      }
    }
    this.observes = {}
  }

  async getBatteryLevel() {
    const unlock = await this.mutex.lock()
    try {
      const charac = await this.fetchCharac('battery_service', 'battery_level')
      const bl     = await charac.readValue()
      return bl.getUint8(0)
    } finally {
      unlock()
    }
  }

  observeBatteryLevel(intsecs = 60) {
    return interval(intsecs * 1000).pipe(
      startWith(this.getBatteryLevel()),
      switchMap(v => this.getBatteryLevel())
    )
  }

  observeHeartRate() {
    // Always reuse the shared observable to prevent multiple subscriptions
    return this.observes.hrm ||= this.createHeartRateObservable()
  }
  
  createHeartRateObservable() {
    console.log('Creating Heart Rate Observable')
    return this.observeNotifications('heart_rate', 'heart_rate_measurement', {
      handler: (sub, event) => {
        const hr = event.target.value.getUint8(1)
        console.log('Heart Rate received:', hr)
        sub.next(hr)
      }
    }).pipe(share())
  }

  observeRRInterval() {
    // Always reuse the shared observable to prevent multiple subscriptions
    return this.observes.rri ||= this.createRRIntervalObservable()
  }
  
  createRRIntervalObservable() {
    return this.observeNotifications('heart_rate', 'heart_rate_measurement', {
      handler: (sub, event) => {
        const value = event.target.value
        let offset  = 0
        const flags = value.getUint8(offset++)

        const hrFormatUint16       =  flags & 0x01
        const sensorContactStatus  = (flags & 0x06) >> 1
        const energyExpendedStatus = (flags & 0x08) >> 3
        const rrIntervalPresent    = (flags & 0x10) >> 4

        offset += (hrFormatUint16) ? 2 : 1

        let rrInterval = null
        if (rrIntervalPresent) {
          const rr = value.getUint16(offset, /* littleEndian= */ true)
          rrInterval = rr // in units of 1/1024 seconds
          rrInterval = rrInterval * 1000 / 1024 // Convert to milliseconds
          offset += 2
        }

        sub.next(rrInterval)
      }
    }).pipe(share())
  }

  observeNotifications(service, charac, {handler, init}) {
    console.log(`observeNotifications called for service: ${service}, charac: ${charac}`)
    return new Observable(async sub => {
      let unlock = null
      let characteristic = null

      try {
        console.log(`Acquiring mutex lock for ${service}/${charac}`)
        // Acquire mutex lock to prevent concurrent GATT operations
        unlock = await this.mutex.lock()
        console.log(`Mutex acquired for ${service}/${charac}`)

        // Get the characteristic, catching and handling errors
        characteristic = await this.fetchCharac(service, charac)
        console.log(`Characteristic fetched for ${service}/${charac}`)

        if (init) {
          console.log(`Running init for ${service}/${charac}`)
          try {
            await init()
          } catch (initError) {
            log.debug(`Error in init for ${service}/${charac}:`, initError)
            // Continue anyway - init errors may not be fatal
          }
        }

        // Start notifications
        console.log(`Starting notifications for ${service}/${charac}`)
        await characteristic.startNotifications()
        console.log(`Notifications started for ${service}/${charac}`)

        // Release mutex lock after starting notifications
        if (unlock) {
          unlock()
          unlock = null
          console.log(`Mutex released for ${service}/${charac}`)
        }

        function handleNotifications(event) {
          try {
            handler(sub, event)
          } catch (error) {
            log.debug('Error in notification handler:', error)
            // Don't call sub.error here to avoid closing the subscription on handler errors
          }
        }

        characteristic.addEventListener('characteristicvaluechanged', handleNotifications)
        console.log(`Event listener added for ${service}/${charac}`)

        // Return cleanup function (teardown logic)
        return {
          unsubscribe: () => {
            try {
              if (characteristic && characteristic.properties && characteristic.properties.notify) {
                // Only call stopNotifications if the characteristic is still available
                // and has notify property
                characteristic.stopNotifications()
                  .catch(e => log.debug('Error stopping notifications:', e))
              }

              if (characteristic) {
                characteristic.removeEventListener('characteristicvaluechanged', handleNotifications)
              }
            } catch (e) {
              log.debug('Error in observable cleanup:', e)
            }
          }
        }
      } catch (error) {
        // Release mutex lock if error occurred
        if (unlock) {
          console.log(`Releasing mutex due to error for ${service}/${charac}`)
          unlock()
          unlock = null
        }
        log.debug('Error setting up notifications:', error)
        sub.error(error)
      }
    })
  }

  async fetchService(service) {
    // If we already have this service cached, return it
    if (this.services[service]) {
      return this.services[service]
    }
    
    try {
      // Otherwise fetch and cache the service
      const resolvedService = await this.connection.getPrimaryService(service)
      this.services[service] = resolvedService
      return resolvedService
    } catch (error) {
      log.debug(`Error fetching service ${service}:`, error)
      throw error
    }
  }

  async fetchCharac(service, charac) {
    // If we already have this characteristic cached, return it
    if (this.characs[charac]) {
      return this.characs[charac]
    }
    
    try {
      // Get the service first
      const serviceObj = await this.fetchService(service)
      
      // Then get and cache the characteristic
      const characteristic = await serviceObj.getCharacteristic(charac)
      this.characs[charac] = characteristic
      return characteristic
    } catch (error) {
      log.debug(`Error fetching characteristic ${charac} from service ${service}:`, error)
      throw error
    }
  }

  /**
   * Returns the device's ECG sampling rate in Hz.
   * Must be implemented by device subclasses that support ECG.
   * @throws {Error} If the device doesn't support ECG or if the subclass doesn't implement this method.
   * @returns {number} The ECG sampling rate in Hz.
   */
  get ecgSamplingRate() {
    throw new Error('ecgSamplingRate getter must be implemented by device classes that support ECG functionality')
  }

  /**
   * Indicates whether the device has ECG data available.
   * Should be overridden by device subclasses that support ECG.
   * @returns {boolean} True if ECG data is available, false otherwise.
   */
  hasEcgData() {
    return false
  }

}

