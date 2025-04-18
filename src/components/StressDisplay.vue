<template>
  <div class="stress-display">
    <div class="stress-header">
      <h2>Stress Index</h2>
      <div class="stress-value" :class="stressLevelClass">
        {{ stressValue }}%
        <div class="stress-label">{{ stressLevelLabel }}</div>
      </div>
    </div>
    
    <div class="nervous-system-balance">
      <h3>Nervous System Balance</h3>
      <div class="balance-indicators">
        <div class="indicator">
          <div class="indicator-label">SNS</div>
          <div class="indicator-bar-container">
            <div class="indicator-bar sns-bar" :style="{ width: `${snsPercentage}%` }"></div>
          </div>
          <div class="indicator-value">{{ snsValue }}</div>
        </div>
        
        <div class="indicator">
          <div class="indicator-label">PSNS</div>
          <div class="indicator-bar-container">
            <div class="indicator-bar psns-bar" :style="{ width: `${psnsPercentage}%` }"></div>
          </div>
          <div class="indicator-value">{{ psnsValue }}</div>
        </div>
      </div>
      
      <div class="balance-description">
        <div v-if="isBalanced" class="balanced">Your nervous system is balanced</div>
        <div v-else-if="isSnsDominant" class="sns-dominant">Sympathetic dominance (fight-or-flight)</div>
        <div v-else class="psns-dominant">Parasympathetic dominance (rest-and-digest)</div>
      </div>
    </div>
    
    <div class="stress-metrics">
      <div class="metric">
        <div class="metric-label">LF/HF Ratio</div>
        <div class="metric-value">{{ lfhfRatio }}</div>
      </div>
      <div class="metric">
        <div class="metric-label">SDNN</div>
        <div class="metric-value">{{ sdnnValue }}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">RMSSD</div>
        <div class="metric-value">{{ rmssdValue }}ms</div>
      </div>
    </div>
  </div>
</template>

<script>
import StressIndex from '../services/StressIndex'
import MetricMixin from '../mixins/MetricMixin'

export default {
  name: 'StressDisplay',
  
  mixins: [MetricMixin],
  
  data() {
    return {
      stressValue: 0,
      snsValue: 0,
      psnsValue: 0,
      lfhfRatio: 0,
      sdnnValue: 0,
      rmssdValue: 0,
      calculatorClass: StressIndex
    }
  },
  
  computed: {
    stressLevelClass() {
      if (this.stressValue < 30) return 'low-stress'
      if (this.stressValue < 60) return 'moderate-stress'
      return 'high-stress'
    },
    
    stressLevelLabel() {
      if (this.stressValue < 30) return 'Low'
      if (this.stressValue < 60) return 'Moderate'
      return 'High'
    },
    
    snsPercentage() {
      // Scale to fit in UI (max 100%)
      return Math.min(this.snsValue, 100)
    },
    
    psnsPercentage() {
      // Scale to fit in UI (max 100%)
      return Math.min(this.psnsValue, 100)
    },
    
    isBalanced() {
      const diff = Math.abs(this.snsValue - this.psnsValue)
      return diff < 15
    },
    
    isSnsDominant() {
      return this.snsValue > this.psnsValue + 15
    }
  },
  
  methods: {
    updateMetrics(calculator) {
      // Get the main stress value
      this.value = calculator.value || 0;
      this.stressValue = Math.round(this.value);
      
      // Get the detailed metrics
      if (calculator.metricHistory) {
        // Access the raw metrics from the calculator
        const recentRrs = calculator.recentRrs;
        if (recentRrs && recentRrs.length > 5) {
          // Calculate SNS and PSNS values
          const lfPower = calculator.calculateBandPower(recentRrs, 0.04, 0.15);
          const hfPower = calculator.calculateBandPower(recentRrs, 0.15, 0.4);
          const totalPower = calculator.calculateBandPower(recentRrs, 0.003, 0.4);
          
          // Time domain metrics
          this.sdnnValue = Math.round(calculator.calculateStdDev(recentRrs));
          this.rmssdValue = Math.round(calculator.calculateRMSSD(recentRrs));
          
          // LF/HF ratio
          this.lfhfRatio = (lfPower && hfPower) ? 
            parseFloat((lfPower / hfPower).toFixed(2)) : 1;
          
          // Get normalized metrics
          const normalizedLFHF = calculator.normalizeLFHF(this.lfhfRatio);
          const normalizedSDNN = calculator.normalizeSDNN(this.sdnnValue);
          const normalizedRMSSD = calculator.normalizeRMSSD(this.rmssdValue);
          const normalizedTotalPower = calculator.normalizeTotalPower(totalPower);
          
          // Calculate SNS and PSNS values (0-100)
          this.snsValue = Math.round(calculator.calculateSNS(
            normalizedLFHF, normalizedSDNN, normalizedRMSSD
          ));
          
          this.psnsValue = Math.round(calculator.calculatePSNS(
            normalizedLFHF, normalizedSDNN, normalizedRMSSD, normalizedTotalPower
          ));
        }
      }
    }
  }
}
</script>

<style scoped>
.stress-display {
  padding: 15px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.stress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.stress-value {
  font-size: 28px;
  font-weight: bold;
  text-align: right;
}

.stress-label {
  font-size: 14px;
  font-weight: normal;
}

.low-stress {
  color: #4caf50;
}

.moderate-stress {
  color: #ff9800;
}

.high-stress {
  color: #f44336;
}

.nervous-system-balance {
  margin-bottom: 20px;
}

.balance-indicators {
  margin-top: 10px;
}

.indicator {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.indicator-label {
  width: 40px;
  font-weight: bold;
}

.indicator-bar-container {
  flex-grow: 1;
  height: 12px;
  background-color: #f0f0f0;
  border-radius: 6px;
  margin: 0 10px;
  overflow: hidden;
}

.indicator-bar {
  height: 100%;
  border-radius: 6px;
}

.sns-bar {
  background-color: #ff5722;
}

.psns-bar {
  background-color: #2196f3;
}

.indicator-value {
  width: 30px;
  text-align: right;
  font-weight: bold;
}

.balance-description {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
  background-color: #f5f5f5;
  text-align: center;
}

.balanced {
  color: #4caf50;
}

.sns-dominant {
  color: #ff5722;
}

.psns-dominant {
  color: #2196f3;
}

.stress-metrics {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
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