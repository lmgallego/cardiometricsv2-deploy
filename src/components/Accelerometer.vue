<template>
  <CardWrapper title="Accelerometer">
    <div class="accelerometer-container">
      <div class="chart-controls">
        <div class="control-buttons">
          <div class="median-control">
            <span class="control-label">Median Window: {{ medianWindowSeconds.toFixed(1) }}s</span>
            <input type="range" min="0.1" max="0.5" step="0.1" v-model.number="medianWindowSeconds" class="slider">
          </div>
          
          <!-- Stabilization indicator -->
          <div v-if="!isStabilized" class="stabilizing-indicator">
            <span class="stabilizing-label">Stabilizing...</span>
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
            :class="['accel-svg', { 'stabilizing': !isStabilized }]">
            
            <!-- Background grid -->
            <g class="grid-lines">
              <!-- Horizontal grid lines with labels -->
              <g v-for="line in horizontalGridLines" :key="`h-${line.y}`">
                <line x1="0" :x2="chartWidth" 
                      :y1="line.y" :y2="line.y" 
                      :stroke="themeColors.grid" stroke-width="0.5" stroke-dasharray="3,3" />
                <text x="30" :y="line.y - 3"
                      font-size="8" text-anchor="end" :fill="themeColors.text">
                  {{ line.label }}
                </text>
              </g>
              
              <!-- Vertical grid lines -->
              <line v-for="line in verticalGridLines" :key="`v-${line.x}`"
                    :x1="line.x" :x2="line.x" 
                    :y1="0" :y2="chartHeight" 
                    :stroke="themeColors.grid" stroke-width="0.5" stroke-dasharray="3,3" />
             
             <!-- Time labels -->
             <text v-for="line in verticalGridLines" :key="`t-${line.x}`"
                   :x="line.x"
                   :y="chartHeight - 5"
                   font-size="10"
                   text-anchor="middle"
                   :fill="themeColors.text">
               {{ line.label }}
             </text>
             
             <!-- Center line (zero acceleration) - highlight it more -->
             <line x1="0" :x2="chartWidth" :y1="chartHeight/2" :y2="chartHeight/2"
                   :stroke="themeColors.zeroLine" stroke-width="1" />
            </g>
            
            <!-- Median lines -->
            <g class="median-lines">
              <template v-for="(axis, index) in axisConfig" :key="axis.name">
                <path v-for="(path, pathIndex) in medianPaths[axis.name]" :key="`m${axis.name}-${pathIndex}`"
                      :d="path"
                      fill="none" :stroke="axis.color" stroke-width="2" stroke-opacity="0.9" />
              </template>
            </g>
            
            <!-- Axis labels -->
            <text x="50" y="15" font-size="12" :fill="themeColors.text">Acceleration (g)</text>
            
            <!-- Legend -->
            <g class="chart-legend" transform="translate(120, 15)">
              <g v-for="(axis, index) in axisConfig" :key="axis.name" :transform="`translate(${index * 50}, 0)`">
                <line x1="0" y1="0" x2="15" y2="0" :stroke="axis.color" stroke-width="2" stroke-opacity="0.9"/>
                <text x="20" y="5" font-size="12" :fill="themeColors.text">{{ axis.name.toUpperCase() }}</text>
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
import accelerometerManager from '../services/AccelerometerManager.js'
import Acc from '../services/Acc.js'
import { computed, watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Constants
const BATCH_SIZE = 100; // Number of data points per polyline segment
const MAX_SEGMENTS = 1000; // Maximum number of segments to maintain for each axis
const SMOOTHING_WINDOW = 15; // Window size for moving average smoothing
const AXIS_CONFIG = [
  { name: 'x', color: 'red', dataKey: 'axData' },
  { name: 'y', color: 'lime', dataKey: 'ayData' },
  { name: 'z', color: 'dodgerblue', dataKey: 'azData' }
];

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
    
    // Theme-dependent colors using a single computed property
    const themeColors = computed(() => {
      const isDark = themeManager.isDarkTheme();
      return {
        text: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        zeroLine: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
      };
    });
    
    // Helper function to determine grid interval
    const calculateGridInterval = (range) => {
      const intervals = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
      return intervals.find(i => range <= i * 5) || Math.ceil(range / 5);
    };

    // Helper function to determine time step
    const calculateTimeStep = (interval) => {
      const steps = [
        { max: 5, step: 0.5 },
        { max: 10, step: 1 },
        { max: 30, step: 5 },
        { max: 60, step: 10 }
      ];
      return steps.find(s => interval <= s.max)?.step || 30;
    };

    // Horizontal grid lines
    const horizontalGridLines = computed(() => {
      const range = yMax.value - yMin.value;
      const interval = calculateGridInterval(range);
      const value = Math.ceil(yMin.value / interval) * interval;
      
      return Array.from({ length: Math.ceil((yMax.value - value) / interval) + 1 }, (_, i) => {
        const val = value + (i * interval);
        const normalizedValue = (val - yMin.value) / range;
        return {
          y: chartHeight.value - (normalizedValue * chartHeight.value),
          value: val,
          label: val === 0 ? '0' : val.toFixed(2)
        };
      });
    });
    
    // Vertical grid lines
    const verticalGridLines = computed(() => {
      const interval = historyInterval.value;
      const timeStep = calculateTimeStep(interval);
      
      return Array.from({ length: Math.floor(interval / timeStep) + 1 }, (_, i) => {
        const t = i * timeStep;
        return {
          x: (t / interval) * chartWidth.value,
          label: `${t.toFixed(1)}s`
        };
      });
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
      themeColors,
      horizontalGridLines,
      verticalGridLines
    };
  },
  
  data() {
    return {
      timeData: [],
      axData: [],
      ayData: [],
      azData: [],
      medianWindowSeconds: 0.3,
      medianPaths: { x: [], y: [], z: [] },
      themeListener: null,
      updateTimer: null,
      accService: null,
      isStabilized: false,
      initialViewFixed: false
    }
  },
  
  computed: {
    // Configuration for the three axes
    axisConfig() {
      return AXIS_CONFIG;
    },
    
    // All acceleration data arrays combined for convenience
    allAccelerationData() {
      return [...this.axData, ...this.ayData, ...this.azData];
    }
  },
  
  methods: {
    // Calculate SVG coordinates for a data point with normalized Y value
    calculateCoords(time, value) {
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
    
    updateYRange() {
      // Find min/max values across all axes
      if (this.allAccelerationData.length === 0) return;
      
      // Use different approach for initial view vs stable state
      if (!this.isStabilized && !this.initialViewFixed && this.timeData.length > 5) {
        // For non-stabilized data, set a fixed initial range that's reasonable
        // This prevents large initial spikes from skewing the view
        this.initialViewFixed = true;
      }
      
      // Calculate min/max with a sliding window approach for recent data
      const recentWindowSize = 500;
      
      // Get recent data for each axis using a more concise approach
      const recentData = this.axisConfig.map(axis => 
        this[axis.dataKey].slice(-recentWindowSize)
      );
      
      // Get min/max of recent data
      const recentMin = Math.min(...recentData.flat());
      const recentMax = Math.max(...recentData.flat());
      
      // Get absolute min/max from all data
      const absoluteMin = Math.min(...this.allAccelerationData);
      const absoluteMax = Math.max(...this.allAccelerationData);
      
      // Use a weighted approach that favors recent data but considers all-time extremes
      const weightRecent = this.isStabilized ? 0.9 : 0.7; // Lower weight for unstable data
      let min = recentMin * weightRecent + absoluteMin * (1 - weightRecent);
      let max = recentMax * weightRecent + absoluteMax * (1 - weightRecent);
      
      // Ensure minimum range to prevent flat lines when values are constant
      const minRange = 0.02; 
      if (max - min < minRange) {
        const center = (max + min) / 2;
        min = center - minRange / 2;
        max = center + minRange / 2;
      }
      
      // Add padding
      const range = Math.max(0.05, max - min);
      const padding = range * (this.isStabilized ? 0.08 : 0.15); // More padding for unstable data
      
      // Update the y-range more responsively
      const smoothFactor = this.isStabilized ? 0.4 : 0.2; // Slower updates for unstable data
      this.yMin = this.yMin !== -1 ? 
        this.yMin * (1 - smoothFactor) + (min - padding) * smoothFactor : 
        min - padding;
      
      this.yMax = this.yMax !== 1 ? 
        this.yMax * (1 - smoothFactor) + (max + padding) * smoothFactor : 
        max + padding;
    },
    
    // Update the visualization based on median data
    updateMedianPaths(medianData) {
      if (!medianData?.times?.length || medianData.times.length < 2) return;
      
      try {
        // Update stabilization state if provided
        if (typeof medianData.isStabilized === 'boolean') {
          this.isStabilized = medianData.isStabilized;
        }
        
        // Create a new medianPaths object with updated paths
        const newMedianPaths = { ...this.medianPaths };
        
        // Process median data for all axes using axisConfig
        this.axisConfig.forEach(axis => {
          const path = this.createPathFromPoints(medianData.times, medianData[axis.name]);
          newMedianPaths[axis.name] = path ? [path] : [];
        });
        
        // Update all paths at once
        this.medianPaths = newMedianPaths;
      } catch (error) {
        // Silently handle errors in path updates
        this.medianPaths = { x: [], y: [], z: [] };
      }
    },
    
    // Create SVG path from time series data using modern array methods
    createPathFromPoints(times, values) {
      if (!times?.length || !values?.length) return null;
      
      const points = times.reduce((acc, time, i) => {
        const value = values[i];
        if (typeof value === 'number' && !isNaN(value)) {
          const coords = this.calculateCoords(time, value);
          acc.push(acc.length === 0 ? `M${coords}` : `L${coords}`);
        }
        return acc;
      }, []);
      
      return points.length > 0 ? points.join(' ') : null;
    },
    
    // Cleanup resources
    cleanup() {
      if (this.accService) {
        this.accService.destroy();
        this.accService = null;
      }
      
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
    },
    
    // Create a new AccService and subscribe to its events
    initializeAccService() {
      this.cleanup();
      
      if (!this.device) return;
      
      this.accService = new Acc(this.device);
      this.accService.setMedianWindowSeconds(this.medianWindowSeconds);
      
      // Register accelerometer service in the manager for ECG motion filtering
      accelerometerManager.setAccService(this.accService);
      console.log('Accelerometer: Service registered for motion artifact filtering');
      
      // Subscribe to all observables at once
      const subscriptions = {
        processed: this.accService.getProcessedDataObservable().subscribe(data => {
          // Update time data
          this.timeData = this.accService.timeData;
          
          // Update axis data using axisConfig
          this.axisConfig.forEach(axis => {
            this[axis.dataKey] = this.accService[axis.dataKey];
          });
          
          // Update stabilization state
          this.isStabilized = data.isStabilized ?? this.isStabilized;
          
          // Update Y range based on new data
          this.updateYRange();
        }),
        
        median: this.accService.getMedianDataObservable().subscribe(this.updateMedianPaths)
      };
      
      // Start update timer - 20fps
      this.updateTimer = setInterval(() => this.$forceUpdate(), 50);
      
      return subscriptions;
    }
  },
  
  watch: {
    device: {
      immediate: true,
      handler(newDevice) {
        this.cleanup();
        if (newDevice) {
          this.$nextTick(this.initializeAccService);
        }
      }
    },
    
    medianWindowSeconds(newValue) {
      this.accService?.setMedianWindowSeconds(newValue);
    },
    
    historyInterval() {
      this.$forceUpdate();
    }
  },
  
  mounted() {
    if (this.device) {
      this.initializeAccService();
    }
    
    this.themeListener = () => this.$forceUpdate();
    themeManager.addListener(this.themeListener);
  },
  
  beforeUnmount() {
    this.cleanup();
    if (this.themeListener) {
      themeManager.removeListener(this.themeListener);
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

.stabilizing-indicator {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 4px;
  background-color: rgba(255, 165, 0, 0.2);
  border: 1px solid orange;
  animation: pulse 1.5s infinite;
}

.stabilizing-label {
  color: orange;
  font-weight: bold;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.accel-svg.stabilizing path {
  opacity: 0.7;
  stroke-dasharray: 4,2;
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
