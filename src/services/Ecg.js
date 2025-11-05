import { Subject, BehaviorSubject, Observable } from 'rxjs'
import { share, map, filter } from 'rxjs/operators'
import log from '@/log'
import AdaptiveLMSFilter from './AdaptiveLMSFilter.js'

// ============================================
// NEW ECG IMPLEMENTATION (based on cardiometrics)
// To revert to old version, comment this class and uncomment EcgServiceOld below
// ============================================

export default class EcgService {
  constructor(device, accService = null) {
    // Device reference
    this.device = device
    
    // Accelerometer service reference for motion artifact filtering
    this.accService = accService
    
    // Motion artifact filter (LMS adaptive filter)
    this.motionFilter = new AdaptiveLMSFilter(15, 0.005)
    this.motionFilterEnabled = true // Can be toggled for comparison
    
    // Accelerometer data buffer for synchronization
    this.accDataBuffer = []
    this.accTimeBuffer = []
    this.maxAccBuffer = 500 // Keep last 500 samples (~2.5 seconds at 200Hz)
    
    // Data storage (ORIGINAL CODE - NOT MODIFIED)
    this.ecgSamples = []
    this.ecgTimes = []
    this.normalizedEcg = [] // Normalized/filtered ECG data for analysis
    this.maxSamples = 5000
    
    // RxJS Subjects for observables
    this.ecgSubject = new Subject()
    this.rPeakSubject = new Subject()
    this.qPointSubject = new Subject()
    this.tEndSubject = new Subject()
    this.qtIntervalSubject = new Subject()
    this.tPeakSubject = new Subject() // Add T-Peak subject
    
    // ECG sampling rate from device
    this.samplingRate = device.ecgSamplingRate
    
    // Device subscription
    this.deviceSubscription = null
    this.accSubscription = null
    
    // Initialize the service
    this.initialize()
    
    this.processedRPeakIndices = new Set()
  }
  
  initialize() {
    console.log('EcgService: Initializing...', this.device?.name);
    if (this.device && this.device.observeEcg) {
      console.log('EcgService: Device has observeEcg method, subscribing...');
      // Subscribe to the device's ECG observable
      this.deviceSubscription = this.device
        .observeEcg()
        .subscribe(data => this.handleData(data))
      console.log('EcgService: ECG subscription created');
    } else {
      console.error('EcgService: Device does not support ECG functionality', this.device);
    }
    
    // Subscribe to accelerometer if available
    this.subscribeToAccelerometer()
  }
  
  subscribeToAccelerometer() {
    if (!this.accService) {
      console.log('EcgService: No accelerometer service provided, motion filtering disabled');
      this.motionFilterEnabled = false
      return
    }
    
    console.log('EcgService: Subscribing to accelerometer for motion artifact filtering...');
    
    // Subscribe to processed accelerometer data
    this.accSubscription = this.accService.processedDataSubject.subscribe(data => {
      if (!data || !data.samples) return
      
      // Store accelerometer data with timestamps for synchronization
      data.samples.forEach((sample, i) => {
        this.accDataBuffer.push({
          x: sample.x,
          y: sample.y,
          z: sample.z,
          magnitude: Math.sqrt(sample.x**2 + sample.y**2 + sample.z**2),
          time: data.times[i]
        })
      })
      
      // Limit buffer size
      if (this.accDataBuffer.length > this.maxAccBuffer) {
        const excess = this.accDataBuffer.length - this.maxAccBuffer
        this.accDataBuffer.splice(0, excess)
      }
    })
    
    console.log('EcgService: Accelerometer subscription created for motion filtering');
  }
  
  handleData(data) {
    if (!data || data.length === 0) return
    
    // Add new samples to the array
    this.ecgSamples.push(...data)
    
    // Generate corresponding time values
    const timeStep = 1 / this.samplingRate
    const lastTime = this.ecgTimes.length > 0 ? 
      this.ecgTimes[this.ecgTimes.length - 1] : 0
    
    const newTimes = []
    for (let i = 0; i < data.length; i++) {
      newTimes.push(lastTime + timeStep * (i + 1))
    }
    this.ecgTimes.push(...newTimes)
    
    // Process and normalize new ECG data (pass times for motion filtering)
    const normalizedData = this.normalizeData(data, newTimes)
    this.normalizedEcg.push(...normalizedData)
    
    // Limit the size of the arrays
    if (this.ecgSamples.length > this.maxSamples) {
      const excessCount = this.ecgSamples.length - this.maxSamples
      this.ecgSamples.splice(0, excessCount)
      this.ecgTimes.splice(0, excessCount)
      this.normalizedEcg.splice(0, excessCount)
    }
    
    // Emit the raw ECG data to subscribers
    this.ecgSubject.next({
      samples: data,
      times: newTimes
    })
    
    // Process ECG for Q and T points
    this.processForQT()
  }
  
  normalizeData(rawData, ecgTimes = null) {
    // 0. Apply motion artifact filtering if enabled and accelerometer data available
    let filteredData = rawData
    if (this.motionFilterEnabled && this.accDataBuffer.length > 0 && ecgTimes) {
      filteredData = this.applyMotionFilter(rawData, ecgTimes)
    }
    
    // 1. Moving average filter to smooth the signal
    const movingAvgWindowSize = Math.max(3, Math.floor(this.samplingRate * 0.01)) // ~10ms window
    const smoothedData = this.applyMovingAverage(filteredData, movingAvgWindowSize)
    
    // 2. Baseline correction
    // Get the last chunk of normalized data to ensure continuity
    const dataForBaseline = [...this.normalizedEcg.slice(-100), ...smoothedData]
    const baselineCorrected = this.removeBaseline(dataForBaseline)
    
    // Return only the newly processed data
    return baselineCorrected.slice(-rawData.length)
  }
  
  /**
   * Apply adaptive LMS filter to remove motion artifacts using accelerometer data
   * @param {Array} ecgData - Raw ECG samples
   * @param {Array} ecgTimes - Timestamps for ECG samples
   * @returns {Array} - Filtered ECG data
   */
  applyMotionFilter(ecgData, ecgTimes) {
    const filteredData = []
    
    for (let i = 0; i < ecgData.length; i++) {
      const ecgSample = ecgData[i]
      const ecgTime = ecgTimes[i]
      
      // Find closest accelerometer sample by time
      const accSample = this.getAccelerometerSampleAtTime(ecgTime)
      
      if (accSample) {
        // Apply LMS filter with accelerometer magnitude as noise reference
        const filtered = this.motionFilter.filter(ecgSample, accSample.magnitude)
        filteredData.push(filtered)
      } else {
        // No accelerometer data available, use original sample
        filteredData.push(ecgSample)
      }
    }
    
    return filteredData
  }
  
  /**
   * Get accelerometer sample at specific time (with interpolation if needed)
   * @param {number} targetTime - Target time in seconds
   * @returns {Object|null} - Accelerometer sample or null
   */
  getAccelerometerSampleAtTime(targetTime) {
    if (this.accDataBuffer.length === 0) return null
    
    // Find closest sample by time
    let closestIndex = 0
    let minTimeDiff = Math.abs(this.accDataBuffer[0].time - targetTime)
    
    for (let i = 1; i < this.accDataBuffer.length; i++) {
      const timeDiff = Math.abs(this.accDataBuffer[i].time - targetTime)
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff
        closestIndex = i
      }
    }
    
    // If time difference is too large (>50ms), return null
    if (minTimeDiff > 0.05) return null
    
    return this.accDataBuffer[closestIndex]
  }
  
  applyMovingAverage(data, windowSize) {
    const result = []
    
    // If we have previous normalized data, use it for the initial window overlap
    const lookback = Math.min(windowSize - 1, this.normalizedEcg.length)
    const previousData = this.normalizedEcg.slice(-lookback)
    const combinedData = [...previousData, ...data]
    
    // Apply moving average
    for (let i = 0; i < data.length; i++) {
      const windowStart = i
      const windowEnd = i + windowSize
      let sum = 0
      
      for (let j = windowStart; j < windowEnd && j < combinedData.length; j++) {
        sum += combinedData[j]
      }
      
      const actualWindowSize = Math.min(windowSize, combinedData.length - windowStart)
      result.push(sum / actualWindowSize)
    }
    
    return result
  }
  
  removeBaseline(data) {
    // Use a median filter to estimate the baseline
    const medianWindowSize = Math.floor(this.samplingRate * 0.2) // 200ms window
    
    // We'll use a simplified approach for real-time processing
    // Estimate baseline by polynomial fitting
    const baseline = []
    const segmentSize = Math.min(data.length, this.samplingRate)
    
    for (let i = 0; i < data.length; i += segmentSize / 2) {
      const segment = data.slice(i, i + segmentSize)
      // Find average of the lowest 20% of points as baseline level for this segment
      const sortedSegment = [...segment].sort((a, b) => a - b)
      const baselineLevel = sortedSegment.slice(0, Math.max(1, Math.floor(segment.length * 0.2)))
        .reduce((sum, val) => sum + val, 0) / Math.max(1, Math.floor(segment.length * 0.2))
      
      for (let j = i; j < i + segmentSize / 2 && j < data.length; j++) {
        baseline.push(baselineLevel)
      }
    }
    
    // Fill in any missing baseline values
    while (baseline.length < data.length) {
      baseline.push(baseline[baseline.length - 1])
    }
    
    // Subtract baseline from signal
    return data.map((value, i) => value - baseline[i])
  }
  
  processForQT() {
    if (this.normalizedEcg.length < 200) return
    const windowDuration = 5
    const windowSize = Math.floor(windowDuration * this.samplingRate)
    const samples = this.normalizedEcg.slice(-windowSize)
    const originalSamples = this.ecgSamples.slice(-windowSize)
    const rPeaks = this.detectRPeaks(samples)
    if (rPeaks.length < 2) return
    const refinedRPeaks = this.refineRPeaks(rPeaks, originalSamples)
    const fullArrayOffset = this.ecgSamples.length - windowSize

    refinedRPeaks.forEach(rPeakIndex => {
      const rPeakFullIndex = fullArrayOffset + rPeakIndex
      this.rPeakSubject.next({
        index: rPeakFullIndex,
        time: this.ecgTimes[rPeakFullIndex],
        value: this.ecgSamples[rPeakFullIndex]
      })
    })

    const processedPeaks = Math.min(refinedRPeaks.length, 5)
    for (let i = refinedRPeaks.length - processedPeaks; i < refinedRPeaks.length; i++) {
      const rPeakIndex = refinedRPeaks[i]
      const rPeakFullIndex = fullArrayOffset + rPeakIndex
      if (this.processedRPeakIndices.has(rPeakFullIndex)) continue

      // Use new T-peak detection (second max in RR interval)
      const tPeak = this.findTPeak(samples, rPeakIndex, refinedRPeaks)
      const tEnd = tPeak !== null ? this.findTEndTrapezium(samples, tPeak, this.samplingRate) : null
      const qPoint = this.findQPoint(samples, rPeakIndex)

      if (qPoint !== null && tPeak !== null && tEnd !== null) {
        const qPointFullIndex = fullArrayOffset + qPoint
        const tPeakFullIndex = fullArrayOffset + tPeak
        const tEndFullIndex = fullArrayOffset + tEnd
        const qtInterval = ((tEnd - qPoint) / this.samplingRate) * 1000
        if (qtInterval >= 230 && qtInterval <= 660 && tEnd > tPeak && tPeak > qPoint) {
          this.qPointSubject.next({
            index: qPointFullIndex,
            time: this.ecgTimes[qPointFullIndex],
            value: this.ecgSamples[qPointFullIndex]
          })
          this.tPeakSubject.next({
            index: tPeakFullIndex,
            time: this.ecgTimes[tPeakFullIndex],
            value: this.ecgSamples[tPeakFullIndex]
          })
          this.tEndSubject.next({
            index: tEndFullIndex,
            time: this.ecgTimes[tEndFullIndex],
            value: this.ecgSamples[tEndFullIndex]
          })
          this.qtIntervalSubject.next({
            qtInterval,
            qPointIndex: qPointFullIndex,
            tEndIndex: tEndFullIndex,
            qPointTime: this.ecgTimes[qPointFullIndex],
            tEndTime: this.ecgTimes[tEndFullIndex],
            rPeakIndex: rPeakFullIndex,
            rPeakTime: this.ecgTimes[rPeakFullIndex]
          })
          this.processedRPeakIndices.add(rPeakFullIndex)
        }
      }
    }
  }
  
  /**
   * Refine R peak positions using the original signal to ensure they're at the true peaks
   * @param {Array} rPeaks - Detected R peak indices in normalized signal
   * @param {Array} originalSignal - Original ECG signal
   * @returns {Array} - Refined R peak indices
   */
  refineRPeaks(rPeaks, originalSignal) {
    const refinedPeaks = [];
    
    for (const peakIndex of rPeaks) {
      // Define a search window around the detected peak (±20ms)
      const searchWindowSamples = Math.ceil(0.02 * this.samplingRate);
      const startIndex = Math.max(0, peakIndex - searchWindowSamples);
      const endIndex = Math.min(originalSignal.length - 1, peakIndex + searchWindowSamples);
      
      // Find the actual maximum value in original signal within search window
      let maxValue = originalSignal[peakIndex];
      let maxIndex = peakIndex;
      
      for (let i = startIndex; i <= endIndex; i++) {
        if (originalSignal[i] > maxValue) {
          maxValue = originalSignal[i];
          maxIndex = i;
        }
      }
      
      // Add the refined peak to our list
      refinedPeaks.push(maxIndex);
    }
    
    return refinedPeaks;
  }
  
  detectRPeaks(samples) {
    // Use dynamic threshold to improve R peak detection
    const threshold = this.calculateRPeakThreshold(samples)
    const peaks = []
    
    // Calculate minimum distance between peaks based on sampling rate
    // Allow for higher heart rates by lowering the minimum period
    const minHeartRatePeriodMs = 400 // ms (corresponds to 150 BPM)
    const minDistance = Math.floor((minHeartRatePeriodMs / 1000) * this.samplingRate)
    
    // Enhanced detection using derivative
    const derivative = this.calculateDerivative(samples)
    
    // Find peaks above threshold
    for (let i = 10; i < samples.length - 10; i++) {
      // Check for local maximum in a window
      let isLocalMax = true;
      for (let j = Math.max(0, i - 5); j <= Math.min(samples.length - 1, i + 5); j++) {
        if (j !== i && samples[j] > samples[i]) {
          isLocalMax = false;
          break;
        }
      }
      
      // Skip if not a local maximum
      if (!isLocalMax) continue;
      
      // Additional criteria: must be above threshold and have steep slope
      const slopeUpPositive = i > 0 && derivative[i - 1] > threshold / 15;
      const slopeDownNegative = i < samples.length - 1 && derivative[i] < -threshold / 15;
      
      if (samples[i] > threshold && (slopeUpPositive || slopeDownNegative)) {
        // Check if this is far enough from the previous peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i)
        } else if (samples[i] > samples[peaks[peaks.length - 1]] * 1.1) {
          // If this peak is significantly higher than the previous one and they're close,
          // replace the previous one with this (better R peak)
          peaks[peaks.length - 1] = i
        }
      }
    }
    
    return peaks
  }
  
  calculateDerivative(samples) {
    const derivative = new Array(samples.length).fill(0);
    
    for (let i = 1; i < samples.length; i++) {
      derivative[i] = samples[i] - samples[i-1];
    }
    
    return derivative;
  }
  
  calculateRPeakThreshold(samples) {
    // Use a more robust method for determining threshold
    // Sort samples and take the 90th percentile as a base threshold
    const sortedSamples = [...samples].sort((a, b) => a - b)
    const percentile90 = sortedSamples[Math.floor(samples.length * 0.9)]
    
    // Calculate the mean of potential R peak values
    const potentialPeaks = samples.filter(val => val > percentile90)
    const peaksMean = potentialPeaks.reduce((sum, val) => sum + val, 0) / 
                      (potentialPeaks.length || 1)
    
    // Dynamic threshold based on signal strength
    const threshold = percentile90 * 0.5 + peaksMean * 0.5
    
    return threshold
  }
  
  findQPoint(samples, rPeakIndex) {
    // Search backward from R peak to find Q point (local minimum before R peak)
    // Adaptive window to capture more Q points
    const heartRate = this.estimateHeartRate(samples)
    
    // Narrower search window - QRS typically starts 50-80ms before R peak
    // Use a tighter physiologically relevant window to avoid detecting P waves as Q points
    const maxSearchWindowMs = 120 // Maximum 120ms window (reduced from previous values)
    const searchWindowMs = Math.min(maxSearchWindowMs, 60000 / heartRate * 0.12) // 12% of RR interval, max 120ms
    const searchWindow = Math.floor((searchWindowMs / 1000) * this.samplingRate)
    const startIndex = Math.max(0, rPeakIndex - searchWindow)
    
    // Calculate derivative to help identify the true onset of QRS
    const derivative = this.calculateDerivative(samples.slice(startIndex, rPeakIndex + 1))
    const secondDerivative = this.calculateDerivative(derivative)
    
    // Method 1: Find the steepest downslope before R peak (strongest negative derivative)
    let steepestSlopeIndex = null
    let maxNegativeSlope = 0
    
    for (let i = 1; i < derivative.length - 1; i++) {
      // Find where the slope is strongly negative (downward deflection)
      const currentSlope = derivative[i]
      if (currentSlope < -0.5 && Math.abs(currentSlope) > maxNegativeSlope) {
        maxNegativeSlope = Math.abs(currentSlope)
        steepestSlopeIndex = startIndex + i
      }
    }
    
    // Method 2: Look for inflection point where second derivative changes sign
    // This helps identify the precise onset of the Q wave
    let inflectionIndex = null
    for (let i = 1; i < secondDerivative.length - 1; i++) {
      // Look for change from negative to positive in second derivative
      if (secondDerivative[i-1] <= 0 && secondDerivative[i] > 0) {
        inflectionIndex = startIndex + i
        break
      }
    }
    
    // Method 3: Q is typically 40-60ms before R peak, search for local minimum in this region
    let qWindowStart = Math.max(startIndex, rPeakIndex - Math.floor(0.06 * this.samplingRate)) // 60ms
    let qWindowEnd = Math.max(qWindowStart + 3, rPeakIndex - 2) // At least 2 samples before R peak
    
    let qPointIndex = null
    let minValue = Infinity
    
    for (let i = qWindowStart; i <= qWindowEnd; i++) {
      if (samples[i] < minValue) {
        minValue = samples[i]
        qPointIndex = i
      }
    }
    
    // Determine final Q point: prefer steepest slope if found, otherwise use minimum value
    // This approach balances physiological accuracy with detection reliability
    if (steepestSlopeIndex !== null) {
      // Search for minimum in 10ms window after steepest slope
      const windowSize = Math.ceil(0.01 * this.samplingRate) // 10ms
      let minAfterSlope = samples[steepestSlopeIndex]
      let minAfterSlopeIndex = steepestSlopeIndex
      
      for (let i = steepestSlopeIndex; i < Math.min(steepestSlopeIndex + windowSize, rPeakIndex - 1); i++) {
        if (samples[i] < minAfterSlope) {
          minAfterSlope = samples[i]
          minAfterSlopeIndex = i
        }
      }
      
      return minAfterSlopeIndex
    } else if (inflectionIndex !== null && inflectionIndex < rPeakIndex - 2) {
      return inflectionIndex
    }
    
    // Fallback to minimum value if other methods failed
    return qPointIndex
  }
  
  // Helper to get median derivative over next 'count' points
  getMedianDerivative(samples, startIndex, count) {
    const derivatives = []
    // Calculate derivatives for up to 'count' points, handling boundaries
    for (let i = 0; i < count; i++) {
      const currentIndex = startIndex + i
      if (currentIndex + 1 >= samples.length) break // Stop if we reach the end
      derivatives.push(samples[currentIndex + 1] - samples[currentIndex])
    }

    if (derivatives.length === 0) return 0 // Or handle as needed, e.g., NaN

    derivatives.sort((a, b) => a - b)
    const mid = Math.floor(derivatives.length / 2)

    return derivatives.length % 2 !== 0 
      ? derivatives[mid] 
      : (derivatives[mid - 1] + derivatives[mid]) / 2
  }

  // Find T-peak as the second max voltage in the RR interval after R-peak
  findTPeak(samples, rPeakIndex, rPeaks) {
    const fs = this.samplingRate
    const nextR = rPeaks.find(p => p > rPeakIndex) || samples.length - 1
    let max1 = rPeakIndex, max2 = null
    for (let i = rPeakIndex + Math.floor(0.1 * fs); i < nextR; i++) {
      if (samples[i] > samples[max1]) {
        max2 = max1; max1 = i
      } else if ((max2 === null || samples[i] > samples[max2]) && i !== max1) {
        max2 = i
      }
    }
    return max2
  }

  // Find T-end index after T-peak
  findTEnd(samples, rPeakIndex, rPeaks) {
    const tPeak = this.findTPeak(samples, rPeakIndex, rPeaks)
    if (tPeak === null) return null
    const fs = this.samplingRate
    const baseline = (() => {
      const pre = samples.slice(Math.max(0, rPeakIndex - Math.floor(0.15 * fs)), Math.max(0, rPeakIndex - Math.floor(0.03 * fs)))
      const post = (() => {
        const nextR = rPeaks.find(p => p > rPeakIndex)
        if (!nextR) return []
        const s = tPeak + Math.floor(0.15 * fs), e = Math.min(samples.length, Math.min(nextR - Math.floor(0.12 * fs), rPeakIndex + Math.floor(0.8 * fs)))
        return samples.slice(s, e)
      })()
      const segs = [...pre, ...post]
      if (segs.length > 5) { segs.sort((a, b) => a - b); return segs[Math.floor(segs.length/2)] }
      const w0 = Math.max(0, rPeakIndex - Math.floor(0.2 * fs)), w1 = Math.min(samples.length, rPeakIndex + Math.floor(0.8 * fs))
      return samples.slice(w0, w1).reduce((a, b) => a + b, 0) / (w1 - w0)
    })()
    const tAmp = Math.abs(samples[tPeak] - baseline)
    const isPos = samples[tPeak] > baseline
    const start = tPeak + Math.max(3, Math.floor(0.03 * fs)), end = Math.min(samples.length - 2, tPeak + Math.floor(0.3 * fs))
    if (start >= end) return null
    // Find first point after T-peak where signal returns to baseline (within 15% of T amplitude)
    for (let i = start; i <= end; i++) {
      if (Math.abs(samples[i] - baseline) < tAmp * 0.15) return i
    }
    // Fallback: fixed offset
    const fallback = tPeak + Math.floor(0.16 * fs)
    return fallback < samples.length ? fallback : null
  }
  
  estimateHeartRate(samples) {
    // Use R peaks to estimate heart rate
    const rPeaks = this.detectRPeaks(samples)
    
    if (rPeaks.length < 2) {
      return 75; // Default heart rate if not enough peaks
    }
    
    // Calculate RR intervals in samples
    const rrIntervals = [];
    for (let i = 1; i < rPeaks.length; i++) {
      rrIntervals.push(rPeaks[i] - rPeaks[i-1]);
    }
    
    // Convert to milliseconds
    const rrIntervalsMs = rrIntervals.map(samples => samples * 1000 / this.samplingRate);
    
    // Calculate mean heart rate
    const meanRRIntervalMs = rrIntervalsMs.reduce((a, b) => a + b, 0) / rrIntervalsMs.length;
    const heartRate = 60000 / meanRRIntervalMs;
    
    return heartRate;
  }
  
  // Observable getters
  
  /**
   * Get an observable for raw ECG data.
   * @returns {Observable} Observable that emits {samples, times} objects.
   */
  getEcgObservable() {
    return this.ecgSubject.asObservable().pipe(share())
  }
  
  /**
   * Get an observable for R peaks.
   * @returns {Observable} Observable that emits {index, time, value} objects.
   */
  getRPeakObservable() {
    return this.rPeakSubject.asObservable().pipe(share())
  }
  
  /**
   * Get an observable for Q points.
   * @returns {Observable} Observable that emits {index, time, value} objects.
   */
  getQPointObservable() {
    return this.qPointSubject.asObservable().pipe(share())
  }
  
  /**
   * Get an observable for T-end points.
   * @returns {Observable} Observable that emits {index, time, value} objects.
   */
  getTEndObservable() {
    return this.tEndSubject.asObservable().pipe(share())
  }
  
  /**
   * Get an observable for QT intervals.
   * @returns {Observable} Observable that emits {qtInterval, qPointIndex, tEndIndex, qPointTime, tEndTime} objects.
   */
  getQtIntervalObservable() {
    return this.qtIntervalSubject.asObservable()
  }
  
  /**
   * Get an observable for T-peak points.
   * @returns {Observable} Observable that emits {index, time, value} objects.
   */
  getTPeakObservable() {
    return this.tPeakSubject.asObservable().pipe(share())
  }
  
  /**
   * Returns an Observable that emits RR intervals calculated from ECG data
   * @returns {Observable} - RR interval observable (in milliseconds)
   */
  getRRIntervals() {
    return new Observable(observer => {
      // Use the R peaks observable as the source
      const subscription = this.rPeakSubject.subscribe(rPeak => {
        // We need at least 2 consecutive R peaks to calculate an RR interval
        if (this.lastRPeakTime !== undefined) {
          const rrInterval = (rPeak.time - this.lastRPeakTime) * 1000 // Convert to milliseconds
          
          // Filter out implausible values (same range as in RRInt.validateRrInterval)
          if (rrInterval >= 300 && rrInterval <= 2000) {
            observer.next(rrInterval)
          }
        }
        
        // Store the current R peak time for the next calculation
        this.lastRPeakTime = rPeak.time
      })
      
      // Cleanup function
      return () => subscription.unsubscribe()
    }).pipe(share()) // Share the observable among multiple subscribers
  }
  
  /**
   * Get the latest RR intervals calculated from ECG data
   * @param {number} count - Number of RR intervals to return
   * @returns {Array} - Array of RR intervals in milliseconds
   */
  getLatestRRIntervals(count = 30) {
    if (!this.rrIntervals) {
      this.rrIntervals = []
      
      // Subscribe to RR intervals and store them
      this.rrIntervalsSubscription = this.getRRIntervals().subscribe(rrInterval => {
        this.rrIntervals.push(rrInterval)
        
        // Limit the size of the array
        if (this.rrIntervals.length > 100) { // Store the last 100 intervals
          this.rrIntervals.shift()
        }
      })
    }
    
    // Return the latest RR intervals
    return this.rrIntervals.slice(-count)
  }
  
  /**
   * Get current ECG data and time arrays.
   * @returns {Object} Object containing ecgSamples and ecgTimes arrays.
   */
  getCurrentData() {
    return {
      samples: [...this.ecgSamples],
      times: [...this.ecgTimes]
    }
  }
  
  /**
   * Enable or disable motion artifact filtering
   * @param {boolean} enabled - True to enable, false to disable
   */
  setMotionFilterEnabled(enabled) {
    this.motionFilterEnabled = enabled
    console.log(`EcgService: Motion filtering ${enabled ? 'enabled' : 'disabled'}`)
    
    // Reset filter when toggling
    if (enabled && this.motionFilter) {
      this.motionFilter.reset()
    }
  }
  
  /**
   * Get motion filter statistics
   * @returns {Object} Filter statistics
   */
  getMotionFilterStats() {
    if (!this.motionFilter) return null
    return this.motionFilter.getStats()
  }
  
  /**
   * Set accelerometer service for motion filtering
   * @param {Object} accService - Accelerometer service instance
   */
  setAccelerometerService(accService) {
    // Unsubscribe from old service
    if (this.accSubscription) {
      this.accSubscription.unsubscribe()
      this.accSubscription = null
    }
    
    this.accService = accService
    
    // Subscribe to new service
    if (accService) {
      this.subscribeToAccelerometer()
    }
  }
  
  /**
   * Clean up resources when no longer needed.
   */
  destroy() {
    // Unsubscribe from device
    if (this.deviceSubscription) {
      this.deviceSubscription.unsubscribe()
      this.deviceSubscription = null
    }
    
    // Unsubscribe from accelerometer
    if (this.accSubscription) {
      this.accSubscription.unsubscribe()
      this.accSubscription = null
    }
    
    // Unsubscribe from RR intervals
    if (this.rrIntervalsSubscription) {
      this.rrIntervalsSubscription.unsubscribe()
      this.rrIntervalsSubscription = null
    }
    
    // Clear subjects
    this.ecgSubject.complete()
    this.rPeakSubject.complete()
    this.qPointSubject.complete()
    this.tEndSubject.complete()
    this.qtIntervalSubject.complete()
    this.tPeakSubject.complete() // Complete T-peak subject
    
    // Clear data
    this.ecgSamples = []
    this.ecgTimes = []
    this.normalizedEcg = []
    this.rrIntervals = []
    this.accDataBuffer = []
    this.accTimeBuffer = []
    
    // Clear the set on destroy
    this.processedRPeakIndices.clear()
  }
}

// Helper: Placeholder for wavelet transform (should use a real library in production)
function waveletTransform(signal, scale) {
  // Simple Haar or Daubechies wavelet transform can be used here
  // For demo, just return the signal (no-op)
  return signal
}

// Wavelet-based delineation (Martínez et al.)
EcgService.prototype.waveletDelineate = function(samples, fs) {
  // 1. Apply wavelet transform at multiple scales
  // 2. Find zero-crossings and modulus maxima
  // 3. Use rules to select P, QRS, T onsets/peaks/ends
  // This is a placeholder; in production, use a validated implementation
  // Here, just return nulls for all points
  return {
    Pon: null, Pp: null, Pend: null,
    QRSon: null, Rp: null, QRSoff: null,
    Ton: null, Tp: null, Tend: null
  }
}

// Trapezium's Area method for T-end (Vázquez-Seisdedos et al.)
EcgService.prototype.findTEndTrapezium = function(samples, tPeakIdx, fs) {
  const windowSlope = Math.floor(0.2 * fs)
  const windowIso = [Math.floor(0.2 * fs), Math.floor(0.4 * fs)]
  let maxDeriv = 0, xm = tPeakIdx
  for (let i = tPeakIdx; i < tPeakIdx + windowSlope && i < samples.length - 1; i++) {
    const d = Math.abs(samples[i+1] - samples[i])
    if (d > maxDeriv) { maxDeriv = d; xm = i }
  }
  let xr = tPeakIdx + windowIso[0], minDeriv = Infinity
  for (let i = tPeakIdx + windowIso[0]; i < tPeakIdx + windowIso[1] && i < samples.length; i++) {
    const d = Math.abs(samples[i+1] - samples[i])
    if (d < minDeriv) { minDeriv = d; xr = i }
  }
  let maxArea = -Infinity, tend = xm
  for (let xi = xm; xi <= xr; xi++) {
    const area = 0.5 * (samples[xm] - samples[xi]) * (xr - xi)
    if (area > maxArea) { maxArea = area; tend = xi }
  }
  return tend
}

// --- Complex number helpers ---
function cadd(a, b) { return { re: a.re + b.re, im: a.im + b.im } }
function csub(a, b) { return { re: a.re - b.re, im: a.im - b.im } }
function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re } }
function cexp(theta) { return { re: Math.cos(theta), im: Math.sin(theta) } }
function cconj(a) { return { re: a.re, im: -a.im } }
function creal(a) { return a.re }
function cdiv(a, b) {
  const denom = b.re * b.re + b.im * b.im
  return { re: (a.re * b.re + a.im * b.im) / denom, im: (a.im * b.re - a.re * b.im) / denom }
}

// Helper: pad array to next power of 2
function padToNextPow2(arr) {
  const n = arr.length, pow2 = 1 << (32 - Math.clz32(n - 1))
  if (n === pow2) return arr
  if (typeof arr[0] === 'object') return arr.concat(Array(pow2 - n).fill({ re: 0, im: 0 }))
  return arr.concat(Array(pow2 - n).fill(0))
}

// Real FrFT implementation (discrete, based on Ozaktas et al., 1996)
function frft(signal, alpha) {
  let N = signal.length
  if (alpha % 2 === 0) return signal.slice()
  if (alpha % 2 === 1) return signal.slice().reverse()
  if (alpha === 0) return signal.slice()
  if (alpha === 1) return dft(signal)
  const pi = Math.PI
  const a = alpha * pi / 2
  const tana2 = Math.tan(a / 2)
  const sina = Math.sin(a)
  if (Math.abs(sina) < 1e-10) return dft(signal)
  // Chirp premultiplication
  let x = []
  for (let n = 0; n < N; n++) {
    const phase = -pi * n * n * tana2 / N
    const c = cexp(phase)
    x.push({ re: signal[n] * c.re, im: signal[n] * c.im })
  }
  // Chirp convolution (via FFT)
  let c = []
  for (let n = 0; n < N; n++) {
    const phase = pi * n * n * tana2 / N
    c.push(cexp(phase))
  }
  // Pad to next power of 2
  const N2 = 1 << (32 - Math.clz32(N - 1))
  x = padToNextPow2(x)
  c = padToNextPow2(c)
  const X = fft(x)
  const C = fft(c)
  const Y = []
  for (let n = 0; n < X.length; n++) Y.push(cmul(X[n], C[n]))
  const y = ifft(Y)
  // Chirp postmultiplication
  const out = []
  for (let n = 0; n < N; n++) {
    const phase = -pi * n * n * tana2 / N
    const cc = cexp(phase)
    const v = cmul(y[n], cc)
    out.push(v.re / Math.sqrt(Math.abs(sina)))
  }
  return out
}

// Simple DFT (for fallback, not efficient)
function dft(signal) {
  const N = signal.length
  const out = []
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0
    for (let n = 0; n < N; n++) {
      const phi = -2 * Math.PI * k * n / N
      re += signal[n] * Math.cos(phi)
      im += signal[n] * Math.sin(phi)
    }
    out.push(re)
  }
  return out
}

// Simple FFT and IFFT (Cooley-Tukey, radix-2, complex input)
function fft(signal) {
  const N = signal.length
  if (N <= 1) return [signal[0]]
  if (N % 2 !== 0) throw new Error('FFT length must be power of 2')
  const even = fft(signal.filter((_, i) => i % 2 === 0))
  const odd = fft(signal.filter((_, i) => i % 2 === 1))
  const out = new Array(N)
  for (let k = 0; k < N / 2; k++) {
    const tw = cexp(-2 * Math.PI * k / N)
    const t = cmul(tw, odd[k])
    out[k] = cadd(even[k], t)
    out[k + N / 2] = csub(even[k], t)
  }
  return out
}
function ifft(signal) {
  const N = signal.length
  const conj = signal.map(cconj)
  const out = fft(conj).map(cconj)
  return out.map(z => ({ re: z.re / N, im: z.im / N }))
}

EcgService.prototype.termaFrftTPeak = function(samples, rPeakIdx, fs) {
  // 1. Zero out QRS region (±60ms around R-peak)
  const qrsWin = Math.floor(0.06 * fs)
  const sig = samples.slice()
  for (let i = Math.max(0, rPeakIdx - qrsWin); i <= Math.min(samples.length - 1, rPeakIdx + qrsWin); i++) sig[i] = 0

  // 2. Apply FrFT (placeholder, use real FrFT in production)
  const frftSig = frft(sig, 0.01)

  // 3. Square/enhance
  const enhanced = frftSig.map(x => x * x)

  // 4. Compute two moving averages (short/long window)
  const W1 = Math.floor(0.12 * fs) // T-wave duration ~120ms
  const W2 = Math.floor(0.4 * fs)  // QT interval ~400ms
  const maShort = movingAverage(enhanced, W1)
  const maLong = movingAverage(enhanced, W2)

  // 5. Find blocks where short MA > long MA (block of interest)
  let blocks = [], inBlock = false, blockStart = 0
  for (let i = rPeakIdx + Math.floor(0.1 * fs); i < enhanced.length; i++) {
    if (maShort[i] > maLong[i]) {
      if (!inBlock) { inBlock = true; blockStart = i }
    } else {
      if (inBlock) { blocks.push([blockStart, i - 1]); inBlock = false }
    }
  }
  if (inBlock) blocks.push([blockStart, enhanced.length - 1])

  // 6. T-peak = max in first block after R-peak
  let tPeakIdx = null
  if (blocks.length > 0) {
    const [start, end] = blocks[0]
    let maxVal = -Infinity
    for (let i = start; i <= end; i++) {
      if (samples[i] > maxVal) { maxVal = samples[i]; tPeakIdx = i }
    }
  }
  return tPeakIdx
}

// Helper: moving average
function movingAverage(arr, win) {
  const out = new Array(arr.length).fill(0)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= win) sum -= arr[i - win]
    out[i] = i >= win - 1 ? sum / win : sum / (i + 1)
  }
  return out
} 