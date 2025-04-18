import { Observable } from 'rxjs'
import { interval } from 'rxjs'
import { switchMap, startWith } from 'rxjs/operators'

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
    this.connection.device.addEventListener('gattserverdisconnected', handler)
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
    const charac = await this.fetchCharac('battery_service', 'battery_level')
    const bl     = await charac.readValue()
    return bl.getUint8(0)
  }

  observeBatteryLevel(intsecs = 60) {
    return interval(intsecs * 1000).pipe(
      startWith(this.getBatteryLevel()),
      switchMap(v => this.getBatteryLevel())
    )
  }

  observeHeartRate() {
    // Use a fresh observable on each request during development/HMR
    if (import.meta.env.DEV) {
      return this.createHeartRateObservable()
    }
    
    // In production, reuse the observable
    return this.observes.hrm ||= this.createHeartRateObservable()
  }
  
  createHeartRateObservable() {
    return this.observeNotifications('heart_rate', 'heart_rate_measurement', {
      handler: (sub, event) => {
        sub.next(event.target.value.getUint8(1))
      }
    })
  }

  observeRRInterval() {
    // Use a fresh observable on each request during development/HMR
    if (import.meta.env.DEV) {
      return this.createRRIntervalObservable()
    }
    
    // In production, reuse the observable
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
    })
  }

  observeNotifications(service, charac, {handler, init}) {
    return new Observable(async sub => {
      try {
        // Get the characteristic, catching and handling errors
        const characteristic = await this.fetchCharac(service, charac)
        
        if (init) await init()
        
        // Start notifications
        await characteristic.startNotifications()
        
        function handleNotifications(event) { 
          try {
            handler(sub, event) 
          } catch (error) {
            log.debug('Error in notification handler:', error)
            sub.error(error)
          }
        }
        
        characteristic.addEventListener('characteristicvaluechanged', handleNotifications)
        
        // Return cleanup function
        return () => {
          try {
            if (characteristic && characteristic.properties.notify) {
              // Only call stopNotifications if the characteristic is still available
              // and has notify property
              characteristic.stopNotifications()
                .catch(e => log.debug('Error stopping notifications:', e))
            }
            
            characteristic.removeEventListener('characteristicvaluechanged', handleNotifications)
          } catch (e) {
            log.debug('Error in observable cleanup:', e)
          }
        }
      } catch (error) {
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

