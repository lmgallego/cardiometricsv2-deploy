<template>
  <div>
    <p v-if=heartRate >Heart Rate: {{ heartRate }} BPM</p>
    <p v-else >No heart rate data available</p>
  </div>
</template>

<script>
import log from '@/log'

export default {
  data() {
    return {
      heartRate: null,
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
        if (newDevice && typeof newDevice.observeHeartRate === 'function') {
          try {
            this.subscription = newDevice.observeHeartRate().subscribe({
              next: (hr) => {
                this.heartRate = hr
              },
              error: (err) => {
                log.debug('HeartRateMonitor: Error in heart rate subscription:', err)
              }
            })
          } catch (err) {
            log.debug('HeartRateMonitor: Error subscribing to heart rate:', err)
          }
        } else {
          this.heartRate = null
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

