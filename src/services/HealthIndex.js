import FrequencyDomain from './FrequencyDomain'
import SDNN from './SDNN'
import RMSSD from './RMSSD'
import StressIndex from './StressIndex'
import EnergyIndex from './EnergyIndex'

/**
 * Health Index calculator that combines StressIndex and EnergyIndex
 * to determine overall health status.
 * Higher values (closer to 100%) indicate better health.
 */
export default class HealthIndex extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%', // Percentage for health level
      precision: 1
    })

    // Create required calculators
    this.sdnnCalculator = options.sdnnInstance || new SDNN(device, options)
    this.rmssdCalculator = options.rmssdInstance || new RMSSD(device, options)
    this.stressCalculator = options.stressInstance || new StressIndex(device, options)
    this.energyCalculator = options.energyInstance || new EnergyIndex(device, options)

    // Track metric history
    this.metricHistory = {
      health: [],
      stressLevel: [],
      energyLevel: [],
      immunity: [],
      recovery: [],
      balance: [],
      historyMaxSize: 20
    }

    // Current health value
    this.value = 100
  }

  handleRrInterval(rri) {
    // Ensure base class handles RR interval storage
    super.handleRrInterval(rri)

    // Update the RR intervals for child calculators
    this.sdnnCalculator.handleRrInterval(rri)
    this.rmssdCalculator.handleRrInterval(rri)
    this.stressCalculator.handleRrInterval(rri)
    this.energyCalculator.handleRrInterval(rri)

    // Calculate and emit new value if we have enough data
    if (this.recentRrs && this.recentRrs.length >= 5) {
      this.value = this.calculate()
      this.valueSubject.next(this.value)
    }
  }

  calculate() {
    // Need sufficient RR intervals
    if (!this.recentRrs || this.recentRrs.length < 5) {
      return this.getLastHealthValue() || 100 // Default to 100% health if no data
    }

    // Get current stress and energy values
    const stressValue = this.stressCalculator.value || 0
    const energyValue = this.energyCalculator.value || 0

    // Calculate HRV metrics
    const sdnn = this.sdnnCalculator.calculateStdDev(this.recentRrs)
    const rmssd = this.rmssdCalculator.calculateRMSSD(this.recentRrs)

    // Update history for contributing metrics
    this.updateMetricHistory('stressLevel', stressValue)
    this.updateMetricHistory('energyLevel', energyValue)

    // Calculate immune system resilience (higher is better)
    // Based on combination of HRV metrics and energy level
    const immunityScore = this.calculateImmunity(sdnn, rmssd, energyValue)
    this.updateMetricHistory('immunity', immunityScore)

    // Calculate recovery capability (higher is better)
    // Inversely related to stress level, with energy level influence
    const recoveryScore = this.calculateRecovery(stressValue, energyValue)
    this.updateMetricHistory('recovery', recoveryScore)

    // Calculate autonomic balance (higher is better)
    // Optimal when stress is low and energy is high
    const balanceScore = this.calculateBalance(stressValue, energyValue)
    this.updateMetricHistory('balance', balanceScore)

    // Combine components to calculate overall health
    const rawHealth = this.calculateOverallHealth(
      immunityScore,
      recoveryScore,
      balanceScore,
      stressValue,
      energyValue
    )

    // Apply smoothing to prevent jumps in health score
    const smoothedHealth = this.smoothHealth(rawHealth)

    // Store the final health value in history
    this.updateMetricHistory('health', smoothedHealth)

    // Ensure value is within 0-100 range
    return Math.round(Math.min(100, Math.max(0, smoothedHealth)))
  }

  calculateImmunity(sdnn, rmssd, energyValue) {
    // Higher HRV metrics and energy correlate with better immune function
    const sdnnComponent = Math.min(100, (sdnn / 60) * 100) * 0.35
    const rmssdComponent = Math.min(100, (rmssd / 40) * 100) * 0.35
    const energyComponent = energyValue * 0.3
    
    return sdnnComponent + rmssdComponent + energyComponent
  }

  calculateRecovery(stressValue, energyValue) {
    // Recovery is better when stress is low and energy is high
    const stressComponent = Math.max(0, 100 - stressValue) * 0.6
    const energyComponent = energyValue * 0.4
    
    return stressComponent + energyComponent
  }

  calculateBalance(stressValue, energyValue) {
    // Calculate autonomic balance - optimal when stress is low and energy is high
    const stressComponent = Math.max(0, 100 - stressValue) * 0.5
    const energyComponent = energyValue * 0.5
    
    // Bonus for having both values in optimal range
    let balanceBonus = 0
    if (stressValue < 40 && energyValue > 60) {
      balanceBonus = 10
    }
    
    return stressComponent + energyComponent + balanceBonus
  }

  calculateOverallHealth(immunity, recovery, balance, stressValue, energyValue) {
    // Weight the contribution of each component to the overall health score
    const immunityWeight = 0.3
    const recoveryWeight = 0.3
    const balanceWeight = 0.2
    const stressWeight = 0.1 // Inverse contribution (lower stress = higher health)
    const energyWeight = 0.1 // Direct contribution
    
    // Calculate the weighted sum
    return (
      (immunity * immunityWeight) +
      (recovery * recoveryWeight) +
      (balance * balanceWeight) +
      ((100 - stressValue) * stressWeight) +
      (energyValue * energyWeight)
    )
  }

  updateMetricHistory(metric, value) {
    if (!this.metricHistory[metric]) {
      console.warn(`Metric history for "${metric}" does not exist.`)
      return
    }
    
    this.metricHistory[metric].push(value)
    if (this.metricHistory[metric].length > this.metricHistory.historyMaxSize) {
      this.metricHistory[metric].shift()
    }
  }

  smoothHealth(rawValue) {
    // Simple exponential smoothing
    const history = this.metricHistory.health
    if (!history || history.length === 0) {
      return rawValue
    }

    const previous = history[history.length - 1]
    const diff = Math.abs(rawValue - previous)
    
    // Adjust smoothing factor based on difference (faster adaptation for large changes)
    const currentWeight = Math.min(0.5 + (diff / 200), 0.8)
    const historyWeight = 1 - currentWeight

    return (rawValue * currentWeight) + (previous * historyWeight)
  }

  getLastHealthValue() {
    const h = this.metricHistory.health
    return (h && h.length > 0) ? h[h.length - 1] : null
  }

  getVulnerabilityLevel() {
    // Calculate health vulnerability level (0-4)
    // 0 = No vulnerability (100% health)
    // 1 = Low vulnerability (80-99% health)
    // 2 = Moderate vulnerability (60-79% health)
    // 3 = High vulnerability (40-59% health)
    // 4 = Severe vulnerability (<40% health)
    
    const health = this.value
    
    if (health >= 95) return 0
    if (health >= 80) return 1
    if (health >= 60) return 2
    if (health >= 40) return 3
    return 4
  }

  getVulnerabilityLabel() {
    const level = this.getVulnerabilityLevel()
    
    switch (level) {
      case 0: return 'Optimal Health'
      case 1: return 'Slight Vulnerability'
      case 2: return 'Moderate Vulnerability'
      case 3: return 'High Vulnerability'
      case 4: return 'Severe Vulnerability'
      default: return 'Unknown'
    }
  }

  destroy() {
    // Clean up child calculators
    if (this.sdnnCalculator) this.sdnnCalculator.destroy()
    if (this.rmssdCalculator) this.rmssdCalculator.destroy()
    if (this.stressCalculator) this.stressCalculator.destroy()
    if (this.energyCalculator) this.energyCalculator.destroy()
    
    // Call parent's destroy method
    super.destroy()
  }
} 