import FrequencyDomain from './FrequencyDomain'

export default class TotalPower extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, options)
  }

  calculate() {
    // Calculate each power band individually
    const vlfPower = this.calculateBandPower(this.recentRrs, 0.003, 0.04);
    const lfPower = this.calculateBandPower(this.recentRrs, 0.04, 0.15);
    const hfPower = this.calculateBandPower(this.recentRrs, 0.15, 0.4);
    
    // Total power should be the sum of VLF, LF, and HF
    return vlfPower + lfPower + hfPower;
  }
} 