import { reactive } from 'vue'

/**
 * Application-wide settings
 * 
 * rrIntervals: Number of R-R intervals to use for metric calculations
 * - Controls the window size for all HRV metrics
 * - Affects all standard deviation calculations
 * - Lower values (20-30) provide more responsive metrics but higher variability
 * - Higher values (60-120) provide more stable metrics but slower response to changes
 * - Recommended range: 30-60 for real-time monitoring
 * 
 * qtcFormula: Formula to use for QTc calculation
 * - 'bazett': Traditional Bazett's formula (QTc = QT/√RR)
 * - 'fridericia': Fridericia's formula (QTc = QT/∛RR), less heart rate dependent
 * - Fridericia is generally more accurate across different heart rates
 *
 * historyInterval: Time window in seconds for chart history display
 * - Controls how much historical data is displayed in charts
 * - Lower values (30-60) provide more detailed view of recent data
 * - Higher values (120-300) show longer-term trends
 * - Default: 30 seconds for optimal visualization
 */
export const opts = reactive({
  rrIntervals: 60, // Number of R-R intervals for calculations
  qtcFormula: 'fridericia', // Formula for QTc calculation (bazett or fridericia)
  historyInterval: 30, // History time window in seconds (default: 30s)
})

/**
 * Centralized store for metric values
 * Used to avoid recalculating metrics across different components
 * All metric values are stored here and components reference these values
 */
export const metrics = reactive({
  // Time domain metrics
  sdnn: 0,
  rmssd: 0,
  pnn50: 0,
  mxdmn: 0,
  amo50: 0,
  cv: 0,
  qtc: 0,
  
  // Frequency domain metrics
  totalPower: 0,
  vlfPower: 0,
  lfPower: 0,
  hfPower: 0,
  lfhfRatio: 0,
  
  // Composite/Index Metrics
  stressLevel: 0,        // Added stress index value
  energyLevel: 0,        // Added energy index value
  snsActivity: 0,        // Added SNS (Sympathetic Nervous System) activity
  psnsActivity: 0,       // Added PSNS (Parasympathetic Nervous System) activity
  
  // Device Status & Direct Measurements
  batteryLevel: 0,       // Added battery percentage
  heartRate: 0,          // Added current heart rate
  rrInterval: 0,         // Added latest RR interval
  
  // Data for Visualizations/Raw Data Displays
  heartRateHistory: [],  // Added for heart rate chart
  ecgData: [],           // Added for ECG display
  accelerometerData: [], // Added for Accelerometer display (array of {x,y,z})
  
  // Mean and standard deviation for each metric
  means: {
    sdnn: 0,
    rmssd: 0,
    pnn50: 0,
    mxdmn: 0,
    amo50: 0,
    cv: 0,
    qtc: 0,
    totalPower: 0,
    vlfPower: 0,
    lfPower: 0,
    hfPower: 0,
    lfhfRatio: 0
  },
  
  stdDevs: {
    sdnn: 0,
    rmssd: 0,
    pnn50: 0,
    mxdmn: 0,
    amo50: 0,
    cv: 0,
    qtc: 0,
    totalPower: 0,
    vlfPower: 0,
    lfPower: 0,
    hfPower: 0,
    lfhfRatio: 0
  }
})

