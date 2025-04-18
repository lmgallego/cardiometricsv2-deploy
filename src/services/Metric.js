import { Subject } from 'rxjs'
import { mean, std, sqrt } from 'mathjs'

/**
 * Base class for all metrics.
 * Provides common functionality for calculating and emitting metrics.
 */
export default class Metric {
  constructor(device, options = {}) {
    this.device = device
    this.options = options
    this.valueSubject = new Subject()
    this.subscription = null
    this.unit = options.unit || 'ms'
    this.precision = options.precision || 2
    this.isSubscribed = false
    this.data = []
    this.maxSamples = options.maxSamples || 1000
    this.pulsesNumber = options.rrIntervals || 100
  }

  /**
   * Initialize and return subscription to metric values.
   */
  subscribe() {
    // Only set up subscription once
    if (!this.isSubscribed && this.device && typeof this.setupSubscription === 'function') {
      this.setupSubscription()
      this.isSubscribed = true
    } else if (!this.device || typeof this.setupSubscription !== 'function') {
      console.error('Device is not available or setupSubscription method not implemented')
    }
    return this.valueSubject
  }

  /**
   * Clean up subscription.
   */
  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
      this.isSubscribed = false
    }
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.unsubscribe()
    this.valueSubject.complete()
  }

  /**
   * Add data sample to the collection.
   */
  addSample(sample) {
    this.data.push(sample)
    if (this.data.length > this.maxSamples) {
      this.data.shift()
    }
  }

  /**
   * Get recent samples based on pulsesNumber.
   */
  get recentSamples() {
    const n = Math.min(this.pulsesNumber, this.data.length)
    return this.data.slice(-n)
  }

  /**
   * Calculate mean of samples.
   */
  calculateMean(samples = this.recentSamples) {
    if (samples.length === 0) return 0
    return mean(samples)
  }

  /**
   * Calculate standard deviation of samples.
   */
  calculateStdDev(samples = this.recentSamples) {
    // Need at least 2 samples for a meaningful standard deviation
    if (samples.length < 2) return 0
    
    // Use the uncorrected sample standard deviation formula (n divisor instead of n-1)
    // This gives a better estimate for HRV metrics like SDNN
    return std(samples, 'uncorrected')
  }

  /**
   * Calculate differences between consecutive samples.
   */
  calculateDifferences(samples = this.recentSamples, absolute = false) {
    if (samples.length < 2) return []
    return samples.slice(1).map((val, i) => {
      const diff = val - samples[i]
      return absolute ? Math.abs(diff) : diff
    })
  }

  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences).
   */
  calculateRMSSD(samples = this.recentSamples) {
    const diffs = this.calculateDifferences(samples)
    if (diffs.length === 0) return 0
    const squaredDiffs = diffs.map(d => d * d)
    return sqrt(mean(squaredDiffs))
  }

  /**
   * Calculate pNN50 (percentage of successive RR intervals that differ by more than 50ms).
   */
  calculatePNN50(samples = this.recentSamples) {
    const diffs = this.calculateDifferences(samples, true)
    if (diffs.length === 0) return 0
    const count = diffs.filter(d => d > 50).length
    return (count / diffs.length) * 100
  }

  /**
   * Calculate CV (coefficient of variation).
   */
  calculateCV(samples = this.recentSamples) {
    if (samples.length < 2) return 0
    const meanVal = this.calculateMean(samples)
    if (meanVal === 0) return 0
    const stdDev = this.calculateStdDev(samples)
    return (stdDev / meanVal) * 100
  }

  // Override in child classes
  setupSubscription() {
    console.warn('setupSubscription method must be implemented in child class')
  }

  // Override in child classes
  calculate() {
    console.warn('calculate method must be implemented in child class')
    return 0
  }

  // For backward compatibility
  getMetricObservable() {
    // Initialize subscription if it doesn't exist
    if (!this.subscription) {
      this.subscribe()
    }
    return this.valueSubject
  }
} 