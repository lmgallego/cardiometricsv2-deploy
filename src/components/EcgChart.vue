<template>
  <div class="ecg-chart-container">
    <!-- Time label if needed -->
    <div v-if="showLabel" class="time-label">
      {{ startTime.toFixed(1) }}s - {{ endTime.toFixed(1) }}s
      <span v-if="showPointCount" class="point-count">({{ ecgData.length }} pts)</span>
    </div>
    
    <svg 
      :width="width" 
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
      class="ecg-svg"
      :class="{ 'history-view': chartType === 'history' }">
      
      <!-- Background for history view -->
      <rect v-if="chartType === 'history'" x="0" y="0" :width="width" :height="height" fill="rgba(0,10,20,0.5)" />
      
      <!-- Grid lines -->
      <g class="grid-lines">
        <!-- Horizontal grid lines -->
        <line v-for="line in horizontalGridLines" :key="`h-${line.y}`"
              x1="0" :x2="width" 
              :y1="line.y" :y2="line.y" 
              :stroke="gridColor" stroke-width="0.5" stroke-dasharray="3,3" />
        
        <!-- Vertical grid lines - only if timeScale is provided -->
        <line v-for="line in verticalGridLines" :key="`v-${line.x}`"
              :x1="line.x" :x2="line.x" 
              :y1="0" :y2="height" 
              :stroke="gridColor" stroke-width="0.5" stroke-dasharray="3,3" />
        
        <!-- Center line -->
        <line x1="0" :x2="width" :y1="height/2" :y2="height/2" 
              :stroke="gridColor" stroke-width="0.5" />
      </g>
      
      <!-- ECG line segments -->
      <g class="ecg-lines">
        <polyline v-for="(segmentPoints, index) in ecgSegments" :key="index"
                  :points="segmentPoints"
                  fill="none" stroke="red" :stroke-width="chartType === 'history' ? 1 : 1.5" />
      </g>

      <!-- R peaks -->
      <circle v-if="showMarkers" v-for="(point, index) in displayRPeaks" :key="`r-${index}`"
              :cx="point.x" :cy="point.y" r="3" fill="purple" />
      
      <!-- Q points -->
      <circle v-if="showMarkers" v-for="(point, index) in displayQPoints" :key="`q-${index}`"
              :cx="point.x" :cy="point.y" r="2" fill="blue" />
      
      <!-- T-end points -->
      <circle v-if="showMarkers" v-for="(point, index) in displayTEndPoints" :key="`t-${index}`"
              :cx="point.x" :cy="point.y" r="2" fill="green" />
      
      <!-- Point count for debugging -->
      <text v-if="showPointCount" x="5" y="15" font-size="10" fill="yellow">
        Points: {{ ecgData.length }} in {{ ecgSegments.length }} segments
      </text>
    </svg>
  </div>
</template>

<script>
import themeManager from '../services/ThemeManager.js'
import { computed, ref, watch } from 'vue'

// Number of data points per polyline segment
const BATCH_SIZE = 100;

export default {
  name: 'EcgChart',
  
  props: {
    // ECG data
    ecgData: {
      type: Array,
      required: true,
      default: () => []
    },
    // Time points corresponding to each ecgData point
    timeData: {
      type: Array,
      required: true,
      default: () => []
    },
    // Optional R peaks
    rPeaks: {
      type: Array,
      default: () => []
    },
    // Optional Q points
    qPoints: {
      type: Array,
      default: () => []
    },
    // Optional T-end points
    tEndPoints: {
      type: Array,
      default: () => []
    },
    // Start time of the segment to display
    startTime: {
      type: Number,
      default: 0
    },
    // End time of the segment to display
    endTime: {
      type: Number,
      default: 0
    },
    // Optional: Fixed total time duration the width should represent
    fixedTimeWindow: {
        type: Number,
        default: null
    },
    // Width of the chart in pixels
    width: {
      type: Number,
      default: 100
    },
    // Height of the chart in pixels
    height: {
      type: Number,
      default: 100
    },
    // Y-scale factor - controls amplitude of the waveform
    yScale: {
      type: Number,
      default: 0.1
    },
    // Show time label
    showLabel: {
      type: Boolean,
      default: false
    },
    // Show points count (for debugging)
    showPointCount: {
      type: Boolean,
      default: false
    },
    // Chart type: 'realtime' or 'history'
    chartType: {
      type: String,
      default: 'realtime',
      validator: value => ['realtime', 'history'].includes(value)
    },
    // Time scale for vertical grid lines (seconds between lines)
    timeScale: {
      type: Number,
      default: 0.5
    },
    // Show R, Q, and T markers
    showMarkers: {
      type: Boolean,
      default: true
    },
  },
  
  setup(props) {
    const yOffset = computed(() => props.height / 2);
    const ecgSegments = ref([]); // Holds the point strings for each polyline

    // Get theme-dependent colors
    const gridColor = computed(() => 
      themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    );
    
    // Time window duration for scaling, preferring fixed prop
    const timeWindowDuration = computed(() => {
        // Ensure duration is positive, default to 1 if start/end are equal or invalid
        const duration = props.fixedTimeWindow > 0 ? props.fixedTimeWindow : (props.endTime - props.startTime);
        return duration > 0 ? duration : 1;
    });

    // Function to calculate SVG coordinates for a point
    const calculateCoords = (time, value) => {
      const relativeTime = time - props.startTime;
      // Ensure time position calculation is safe against zero duration
      const timeWindow = timeWindowDuration.value;
      const clampedRelativeTime = Math.max(0, Math.min(relativeTime, timeWindow));
      const timePosition = timeWindow > 0 ? clampedRelativeTime / timeWindow : 0;
      
      const x = timePosition * props.width;
      const y = yOffset.value - (value * props.yScale);
      return `${x.toFixed(1)},${y.toFixed(1)}`; // Use toFixed(1) for slight perf gain
    };

    // Function to update the polyline segments
    const updateSegments = () => {
      const data = props.ecgData;
      const time = props.timeData;
      const numPoints = data.length;
      const newSegments = [];

      if (numPoints === 0 || time.length !== numPoints || timeWindowDuration.value <= 0) {
        ecgSegments.value = [];
        return;
      }

      for (let i = 0; i < numPoints; i += BATCH_SIZE) {
        let segmentStr = '';
        const end = Math.min(i + BATCH_SIZE, numPoints);
        
        // Include the last point of the previous segment for line continuity
        if (i > 0) {
           segmentStr += calculateCoords(time[i - 1], data[i - 1]);
        }

        for (let j = i; j < end; j++) {
          if (segmentStr) segmentStr += ' '; // Add space separator
          segmentStr += calculateCoords(time[j], data[j]);
        }

        if (segmentStr) { // Avoid adding empty segments
          newSegments.push(segmentStr);
        }
      }
      ecgSegments.value = newSegments;
    };

    // Watch for changes that require recalculating segments
    watch(
      [
        () => props.ecgData, 
        () => props.timeData, 
        () => props.startTime, 
        () => props.endTime, 
        () => props.width, 
        () => props.height, 
        () => props.yScale,
        () => props.fixedTimeWindow
      ], 
      updateSegments, 
      { deep: true, immediate: true } // Deep watch might be needed for ecgData/timeData arrays
    );

    return {
      yOffset,
      gridColor,
      timeWindowDuration,
      ecgSegments, // Expose segments to the template
      // Keep other computed properties needed for markers and grid lines
    };
  },
  
  computed: {
    displayRPeaks() {
      if (this.timeWindowDuration <= 0) return [];
      const peaksToDisplay = this.rPeaks.filter(peak => 
          peak.time >= this.startTime && peak.time <= this.endTime
      );
      return peaksToDisplay.map(peak => {
          const relativeTime = peak.time - this.startTime;
          const clampedRelativeTime = Math.max(0, Math.min(relativeTime, this.timeWindowDuration));
          const timePosition = this.timeWindowDuration > 0 ? clampedRelativeTime / this.timeWindowDuration : 0;
          return {
            ...peak,
            x: timePosition * this.width,
            y: this.yOffset - (peak.value * this.yScale)
          };
        });
    },
    
    displayQPoints() {
       if (this.timeWindowDuration <= 0) return [];
       const pointsToDisplay = this.qPoints.filter(point => 
           point.time >= this.startTime && point.time <= this.endTime
       );
       return pointsToDisplay.map(point => {
          const relativeTime = point.time - this.startTime; 
          const clampedRelativeTime = Math.max(0, Math.min(relativeTime, this.timeWindowDuration));
          const timePosition = this.timeWindowDuration > 0 ? clampedRelativeTime / this.timeWindowDuration : 0;
          return {
            ...point,
            x: timePosition * this.width,
            y: this.yOffset - (point.value * this.yScale)
          };
        });
    },
    
    displayTEndPoints() {
      if (this.timeWindowDuration <= 0) return [];
      const pointsToDisplay = this.tEndPoints.filter(point => 
          point.time >= this.startTime && point.time <= this.endTime
      );
      return pointsToDisplay.map(point => {
          const relativeTime = point.time - this.startTime; 
          const clampedRelativeTime = Math.max(0, Math.min(relativeTime, this.timeWindowDuration));
          const timePosition = this.timeWindowDuration > 0 ? clampedRelativeTime / this.timeWindowDuration : 0;
          return {
            ...point,
            x: timePosition * this.width,
            y: this.yOffset - (point.value * this.yScale)
          };
        });
    },
    
    horizontalGridLines() {
      const lines = [];
      // Avoid division by zero if height is 0
      const lineSpacing = this.height > 0 ? (this.chartType === 'history' ? this.height / 4 : 50) : 50;
      const count = this.height > 0 && lineSpacing > 0 ? Math.floor(this.height / lineSpacing) : 0;
      
      for (let i = 0; i <= count; i++) {
        lines.push({ y: i * lineSpacing });
      }
      return lines;
    },
    
    verticalGridLines() {
      const lines = [];
      const timeRange = this.timeWindowDuration; 
      if (timeRange <= 0 || this.width <= 0) return [];

      const secondsPerLine = this.chartType === 'history' 
        ? Math.max(0.5, Math.floor(timeRange / 5)) // Ensure secondsPerLine > 0
        : this.timeScale;
      
      if (secondsPerLine <= 0) return []; // Avoid infinite loop if timeScale is invalid

      let currentTime = Math.ceil(this.startTime / secondsPerLine) * secondsPerLine;

      // Limit iterations to prevent potential infinite loops with weird inputs
      let maxIterations = 1000; 
      while (currentTime <= this.endTime + secondsPerLine && maxIterations-- > 0) { 
        const relativeTime = currentTime - this.startTime;
        
        if (relativeTime >= -0.001 && relativeTime <= timeRange + 0.001) { 
            const timePosition = relativeTime / timeRange;
            const x = timePosition * this.width;
             if (timePosition >= 0 && timePosition <= 1) { 
               lines.push({ x });
             }
        }
        // Break if we are clearly past the end time to avoid extra loops
        if (relativeTime > timeRange + secondsPerLine * 2) break; 

        currentTime += secondsPerLine;
      }
      if (maxIterations <= 0) {
          console.warn("EcgChart: Max iterations reached in verticalGridLines calculation.");
      }
      
      return lines;
    }
  }
};
</script>

<style scoped>
.ecg-chart-container {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.time-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  margin-bottom: 2px;
}

.point-count {
  margin-left: 5px;
  color: yellow;
}

.ecg-svg {
  display: block;
  width: 100%;
  background-color: var(--background-color, rgba(0, 0, 0, 0.05));
}

.ecg-svg.history-view {
  border: 1px solid rgba(100, 100, 255, 0.3);
}
</style> 