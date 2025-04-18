<template>
  <div class="energy-display">
    <div class="energy-header">
      <h2>Energy Level</h2>
      <div class="energy-value" :class="energyLevelClass">
        {{ energyValue }}%
        <div class="energy-label">{{ energyLevelLabel }}</div>
      </div>
    </div>

    <!-- Optional: Display contributing raw metrics -->
    <div class="energy-metrics">
      <div class="metric">
        <div class="metric-label">PSNS Score</div>
        <div class="metric-value">{{ psnsValue }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">SDNN</div>
        <div class="metric-value">{{ sdnnValue }}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">RMSSD</div>
        <div class="metric-value">{{ rmssdValue }}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Power</div>
        <div class="metric-value">{{ totalPowerValue }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import EnergyIndex from '../services/EnergyIndex' // Import the new EnergyIndex service
import MetricMixin from '../mixins/MetricMixin'

export default {
  name: 'EnergyDisplay',

  mixins: [MetricMixin],

  data() {
    return {
      energyValue: 0,
      // Store contributing metrics if needed for display
      psnsValue: 0,
      sdnnValue: 0,
      rmssdValue: 0,
      totalPowerValue: 0,
      calculatorClass: EnergyIndex // Use the EnergyIndex calculator
    }
  },

  computed: {
    energyLevelClass() {
      // Define classes based on energy levels (adjust thresholds as needed)
      if (this.energyValue < 35) return 'low-energy'
      if (this.energyValue < 70) return 'medium-energy'
      return 'high-energy'
    },

    energyLevelLabel() {
      // Define labels based on energy levels
      if (this.energyValue < 35) return 'Low'
      if (this.energyValue < 70) return 'Medium'
      return 'High'
    }
  },

  methods: {
    updateMetrics(calculator) {
      // Get the main energy value
      this.value = calculator.value || 0;
      this.energyValue = Math.round(this.value);

      // Get detailed metrics from the calculator's history if available
      if (calculator.metricHistory) {
        const history = calculator.metricHistory;
        this.psnsValue = history.psns && history.psns.length > 0 ?
          Math.round(history.psns[history.psns.length - 1]) : 0;
        this.sdnnValue = history.sdnn && history.sdnn.length > 0 ?
          Math.round(history.sdnn[history.sdnn.length - 1]) : 0;
        this.rmssdValue = history.rmssd && history.rmssd.length > 0 ?
          Math.round(history.rmssd[history.rmssd.length - 1]) : 0;
        this.totalPowerValue = history.totalPower && history.totalPower.length > 0 ?
          Math.round(history.totalPower[history.totalPower.length - 1]) : 0;

        // Note: You might want to add more sophisticated ways to get these values
        // if the history might be empty or calculation hasn't run yet.
      }
    }
  }
}
</script>

<style scoped>
.energy-display {
  padding: 15px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.energy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px; /* Increased margin */
}

.energy-value {
  font-size: 28px;
  font-weight: bold;
  text-align: right;
}

.energy-label {
  font-size: 14px;
  font-weight: normal;
}

/* Define colors for energy levels */
.low-energy {
  color: #f44336; /* Red for low energy */
}

.medium-energy {
  color: #ff9800; /* Orange for medium energy */
}

.high-energy {
  color: #4caf50; /* Green for high energy */
}

.energy-metrics {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.metric {
  text-align: center;
}

.metric-label {
  font-size: 12px;
  color: #666;
}

.metric-value {
  font-weight: bold;
  margin-top: 5px;
}
</style> 