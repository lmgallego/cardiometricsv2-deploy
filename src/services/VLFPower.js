import FrequencyDomain from './FrequencyDomain'

export default class VLFPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // VLF power (0.003-0.04 Hz) - related to long-term regulation mechanisms
    return this.calculateBandPower(this.recentRrs, 0.003, 0.04);
  }
} 