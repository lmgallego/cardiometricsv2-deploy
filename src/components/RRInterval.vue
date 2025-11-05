<template>
  <div>
    <p v-if=lastRRInterval >R-R Interval: {{ Math.round(lastRRInterval) }}ms </p>
    <p v-else >No R-R Interval available</p>
    
    <div>
      <label for=rrIntervals > Number of R-R Intervals for metrics </label>
      <input type=number name=rrIntervals v-model.number=opts.rrIntervals :min=2 :max=1000 />
    </div>
  </div>
</template>

<script>
import log from '@/log'
import { opts } from '../services/store'

export default {
  data() {
    return {
      lastRRInterval: null,
      opts,
      subscription: null
    }
  },
  props: ['device'],

  watch: {
    device: {
      immediate: true,
      handler(newDevice) {
        // Cleanup previous subscription
        if (this.subscription) {
          this.subscription.unsubscribe()
          this.subscription = null
        }

        // Only subscribe if device exists and has the method
        if (newDevice && typeof newDevice.observeRRInterval === 'function') {
          try {
            this.subscription = newDevice.observeRRInterval().subscribe({
              next: (rri) => {
                this.lastRRInterval = rri
              },
              error: (err) => {
                log.debug('RRInterval: Error in RR interval subscription:', err)
              }
            })
          } catch (err) {
            log.debug('RRInterval: Error subscribing to RR interval:', err)
          }
        } else {
          this.lastRRInterval = null
        }
      }
    }
  },

  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
  },

  methods: {
  }
}
</script>

