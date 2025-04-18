import FrequencyDomain from './FrequencyDomain'

export default class LFPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // LF power (0.04-0.15 Hz) - reflecting both sympathetic and parasympathetic activity
    // Apply normalization factor to align with typical range of 1170±416 ms²
    return this.calculateBandPower(this.recentRrs, 0.04, 0.15, 4.5); 
  }
} 