/**
 * Adaptive LMS (Least Mean Squares) Filter
 * 
 * Used to remove motion artifacts from ECG signals using accelerometer data as reference.
 * Based on research: Raya & Sison (2002) "Adaptive noise cancelling of motion artifact 
 * in stress ECG signals using accelerometer"
 * 
 * Theory:
 * - Accelerometer measures body motion (noise reference)
 * - LMS filter learns correlation between motion and ECG noise
 * - Filtered ECG = Raw ECG - Estimated Noise
 */

export default class AdaptiveLMSFilter {
  /**
   * @param {number} filterOrder - Number of filter taps (10-20 recommended)
   * @param {number} stepSize - Learning rate μ (0.001-0.01 recommended)
   */
  constructor(filterOrder = 15, stepSize = 0.005) {
    this.filterOrder = filterOrder
    this.stepSize = stepSize
    this.initialStepSize = stepSize
    
    // Filter weights (adaptive coefficients)
    this.weights = new Array(filterOrder).fill(0)
    
    // Input buffer for accelerometer samples
    this.accBuffer = new Array(filterOrder).fill(0)
    
    // Statistics for adaptive step size
    this.errorHistory = []
    this.maxErrorHistory = 50
    
    // Motion detection
    this.movementThreshold = 0.15 // g (gravity units)
    this.isHighMotion = false
    
    // Performance metrics
    this.sampleCount = 0
    this.convergenceTime = 0
  }
  
  /**
   * Filter a single ECG sample using accelerometer reference
   * 
   * @param {number} ecgSample - Raw ECG value
   * @param {number} accMagnitude - Accelerometer magnitude (sqrt(x²+y²+z²))
   * @returns {number} Filtered ECG value
   */
  filter(ecgSample, accMagnitude) {
    this.sampleCount++
    
    // Detect high motion periods
    this.detectMotion(accMagnitude)
    
    // Shift buffer (FIFO)
    this.accBuffer.shift()
    this.accBuffer.push(accMagnitude)
    
    // Calculate estimated noise using current weights
    let estimatedNoise = 0
    for (let i = 0; i < this.filterOrder; i++) {
      estimatedNoise += this.weights[i] * this.accBuffer[i]
    }
    
    // Calculate error (desired signal = ECG - estimated noise)
    const error = ecgSample - estimatedNoise
    
    // Update weights using LMS algorithm
    // w(n+1) = w(n) + μ * e(n) * x(n)
    const adaptiveStepSize = this.getAdaptiveStepSize()
    for (let i = 0; i < this.filterOrder; i++) {
      this.weights[i] += adaptiveStepSize * error * this.accBuffer[i]
    }
    
    // Track error for convergence monitoring
    this.trackError(error)
    
    // Return filtered ECG (error signal is the clean ECG)
    return error
  }
  
  /**
   * Detect high motion periods based on accelerometer magnitude
   * @param {number} accMagnitude 
   */
  detectMotion(accMagnitude) {
    // Remove gravity (1g) to get motion component
    const motionComponent = Math.abs(accMagnitude - 1.0)
    
    this.isHighMotion = motionComponent > this.movementThreshold
  }
  
  /**
   * Get adaptive step size based on motion level
   * @returns {number} Adjusted step size
   */
  getAdaptiveStepSize() {
    if (this.isHighMotion) {
      // During high motion, use larger step size for faster adaptation
      return this.initialStepSize * 3
    } else {
      // During low motion, use smaller step size for stability
      return this.initialStepSize
    }
  }
  
  /**
   * Track error for convergence monitoring
   * @param {number} error 
   */
  trackError(error) {
    this.errorHistory.push(Math.abs(error))
    
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift()
    }
    
    // Check if filter has converged (error is stable)
    if (this.convergenceTime === 0 && this.errorHistory.length >= 20) {
      const recentErrors = this.errorHistory.slice(-20)
      const avgError = recentErrors.reduce((a, b) => a + b) / recentErrors.length
      const variance = recentErrors.reduce((sum, e) => sum + (e - avgError) ** 2, 0) / recentErrors.length
      
      // If variance is low, filter has converged
      if (variance < avgError * 0.1) {
        this.convergenceTime = this.sampleCount
      }
    }
  }
  
  /**
   * Reset filter to initial state
   */
  reset() {
    this.weights.fill(0)
    this.accBuffer.fill(0)
    this.errorHistory = []
    this.sampleCount = 0
    this.convergenceTime = 0
    this.isHighMotion = false
  }
  
  /**
   * Get filter statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const avgError = this.errorHistory.length > 0
      ? this.errorHistory.reduce((a, b) => a + b) / this.errorHistory.length
      : 0
    
    return {
      sampleCount: this.sampleCount,
      convergenceTime: this.convergenceTime,
      averageError: avgError,
      isHighMotion: this.isHighMotion,
      hasConverged: this.convergenceTime > 0
    }
  }
  
  /**
   * Set filter parameters
   * @param {Object} params 
   */
  setParameters({ filterOrder, stepSize, movementThreshold }) {
    if (filterOrder !== undefined) {
      this.filterOrder = filterOrder
      this.weights = new Array(filterOrder).fill(0)
      this.accBuffer = new Array(filterOrder).fill(0)
    }
    
    if (stepSize !== undefined) {
      this.stepSize = stepSize
      this.initialStepSize = stepSize
    }
    
    if (movementThreshold !== undefined) {
      this.movementThreshold = movementThreshold
    }
  }
}

/**
 * Normalized LMS (NLMS) Filter - More stable variant
 * 
 * Normalizes step size by input power to improve convergence
 */
export class NormalizedLMSFilter extends AdaptiveLMSFilter {
  constructor(filterOrder = 15, stepSize = 0.5) {
    super(filterOrder, stepSize)
    this.epsilon = 1e-6 // Small constant to avoid division by zero
  }
  
  filter(ecgSample, accMagnitude) {
    this.sampleCount++
    this.detectMotion(accMagnitude)
    
    // Shift buffer
    this.accBuffer.shift()
    this.accBuffer.push(accMagnitude)
    
    // Calculate estimated noise
    let estimatedNoise = 0
    for (let i = 0; i < this.filterOrder; i++) {
      estimatedNoise += this.weights[i] * this.accBuffer[i]
    }
    
    // Calculate error
    const error = ecgSample - estimatedNoise
    
    // Calculate input power (normalization factor)
    let inputPower = 0
    for (let i = 0; i < this.filterOrder; i++) {
      inputPower += this.accBuffer[i] ** 2
    }
    inputPower += this.epsilon
    
    // Update weights with normalized step size
    const normalizedStepSize = this.getAdaptiveStepSize() / inputPower
    for (let i = 0; i < this.filterOrder; i++) {
      this.weights[i] += normalizedStepSize * error * this.accBuffer[i]
    }
    
    this.trackError(error)
    
    return error
  }
}
