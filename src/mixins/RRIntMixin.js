import { opts } from '../services/store'
import log from '@/log'
import SubscriptionMixin from './SubscriptionMixin'

export default {
  mixins: [SubscriptionMixin],
  
  data() {
    return {
      opts: opts,
      value: 0,
      calculator: null,
      unit: '',
      precision: 2
    }
  },
  
  props: ['device'],
  
  watch: {
    device: {
      immediate: true,
      handler(newDevice, oldDevice) {
        // Clean up old device resources
        if (oldDevice) {
          this.cleanupDevice(oldDevice)
        }
        
        // Set up new device
        this.setupDevice(newDevice)
      },
    },
  },
  
  methods: {
    setupDevice(device) {
      // Skip if no device or no calculator class defined
      if (!device || !this.calculatorClass) {
        return
      }
      
      try {
        log.debug(`RRIntMixin: Setting up ${this.calculatorClass.name} with device`)
        
        // Create calculator with current device
        this.calculator = new this.calculatorClass(device, this.opts)
        this.unit = this.calculator.unit
        this.precision = this.calculator.precision
        
        // Subscribe to metric updates using safeSubscribe from SubscriptionMixin
        this.safeSubscribe(
          // Unique key for this subscription
          `calculator-${this.calculatorClass.name}`,
          
          // The observable
          this.calculator.subscribe(),
          
          // Next handler - receives metric updates
          (metric) => {
            this.value = metric
            
            // Call addMetricValue if the component uses MetricHistoryMixin
            if (typeof this.addMetricValue === 'function') {
              this.addMetricValue(metric)
            }
            
            // Call custom update method if the component defines it
            if (typeof this.updateMetrics === 'function') {
              this.updateMetrics(this.calculator)
            }
          }
        )
      } catch (error) {
        log.debug('RRIntMixin: Error setting up device:', error)
      }
    },
    
    cleanupDevice(device) {
      // Clean up previous calculator
      this.destroyCalculator()
      
      // All subscriptions are automatically managed by SubscriptionMixin
    },
    
    destroyCalculator() {
      // Safely destroy calculator
      if (this.calculator) {
        try {
          this.calculator.destroy()
        } catch (e) {
          log.debug('RRIntMixin: Error destroying calculator:', e)
        }
        this.calculator = null
      }
    },
  },
  
  // Support for HMR
  beforeCreate() {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        log.debug(`RRIntMixin: HMR triggered in component using ${this.calculatorClass?.name || 'unknown calculator'}`)
      })
    }
  },
  
  beforeDestroy() {
    // Destroy the calculator
    this.destroyCalculator()
    
    // No need to manually unsubscribe here since SubscriptionMixin handles it
  },
  
  created() {
    if (!this.calculatorClass) {
      console.error('RRIntMixin requires "calculatorClass" to be defined in the component.')
    }
  },
} 