import { Subject } from 'rxjs'
import { share } from 'rxjs/operators'

/**
 * NEW ECG Service - Based on cardiometrics implementation
 * 
 * Key improvements:
 * 1. Stores RAW ECG values (not scaled) for better QRS detection
 * 2. Uses slope-based QRS detection (more robust)
 * 3. Updates display at 20 FPS instead of every sample
 * 4. Limited buffer size for memory management
 * 
 * To use this version:
 * - Import EcgNew instead of Ecg in your components
 * - Or rename this file to Ecg.js (backup old one first)
 */

export default class EcgService {
  constructor(device) {
    this.device = device
    
    // Store RAW ECG data (not scaled to microvolts)
    this.ecgData = [] // Array of { timestamp, value } where value is RAW counts
    this.maxPoints = 2000 // ~15 seconds at 130Hz
    
    // Display data (windowed for visualization)
    this.displayData = []
    this.displayWindowMs = 5000 // 5 seconds
    
    // QRS detection results
    this.qrsPoints = []
    this.lastProcessTime = 0
    this.isProcessing = false
    
    // RxJS Subjects
    this.ecgSubject = new Subject()
    this.rPeakSubject = new Subject()
    this.displaySubject = new Subject() // New: for display updates
    
    // ECG sampling rate
    this.samplingRate = device.ecgSamplingRate || 130
    
    // QRS Detection Config (from cardiometrics)
    this.qrsConfig = {
      samplingRate: this.samplingRate,
      windowSize: this.samplingRate, // 1 second window
      slopeThreshold: 0.7,
      refractoryPeriod: 200 // 200ms minimum between QRS peaks
    }
    
    // Device subscription
    this.deviceSubscription = null
    
    // Processing interval (20 FPS like cardiometrics)
    this.processingInterval = null
    
    // Initialize
    this.initialize()
    this.startProcessingInterval()
  }
  
  initialize() {
    if (this.device && this.device.observeEcg) {
      // Subscribe to device's ECG observable
      this.deviceSubscription = this.device
        .observeEcg()
        .subscribe(data => this.addSamples(data))
    } else {
      console.error('Device does not support ECG functionality')
    }
  }
  
  /**
   * Add new ECG samples (RAW values, not scaled)
   * This is called for each batch of samples from the device
   */
  addSamples(samples) {
    if (!samples || samples.length === 0) return
    
    const now = Date.now()
    const timeStep = 1000 / this.samplingRate // ms per sample
    
    // Convert samples array to ECGPoint objects with timestamps
    samples.forEach((value, index) => {
      const timestamp = now + (index * timeStep)
      this.ecgData.push({ timestamp, value })
    })
    
    // Keep buffer size limited
    if (this.ecgData.length > this.maxPoints) {
      this.ecgData = this.ecgData.slice(-this.maxPoints)
    }
    
    // Emit raw samples to subscribers (for compatibility)
    this.ecgSubject.next({
      samples: samples,
      times: samples.map((_, i) => (now + i * timeStep) / 1000) // in seconds
    })
  }
  
  /**
   * Start processing interval (20 FPS)
   * This processes ECG data for display and QRS detection
   */
  startProcessingInterval() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }
    
    this.processingInterval = setInterval(() => {
      if (this.ecgData.length === 0 || this.isProcessing) {
        return
      }
      
      this.isProcessing = true
      
      try {
        // Update display data (windowed)
        this.displayData = this.processECGForDisplay()
        
        // Detect QRS complexes
        this.qrsPoints = this.detectQRS(this.displayData)
        
        // Emit display update
        this.displaySubject.next({
          displayData: this.displayData,
          qrsPoints: this.qrsPoints
        })
        
        // Emit R peaks
        this.qrsPoints.forEach(point => {
          this.rPeakSubject.next({
            index: 0, // Not used in new implementation
            time: point.timestamp / 1000, // Convert to seconds
            value: point.value
          })
        })
        
        this.lastProcessTime = Date.now()
      } finally {
        this.isProcessing = false
      }
    }, 50) // 50ms = 20 FPS
  }
  
  /**
   * Process ECG data for display (keep only data within window)
   */
  processECGForDisplay() {
    const now = Date.now()
    const windowStart = now - this.displayWindowMs
    
    return this.ecgData.filter(point => point.timestamp >= windowStart)
  }
  
  /**
   * Detect QRS complexes using slope analysis (from cardiometrics)
   * This is more robust than simple threshold-based detection
   */
  detectQRS(ecgData) {
    if (ecgData.length < this.qrsConfig.windowSize) {
      return []
    }
    
    // Calculate first derivative (slope)
    const slopes = []
    for (let i = 1; i < ecgData.length; i++) {
      slopes.push(ecgData[i].value - ecgData[i-1].value)
    }
    
    // Find mean and std of slopes
    const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length
    const stdSlope = Math.sqrt(
      slopes.reduce((a, b) => a + Math.pow(b - meanSlope, 2), 0) / slopes.length
    )
    
    // Dynamic threshold based on signal characteristics
    const threshold = meanSlope + (stdSlope * this.qrsConfig.slopeThreshold)
    
    const qrsPoints = []
    let lastQRSTime = 0
    
    // Detect QRS using slope crossings
    for (let i = 1; i < ecgData.length - 1; i++) {
      const timeSinceLastQRS = ecgData[i].timestamp - lastQRSTime
      
      // Check if we're past refractory period
      if (timeSinceLastQRS >= this.qrsConfig.refractoryPeriod) {
        // Look for negative slope crossing threshold after positive slope
        if (slopes[i] > threshold && slopes[i+1] < -threshold) {
          // Found potential QRS peak
          qrsPoints.push(ecgData[i])
          lastQRSTime = ecgData[i].timestamp
        }
      }
    }
    
    return qrsPoints
  }
  
  /**
   * Get observable for ECG display updates
   * Emits { displayData, qrsPoints } at 20 FPS
   */
  getDisplayObservable() {
    return this.displaySubject.asObservable().pipe(share())
  }
  
  /**
   * Get observable for raw ECG data (for compatibility)
   */
  getEcgObservable() {
    return this.ecgSubject.asObservable().pipe(share())
  }
  
  /**
   * Get observable for R peaks
   */
  getRPeakObservable() {
    return this.rPeakSubject.asObservable().pipe(share())
  }
  
  /**
   * Get current display data
   */
  getCurrentDisplayData() {
    return {
      displayData: this.displayData,
      qrsPoints: this.qrsPoints
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Stop processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    
    // Unsubscribe from device
    if (this.deviceSubscription) {
      this.deviceSubscription.unsubscribe()
      this.deviceSubscription = null
    }
    
    // Complete subjects
    this.ecgSubject.complete()
    this.rPeakSubject.complete()
    this.displaySubject.complete()
    
    // Clear data
    this.ecgData = []
    this.displayData = []
    this.qrsPoints = []
  }
}
