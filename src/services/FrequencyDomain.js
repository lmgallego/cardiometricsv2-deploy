import RRInt from './RRInt'

/**
 * Base class for frequency domain HRV metrics
 * Provides shared functionality for LF power, HF power and LF/HF ratio calculations
 */
export default class FrequencyDomain extends RRInt {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: options.unit || 'ms²',
      precision: 2
    })
  }

  /**
   * Calculate power in a specific frequency band
   * @param {Array} rrSeries - Array of RR intervals
   * @param {Number} minFreq - Lower frequency bound
   * @param {Number} maxFreq - Upper frequency bound
   * @returns {Number} - Power in specified band (ms²)
   */
  calculateBandPower(rrSeries, minFreq, maxFreq) {
    // Use the most recent intervals up to the configured number (or all available if fewer)
    // We need at least 5 intervals for a meaningful analysis
    const minIntervals = 5;
    
    // Check if we have the minimum required intervals
    if (!rrSeries || rrSeries.length < minIntervals) {
      return 0;
    }
    
    // Use only the most recent RR intervals
    // This ensures we respect the opts.rrIntervals configured in the application
    // rrSeries should already be properly limited by the RRInt base class
    const rr = rrSeries.slice();
    
    // Calculate variance of RR intervals
    const meanRR = rr.reduce((sum, val) => sum + val, 0) / rr.length;
    const variance = rr.reduce((sum, val) => sum + Math.pow(val - meanRR, 2), 0) / rr.length;
    
    // Scaling factor: adjust power based on number of intervals
    // This helps to normalize results regardless of recording length
    // For short recordings (<30 intervals), we apply a slight damping factor
    const scaleFactorByCount = rr.length < 30 ? 0.8 + (rr.length / 150) : 1.0;
    
    // Estimate total power (approximation based on variance of the time series)
    const totalPower = variance * scaleFactorByCount;
    
    // Using a simplistic model where power is distributed across frequency bands
    // based on typical physiological distributions:
    // - VLF: ~15-25% of total power
    // - LF: ~20-40% of total power  
    // - HF: ~10-30% of total power
    
    if (minFreq >= 0.003 && minFreq < 0.04 && maxFreq <= 0.04) {
      // VLF band (0.003-0.04 Hz)
      return totalPower * 0.25; // ~25% of total power
    } else if (minFreq >= 0.04 && minFreq < 0.15 && maxFreq <= 0.15) {
      // LF band (0.04-0.15 Hz)
      return totalPower * 0.35; // ~35% of total power
    } else if (minFreq >= 0.15 && minFreq < 0.4 && maxFreq <= 0.4) {
      // HF band (0.15-0.4 Hz)
      return totalPower * 0.25; // ~25% of total power
    } else if (minFreq <= 0.003 && maxFreq >= 0.4) {
      // Total power (all bands)
      return totalPower; 
    } else {
      // For other custom frequency bands, use a simple proportion
      // based on the width of the band relative to the total spectrum (0.003-0.4 Hz)
      const totalBandwidth = 0.4 - 0.003;
      const requestedBandwidth = Math.min(maxFreq, 0.4) - Math.max(minFreq, 0.003);
      const proportion = requestedBandwidth / totalBandwidth;
      return totalPower * proportion;
    }
  }

  /**
   * Calculate the mean of an RR interval series
   * @param {Array} rrSeries - Array of RR intervals
   * @returns {Number} - Mean value
   */
  calculateMean(rrSeries) {
    if (!rrSeries || rrSeries.length === 0) {
      return 0;
    }
    return rrSeries.reduce((sum, val) => sum + val, 0) / rrSeries.length;
  }

  /**
   * Calculate the standard deviation of RR intervals (SDNN)
   * @param {Array} rrSeries - Array of RR intervals
   * @returns {Number} - Standard deviation
   */
  calculateStdDev(rrSeries) {
    if (!rrSeries || rrSeries.length < 2) {
      return 0;
    }
    
    const mean = this.calculateMean(rrSeries);
    const variance = rrSeries.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrSeries.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate the root mean square of successive differences (RMSSD)
   * @param {Array} rrSeries - Array of RR intervals
   * @returns {Number} - RMSSD value
   */
  calculateRMSSD(rrSeries) {
    if (!rrSeries || rrSeries.length < 2) {
      return 0;
    }
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < rrSeries.length; i++) {
      const diff = rrSeries[i] - rrSeries[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (rrSeries.length - 1));
  }

  // Override in child classes
  calculate() {
    throw new Error('calculate() must be implemented by subclass')
  }
} 