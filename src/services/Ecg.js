import { Subject, BehaviorSubject, Observable } from 'rxjs'
import { share, map, filter } from 'rxjs/operators'
import log from '@/log'

export default class EcgService {
  constructor(device) {
    // Device reference
    this.device = device
    
    // Data storage
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
    
    // ECG sampling rate from device
    this.samplingRate = device.ecgSamplingRate
    
    // Device subscription
    this.deviceSubscription = null
    
    // Initialize the service
    this.initialize()
  }
  
  initialize() {
    if (this.device && this.device.observeEcg) {
      // Subscribe to the device's ECG observable
      this.deviceSubscription = this.device
        .observeEcg()
        .subscribe(data => this.handleData(data))
    } else {
      console.error('Device does not support ECG functionality')
    }
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
    
    // Process and normalize new ECG data
    const normalizedData = this.normalizeData(data)
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
  
  normalizeData(rawData) {
    // Apply a combination of filtering techniques to reduce noise
    
    // 1. Moving average filter to smooth the signal
    const movingAvgWindowSize = Math.max(3, Math.floor(this.samplingRate * 0.01)) // ~10ms window
    const smoothedData = this.applyMovingAverage(rawData, movingAvgWindowSize)
    
    // 2. Baseline correction
    // Get the last chunk of normalized data to ensure continuity
    const dataForBaseline = [...this.normalizedEcg.slice(-100), ...smoothedData]
    const baselineCorrected = this.removeBaseline(dataForBaseline)
    
    // Return only the newly processed data
    return baselineCorrected.slice(-rawData.length)
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
    
    // Get a window of the most recent ECG samples for analysis
    const windowDuration = 5 // seconds
    const windowSize = Math.floor(windowDuration * this.samplingRate)
    
    // Use normalized ECG data for analysis
    const samples = this.normalizedEcg.slice(-windowSize)
    // Original ECG samples for visualization and metrics
    const originalSamples = this.ecgSamples.slice(-windowSize)
    
    // Step 1: Detect R peaks (QRS complex) in normalized data
    const rPeaks = this.detectRPeaks(samples)
    
    if (rPeaks.length < 2) return

    // Step 2: Refine R peak positions using original signal to ensure they're at the true peaks
    const refinedRPeaks = this.refineRPeaks(rPeaks, originalSamples)

    // Emit detected R peaks using original ECG values and refined positions
    const fullArrayOffset = this.ecgSamples.length - windowSize
    refinedRPeaks.forEach(rPeakIndex => {
      const rPeakFullIndex = fullArrayOffset + rPeakIndex
      this.rPeakSubject.next({
        index: rPeakFullIndex,
        time: this.ecgTimes[rPeakFullIndex],
        value: this.ecgSamples[rPeakFullIndex]
      })
    })
    
    // Process each R peak to find corresponding Q and T points
    // We'll process multiple peaks to increase the chance of detection
    const processedPeaks = Math.min(refinedRPeaks.length, 5) // Increase from 3 to 5 
    
    for (let i = refinedRPeaks.length - processedPeaks; i < refinedRPeaks.length; i++) {
      const rPeakIndex = refinedRPeaks[i]
      
      // Use normalized data for Q and T detection
      const qPoint = this.findQPoint(samples, rPeakIndex)
      const tEnd = this.findTEnd(samples, rPeakIndex, refinedRPeaks)
      
      if (qPoint !== null && tEnd !== null) {
        // Calculate absolute indices in the full ECG array
        const qPointFullIndex = fullArrayOffset + qPoint
        const tEndFullIndex = fullArrayOffset + tEnd
        
        // Calculate QT interval in milliseconds
        const qtInterval = ((tEnd - qPoint) / this.samplingRate) * 1000
        
        // Use a wider range for validation (230-660ms) to capture more variations
        if (qtInterval >= 230 && qtInterval <= 660) {
          // Emit the Q and T points using original ECG values for display
          this.qPointSubject.next({
            index: qPointFullIndex,
            time: this.ecgTimes[qPointFullIndex],
            value: this.ecgSamples[qPointFullIndex]
          })
          
          this.tEndSubject.next({
            index: tEndFullIndex,
            time: this.ecgTimes[tEndFullIndex],
            value: this.ecgSamples[tEndFullIndex]
          })
          
          // Emit the QT interval
          this.qtIntervalSubject.next({
            qtInterval,
            qPointIndex: qPointFullIndex,
            tEndIndex: tEndFullIndex,
            qPointTime: this.ecgTimes[qPointFullIndex],
            tEndTime: this.ecgTimes[tEndFullIndex],
            rPeakIndex: fullArrayOffset + rPeakIndex,
            rPeakTime: this.ecgTimes[fullArrayOffset + rPeakIndex]
          })
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
  
  findTEnd(samples, rPeakIndex, rPeaks) {
    // Get heart rate to adjust T wave search window
    const heartRate = this.estimateHeartRate(samples)
    const rrInterval = 60000 / Math.max(40, heartRate) // in ms
    
    // Adaptive search windows based on heart rate
    // Higher heart rates have T waves closer to the R peak
    const minTSearchMs = Math.max(100, rrInterval * 0.15) // Increase minimum to 15% of RR
    const maxTSearchMs = Math.min(500, rrInterval * 0.60) // Decrease maximum to 60% of RR and cap at 500ms
    
    const minTSearch = rPeakIndex + Math.floor((minTSearchMs / 1000) * this.samplingRate)
    
    // Don't search beyond the next R peak if it exists and is close
    let maxTSearch = Math.min(
      samples.length - 1, 
      rPeakIndex + Math.floor((maxTSearchMs / 1000) * this.samplingRate)
    )
    
    // Find next R peak to limit T wave search
    const nextRPeakIndex = rPeaks.find(index => index > rPeakIndex)
    if (nextRPeakIndex && nextRPeakIndex < maxTSearch) {
      // Limit search to 80% of the way to the next R peak
      maxTSearch = rPeakIndex + Math.floor(0.8 * (nextRPeakIndex - rPeakIndex))
    }
    
    // Prepare the segment from the R peak to the maxTSearch for analysis
    const segment = samples.slice(rPeakIndex, maxTSearch + 1)
    
    // Apply additional smoothing for T wave detection
    const smoothedSegment = this.applyMovingAverage(segment, Math.ceil(this.samplingRate * 0.03))
    
    // Calculate derivatives
    const firstDerivative = this.calculateDerivative(smoothedSegment)
    
    // Step 1: Find the T wave peak first
    let tPeakIndex = null
    let maxTValue = -Infinity
    
    // Typical T wave occurs at about 300ms after the R peak
    const expectedTPeakTime = Math.min(
      Math.floor(0.3 * this.samplingRate), 
      Math.floor((maxTSearch - rPeakIndex) * 0.5)
    )
    
    // Weight function that gives preference to points near the expected T location
    for (let i = Math.floor(minTSearchMs / 1000 * this.samplingRate); i < smoothedSegment.length; i++) {
      // Skip the segment right after R peak that might include S wave
      if (i < Math.floor(0.08 * this.samplingRate)) continue
      
      // Check if this is a local maximum in the smoothed data
      if (i > 0 && i < smoothedSegment.length - 1 && 
          smoothedSegment[i] > smoothedSegment[i-1] && 
          smoothedSegment[i] >= smoothedSegment[i+1]) {
        
        // Weight by proximity to expected T peak
        const distanceWeight = 1 - Math.min(1, Math.abs(i - expectedTPeakTime) / (smoothedSegment.length * 0.5))
        const weightedValue = smoothedSegment[i] * (0.6 + 0.4 * distanceWeight)
        
        if (weightedValue > maxTValue) {
          maxTValue = weightedValue
          tPeakIndex = i
        }
      }
    }
    
    // If no T peak found by local maxima, try finding the highest point
    if (tPeakIndex === null) {
      for (let i = Math.floor(minTSearchMs / 1000 * this.samplingRate); i < smoothedSegment.length; i++) {
        // Skip the segment right after R peak that might include S wave
        if (i < Math.floor(0.08 * this.samplingRate)) continue
        
        if (smoothedSegment[i] > maxTValue) {
          maxTValue = smoothedSegment[i]
          tPeakIndex = i
        }
      }
    }
    
    // If still no peak, give up
    if (tPeakIndex === null) {
      return null
    }
    
    // Step 2: Find T wave end
    let tEndOffset = null
    
    // Look for where the first derivative approaches zero after T peak
    const endSearchStart = tPeakIndex + Math.floor(0.03 * this.samplingRate) // Start 30ms after T peak
    const endSearchEnd = Math.min(smoothedSegment.length - 1, tPeakIndex + Math.floor(0.2 * this.samplingRate)) // Up to 200ms after T peak
    
    // 1. Derivative-based approach: locate where derivative crosses zero
    for (let i = endSearchStart; i < endSearchEnd; i++) {
      // Get the derivative sign (positive, negative, or zero)
      const currentSign = Math.sign(firstDerivative[i])
      const nextSign = Math.sign(firstDerivative[i + 1])
      
      // Detect sign change
      if ((currentSign < 0 && nextSign >= 0) || Math.abs(firstDerivative[i]) < 0.2) {
        tEndOffset = i;
        break;
      }
    }
    
    // 2. If derivative approach failed, try tangent method
    if (tEndOffset === null) {
      // Find the point of inflection after T peak (where the concavity changes)
      let inflectionPoint = null
      let maxCurvature = 0
      
      for (let i = tPeakIndex + 1; i < Math.min(smoothedSegment.length - 1, tPeakIndex + Math.floor(0.15 * this.samplingRate)); i++) {
        // Approximate second derivative
        const secondDerivative = (firstDerivative[i] - firstDerivative[i-1]);
        if (Math.abs(secondDerivative) > maxCurvature) {
          maxCurvature = Math.abs(secondDerivative);
          inflectionPoint = i;
        }
      }
      
      if (inflectionPoint !== null) {
        // Define tangent at inflection point
        const tangentSlope = firstDerivative[inflectionPoint];
        const tangentIntercept = smoothedSegment[inflectionPoint] - tangentSlope * inflectionPoint;
        
        // Find where the signal crosses this tangent line
        for (let i = inflectionPoint + 1; i < smoothedSegment.length; i++) {
          const tangentValueAtI = tangentSlope * i + tangentIntercept;
          if ((smoothedSegment[i-1] >= tangentValueAtI && smoothedSegment[i] < tangentValueAtI) ||
              (smoothedSegment[i-1] <= tangentValueAtI && smoothedSegment[i] > tangentValueAtI)) {
            tEndOffset = i;
            break;
          }
        }
      }
    }
    
    // 3. If both approaches failed, use the classic method - threshold crossing
    if (tEndOffset === null) {
      // Find the baseline (average of segment parts likely not in the T wave)
      const baselineStart = Math.floor(maxTSearch - rPeakIndex) * 0.8;
      const baselineSegment = smoothedSegment.slice(Math.floor(baselineStart));
      const baseline = baselineSegment.reduce((a, b) => a + b, 0) / baselineSegment.length;
      
      // Find where the signal returns to baseline
      for (let i = tPeakIndex + 1; i < smoothedSegment.length; i++) {
        if (Math.abs(smoothedSegment[i] - baseline) < Math.abs(smoothedSegment[tPeakIndex] - baseline) * 0.2) {
          tEndOffset = i;
          break;
        }
      }
    }
    
    // If we still couldn't find T end, use an estimate
    if (tEndOffset === null) {
      // Estimate T end as 70ms after T peak for faster heart rates
      // or 100ms for slower heart rates
      const tEndDelay = heartRate > 70 ? 0.07 : 0.1;
      tEndOffset = Math.min(
        smoothedSegment.length - 1,
        tPeakIndex + Math.floor(tEndDelay * this.samplingRate)
      );
    }
    
    // Convert T end offset to the global index
    return rPeakIndex + tEndOffset;
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
   * Clean up resources when no longer needed.
   */
  destroy() {
    // Unsubscribe from device
    if (this.deviceSubscription) {
      this.deviceSubscription.unsubscribe()
      this.deviceSubscription = null
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
    
    // Clear data
    this.ecgSamples = []
    this.ecgTimes = []
    this.normalizedEcg = []
    this.rrIntervals = []
  }
} 