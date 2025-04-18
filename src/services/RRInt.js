import Metric from './Metric'

export default class RRInt extends Metric {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: options.unit || 'ms',
      precision: options.precision || 2
    })
  }

  setupSubscription() {
    if (this.device && this.device.observeRRInterval) {
      this.subscription = this.device
        .observeRRInterval()
        .subscribe((rri) => this.handleRrInterval(rri))
    } else {
      console.error('Device does not support observeRRInterval().')
    }
  }

  handleRrInterval(rri) {
    if (this.validateRrInterval(rri)) {
      this.addSample(rri)
      const value = this.calculate()
      this.valueSubject.next(value)
    }
  }

  validateRrInterval(rri) {
    return rri >= 300 && rri <= 2000
  }

  // Alias for backward compatibility
  get recentRrs() {
    return this.recentSamples
  }

  // Override in child classes
  calculate() {
    throw new Error('calculate() must be implemented by subclass')
    return 0
  }
} 