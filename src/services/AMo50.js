import RRInt from './RRInt'

export default class AMo50 extends RRInt {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%',
      precision: 2
    })
  }

  calculate() {
    const recentRrs = this.recentRrs

    if (recentRrs.length === 0) {
      return 0
    }

    const meanRR = this.calculateMean(recentRrs)
    const count = recentRrs.filter(rri => Math.abs(rri - meanRR) > 50).length

    return (count / recentRrs.length) * 100
  }
} 