<template>
  <div>
    <MetricDisplay 
      label="HF Power (Parasympathetic)"
      :value="value"
      :meanValue="meanValue"
      :stdDevValue="stdDevValue"
      :unit="unit"
      :precision="precision"
    />
  </div>
</template>

<script>
import HFPower from '../services/HFPower.js'
import MetricMixin from '../mixins/MetricMixin.js'
import MetricDisplay from './MetricDisplay.vue'

export default {
  components: {
    MetricDisplay
  },
  mixins: [MetricMixin],
  data() {
    return {
      calculatorClass: HFPower
    }
  }
}
</script>

<style scoped>
</style> 