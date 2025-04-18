import FrequencyDomain from './FrequencyDomain'

export default class LFHFRatio extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%', // Change to percentage
      precision: 1
    })
  }

  calculate() {
    // Calculate LF power (0.04-0.15 Hz)
    const lfPower = this.calculateBandPower(this.recentRrs, 0.04, 0.15)
    
    // Calculate HF power (0.15-0.4 Hz)
    const hfPower = this.calculateBandPower(this.recentRrs, 0.15, 0.4)
    
    // Calculate stress index using a normalized scale
    // Using formula: 100 * LF / (LF + HF) which gives values between 0-100%
    // This represents sympathetic activity as a percentage of total autonomic activity
    if (lfPower + hfPower <= 0) return 0
    
    return 100 * lfPower / (lfPower + hfPower)
  }
} 