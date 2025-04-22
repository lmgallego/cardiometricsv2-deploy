<template>
  <CardWrapper title="Accelerometer">
    <div class="accelerometer-container">
      <div class="chart-controls">
        <div>History ({{ historyInterval }}s)</div>
        <div class="control-buttons">
          <div class="median-control">
            <span class="control-label">Window: {{ medianWindowSeconds.toFixed(1) }}s</span>
            <input type="range" min="0.1" max="1" step="0.1" v-model.number="medianWindowSeconds" class="slider">
          </div>
        </div>
      </div>
      <div class="chart-area">
        <div class="chart-scroll-container" ref="scrollContainer">
          <svg 
            ref="accelSvg"
            :width="chartWidth" 
            :height="chartHeight"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            preserveAspectRatio="none"
            class="accel-svg">
            
            <!-- Background grid -->
            <g class="grid-lines">
              <!-- Horizontal grid lines with labels -->
              <g v-for="line in horizontalGridLines" :key="`h-${line.y}`">
                <line x1="0" :x2="chartWidth" 
                      :y1="line.y" :y2="line.y" 
                      :stroke="gridColor" stroke-width="0.5" stroke-dasharray="3,3" />
                <text x="30" :y="line.y - 3" 
                      font-size="8" text-anchor="end" :fill="textColor">
                  {{ line.label }}
                </text>
              </g>
              
              <!-- Vertical grid lines -->
              <line v-for="line in verticalGridLines" :key="`v-${line.x}`"
                    :x1="line.x" :x2="line.x" 
                    :y1="0" :y2="chartHeight" 
                    :stroke="gridColor" stroke-width="0.5" stroke-dasharray="3,3" />
              
              <!-- Time labels -->
              <text v-for="line in verticalGridLines" :key="`t-${line.x}`" 
                    :x="line.x" 
                    :y="chartHeight - 5" 
                    font-size="10" 
                    text-anchor="middle"
                    :fill="textColor">
                {{ line.label }}
              </text>
              
              <!-- Center line (zero acceleration) - highlight it more -->
              <line x1="0" :x2="chartWidth" :y1="chartHeight/2" :y2="chartHeight/2" 
                    :stroke="zeroLineColor" stroke-width="1" />
            </g>
            
            <!-- Median lines -->
            <g class="median-lines">
              <!-- X-axis median line -->
              <path v-for="(path, index) in xMedianPaths" :key="`mx-${index}`"
                    :d="path"
                    fill="none" stroke="red" stroke-width="2" stroke-opacity="0.9" />
              
              <!-- Y-axis median line -->
              <path v-for="(path, index) in yMedianPaths" :key="`my-${index}`"
                    :d="path"
                    fill="none" stroke="lime" stroke-width="2" stroke-opacity="0.9" />
              
              <!-- Z-axis median line -->
              <path v-for="(path, index) in zMedianPaths" :key="`mz-${index}`"
                    :d="path"
                    fill="none" stroke="dodgerblue" stroke-width="2" stroke-opacity="0.9" />
            </g>
            
            <!-- Axis labels -->
            <text x="50" y="15" font-size="12" :fill="textColor">Acceleration (g)</text>
            
            <!-- Legend -->
            <g class="chart-legend" transform="translate(120, 15)">
              <g>
                <line x1="0" y1="0" x2="15" y2="0" stroke="red" stroke-width="2" stroke-opacity="0.9"/>
                <text x="20" y="5" font-size="12" :fill="textColor">X</text>
              </g>
              <g transform="translate(50, 0)">
                <line x1="0" y1="0" x2="15" y2="0" stroke="lime" stroke-width="2" stroke-opacity="0.9"/>
                <text x="20" y="5" font-size="12" :fill="textColor">Y</text>
              </g>
              <g transform="translate(100, 0)">
                <line x1="0" y1="0" x2="15" y2="0" stroke="dodgerblue" stroke-width="2" stroke-opacity="0.9"/>
                <text x="20" y="5" font-size="12" :fill="textColor">Z</text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  </CardWrapper>
</template>

<script>
import CardWrapper from './CardWrapper.vue'
import themeManager from '../services/ThemeManager.js'
import { opts } from '../services/store.js'
import { computed, watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Number of data points per polyline segment
const BATCH_SIZE = 100;
// Maximum number of segments to maintain for each axis
const MAX_SEGMENTS = 1000;
// Window size for moving average smoothing
const SMOOTHING_WINDOW = 15;

export default {
  components: {
    CardWrapper
  },
  props: ['device'],
  
  setup(props) {
    // References and state
    const accelSvg = ref(null);
    const scrollContainer = ref(null);
    const chartWidth = ref(800);
    const chartHeight = ref(400);
    
    // Dynamic range tracking
    const yMin = ref(-1);
    const yMax = ref(1);
    
    // Computed property for dynamic history interval
    const historyInterval = computed(() => opts.historyInterval);
    
    // Theme-dependent colors
    const textColor = computed(() => 
      themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'
    );
    
    const gridColor = computed(() => 
      themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    );
    
    const zeroLineColor = computed(() => 
      themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    );
    
    // Horizontal grid lines
    const horizontalGridLines = computed(() => {
      const lines = [];
      
      // Create grid lines at nice intervals based on current yMin and yMax
      const range = yMax.value - yMin.value;
      
      // Calculate a nice interval (0.01, 0.02, 0.05, 0.1, 0.2, 0.5) based on range
      // Use smaller divisions for finer detail when range is small
      let interval;
      if (range <= 0.05) interval = 0.01;
      else if (range <= 0.1) interval = 0.02;
      else if (range <= 0.2) interval = 0.05;
      else if (range <= 0.5) interval = 0.1;
      else if (range <= 1) interval = 0.2;
      else if (range <= 2) interval = 0.5;
      else interval = Math.ceil(range / 5);
      
      // Find the first grid line above yMin
      let value = Math.ceil(yMin.value / interval) * interval;
      
      // Add grid lines up to yMax
      while (value <= yMax.value) {
        const normalizedValue = (value - yMin.value) / (yMax.value - yMin.value);
        const y = chartHeight.value - (normalizedValue * chartHeight.value);
        
        lines.push({ 
          y, 
          value, 
          label: value === 0 ? '0' : value.toFixed(2) 
        });
        
        value += interval;
      }
      
      return lines;
    });
    
    // Vertical grid lines
    const verticalGridLines = computed(() => {
      const lines = [];
      const interval = historyInterval.value;
      
      // Create grid lines at fixed intervals
      let timeStep;
      
      // Adjust time step based on visible time span for optimal grid density
      if (interval <= 5) timeStep = 0.5;       // 0.5 second steps for small spans
      else if (interval <= 10) timeStep = 1;   // 1 second steps
      else if (interval <= 30) timeStep = 5;   // 5 second steps
      else if (interval <= 60) timeStep = 10;  // 10 second steps
      else timeStep = 30;                      // 30 second steps for large spans
      
      // Add grid lines at nice intervals
      for (let t = 0; t <= interval; t += timeStep) {
        const x = (t / interval) * chartWidth.value;
        lines.push({
          x,
          label: `${t.toFixed(1)}s`
        });
      }
      
      return lines;
    });
    
    // Resize observer
    let resizeObserver = null;
    
    // Function to update chart size based on container
    const updateChartSize = () => {
      if (!accelSvg.value) return;
      
      const container = scrollContainer.value || accelSvg.value.parentElement;
      if (container) {
        const containerWidth = container.clientWidth;
        chartWidth.value = containerWidth;
        chartHeight.value = container.clientHeight;
      }
    };
    
    // Watch for changes in history interval
    watch(historyInterval, () => {
      updateChartSize();
    });
    
    // Set up the resize observer on mount
    onMounted(() => {
      updateChartSize();
      
      // Set up resize observer for responsive sizing
      if (window.ResizeObserver && scrollContainer.value) {
        resizeObserver = new ResizeObserver(updateChartSize);
        resizeObserver.observe(scrollContainer.value);
      }
      
      // Fallback - listen to window resize
      window.addEventListener('resize', updateChartSize);
    });
    
    // Clean up on unmount
    onBeforeUnmount(() => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateChartSize);
    });
    
    return {
      accelSvg,
      scrollContainer,
      chartWidth,
      chartHeight,
      historyInterval,
      yMin,
      yMax,
      textColor,
      gridColor,
      zeroLineColor,
      horizontalGridLines,
      verticalGridLines
    };
  },
  
  data() {
    return {
      accData: [], // Array to store received accelerometer data
      axData: [],  // X-axis values
      ayData: [],  // Y-axis values
      azData: [],  // Z-axis values
      timeData: [], // Timestamps for each data point
      startTime: null,
      subscription: null,
      themeListener: null,
      scaleFactor: 0.01,
      sampleIndex: 0,
      baselineValues: null,
      calibrationCount: 20,
      // Processed batches tracking
      lastProcessedBatch: { x: [], y: [], z: [], time: [] },
      lastDataTime: 0,
      updateTimer: null,
      // Aggregation interval
      aggregationInterval: 0.2, // seconds
      // Median line controls
      medianWindowSeconds: 0.2,
      xMedianPaths: [],
      yMedianPaths: [],
      zMedianPaths: [],
      // Store precomputed median values and last processed time
      lastProcessedMedianTime: 0,
      medianValueCache: {
        x: new Map(), // Maps time window start to median value
        y: new Map(),
        z: new Map()
      }
    }
  },
  
  methods: {
    // Calculate SVG coordinates for a data point with normalized Y value
    calculateCoords(time, value, axis) {
      // Calculate X position based on time relative to current timeframe
      const latestTime = this.timeData[this.timeData.length - 1] || 0;
      const windowStart = Math.max(0, latestTime - this.historyInterval);
      
      // Normalize time to chart width
      const normalizedX = (time - windowStart) / this.historyInterval;
      const x = normalizedX * this.chartWidth;
      
      // Calculate Y coordinate with dynamic range
      const range = this.yMax - this.yMin;
      const normalizedValue = range !== 0 ? (value - this.yMin) / range : 0.5;
      const y = this.chartHeight - (normalizedValue * this.chartHeight);
      
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    },
    
    processAccelerometerData() {
      if (!this.accData || this.accData.length === 0) {
        return;
      }
      
      try {
        // Get the batch of data to process
        const dataToProcess = [...this.accData];
        this.accData = []; // Clear buffer for next batch
        
        if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
          // Set up time tracking if not already done
          if (!this.startTime) {
            this.startTime = Date.now();
            console.log('Accelerometer tracking started at:', new Date(this.startTime).toISOString());
          }
          
          const rawXData = [];
          const rawYData = [];
          const rawZData = [];
          const rawTimeData = [];
          
          // Process each reading in the batch: scale and calculate time
          dataToProcess.forEach((reading) => {
            if (!reading || typeof reading !== 'object' || !('x' in reading) || !('y' in reading) || !('z' in reading)) {
              return; // Skip invalid readings
            }
            
            // Scale the values
            let x = reading.x * this.scaleFactor;
            let y = reading.y * this.scaleFactor;
            let z = reading.z * this.scaleFactor;
            
            // Calculate time relative to start
            const now = Date.now(); // Use timestamp of processing
            const elapsedSeconds = (now - this.startTime) / 1000;
            
            // Apply baseline normalization if available
            if (this.baselineValues) {
              x -= this.baselineValues.x;
              y -= this.baselineValues.y;
              z -= this.baselineValues.z;
            }
            
            // Store raw (scaled, baselined) data with timestamps
            rawTimeData.push(elapsedSeconds);
            rawXData.push(x);
            rawYData.push(y);
            rawZData.push(z);
            
            this.sampleIndex++;
          });
          
          // Update the last time we received data
          this.lastDataTime = Date.now();
          
          // Try to calculate baseline values if we don't have them yet (using raw scaled data count)
          if (!this.baselineValues && this.sampleIndex >= this.calibrationCount) {
            // Note: Baseline calc now uses raw scaled data before potential aggregation
            this.calculateBaseline(); // Recalculate baseline using all data so far
          }
          
          // Step 1: Aggregate data into fixed time intervals
          const { aggregatedTimes, aggregatedX, aggregatedY, aggregatedZ } = this.aggregateDataByInterval(
            rawTimeData, rawXData, rawYData, rawZData, this.aggregationInterval
          );
          
          // If aggregation produced no points, stop here
          if (aggregatedTimes.length === 0) {
              return;
          }

          // Step 2: Remove outliers from aggregated data
          const cleanedXData = this.removeOutliers(aggregatedX);
          const cleanedYData = this.removeOutliers(aggregatedY);
          const cleanedZData = this.removeOutliers(aggregatedZ);
          
          // Add aggregated, cleaned data to main arrays
          this.timeData.push(...aggregatedTimes);
          this.axData.push(...cleanedXData);
          this.ayData.push(...cleanedYData);
          this.azData.push(...cleanedZData);
          
          // Debug info occasionally
          if (this.sampleIndex % 100 < dataToProcess.length) { // Log roughly every 100 samples
            console.log(`Accelerometer: ${this.timeData.length} aggregated points processed.`);
          }
          
          // Update the Y range based on the newly added aggregated data
          this.updateYRange();
          
          // Update median lines
          this.updateMedianLines();
          
          // Prune old data outside our history window
          this.pruneOldData();
        }
      } catch (error) {
        console.error('Error processing accelerometer data:', error);
      }
    },

    // Aggregate data points into fixed time intervals using median
    aggregateDataByInterval(times, xData, yData, zData, intervalSeconds) {
      if (!times || times.length === 0) {
        return { aggregatedTimes: [], aggregatedX: [], aggregatedY: [], aggregatedZ: [] };
      }

      const timeBins = {};

      // Group data into time bins
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        // Determine the start time of the bin this point falls into
        const binStartTime = Math.floor(time / intervalSeconds) * intervalSeconds;

        if (!timeBins[binStartTime]) {
          timeBins[binStartTime] = { x: [], y: [], z: [] };
        }

        // Add valid data points to the corresponding bin
        if (typeof xData[i] === 'number' && !isNaN(xData[i])) timeBins[binStartTime].x.push(xData[i]);
        if (typeof yData[i] === 'number' && !isNaN(yData[i])) timeBins[binStartTime].y.push(yData[i]);
        if (typeof zData[i] === 'number' && !isNaN(zData[i])) timeBins[binStartTime].z.push(zData[i]);
      }

      // Calculate median for each bin and prepare output arrays
      const aggregatedTimes = [];
      const aggregatedX = [];
      const aggregatedY = [];
      const aggregatedZ = [];

      // Sort bins by time
      const sortedBinKeys = Object.keys(timeBins).map(parseFloat).sort((a, b) => a - b);

      sortedBinKeys.forEach(binStartTime => {
        const binData = timeBins[binStartTime];
        aggregatedTimes.push(binStartTime); // Use the start time of the interval as the representative time
        aggregatedX.push(binData.x.length > 0 ? this.calculateMedian(binData.x) : NaN);
        aggregatedY.push(binData.y.length > 0 ? this.calculateMedian(binData.y) : NaN);
        aggregatedZ.push(binData.z.length > 0 ? this.calculateMedian(binData.z) : NaN);
      });

      return {
        aggregatedTimes,
        aggregatedX,
        aggregatedY,
        aggregatedZ
      };
    },
    
    // Remove statistical outliers from data
    removeOutliers(data, windowSize = 5, threshold = 2.0) {
      if (!data || data.length < windowSize) return data; // Not enough data

      const result = [...data];
      const halfWindow = Math.floor(windowSize / 2);

      for (let i = 0; i < data.length; i++) {
        const currentValue = data[i];
        if (typeof currentValue !== 'number' || isNaN(currentValue)) continue; // Skip non-numbers

        // Define local window indices, excluding the current point
        let windowValues = [];
        for (let j = -halfWindow; j <= halfWindow; j++) {
          if (j === 0) continue; // Skip the point itself
          const idx = i + j;
          if (idx >= 0 && idx < data.length) {
             const val = data[idx];
             if (typeof val === 'number' && !isNaN(val)) {
                 windowValues.push(val);
             }
          }
        }

        if (windowValues.length < 2) continue; // Need at least 2 neighbors to calculate std dev

        // Calculate mean and standard deviation of the window
        const sum = windowValues.reduce((acc, val) => acc + val, 0);
        const mean = sum / windowValues.length;
        const variance = windowValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / windowValues.length;
        const stdDev = Math.sqrt(variance);

        // If the point is too far from the local mean, mark it as NaN
        if (stdDev > 0 && Math.abs(currentValue - mean) > threshold * stdDev) {
          result[i] = NaN; // Mark as outlier
        }
      }
      return result;
    },
    
    pruneOldData() {
      // Remove data outside of history window
      if (this.timeData.length === 0) return;
      
      const latestTime = this.timeData[this.timeData.length - 1];
      const cutoffTime = latestTime - this.historyInterval;
      
      // Find the index of the first data point to keep
      let cutoffIndex = 0;
      while (cutoffIndex < this.timeData.length && this.timeData[cutoffIndex] < cutoffTime) {
        cutoffIndex++;
      }
      
      // If we have data to remove
      if (cutoffIndex > 0) {
        this.timeData = this.timeData.slice(cutoffIndex);
        this.axData = this.axData.slice(cutoffIndex);
        this.ayData = this.ayData.slice(cutoffIndex);
        this.azData = this.azData.slice(cutoffIndex);
      }
    },
    
    calculateBaseline() {
      // Make sure we have enough data
      if (this.axData.length < this.calibrationCount) {
        return;
      }
      
      // Calculate average of first N samples as baseline
      let sumX = 0, sumY = 0, sumZ = 0;
      for (let i = 0; i < this.calibrationCount; i++) {
        sumX += this.axData[i];
        sumY += this.ayData[i];
        sumZ += this.azData[i];
      }
      
      this.baselineValues = {
        x: sumX / this.calibrationCount,
        y: sumY / this.calibrationCount,
        z: sumZ / this.calibrationCount
      };
      
      console.log('Established baseline values:', this.baselineValues);
    },
    
    resetDataArrays() {
      this.axData = [];
      this.ayData = [];
      this.azData = [];
      this.timeData = [];
      this.startTime = null;
      this.sampleIndex = 0;
      this.baselineValues = null;
      this.lastProcessedBatch = { x: [], y: [], z: [], time: [] };
      
      // Clear median paths
      this.xMedianPaths = [];
      this.yMedianPaths = [];
      this.zMedianPaths = [];
      
      // Reset median caches
      this.lastProcessedMedianTime = 0;
      this.medianValueCache = {
        x: new Map(),
        y: new Map(),
        z: new Map()
      };
    },
    
    // Update median lines for all axes
    updateMedianLines() {
      if (this.timeData.length < 2) return;
      
      try {
        // Find the latest time
        const latestTime = this.timeData[this.timeData.length - 1];
        
        // Skip only if EXACTLY the same timestamp (avoid floating point comparison issues)
        if (latestTime === this.lastProcessedMedianTime) return;
        
        // Only process new data windows
        this.incrementalUpdateMedianPaths('x');
        this.incrementalUpdateMedianPaths('y');
        this.incrementalUpdateMedianPaths('z');
        
        // Update the last processed time
        this.lastProcessedMedianTime = latestTime;
      } catch (error) {
        console.error('Error updating median lines:', error);
        // Don't update lastProcessedMedianTime on error so we'll try again
      }
    },
    
    // Incrementally update median paths for an axis
    incrementalUpdateMedianPaths(axis) {
      try {
        const timeWindow = this.medianWindowSeconds;
        const dataArray = axis === 'x' ? this.axData : 
                         axis === 'y' ? this.ayData : this.azData;
        
        if (dataArray.length < 2 || this.timeData.length < 2) return;
        
        // Find the latest time and the time to start processing from
        const latestTime = this.timeData[this.timeData.length - 1];
        const medianCache = this.medianValueCache[axis];
        
        // Calculate the oldest time we need to keep in our display
        const oldestTimeToKeep = Math.max(0, latestTime - this.historyInterval);
        
        // Clean up old cache entries that are outside our time window
        const windowsToRemove = [];
        medianCache.forEach((value, windowStart) => {
          if (windowStart < oldestTimeToKeep) {
            windowsToRemove.push(windowStart);
          }
        });
        windowsToRemove.forEach(window => medianCache.delete(window));
        
        // Ensure we have all windows covered within our visible range
        // This more robust approach ensures no gaps
        for (let windowStart = oldestTimeToKeep; 
             windowStart <= latestTime - timeWindow; 
             windowStart += timeWindow) {
          
          // Skip if we already have this window calculated
          if (medianCache.has(windowStart)) continue;
          
          const windowEnd = windowStart + timeWindow;
          const pointsInWindow = { values: [], times: [] };
          
          // Find all points in this time window
          for (let i = 0; i < this.timeData.length; i++) {
            const time = this.timeData[i];
            if (time >= windowStart && time < windowEnd) {
              const value = dataArray[i];
              if (typeof value === 'number' && !isNaN(value)) {
                pointsInWindow.values.push(value);
                pointsInWindow.times.push(time);
              }
            }
          }
          
          // If we have points in this window, calculate and cache the median
          if (pointsInWindow.values.length > 0) {
            const medianValue = this.calculateMedian(pointsInWindow.values);
            medianCache.set(windowStart, medianValue);
          } else if (windowStart > oldestTimeToKeep + timeWindow) {
            // For empty windows (except the first), interpolate between neighbors
            const prevWindow = windowStart - timeWindow;
            const nextWindow = windowStart + timeWindow;
            
            if (medianCache.has(prevWindow) && 
                (medianCache.has(nextWindow) || windowStart + timeWindow > latestTime)) {
              // Use the previous window's value when we don't have a next one yet
              const medianValue = medianCache.get(prevWindow);
              medianCache.set(windowStart, medianValue);
            }
          }
        }
        
        // Always include the most recent partial window using the latest value
        const lastWindow = Math.floor((latestTime - oldestTimeToKeep) / timeWindow) * timeWindow + oldestTimeToKeep;
        if (!medianCache.has(lastWindow) && dataArray.length > 0) {
          const lastValue = dataArray[dataArray.length - 1];
          if (typeof lastValue === 'number' && !isNaN(lastValue)) {
            medianCache.set(lastWindow, lastValue);
          }
        }
        
        // Build path from all valid cached median values within our display window
        let currentPath = '';
        
        // Sort window starts for consistent path building
        const windowStarts = Array.from(medianCache.keys()).sort((a, b) => a - b);
        
        // Filter to only include windows in our visible time frame
        const visibleWindows = windowStarts.filter(start => start >= oldestTimeToKeep);
        
        if (visibleWindows.length > 0) {
          // Start with a move command to the first point
          const firstWindow = visibleWindows[0];
          const firstMedian = medianCache.get(firstWindow);
          const firstCoord = this.calculateCoords(firstWindow, firstMedian, axis);
          currentPath = `M${firstCoord}`;
          
          // Add line segments to each successive point
          for (let i = 0; i < visibleWindows.length; i++) {
            const windowStart = visibleWindows[i];
            const windowEnd = windowStart + timeWindow;
            const medianValue = medianCache.get(windowStart);
            
            // Add points at start and end of window with the same Y value
            if (i > 0) { // We already added the move command for the first window
              const startCoord = this.calculateCoords(windowStart, medianValue, axis);
              currentPath += ` L${startCoord}`;
            }
            
            const endCoord = this.calculateCoords(windowEnd, medianValue, axis);
            currentPath += ` L${endCoord}`;
          }
        }
        
        // Update the path array (replacing the previous one)
        if (currentPath) {
          if (axis === 'x') this.xMedianPaths = [currentPath];
          else if (axis === 'y') this.yMedianPaths = [currentPath];
          else this.zMedianPaths = [currentPath];
        }
      } catch (error) {
        console.error(`Error updating median path for ${axis} axis:`, error);
        // On error, don't update the paths to maintain visual continuity
      }
    },
    
    subscribeToAccelerometer() {
      if (this.device && this.device.observeAccelerometer) {
        console.log('Subscribing to accelerometer data stream...');
        
        this.accData = [];
        this.resetDataArrays();
        
        this.subscription = this.device.observeAccelerometer().subscribe(accBatch => {
          if (Array.isArray(accBatch)) {
            this.accData = accBatch;
            this.processAccelerometerData();
          } else {
            this.accData = [accBatch];
            this.processAccelerometerData();
          }
        });
        
        // Start update timer for continuous rendering and periodic scale adjustment
        let updateCount = 0;
        this.updateTimer = setInterval(() => {
          try {
            // Force update for smooth continuous animation even when no new data
            this.$forceUpdate();
            
            // Always update at least every second even without new data
            updateCount++;
            if (updateCount % 2 === 0) {
              this.updateYRange();
              this.updateMedianLines();
            }
            
            // Check for stalled updates and force a refresh if needed
            const now = Date.now();
            if (this.lastDataTime > 0 && now - this.lastDataTime > 2000) {
              // More than 2 seconds without new data, ensure we're still rendering properly
              this.updateMedianLines();
              this.lastDataTime = now; // Reset timer to avoid constant refreshes
            }
          } catch (error) {
            console.error('Error in update timer:', error);
          }
        }, 50); // 20fps refresh rate
        
        setTimeout(() => {
          if (this.sampleIndex === 0) {
            console.warn('No accelerometer data received after 3 seconds');
          }
        }, 3000);
      } else {
        console.error('Device does not support observeAccelerometer()');
      }
    },
    
    // Calculate median of an array efficiently (assumes input is a non-empty array of numbers)
    calculateMedian(arr) {
      // No need for length checks or filtering here, handled by applyMedianFilter
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    
    // Update Y-scale dynamically based on current data
    updateYRange() {
      // Find min/max values across all axes
      const allValues = [...this.axData, ...this.ayData, ...this.azData];
      if (allValues.length === 0) return;
      
      // Calculate min/max with a sliding window approach for recent data
      // This makes the chart more responsive to recent changes
      const recentWindowSize = 500; // Consider the most recent 500 points for immediate scaling
      const xRecent = this.axData.slice(-recentWindowSize);
      const yRecent = this.ayData.slice(-recentWindowSize);
      const zRecent = this.azData.slice(-recentWindowSize);
      
      // Get min/max of recent data
      const recentMin = Math.min(
        ...xRecent,
        ...yRecent,
        ...zRecent
      );
      
      const recentMax = Math.max(
        ...xRecent,
        ...yRecent,
        ...zRecent
      );
      
      // Get absolute min/max from all data
      const absoluteMin = Math.min(...allValues);
      const absoluteMax = Math.max(...allValues);
      
      // Use a weighted approach that favors recent data but considers all-time extremes
      const weightRecent = 0.9; // 90% weight to recent data (increased from 70%)
      let min = recentMin * weightRecent + absoluteMin * (1 - weightRecent);
      let max = recentMax * weightRecent + absoluteMax * (1 - weightRecent);
      
      // Ensure minimum range to prevent flat lines when values are constant
      // Reduced from 0.05 to 0.02 to make scale tighter
      const minRange = 0.02; 
      if (max - min < minRange) {
        const center = (max + min) / 2;
        min = center - minRange / 2;
        max = center + minRange / 2;
      }
      
      // Add padding to ensure values don't touch the edges
      // Reduced padding from 15% to 8% to make scale tighter
      const range = Math.max(0.05, max - min);
      const padding = range * 0.08;
      
      // Update the y-range more responsively
      // Increased smoothFactor from 0.2 to 0.4 for faster adaptation
      const smoothFactor = 0.4;
      this.yMin = this.yMin !== -1 ? 
        this.yMin * (1 - smoothFactor) + (min - padding) * smoothFactor : 
        min - padding;
      
      this.yMax = this.yMax !== 1 ? 
        this.yMax * (1 - smoothFactor) + (max + padding) * smoothFactor : 
        max + padding;
    },
    
    // When history interval changes, reset median caches
    resetMedianCaches() {
      this.lastProcessedMedianTime = 0;
      this.medianValueCache = {
        x: new Map(),
        y: new Map(),
        z: new Map()
      };
      this.xMedianPaths = [];
      this.yMedianPaths = [];
      this.zMedianPaths = [];
    }
  },
  
  watch: {
    device: {
      immediate: true,
      handler(newDevice, oldDevice) {
        if (this.subscription) {
          this.subscription.unsubscribe();
          this.subscription = null;
        }
        
        if (this.updateTimer) {
          clearInterval(this.updateTimer);
          this.updateTimer = null;
        }
        
        this.resetDataArrays();
        
        if (newDevice) {
          this.$nextTick(() => {
            this.subscribeToAccelerometer();
          });
        }
      }
    },
    
    // Update median lines when window size changes
    medianWindowSeconds() {
      this.updateMedianLines();
    },
    
    // Recompute everything when history interval changes
    historyInterval() {
      // Clear median caches when interval changes
      this.resetMedianCaches();
      this.pruneOldData();
    }
  },
  
  mounted() {
    // Subscribe to accelerometer if device is already available
    if (this.device) {
      this.subscribeToAccelerometer();
    }
    
    // Listen for theme changes
    this.themeListener = () => {
      this.$forceUpdate();
    };
    themeManager.addListener(this.themeListener);
  },
  
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    if (this.themeListener) {
      themeManager.removeListener(this.themeListener);
    }
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}
</script>

<style scoped>
.accelerometer-container {
  width: 100%;
  height: 400px;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  color: var(--text-color);
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  padding: 0 5px;
  font-size: 12px;
}

.control-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 8px 0;
}

.toggle-control {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  background-color: var(--control-bg);
  user-select: none;
}

.median-control {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 4px;
  background-color: var(--control-bg);
}

.control-label {
  margin-right: 6px;
  white-space: nowrap;
}

.slider {
  width: 100px;
  height: 5px;
}

.chart-area {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  background: var(--background-color, transparent);
  overflow: hidden;
}

.accel-svg {
  width: 100%;
  height: 100%;
}

.chart-scroll-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>

