import { Subject } from 'rxjs'
import { share } from 'rxjs/operators'
import { opts } from './store.js'

export default class Acc {
  constructor(device) {
    // Device reference
    this.device = device
    
    // RxJS Subjects for observables
    this.rawAccDataSubject = new Subject()
    this.processedDataSubject = new Subject()
    this.medianDataSubject = new Subject()
    
    // Data storage
    this.accData = []     // Buffer for incoming data
    this.timeData = []    // Timestamps for processed data
    this.axData = []      // X-axis processed values
    this.ayData = []      // Y-axis processed values
    this.azData = []      // Z-axis processed values
    this.startTime = null // Reference time for all measurements
    
    // Processing parameters
    this.scaleFactor = 0.01
    this.sampleIndex = 0
    this.baselineValues = null
    this.calibrationCount = 20
    this.lastDataTime = 0
    this.medianWindowSeconds = 0.3
    
    // Retry control - DISABLED to prevent GATT operation cascades
    this.retryCount = 0
    this.maxRetries = 0  // Set to 0 to disable auto-retry
    this.isInitializing = false
    
    // Stabilization tracking
    this.isStabilized = false
    this.stabilizationSamples = 40  // Number of samples to wait before considering data stable
    this.initialValueRange = { min: -0.2, max: 0.2 } // Expected normal range for stable data
    
    // Processed median values cache
    this.medianValueCache = {
      x: new Map(), // Maps time window start to median value
      y: new Map(),
      z: new Map()
    }
    
    // Device subscription
    this.subscription = null
    
    // Auto-start if device provided (TEMPORALLY DISABLED)
    // Commented to prevent ECG interference
    // if (device) {
    //   // Wait a brief moment to ensure device is fully initialized
    //   setTimeout(() => this.initialize(), 100)
    // }
  }
  
  initialize() {
    if (!this.device || typeof this.device.observeAccelerometer !== 'function') {
      return
    }
    
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      return
    }
    
    // Check retry limit
    if (this.retryCount >= this.maxRetries) {
      console.warn('Accelerometer: Max retries reached, stopping attempts')
      return
    }
    
    this.isInitializing = true
    this.resetDataArrays()
    
    try {
      const observable = this.device.observeAccelerometer()
      
      if (!observable || typeof observable.subscribe !== 'function') {
        this.isInitializing = false
        return;
      }
      
      this.subscription = observable.subscribe({
        next: accBatch => {
          // Reset retry count on successful data reception
          this.retryCount = 0

          if (Array.isArray(accBatch)) {
            this.accData = accBatch
          } else {
            this.accData = [accBatch]
          }
          this.processAccelerometerData()
        },
        error: (err) => {
          console.debug('Accelerometer subscription error (non-critical):', err.message)
          this.isInitializing = false
          // Do not auto-retry to prevent GATT operation cascades
        }
      })

      this.isInitializing = false
    } catch (err) {
      console.debug('Accelerometer initialization error (non-critical):', err.message)
      this.isInitializing = false
      // Do not auto-retry to prevent GATT operation cascades
    }
  }
  
  resetDataArrays() {
    this.axData = []
    this.ayData = []
    this.azData = []
    this.timeData = []
    this.startTime = null
    this.sampleIndex = 0
    this.baselineValues = null
    this.lastDataTime = 0
    this.isStabilized = false
    
    // Reset median caches
    this.medianValueCache = {
      x: new Map(),
      y: new Map(),
      z: new Map()
    }
  }
  
  processAccelerometerData() {
    if (!this.accData || this.accData.length === 0) {
      return
    }
    
    try {
      // Get the batch of data to process
      const dataToProcess = [...this.accData]
      this.accData = [] // Clear buffer for next batch
      
      if (!Array.isArray(dataToProcess) || dataToProcess.length === 0) return
      
      // Set up time tracking if not already done
      if (!this.startTime) {
        this.startTime = Date.now()
      }
      
      const rawXData = []
      const rawYData = []
      const rawZData = []
      const rawTimeData = []
      
      // Process each reading in the batch: scale and calculate time
      dataToProcess.forEach(reading => {
        if (!reading || typeof reading !== 'object' || !('x' in reading) || !('y' in reading) || !('z' in reading)) {
          return // Skip invalid readings
        }
        
        // Scale the values
        let x = reading.x * this.scaleFactor
        let y = reading.y * this.scaleFactor
        let z = reading.z * this.scaleFactor
        
        // Calculate time relative to start
        const now = Date.now()
        const elapsedSeconds = (now - this.startTime) / 1000
        
        // Apply baseline normalization if available
        if (this.baselineValues) {
          x -= this.baselineValues.x
          y -= this.baselineValues.y
          z -= this.baselineValues.z
        }
        
        // Store raw (scaled, baselined) data with timestamps
        rawTimeData.push(elapsedSeconds)
        rawXData.push(x)
        rawYData.push(y)
        rawZData.push(z)
        
        this.sampleIndex++
      })
      
      // Update the last time we received data
      this.lastDataTime = Date.now()
      
      // Emit raw data
      this.rawAccDataSubject.next({
        times: rawTimeData,
        x: rawXData,
        y: rawYData,
        z: rawZData
      })
      
      // Try to calculate baseline values if we don't have them yet
      if (!this.baselineValues && this.sampleIndex >= this.calibrationCount) {
        this.calculateBaseline()
      }
      
      // Check if data has stabilized
      if (!this.isStabilized) {
        this.checkDataStabilization(rawXData, rawYData, rawZData)
      }
      
      // Aggregate data into fixed time intervals using the median window
      const { aggregatedTimes, aggregatedX, aggregatedY, aggregatedZ } = this.aggregateDataByInterval(
        rawTimeData, rawXData, rawYData, rawZData, this.medianWindowSeconds
      )
      
      // If aggregation produced no points, stop here
      if (aggregatedTimes.length === 0) return
      
      // Remove outliers from aggregated data
      const cleanedXData = this.removeOutliers(aggregatedX)
      const cleanedYData = this.removeOutliers(aggregatedY)
      const cleanedZData = this.removeOutliers(aggregatedZ)
      
      // Add aggregated, cleaned data to main arrays
      this.timeData.push(...aggregatedTimes)
      this.axData.push(...cleanedXData)
      this.ayData.push(...cleanedYData)
      this.azData.push(...cleanedZData)
      
      // In initial unstable phase, consider discarding extreme values
      if (!this.isStabilized && this.timeData.length > 0) {
        this.filterInitialExtremes()
      }
      
      // Emit processed data
      this.processedDataSubject.next({
        times: aggregatedTimes,
        x: cleanedXData,
        y: cleanedYData,
        z: cleanedZData,
        isStabilized: this.isStabilized
      })
      
      // Calculate and emit median data
      this.updateMedianData()
      
      // Prune old data outside our history window
      this.pruneOldData()
    } catch {
      // Silent fail - data will be processed in next batch
    }
  }
  
  // Check if accelerometer data has stabilized
  checkDataStabilization(xData, yData, zData) {
    if (this.sampleIndex < this.stabilizationSamples) {
      return // Not enough samples yet
    }
    
    // Calculate standard deviation of recent values
    const recentValues = { x: [], y: [], z: [] }
    const numSamples = Math.min(30, xData.length)
    
    for (let i = xData.length - numSamples; i < xData.length; i++) {
      if (i >= 0) {
        recentValues.x.push(xData[i])
        recentValues.y.push(yData[i])
        recentValues.z.push(zData[i])
      }
    }
    
    // Calculate statistics for each axis
    const stats = {
      x: this.calculateStats(recentValues.x),
      y: this.calculateStats(recentValues.y),
      z: this.calculateStats(recentValues.z)
    }
    
    // Data is considered stable if:
    // 1. We have enough samples (already checked above)
    // 2. The standard deviations are reasonably low (relaxed from 0.05)
    // 3. The range isn't extremely large (removed tight bound requirements)
    const isStable = (
      // Check that standard deviations are reasonable 
      // (we need to allow for normal movement and small changes)
      stats.x.stdDev < 0.15 && 
      stats.y.stdDev < 0.15 && 
      stats.z.stdDev < 0.15 &&
      
      // Check that values are within reasonable bounds
      // (removed the strict min/max range check)
      Math.abs(stats.x.max - stats.x.min) < 0.5 &&
      Math.abs(stats.y.max - stats.y.min) < 0.5 &&
      Math.abs(stats.z.max - stats.z.min) < 0.5
    )
    
    if (isStable || this.sampleIndex > 200) {
      this.isStabilized = true
    }
  }
  
  // Calculate statistics for an array of values
  calculateStats(values) {
    if (!values || values.length === 0) {
      return { min: 0, max: 0, mean: 0, stdDev: 1 }
    }
    
    const min = Math.min(...values)
    const max = Math.max(...values)
    const sum = values.reduce((acc, val) => acc + val, 0)
    const mean = sum / values.length
    
    const sumSqDiff = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0)
    const variance = sumSqDiff / values.length
    const stdDev = Math.sqrt(variance)
    
    return { min, max, mean, stdDev }
  }
  
  // Filter extreme values during initial unstable phase
  filterInitialExtremes() {
    if (this.timeData.length < 5) return // Need some data points
    
    // Look for extreme outliers in the data
    const maxAllowedMagnitude = 1.0 // Max allowed initial acceleration magnitude
    
    // Check the current ranges
    const currentData = {
      x: [...this.axData],
      y: [...this.ayData],
      z: [...this.azData]
    }
    
    const stats = {
      x: this.calculateStats(currentData.x),
      y: this.calculateStats(currentData.y),
      z: this.calculateStats(currentData.z)
    }
    
    // If any axis has extreme ranges, clip the values
    const needsFiltering = 
      Math.abs(stats.x.min) > maxAllowedMagnitude || 
      Math.abs(stats.x.max) > maxAllowedMagnitude ||
      Math.abs(stats.y.min) > maxAllowedMagnitude || 
      Math.abs(stats.y.max) > maxAllowedMagnitude ||
      Math.abs(stats.z.min) > maxAllowedMagnitude || 
      Math.abs(stats.z.max) > maxAllowedMagnitude
    
    if (needsFiltering) {
      console.log('Filtering extreme initial values')
      
      // Identify extreme values
      for (let i = 0; i < this.timeData.length; i++) {
        if (Math.abs(this.axData[i]) > maxAllowedMagnitude) {
          this.axData[i] = Math.sign(this.axData[i]) * maxAllowedMagnitude
        }
        if (Math.abs(this.ayData[i]) > maxAllowedMagnitude) {
          this.ayData[i] = Math.sign(this.ayData[i]) * maxAllowedMagnitude
        }
        if (Math.abs(this.azData[i]) > maxAllowedMagnitude) {
          this.azData[i] = Math.sign(this.azData[i]) * maxAllowedMagnitude
        }
      }
    }
  }
  
  aggregateDataByInterval(times, xData, yData, zData, intervalSeconds) {
    if (!times || times.length === 0) {
      return { aggregatedTimes: [], aggregatedX: [], aggregatedY: [], aggregatedZ: [] }
    }

    const timeBins = {}

    // Group data into time bins
    for (let i = 0; i < times.length; i++) {
      const time = times[i]
      const binStartTime = Math.floor(time / intervalSeconds) * intervalSeconds

      if (!timeBins[binStartTime]) {
        timeBins[binStartTime] = { x: [], y: [], z: [] }
      }

      // Add valid data points to the corresponding bin
      if (typeof xData[i] === 'number' && !isNaN(xData[i])) timeBins[binStartTime].x.push(xData[i])
      if (typeof yData[i] === 'number' && !isNaN(yData[i])) timeBins[binStartTime].y.push(yData[i])
      if (typeof zData[i] === 'number' && !isNaN(zData[i])) timeBins[binStartTime].z.push(zData[i])
    }

    // Calculate median for each bin and prepare output arrays
    const aggregatedTimes = []
    const aggregatedX = []
    const aggregatedY = []
    const aggregatedZ = []

    // Sort bins by time
    const sortedBinKeys = Object.keys(timeBins).map(parseFloat).sort((a, b) => a - b)

    sortedBinKeys.forEach(binStartTime => {
      const binData = timeBins[binStartTime]
      aggregatedTimes.push(binStartTime)
      aggregatedX.push(binData.x.length > 0 ? this.calculateMedian(binData.x) : NaN)
      aggregatedY.push(binData.y.length > 0 ? this.calculateMedian(binData.y) : NaN)
      aggregatedZ.push(binData.z.length > 0 ? this.calculateMedian(binData.z) : NaN)
    })

    return { aggregatedTimes, aggregatedX, aggregatedY, aggregatedZ }
  }
  
  // Calculate median of an array efficiently
  calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  
  // Remove statistical outliers from data
  removeOutliers(data, windowSize = 5, threshold = 2.0) {
    if (!data || data.length < windowSize) return data

    const result = [...data]
    const halfWindow = Math.floor(windowSize / 2)

    for (let i = 0; i < data.length; i++) {
      const currentValue = data[i]
      if (typeof currentValue !== 'number' || isNaN(currentValue)) continue

      let windowValues = []
      for (let j = -halfWindow; j <= halfWindow; j++) {
        if (j === 0) continue // Skip the point itself
        const idx = i + j
        if (idx >= 0 && idx < data.length) {
          const val = data[idx]
          if (typeof val === 'number' && !isNaN(val)) {
            windowValues.push(val)
          }
        }
      }

      if (windowValues.length < 2) continue

      const sum = windowValues.reduce((acc, val) => acc + val, 0)
      const mean = sum / windowValues.length
      const variance = windowValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / windowValues.length
      const stdDev = Math.sqrt(variance)

      if (stdDev > 0 && Math.abs(currentValue - mean) > threshold * stdDev) {
        result[i] = NaN
      }
    }
    return result
  }
  
  // Update median data for all axes
  updateMedianData() {
    if (this.timeData.length < 2) return
    
    try {
      const latestTime = this.timeData[this.timeData.length - 1]
      const oldestTimeToKeep = Math.max(0, latestTime - opts.historyInterval)
      const timeWindow = this.medianWindowSeconds
      
      // Ensure we have a valid medianValueCache
      if (!this.medianValueCache) {
        this.medianValueCache = {
          x: new Map(),
          y: new Map(),
          z: new Map()
        }
      }
      
      // Clean up old cache entries
      ['x', 'y', 'z'].forEach(axis => {
        // Ensure this axis exists in the cache
        if (!this.medianValueCache[axis]) {
          this.medianValueCache[axis] = new Map()
        }
        
        const medianCache = this.medianValueCache[axis]
        
        // Remove old windows
        const windowsToRemove = []
        medianCache.forEach((value, windowStart) => {
          if (windowStart < oldestTimeToKeep) {
            windowsToRemove.push(windowStart)
          }
        })
        windowsToRemove.forEach(window => medianCache.delete(window))
        
        // Calculate new median values
        const dataArray = axis === 'x' ? this.axData : axis === 'y' ? this.ayData : this.azData
        
        // Get all window start times in the visible range, properly aligned
        const windowStep = timeWindow
        const firstWindowStart = Math.floor(oldestTimeToKeep / windowStep) * windowStep
        
        for (let windowStart = firstWindowStart; windowStart <= latestTime - windowStep; windowStart += windowStep) {
          // Skip if outside visible range or already calculated
          if (windowStart + windowStep < oldestTimeToKeep || medianCache.has(windowStart)) continue
          
          const windowEnd = windowStart + timeWindow
          const pointsInWindow = { values: [], times: [] }
          
          // Find all points in this time window
          for (let i = 0; i < this.timeData.length; i++) {
            const time = this.timeData[i]
            if (time >= windowStart && time < windowEnd) {
              const value = dataArray[i]
              if (typeof value === 'number' && !isNaN(value)) {
                pointsInWindow.values.push(value)
                pointsInWindow.times.push(time)
              }
            }
          }
          
          // Calculate and cache the median
          if (pointsInWindow.values.length > 0) {
            const medianValue = this.calculateMedian(pointsInWindow.values)
            medianCache.set(windowStart, medianValue)
          } else if (windowStart > oldestTimeToKeep + timeWindow) {
            // For empty windows, interpolate using previous window
            const prevWindow = windowStart - timeWindow
            if (medianCache.has(prevWindow)) {
              medianCache.set(windowStart, medianCache.get(prevWindow))
            }
          }
        }
      })
      
      // Build path points from median values
      const medianData = { times: [], x: [], y: [], z: [] }
      
      // Ensure x axis cache exists before trying to get its keys
      if (!this.medianValueCache.x) {
        this.medianValueCache.x = new Map()
        return // No data to process yet
      }
      
      // Sort window starts in ascending order
      const windowStarts = Array.from(this.medianValueCache.x.keys())
        .filter(start => start >= oldestTimeToKeep)
        .sort((a, b) => a - b)
      
      if (windowStarts.length === 0) return // No data points to create a path
      
      // Extract values for each axis
      windowStarts.forEach(windowStart => {
        const windowEnd = windowStart + timeWindow
        
        // Add point at window start
        medianData.times.push(windowStart)
        medianData.x.push(this.medianValueCache.x.get(windowStart) || NaN)
        medianData.y.push(this.medianValueCache.y ? (this.medianValueCache.y.get(windowStart) || NaN) : NaN)
        medianData.z.push(this.medianValueCache.z ? (this.medianValueCache.z.get(windowStart) || NaN) : NaN)
        
        // Add point at window end with same values (creates step function)
        if (windowStarts.indexOf(windowEnd) === -1) {
          medianData.times.push(windowEnd)
          medianData.x.push(this.medianValueCache.x.get(windowStart) || NaN)
          medianData.y.push(this.medianValueCache.y ? (this.medianValueCache.y.get(windowStart) || NaN) : NaN)
          medianData.z.push(this.medianValueCache.z ? (this.medianValueCache.z.get(windowStart) || NaN) : NaN)
        }
      })
      
      // Emit the median data
      this.medianDataSubject.next(medianData)
    } catch (error) {
      console.error('Error updating median data:', error)
      
      // If we encountered an error, reset the cache to prevent cascading errors
      this.medianValueCache = {
        x: new Map(),
        y: new Map(),
        z: new Map()
      }
    }
  }
  
  pruneOldData() {
    if (this.timeData.length === 0) return
    
    const latestTime = this.timeData[this.timeData.length - 1]
    const cutoffTime = latestTime - opts.historyInterval
    
    // Find the index of the first data point to keep
    let cutoffIndex = 0
    while (cutoffIndex < this.timeData.length && this.timeData[cutoffIndex] < cutoffTime) {
      cutoffIndex++
    }
    
    // Remove old data
    if (cutoffIndex > 0) {
      this.timeData = this.timeData.slice(cutoffIndex)
      this.axData = this.axData.slice(cutoffIndex)
      this.ayData = this.ayData.slice(cutoffIndex)
      this.azData = this.azData.slice(cutoffIndex)
    }
  }
  
  calculateBaseline() {
    if (this.axData.length < this.calibrationCount) return
    
    let sumX = 0, sumY = 0, sumZ = 0
    for (let i = 0; i < this.calibrationCount; i++) {
      sumX += this.axData[i]
      sumY += this.ayData[i]
      sumZ += this.azData[i]
    }
    
    this.baselineValues = {
      x: sumX / this.calibrationCount,
      y: sumY / this.calibrationCount,
      z: sumZ / this.calibrationCount
    }
    
    console.log('Established accelerometer baseline values:', this.baselineValues)
  }
  
  // Update median window size
  setMedianWindowSeconds(seconds) {
    if (this.medianWindowSeconds !== seconds) {
      this.medianWindowSeconds = seconds
      
      // Reset data to force reprocessing with new interval
      this.resetDataArrays()
    }
  }
  
  // Get observables for subscribers
  getRawDataObservable() {
    return this.rawAccDataSubject.asObservable().pipe(share())
  }
  
  getProcessedDataObservable() {
    return this.processedDataSubject.asObservable().pipe(share())
  }
  
  getMedianDataObservable() {
    return this.medianDataSubject.asObservable().pipe(share())
  }
  
  // Get current state
  getCurrentData() {
    return {
      processed: {
        times: [...this.timeData],
        x: [...this.axData],
        y: [...this.ayData],
        z: [...this.azData]
      },
      median: {
        windowSeconds: this.medianWindowSeconds,
        x: new Map(this.medianValueCache.x),
        y: new Map(this.medianValueCache.y),
        z: new Map(this.medianValueCache.z)
      }
    }
  }
  
  // Clean up when service is no longer needed
  destroy() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
    
    this.resetDataArrays()
  }
} 