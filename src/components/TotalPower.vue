<template>
  <div>
    <MetricDisplay 
      label="Total Power (HRV)"
      :value="value"
      :meanValue="meanValue"
      :stdDevValue="stdDevValue"
      :unit="unit"
      :precision="precision"
    />
  </div>
</template>

<script>
import TotalPower from '../services/TotalPower.js'
import MetricMixin from '../mixins/MetricMixin.js'
import MetricDisplay from './MetricDisplay.vue'

export default {
  components: {
    MetricDisplay
  },
  mixins: [MetricMixin],
  data() {
    return {
      calculatorClass: TotalPower
    }
  }
}
</script>

<style scoped>
</style> 