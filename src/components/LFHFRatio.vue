<template>
  <div>
    <MetricDisplay 
      label="LF/HF Ratio"
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

export default {
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