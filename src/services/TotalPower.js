import FrequencyDomain from './FrequencyDomain'

export default class TotalPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // Total power (0.003-0.4 Hz) - reflects overall HRV
    // Apply normalization factor to align with typical range of 153.8-769.6 ms²
    return this.calculateBandPower(this.recentRrs, 0.003, 0.4, 8);
  }
} 