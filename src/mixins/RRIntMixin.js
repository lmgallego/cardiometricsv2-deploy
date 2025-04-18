import { opts } from '../services/store'

export default {
  data() {
    return {
      opts: opts,
      value: 0,
      calculator: null,
      subscription: null,
      unit: '',
      precision: 2
    }
  },
  props: ['device'],
  watch: {
    device: {
      immediate: true,
      handler(newDevice) {
        this.reset()
        if (newDevice && this.calculatorClass) {
          this.calculator = new this.calculatorClass(newDevice, this.opts)
          this.unit = this.calculator.unit
          this.precision = this.calculator.precision
          this.subscription = this.calculator.subscribe().subscribe(metric => {
            this.value = metric
            this.addMetricValue(metric) // for MetricHistoryMixin
          })
        }
      },
    },
  },
  methods: {
    reset() {
      if (this.calculator) {
        this.calculator.destroy()
        this.calculator = null
      }
      if (this.subscription) {
        this.subscription.unsubscribe()
        this.subscription = null
      }
    },
  },
  beforeDestroy() {
    this.reset()
  },
  created() {
    if (!this.calculatorClass) {
      console.error('RRIntMixin requires "calculatorClass" to be defined in the component.')
    }
  },
} 