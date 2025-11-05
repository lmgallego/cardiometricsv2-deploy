import RRInt from './RRInt'

export default class PNN50 extends RRInt {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%',
      precision: 2
    })
  }

  calculate() {
    // Use the calculateMetric method to simplify implementation
    const result = this.calculateMetric(this.calculatePNN50, this.recentRrs);
    
    // Debug logging
    if (this.recentRrs.length > 10 && result === 0) {
      const diffs = this.calculateDifferences(this.recentRrs, true);
      const over50 = diffs.filter(d => d > 50).length;
      console.log(`pNN50 Debug: samples=${this.recentRrs.length}, diffs=${diffs.length}, over50ms=${over50}, result=${result}`);
      console.log(`Sample RR intervals:`, this.recentRrs.slice(0, 10));
      console.log(`Sample differences:`, diffs.slice(0, 10));
    }
    
    return result;
  }
} 