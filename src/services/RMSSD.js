import RRInt from './RRInt'

export default class RMSSD extends RRInt {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: 'ms',
      precision: 2
    })
  }

  calculate() {
    // Using the shared method from Metric
    return this.calculateRMSSD(this.recentRrs)
  }
} 