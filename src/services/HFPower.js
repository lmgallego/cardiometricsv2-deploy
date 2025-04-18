import FrequencyDomain from './FrequencyDomain'

export default class HFPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // HF power (0.15-0.4 Hz) - related to parasympathetic activity
    // Apply normalization factor to align with typical range of 975±203 ms²
    return this.calculateBandPower(this.recentRrs, 0.15, 0.4, 9);
  }
} 