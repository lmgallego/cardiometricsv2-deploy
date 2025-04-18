import FrequencyDomain from './FrequencyDomain'
import LFPower from './LFPower'
import HFPower from './HFPower'

export default class LFHFRatio extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '',  // No unit for ratio
      precision: 2
    })
    
    // Initialize metric calculators
    this.lfPowerCalculator = new LFPower(device, options)
    this.hfPowerCalculator = new HFPower(device, options)
    
    // Initialize value
    this.value = 0;
  }

  handleRrInterval(rri) {
    // Make sure RRInt's handleRrInterval is called to manage data
    super.handleRrInterval(rri);
    
    // Calculate and emit new value on every RR interval as long as we have enough data
    if (this.recentRrs && this.recentRrs.length >= 5) {
      this.value = this.calculate();
      this.valueSubject.next(this.value);
    }
  }

  calculate() {
    // Check if we have enough data
    if (!this.recentRrs || this.recentRrs.length < 5) {
      return 0;
    }
    
    // Calculate LF power (0.04-0.15 Hz) using the specialized calculator
    const lfPower = this.lfPowerCalculator.calculateBandPower(this.recentRrs, 0.04, 0.15);
    
    // Calculate HF power (0.15-0.4 Hz) using the specialized calculator
    const hfPower = this.hfPowerCalculator.calculateBandPower(this.recentRrs, 0.15, 0.4);
    
    // Calculate the ratio
    if (hfPower <= 0) return 0;
    
    // Return the actual ratio
    return lfPower / hfPower;
  }
  
  // Clean up all resources
  destroy() {
    try {
      super.destroy();
      
      // Clean up calculator instances
      if (this.lfPowerCalculator) this.lfPowerCalculator.destroy();
      if (this.hfPowerCalculator) this.hfPowerCalculator.destroy();
    } catch (e) {
      console.warn('Error destroying LFHFRatio:', e.message);
    }
  }
} 