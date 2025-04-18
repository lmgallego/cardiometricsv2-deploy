<template>
  <div class="bg-white rounded-xl shadow-md p-4">
    <!-- Header with title and main health status -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Health Status</h2>
      <div class="text-right">
        <div :class="healthColorClass" class="text-2xl font-bold">
          {{ healthValue }}%
        </div>
        <div class="text-sm">{{ vulnerabilityLabel }}</div>
      </div>
    </div>

    <!-- Main insights based on health status -->
    <div class="mb-4 p-3 rounded-lg" :class="insightBackgroundClass">
      <p class="text-sm">{{ healthInsight }}</p>
      <div class="mt-2 text-xs">
        Measurement accuracy is <span class="text-green-500 font-semibold">{{ measurementAccuracy }}%</span>
      </div>
    </div>

    <!-- Health component scores -->
    <div class="mb-4">
      <h3 class="text-lg font-semibold mb-2">Health Components</h3>
      
      <!-- Immunity score -->
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <div class="text-sm font-medium">Immunity</div>
          <div class="text-sm font-bold" :class="getMetricColor(immunityValue)">{{ immunityValue }}%</div>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: `${immunityValue}%` }" :class="getMetricBarColor(immunityValue)"></div>
        </div>
      </div>
      
      <!-- Recovery score -->
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <div class="text-sm font-medium">Recovery</div>
          <div class="text-sm font-bold" :class="getMetricColor(recoveryValue)">{{ recoveryValue }}%</div>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: `${recoveryValue}%` }" :class="getMetricBarColor(recoveryValue)"></div>
        </div>
      </div>
      
      <!-- Autonomic balance score -->
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <div class="text-sm font-medium">Autonomic Balance</div>
          <div class="text-sm font-bold" :class="getMetricColor(balanceValue)">{{ balanceValue }}%</div>
        </div>
        <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: `${balanceValue}%` }" :class="getMetricBarColor(balanceValue)"></div>
        </div>
      </div>
    </div>

    <!-- Contributing factors section -->
    <div class="pt-3 border-t border-gray-200">
      <h3 class="text-sm font-semibold mb-2">Contributing Factors</h3>
      
      <div class="grid grid-cols-2 gap-4">
        <!-- Stress level -->
        <div class="text-center border border-gray-100 rounded-lg p-2">
          <div class="text-xs text-gray-600">Stress Level</div>
          <div class="font-bold" :class="getInverseMetricColor(stressValue)">{{ stressValue }}%</div>
        </div>
        
        <!-- Energy level -->
        <div class="text-center border border-gray-100 rounded-lg p-2">
          <div class="text-xs text-gray-600">Energy Level</div>
          <div class="font-bold" :class="getMetricColor(energyValue)">{{ energyValue }}%</div>
        </div>
      </div>
      
      <!-- Heart rate variability metrics -->
      <div class="grid grid-cols-4 gap-2 mt-2">
        <div class="text-center">
          <div class="text-xs text-gray-600">SDNN</div>
          <div class="font-bold">{{ sdnnValue }}ms</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-600">RMSSD</div>
          <div class="font-bold">{{ rmssdValue }}ms</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-600">LF/HF</div>
          <div class="font-bold">{{ lfhfValue }}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-600">Heart Rate</div>
          <div class="font-bold">{{ heartRate }}bpm</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import HealthIndex from '../services/HealthIndex'
import MetricMixin from '../mixins/MetricMixin'

export default {
  name: 'HealthDisplay',
  
  mixins: [MetricMixin],
  
  data() {
    return {
      healthValue: 100,
      vulnerabilityLevel: 0,
      vulnerabilityLabel: 'Optimal Health',
      
      // Component metrics
      immunityValue: 0,
      recoveryValue: 0,
      balanceValue: 0,
      
      // Contributing metrics
      stressValue: 0,
      energyValue: 0,
      
      // HRV metrics
      sdnnValue: 0,
      rmssdValue: 0,
      lfhfValue: 0,
      heartRate: 0,
      
      // Measurement info
      measurementAccuracy: 100,
      
      // Set the calculator class
      calculatorClass: HealthIndex
    }
  },
  
  computed: {
    healthColorClass() {
      // Define classes based on health/vulnerability levels
      switch (this.vulnerabilityLevel) {
        case 0: return 'text-green-500'  // Optimal
        case 1: return 'text-green-400'  // Slight vulnerability
        case 2: return 'text-yellow-500' // Moderate vulnerability
        case 3: return 'text-orange-500' // High vulnerability
        case 4: return 'text-red-500'    // Severe vulnerability
        default: return 'text-green-500'
      }
    },
    
    insightBackgroundClass() {
      // Background color for the insights box
      switch (this.vulnerabilityLevel) {
        case 0: return 'bg-green-50'
        case 1: return 'bg-green-50'
        case 2: return 'bg-yellow-50'
        case 3: return 'bg-orange-50'
        case 4: return 'bg-red-50'
        default: return 'bg-gray-50'
      }
    },
    
    healthInsight() {
      // Personalized health insights based on vulnerability level
      switch (this.vulnerabilityLevel) {
        case 0:
          return "You aren't under much pressure and could use time to reboot, even if you're feeling ok. If you stick with a chill flow and don't try to overdo it, you'll shine today."
        case 1:
          return "Your body's systems are running smoothly with slight strain. It's a good day for moderate activity and self-care to maintain your health."
        case 2:
          return "You're showing signs of moderate health vulnerability. Consider taking it easier today and focus on recovery activities."
        case 3:
          return "Your body is under significant strain. Prioritize rest and recovery, and consider reducing stressors until your health improves."
        case 4:
          return "Your health metrics indicate you need immediate rest. Avoid strenuous activities and focus on sleep, hydration and recovery."
        default:
          return "Your body's systems are super resilient and running smoothly. All is well."
      }
    }
  },
  
  methods: {
    updateMetrics(calculator) {
      // Get the main health value
      this.value = calculator.value || 0
      this.healthValue = Math.round(this.value)
      
      // Get vulnerability level and label
      this.vulnerabilityLevel = calculator.getVulnerabilityLevel()
      this.vulnerabilityLabel = calculator.getVulnerabilityLabel()
      
      // Get detailed metrics from the calculator's history
      if (calculator.metricHistory) {
        const history = calculator.metricHistory
        
        // Get component values
        this.immunityValue = this.getLatestMetric(history.immunity, 0)
        this.recoveryValue = this.getLatestMetric(history.recovery, 0)
        this.balanceValue = this.getLatestMetric(history.balance, 0)
        
        // Get contributing factors
        this.stressValue = this.getLatestMetric(history.stressLevel, 0)
        this.energyValue = this.getLatestMetric(history.energyLevel, 0)
      }
      
      // Get HRV metrics directly from calculator
      if (calculator.recentRrs && calculator.recentRrs.length > 0) {
        this.sdnnValue = Math.round(calculator.sdnnCalculator.calculateStdDev(calculator.recentRrs))
        this.rmssdValue = Math.round(calculator.rmssdCalculator.calculateRMSSD(calculator.recentRrs))
        
        // Calculate LF/HF ratio
        const lfPower = calculator.calculateBandPower(calculator.recentRrs, 0.04, 0.15)
        const hfPower = calculator.calculateBandPower(calculator.recentRrs, 0.15, 0.4)
        this.lfhfValue = (lfPower && hfPower) ? parseFloat((lfPower / hfPower).toFixed(2)) : 1
        
        // Calculate heart rate
        this.calculateHeartRate(calculator.recentRrs)
      }
      
      // Set measurement accuracy (could be based on data quality or device reliability)
      this.measurementAccuracy = 100
    },
    
    getLatestMetric(metricArray, defaultValue) {
      return (metricArray && metricArray.length > 0) ? 
        Math.round(metricArray[metricArray.length - 1]) : 
        defaultValue
    },
    
    calculateHeartRate(intervals) {
      if (!intervals || intervals.length === 0) {
        this.heartRate = 0
        return
      }
      
      // Calculate average RR interval in milliseconds
      const avgRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length
      
      // Convert to heart rate: HR = 60,000 / RR (in ms)
      this.heartRate = Math.round(60000 / avgRR)
    },
    
    getMetricColor(value) {
      // Color classes for metrics (higher is better)
      if (value >= 80) return 'text-green-500'
      if (value >= 60) return 'text-green-400'
      if (value >= 40) return 'text-yellow-500'
      if (value >= 20) return 'text-orange-500'
      return 'text-red-500'
    },
    
    getInverseMetricColor(value) {
      // Color classes for metrics where lower is better (e.g., stress)
      if (value <= 20) return 'text-green-500'
      if (value <= 40) return 'text-green-400'
      if (value <= 60) return 'text-yellow-500'
      if (value <= 80) return 'text-orange-500'
      return 'text-red-500'
    },
    
    getMetricBarColor(value) {
      // Bar color classes
      if (value >= 80) return 'bg-green-500'
      if (value >= 60) return 'bg-green-400'
      if (value >= 40) return 'bg-yellow-500'
      if (value >= 20) return 'bg-orange-500'
      return 'bg-red-500'
    }
  }
}
</script> 