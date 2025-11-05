/**
 * Accelerometer Manager
 * 
 * Singleton service to manage and share the accelerometer service instance
 * between different components (ECG and Accelerometer display).
 */

class AccelerometerManager {
  constructor() {
    this.accService = null
    this.listeners = []
  }
  
  /**
   * Set the accelerometer service instance
   * @param {Object} accService - Accelerometer service instance
   */
  setAccService(accService) {
    this.accService = accService
    console.log('AccelerometerManager: Accelerometer service registered')
    
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(accService)
      } catch (error) {
        console.error('AccelerometerManager: Error notifying listener:', error)
      }
    })
  }
  
  /**
   * Get the current accelerometer service instance
   * @returns {Object|null} Accelerometer service or null
   */
  getAccService() {
    return this.accService
  }
  
  /**
   * Add a listener to be notified when accelerometer service is set
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    this.listeners.push(listener)
    
    // If service already exists, notify immediately
    if (this.accService) {
      try {
        listener(this.accService)
      } catch (error) {
        console.error('AccelerometerManager: Error notifying new listener:', error)
      }
    }
  }
  
  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }
  
  /**
   * Clear the accelerometer service
   */
  clear() {
    this.accService = null
    console.log('AccelerometerManager: Accelerometer service cleared')
  }
}

// Export singleton instance
export default new AccelerometerManager()
