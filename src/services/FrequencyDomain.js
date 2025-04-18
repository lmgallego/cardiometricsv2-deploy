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
   * @param {Number} normFactor - Normalization factor to adjust the power to expected ranges
   * @returns {Number} - Power in specified band (ms²)
   */
  calculateBandPower(rrSeries, minFreq, maxFreq, normFactor = 1) {
    if (rrSeries.length < 5) return 0; // Need at least 5 intervals for meaningful analysis
    
    // Calculate mean RR interval for normalization
    const meanRR = rrSeries.reduce((sum, rr) => sum + rr, 0) / rrSeries.length;
    
    // Calculate detrended and normalized time series
    // This centers the signal around zero and removes linear trends
    const normalizedSeries = [];
    for (let i = 0; i < rrSeries.length; i++) {
      normalizedSeries.push((rrSeries[i] - meanRR) / meanRR);
    }
    
    // Calculate autocovariance for spectral estimation
    // This is a simplified implementation of Welch's method
    const maxLag = Math.min(rrSeries.length - 1, 20); // Limit the maximum lag
    const autocovariance = [];
    
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < normalizedSeries.length - lag; i++) {
        sum += normalizedSeries[i] * normalizedSeries[i + lag];
      }
      autocovariance.push(sum / (normalizedSeries.length - lag));
    }
    
    // Apply windowing to reduce spectral leakage (Hamming window)
    for (let i = 0; i < autocovariance.length; i++) {
      const windowCoeff = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / maxLag);
      autocovariance[i] *= windowCoeff;
    }
    
    // Calculate power in the specified frequency band
    // Using Parseval's theorem with the autocovariance function
    let bandPower = 0;
    const freqStep = 1 / (2 * maxLag); // Frequency resolution in Hz
    
    for (let freq = minFreq; freq <= maxFreq; freq += freqStep) {
      let spectrumValue = autocovariance[0]; // DC component
      
      for (let lag = 1; lag < autocovariance.length; lag++) {
        spectrumValue += 2 * autocovariance[lag] * Math.cos(2 * Math.PI * freq * lag * meanRR / 1000);
      }
      
      if (spectrumValue > 0) {
        bandPower += spectrumValue;
      }
    }
    
    // Scale to get power in ms² and apply normalization factor
    // to adjust to expected physiological ranges
    return (bandPower * (meanRR * meanRR)) / normFactor;
  }

  // Override in child classes
  calculate() {
    throw new Error('calculate() must be implemented by subclass')
  }
} 