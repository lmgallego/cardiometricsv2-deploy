import FrequencyDomain from './FrequencyDomain'

export default class HFPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // HF power (0.15-0.4 Hz) - related to parasympathetic activity
    // Normalization factor adjusted to match Welltory app reference values (around 188ms²)
    return this.calculateBandPower(this.recentRrs, 0.15, 0.4, 0.87);
  }
} 