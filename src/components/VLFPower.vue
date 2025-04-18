<template>
  <div>
    <MetricDisplay 
      label="VLF Power (Long-term Regulation)"
      :value="value"
      :meanValue="meanValue"
      :stdDevValue="stdDevValue"
      :unit="unit"
      :precision="precision"
    />
  </div>
</template>

<script>
import VLFPower from '../services/VLFPower.js'
import MetricMixin from '../mixins/MetricMixin.js'
import MetricDisplay from './MetricDisplay.vue'

export default {
  components: {
    MetricDisplay
  },
  mixins: [MetricMixin],
  data() {
    return {
      calculatorClass: VLFPower
    }
  }
}
</script>

<style scoped>
</style> 