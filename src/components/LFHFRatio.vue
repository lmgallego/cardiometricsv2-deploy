<template>
  <div>
    <MetricDisplay 
      label="Stress Index (Sympathetic Balance %)"
      :value="value"
      :meanValue="meanValue"
      :stdDevValue="stdDevValue"
      :unit="unit"
      :precision="precision"
    />
  </div>
</template>

<script>
import LFHFRatio from '../services/LFHFRatio.js'
import MetricMixin from '../mixins/MetricMixin.js'
import MetricDisplay from './MetricDisplay.vue'

export default {
  components: {
    MetricDisplay
  },
  mixins: [MetricMixin],
  data() {
    return {
      calculatorClass: LFHFRatio
    }
  }
}
</script>

<style scoped>
</style> 