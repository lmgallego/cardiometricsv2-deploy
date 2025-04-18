import FrequencyDomain from './FrequencyDomain'
import SDNN from './SDNN'
import RMSSD from './RMSSD'
import LFPower from './LFPower'
import HFPower from './HFPower'
import TotalPower from './TotalPower'

/**
 * HRV-based "Energy Index" calculator using similar inputs to StressIndex.
 * Higher values indicate more available "energy" or "resources".
 * This is an interpretive metric, not a direct physiological measure.
 */
export default class EnergyIndex extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%', // Percentage for energy level
      precision: 1
    })

    // Use provided calculator instances or create new ones
    this.sdnnCalculator = options.sdnnInstance || new SDNN(device, options)
    this.rmssdCalculator = options.rmssdInstance || new RMSSD(device, options)
    this.lfPowerCalculator = options.lfPowerInstance || new LFPower(device, options)
    this.hfPowerCalculator = options.hfPowerInstance || new HFPower(device, options)
    this.totalPowerCalculator = options.totalPowerInstance || new TotalPower(device, options)

    // Track recent metric history (specific to EnergyIndex interpretation)
    this.metricHistory = {
      energy: [],
      // Reuse other metrics if needed for debugging or display
      lfhf: [],
      sdnn: [],
      rmssd: [],
      totalPower: [],
      psns: [], // Track PSNS specifically if useful
      historyMaxSize: 20
    }

    // Current energy value
    this.value = 0
  }

  handleRrInterval(rri) {
    // Ensure base class handles RR interval storage
    super.handleRrInterval(rri)

    // ALSO update the RR intervals for child calculators
    // (This assumes they also have a handleRrInterval method or similar)
    this.sdnnCalculator.handleRrInterval(rri)
    this.rmssdCalculator.handleRrInterval(rri)
    this.lfPowerCalculator.handleRrInterval(rri)
    this.hfPowerCalculator.handleRrInterval(rri)
    this.totalPowerCalculator.handleRrInterval(rri)

    // Calculate and emit new value if we have enough data
    if (this.recentRrs && this.recentRrs.length >= 5) {
      this.value = this.calculate()
      this.valueSubject.next(this.value)
    }
  }

  calculate() {
    // Need sufficient RR intervals
    if (!this.recentRrs || this.recentRrs.length < 5) {
      return this.getLastEnergyValue() || 0
    }

    // Calculate raw time-domain metrics
    const sdnn = this.sdnnCalculator.calculateStdDev(this.recentRrs)
    const rmssd = this.rmssdCalculator.calculateRMSSD(this.recentRrs)

    // Calculate raw frequency-domain metrics
    const lfPower = this.lfPowerCalculator.calculateBandPower(this.recentRrs, 0.04, 0.15)
    const hfPower = this.hfPowerCalculator.calculateBandPower(this.recentRrs, 0.15, 0.4)
    const totalPower = this.totalPowerCalculator.calculate()

    // Basic LF/HF ratio
    const lfhfRatio = (lfPower && hfPower > 0) ? (lfPower / hfPower) : 1

    // Update history for raw metrics (optional, for display/debug)
    this.updateMetricHistory('lfhf', lfhfRatio)
    this.updateMetricHistory('sdnn', sdnn)
    this.updateMetricHistory('rmssd', rmssd)
    this.updateMetricHistory('totalPower', totalPower)

    // Normalize metrics (0-100 scale) using StressIndex's logic
    // Note: These normalizations originally map higher physiological values (good) to lower stress (good).
    // We might need to invert some if using directly for "energy".
    const normalizedLFHF = this.normalizeLFHF(lfhfRatio) // High LFHF -> High stress -> Low energy
    const normalizedSDNN = this.normalizeSDNN(sdnn)     // High SDNN -> Low stress -> High energy (inverted needed)
    const normalizedRMSSD = this.normalizeRMSSD(rmssd)   // High RMSSD -> Low stress -> High energy (inverted needed)
    const normalizedTotalPower = this.normalizeTotalPower(totalPower) // High TP -> Low stress -> High energy (inverted needed)

    // Calculate PSNS score using the method from StressIndex
    // High PSNS score means high parasympathetic activity (good for energy)
    const psns = this.calculatePSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD, normalizedTotalPower)
    this.updateMetricHistory('psns', psns) // Store PSNS score

    // --- Energy Index Calculation Logic ---
    // Combine metrics that positively correlate with energy/recovery.
    // We use the calculated PSNS score directly.
    // For metrics where higher raw value is better (SDNN, RMSSD, TP),
    // we use the inverted normalized *stress* score (100 - normalizedStressScore).

    const energyFromPSNS = psns * 0.5 // PSNS contributes 50% (was 40%)
    const energyFromSDNN = (100 - normalizedSDNN) * 0.2 // Inverted normalized SDNN contributes 20% (same)
    const energyFromRMSSD = (100 - normalizedRMSSD) * 0.2 // Inverted normalized RMSSD contributes 20% (same)
    const energyFromTP = (100 - normalizedTotalPower) * 0.1 // Inverted normalized Total Power contributes 10% (was 20%)

    const rawEnergy = energyFromPSNS + energyFromSDNN + energyFromRMSSD + energyFromTP

    // Apply smoothing
    const smoothedEnergy = this.smoothEnergy(rawEnergy)

    // Store the final energy value in history
    this.updateMetricHistory('energy', smoothedEnergy)

    // Ensure value is within 0-100 range
    return Math.round(Math.min(100, Math.max(0, smoothedEnergy)))
  }

  updateMetricHistory(metric, value) {
    if (!this.metricHistory[metric]) {
        console.warn(`Metric history for "${metric}" does not exist.`);
        return;
    }
    this.metricHistory[metric].push(value)
    if (this.metricHistory[metric].length > this.metricHistory.historyMaxSize) {
      this.metricHistory[metric].shift()
    }
  }

  smoothEnergy(rawValue) {
    // Simple exponential smoothing (same logic as smoothStressIndex)
    const history = this.metricHistory.energy
    if (!history || history.length === 0) {
      return rawValue
    }

    const previous = history[history.length - 1]
    const diff = Math.abs(rawValue - previous)
    // Adjust smoothing factor based on difference (faster adaptation for large changes)
    const currentWeight = Math.min(0.7 + (diff / 100), 0.9)
    const historyWeight = 1 - currentWeight

    return (rawValue * currentWeight) + (previous * historyWeight)
  }

  getLastEnergyValue() {
    const h = this.metricHistory.energy
    return (h && h.length > 0) ? h[h.length - 1] : null
  }

  // --- Copied/Adapted Normalization & PSNS Calculation from StressIndex ---
  // These functions convert raw physiological values into a 0-100 scale
  // where higher values indicate *higher stress* (lower energy).

  normalizeLFHF(value) {
    // Typical resting LF/HF is 1-2. Values above 3 indicate stress
    // Values below 0.5 indicate deep relaxation
    if (value <= 0.5) return 10
    if (value <= 1.0) return 20 + (value - 0.5) * 20
    if (value <= 2.0) return 30 + (value - 1.0) * 20
    if (value <= 3.0) return 50 + (value - 2.0) * 20
    return Math.min(90 + (value - 3.0) * 3, 100)
  }

  normalizeSDNN(value) {
    // SDNN typically decreases during stress
    // Normal range: 20-100ms, higher is better (lower stress)
    // Adjusted to map good values (e.g., 60ms) to lower stress scores
    if (value <= 20) return 100
    if (value <= 50) return 80 - ((value - 20) / 30) * 40 // Maps 20->80, 50->40 (was 100->50)
    if (value <= 100) return 40 - ((value - 50) / 50) * 30 // Maps 50->40, 100->10 (was 50->20)
    return Math.max(10 - ((value - 100) / 50) * 10, 0) // Maps 100->10, >100 -> 0 (was 20->0)
  }

  normalizeRMSSD(value) {
    // RMSSD also decreases during stress
    // Normal range: 15-60ms, higher is better (lower stress)
    // Adjusted to map good values (e.g., 40ms) to lower stress scores
    if (value <= 10) return 100
    if (value <= 30) return 80 - ((value - 10) / 20) * 40 // Maps 10->80, 30->40 (was 100->50)
    if (value <= 50) return 40 - ((value - 30) / 20) * 25 // Maps 30->40, 50->15 (was 50->30)
    return Math.max(15 - ((value - 50) / 10) * 10, 0) // Maps 50->15, >50 -> 0 (was 30->0)
  }

  normalizeTotalPower(value) {
    // Total power typically decreases during stress
    // Lower values indicate higher stress
    if (value <= 500) return 90
    if (value <= 1000) return 70 - ((value - 500) / 500) * 20
    if (value <= 2000) return 50 - ((value - 1000) / 1000) * 20
    return Math.max(30 - ((value - 2000) / 1000) * 15, 0)
  }

  calculatePSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD, normalizedTotalPower) {
    // PSNS activity calculation (copied from StressIndex)
    // Higher values indicate more active "rest-and-digest" response (higher PSNS score = better recovery/energy)
    // Note: Inputs are normalized stress scores (0-100, higher = more stress)
    // We invert them (100 - score) so higher physiological values contribute positively to PSNS score.
    return (100 - normalizedLFHF) * 0.4 +
           (100 - normalizedSDNN) * 0.2 +
           (100 - normalizedRMSSD) * 0.2 +
           (100 - normalizedTotalPower) * 0.2
  }

  // Clean up all resources
  destroy() {
    try {
      super.destroy()

      // Clean up calculator instances
      if (this.sdnnCalculator) this.sdnnCalculator.destroy()
      if (this.rmssdCalculator) this.rmssdCalculator.destroy()
      if (this.lfPowerCalculator) this.lfPowerCalculator.destroy()
      if (this.hfPowerCalculator) this.hfPowerCalculator.destroy()
      if (this.totalPowerCalculator) this.totalPowerCalculator.destroy()
    } catch (e) {
      console.warn('Error destroying EnergyIndex:', e.message)
    }
  }
} 