import { Subject } from 'rxjs'
import log from '@/log'

// Singleton pattern for device manager
class DeviceManager {
  constructor() {
    this.device = null
    this.pairedDevice = null
    this.deviceSubject = new Subject()
    this.isConnecting = false
    
    // Watch for HMR (Hot Module Replacement)
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        log.debug('HMR triggered in DeviceManager')
      })
      
      // Store device state for HMR persistence
      if (import.meta.hot.data.device) {
        this.device = import.meta.hot.data.device
        this.pairedDevice = import.meta.hot.data.pairedDevice
        log.debug('DeviceManager: Restored device from HMR state')
      }
      
      import.meta.hot.dispose(data => {
        // Save state before hot update
        data.device = this.device
        data.pairedDevice = this.pairedDevice
        log.debug('DeviceManager: Saved device state for HMR')
      })
    }
  }
  
  /**
   * Get the current device
   */
  getDevice() {
    return this.device
  }
  
  /**
   * Set the current device and notify all subscribers
   */
  setDevice(device) {
    this.device = device
    
    if (device) {
      // Register disconnect handler
      device.onDisconnect(() => {
        log.debug('DeviceManager: Device disconnected')
        this.device = null
        this.deviceSubject.next(null)
      })
    }
    
    // Notify subscribers about device change
    this.deviceSubject.next(device)
    return device
  }
  
  /**
   * Set the paired device (before connection)
   */
  setPairedDevice(device) {
    this.pairedDevice = device
    return device
  }
  
  /**
   * Get the paired device
   */
  getPairedDevice() {
    return this.pairedDevice
  }
  
  /**
   * Returns an observable that emits when the device changes
   */
  observeDevice() {
    return this.deviceSubject
  }
  
  /**
   * Disconnect current device if it exists
   */
  disconnect() {
    if (this.device) {
      log.debug('DeviceManager: Disconnecting device')
      this.device.disconnect()
      this.device = null
      this.deviceSubject.next(null)
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.disconnect()
    this.deviceSubject.complete()
  }
}

// Create singleton instance
const deviceManager = new DeviceManager()

// Make sure it's not destroyed during HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Do not destroy during HMR
  })
}

export default deviceManager 