import RRInt from './RRInt'

export default class SDNN extends RRInt {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: 'ms',
      precision: 2
    })
  }

  calculate() {
    // Using the shared method from Metric
    return this.calculateStdDev(this.recentRrs)
  }
} 