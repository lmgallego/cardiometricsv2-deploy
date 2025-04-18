<template>
  <div>
    <MetricDisplay 
      label="LF Power (Sympathetic)"
      :value="value"
      :meanValue="meanValue"
      :stdDevValue="stdDevValue"
      :unit="unit"
      :precision="precision"
    />
  </div>
</template>

<script>
import LFPower from '../services/LFPower.js'
import MetricMixin from '../mixins/MetricMixin.js'
import MetricDisplay from './MetricDisplay.vue'

export default {
  components: {
    MetricDisplay
  },
  mixins: [MetricMixin],
  data() {
    return {
      calculatorClass: LFPower
    }
  }
}
</script>

<style scoped>
</style> 