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
    // Using the shared method from Metric
    return this.calculatePNN50(this.recentRrs)
  }
} 