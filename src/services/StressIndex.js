import FrequencyDomain from './FrequencyDomain'
import SDNN from './SDNN'
import RMSSD from './RMSSD'
import LFPower from './LFPower'
import HFPower from './HFPower'
import TotalPower from './TotalPower'

/**
 * Enhanced Stress Index calculator based on multiple HRV metrics
 * Similar to Welltory's approach using both time and frequency domain metrics
 * to detect Sympathetic (SNS) and Parasympathetic (PSNS) nervous system activity
 */
export default class StressIndex extends FrequencyDomain {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: '%', // Changed to percentage
      precision: 1
    })
    
    // Initialize metric calculators
    this.sdnnCalculator = new SDNN(device, options)
    this.rmssdCalculator = new RMSSD(device, options)
    this.lfPowerCalculator = new LFPower(device, options)
    this.hfPowerCalculator = new HFPower(device, options)
    this.totalPowerCalculator = new TotalPower(device, options)

    // Tracks the recent history of metrics for trend analysis
    this.metricHistory = {
      lfhf: [],
      sdnn: [],
      rmssd: [],
      totalPower: [],
      stressIndex: [], // Add stressIndex to history
      historyMaxSize: 20  // Store up to 20 values
    }
    
    // Weight factors for different metrics in stress calculation
    this.weights = {
      lfhf: 0.35,       // LF/HF ratio weight
      sdnn: 0.25,       // SDNN weight
      rmssd: 0.25,      // RMSSD weight
      totalPower: 0.15  // Total power weight
    }
    
    // Initialize value
    this.value = 0;
  }

  handleRrInterval(rri) {
    // Make sure RRInt's handleRrInterval is called to manage data
    super.handleRrInterval(rri);
    
    // Calculate and emit new value on every RR interval as long as we have enough data
    if (this.recentRrs && this.recentRrs.length >= 5) {
      this.value = this.calculate();
      this.valueSubject.next(this.value);
    }
  }

  calculate() {
    // Ensure we have enough RR intervals
    if (!this.recentRrs || this.recentRrs.length < 5) {
      return this.getLastStressValue() || 0;
    }
    
    // Get values from individual metric calculators that share the same RR intervals
    const sdnn = this.sdnnCalculator.calculateStdDev(this.recentRrs);
    const rmssd = this.rmssdCalculator.calculateRMSSD(this.recentRrs);
    
    // Calculate frequency-domain metrics
    const lfPower = this.lfPowerCalculator.calculateBandPower(this.recentRrs, 0.04, 0.15);
    const hfPower = this.hfPowerCalculator.calculateBandPower(this.recentRrs, 0.15, 0.4);
    const totalPower = this.totalPowerCalculator.calculate();
    
    // Calculate LF/HF ratio (basic stress index)
    const lfhfRatio = (lfPower && hfPower) ? (lfPower / hfPower) : 1;
    
    // Update metric history
    this.updateMetricHistory('lfhf', lfhfRatio);
    this.updateMetricHistory('sdnn', sdnn);
    this.updateMetricHistory('rmssd', rmssd);
    this.updateMetricHistory('totalPower', totalPower);
    
    // Normalize metrics to 0-100 range
    const normalizedLFHF = this.normalizeLFHF(lfhfRatio);
    const normalizedSDNN = this.normalizeSDNN(sdnn);
    const normalizedRMSSD = this.normalizeRMSSD(rmssd);
    const normalizedTotalPower = this.normalizeTotalPower(totalPower);
    
    // Calculate SNS and PSNS metrics (similar to Welltory)
    const sns = this.calculateSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD);
    const psns = this.calculatePSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD, normalizedTotalPower);
    
    // Final stress index calculation (0-100%)
    // Higher values mean more stress
    const rawStressIndex = this.calculateFinalStressIndex(sns, psns);
    
    // Apply smoothing to reduce variability
    const smoothedStress = this.smoothStressIndex(rawStressIndex);
    
    // Store the final stress value in history
    this.updateMetricHistory('stressIndex', smoothedStress);
    
    return smoothedStress;
  }
  
  updateMetricHistory(metric, value) {
    // Add the new value
    this.metricHistory[metric].push(value);
    
    // Keep only most recent values
    if (this.metricHistory[metric].length > this.metricHistory.historyMaxSize) {
      this.metricHistory[metric].shift();
    }
  }
  
  getLastStressValue() {
    // If we don't have enough data for current calculation,
    // return last calculated stress value or 0
    const stressHistory = this.metricHistory.stressIndex;
    if (stressHistory && stressHistory.length > 0) {
      return stressHistory[stressHistory.length - 1];
    }
    
    // Fallback to normalized LFHF if we have that
    const lfhfHistory = this.metricHistory.lfhf;
    if (lfhfHistory && lfhfHistory.length > 0) {
      return this.normalizeLFHF(lfhfHistory[lfhfHistory.length - 1]);
    }
    
    // No previous values, return default
    return 0;
  }
  
  // Normalization functions convert physiological metrics to 0-100 scale
  // Higher values indicate higher stress
  normalizeLFHF(value) {
    // Typical resting LF/HF is 1-2. Values above 3 indicate stress
    // Values below 0.5 indicate deep relaxation
    if (value <= 0.5) return 10;
    if (value <= 1.0) return 20 + (value - 0.5) * 20;
    if (value <= 2.0) return 30 + (value - 1.0) * 20;
    if (value <= 3.0) return 50 + (value - 2.0) * 20;
    return Math.min(90 + (value - 3.0) * 3, 100);
  }
  
  normalizeSDNN(value) {
    // SDNN typically decreases during stress
    // Normal range: 20-100ms, higher is better (lower stress)
    if (value <= 20) return 100;
    if (value <= 50) return 80 - ((value - 20) / 30) * 30;
    if (value <= 100) return 50 - ((value - 50) / 50) * 30;
    return Math.max(20 - ((value - 100) / 50) * 10, 0);
  }
  
  normalizeRMSSD(value) {
    // RMSSD also decreases during stress
    // Normal range: 15-60ms, higher is better (lower stress)
    if (value <= 10) return 100;
    if (value <= 30) return 80 - ((value - 10) / 20) * 30;
    if (value <= 50) return 50 - ((value - 30) / 20) * 20;
    return Math.max(30 - ((value - 50) / 10) * 10, 0);
  }
  
  normalizeTotalPower(value) {
    // Total power typically decreases during stress
    // Lower values indicate higher stress
    if (value <= 500) return 90;
    if (value <= 1000) return 70 - ((value - 500) / 500) * 20;
    if (value <= 2000) return 50 - ((value - 1000) / 1000) * 20;
    return Math.max(30 - ((value - 2000) / 1000) * 15, 0);
  }
  
  calculateSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD) {
    // SNS activity calculation
    // Higher values indicate more active "fight-or-flight" response
    return normalizedLFHF * 0.5 + normalizedSDNN * 0.25 + normalizedRMSSD * 0.25;
  }
  
  calculatePSNS(normalizedLFHF, normalizedSDNN, normalizedRMSSD, normalizedTotalPower) {
    // PSNS activity calculation
    // Higher values indicate more active "rest-and-digest" response
    return (100 - normalizedLFHF) * 0.4 + (100 - normalizedSDNN) * 0.2 + 
           (100 - normalizedRMSSD) * 0.2 + (100 - normalizedTotalPower) * 0.2;
  }
  
  calculateFinalStressIndex(sns, psns) {
    // Combine SNS and PSNS measures for final stress index
    // Similar to the Welltory approach showing both systems
    
    // When SNS is high and PSNS is low, stress is high
    // When SNS is low and PSNS is high, stress is low
    
    // We also account for imbalance between the two systems
    const balance = Math.abs(sns - psns) / 25; // Normalized difference
    
    // Base stress from SNS activity (0-100)
    const baseStress = sns;
    
    // Modulate stress based on PSNS activity and balance
    return Math.min(100, Math.max(0, 
      baseStress * 0.7 +                      // SNS component
      (100 - psns) * 0.2 +                    // PSNS component (inverted)
      balance * 10                            // System imbalance component
    ));
  }
  
  smoothStressIndex(rawStressIndex) {
    // Apply exponential smoothing to reduce variability
    const stressHistory = this.metricHistory.stressIndex;
    
    // If no history yet, return the raw value
    if (!stressHistory || stressHistory.length === 0) {
      return rawStressIndex;
    }
    
    // Get previous stress value (not using getLastStressValue to avoid circular dependency)
    const lastStressIndex = stressHistory[stressHistory.length - 1];
    
    // Adjust smoothing factor based on difference
    // Use more of the raw value when there's a significant change
    const difference = Math.abs(rawStressIndex - lastStressIndex);
    const currentWeight = Math.min(0.7 + (difference / 100), 0.9);
    const historyWeight = 1 - currentWeight;
    
    // Apply smoothing with adaptive weights
    return (rawStressIndex * currentWeight) + (lastStressIndex * historyWeight);
  }
  
  // Clean up all resources
  destroy() {
    try {
      super.destroy();
      
      // Clean up calculator instances
      if (this.sdnnCalculator) this.sdnnCalculator.destroy();
      if (this.rmssdCalculator) this.rmssdCalculator.destroy();
      if (this.lfPowerCalculator) this.lfPowerCalculator.destroy();
      if (this.hfPowerCalculator) this.hfPowerCalculator.destroy();
      if (this.totalPowerCalculator) this.totalPowerCalculator.destroy();
    } catch (e) {
      console.warn('Error destroying StressIndex:', e.message);
    }
  }
} 