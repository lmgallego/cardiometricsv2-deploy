<template>
  <CardWrapper title="ECG Waveform">
    <div class="ecg-container">
      <div class="chart-area">
        <!-- Left Half: Real-time View -->
        <div class="chart-column chart-realtime" ref="realtimeContainer">
          <div class="chart-controls">
            <div>Real-time View ({{ REALTIME_DURATION_SECONDS }}s)</div>
          </div>
          <div class="chart-scroll-container">
            <EcgChart
              :ecgData="ecgData"
              :timeData="ecgTime"
              :rPeaks="rPeaks"
              :qPoints="qPoints"
              :tEndPoints="tEndPoints"
              :tPeaks="tPeaks"
              :startTime="realtimeStartTime"
              :endTime="latestTime"
              :width="realtimeWidth"
              :height="svgHeight"
              :yScale="yScale"
              chartType="realtime"
            />
          </div>
          <div class="chart-legend">
            <div class="legend-item"><span class="legend-marker" style="background-color: red;"></span>ECG Signal</div>
            <div class="legend-item"><span class="legend-marker" style="background-color: purple;"></span>R Peaks</div>
            <div class="legend-item"><span class="legend-marker" style="background-color: blue;"></span>Q Points</div>
            <div class="legend-item"><span class="legend-marker" style="background-color: green;"></span>T-end Points</div>
            <div class="legend-item"><span class="legend-marker" style="background-color: orange;"></span>T Peaks</div>
          </div>
        </div>

        <!-- Right Half: History View -->
        <div class="chart-column chart-history" ref="historyContainer">
           <div class="chart-controls">
             <div>History ({{ historyInterval }}s segments)</div>
           </div>
           <div class="history-lines-container">
             <div 
               v-for="segment in historySegments" 
               :key="segment.startTime" 
               class="history-segment"
             >
                <EcgChart
                  :ecgData="segment.ecgDataSlice"
                  :timeData="segment.timeDataSlice"
                  :rPeaks="segment.rPeaksData"
                  :qPoints="segment.qPointsData"
                  :tEndPoints="segment.tEndPointsData"
                  :tPeaks="segment.tPeaksData"
                  :startTime="segment.startTime"
                  :endTime="segment.endTime"
                  :fixedTimeWindow="historyInterval"
                  :width="historySegmentWidth"
                  :height="HISTORY_LINE_HEIGHT"
                  :yScale="historyYScale"
                  :showLabel="true"
                  :showPointCount="false"
                  :showMarkers="false"
                  chartType="history"
                />
             </div>
           </div>
        </div>
      </div>
    </div>
  </CardWrapper>
</template>

<script>
import log from '@/log'
import EcgService from '../services/Ecg.js'
import CardWrapper from './CardWrapper.vue'
import EcgChart from './EcgChart.vue'
import themeManager from '../services/ThemeManager.js'
import { opts } from '../services/store.js'
import { computed, watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Define the duration for the real-time view
const REALTIME_DURATION_SECONDS = 5;
// Define sample rate assumed for data limiting
const APPROX_SAMPLE_RATE = 250; 
// Define height for history lines
const HISTORY_LINE_HEIGHT = 80;
// Maximum number of points to store for markers
const MAX_POINTS_STORED = 1000;

export default {
  components: {
    CardWrapper,
    EcgChart
  },
  props: ['device'],
  
  setup(props) {
    const realtimeContainer = ref(null);
    const historyContainer = ref(null);
    
    // Restore historyInterval from store
    const historyInterval = computed(() => opts.historyInterval);
    
    // Keep reference to constant
    const realtimeDuration = ref(REALTIME_DURATION_SECONDS);

    const maxDataPoints = computed(() => {
      // Allow storing much more data - 5 minutes worth?
      return APPROX_SAMPLE_RATE * 60 * 5; 
    });
    
    return {
      realtimeContainer,
      historyContainer,
      historyInterval,
      realtimeDuration,
      maxDataPoints,
      HISTORY_LINE_HEIGHT,
      REALTIME_DURATION_SECONDS,
      MAX_POINTS_STORED
    };
  },
  
  data() {
    return {
      ecgData: [],
      ecgTime: [],
      rPeaks: [],
      qPoints: [],
      tEndPoints: [],
      tPeaks: [],
      updateInterval: 30,
      ecgService: null,
      ecgSubscription: null,
      rPeakSubscription: null,
      qPointSubscription: null,
      tEndSubscription: null,
      tPeakSubscription: null,
      updateTimer: null,
      themeListener: null,
      initialTimestamp: null,
      pixelsPerSecond: 200,
      displayHeight: 350,
      svgHeight: 400,
      showCurrentTimeLine: true,
      yScale: 0.1,  // Will auto-adjust based on data range
      timeScale: 0.5,
      amplitudeScale: 0.5,
      autoScaleEnabled: true
    }
  },

  computed: {
    visibleWidthPx() {
      return this.$refs.realtimeContainer ? this.$refs.realtimeContainer.clientWidth : 400;
    },

    historySegmentWidth() {
      return this.$refs.historyContainer ? this.$refs.historyContainer.clientWidth - 10 : 390;
    },

    latestTime() {
      return this.ecgTime.length > 0 ? this.ecgTime[this.ecgTime.length - 1] : 0;
    },
    
    realtimeStartTime() {
      return Math.max(0, this.latestTime - REALTIME_DURATION_SECONDS);
    },
    
    realtimeWidth() {
      return this.visibleWidthPx;
    },
    
    historyYScale() {
      // Use the same scale as realtime view
      return this.yScale;
    },

    historySegments() {
      if (this.ecgTime.length < 2 || this.historyInterval <= 0) {
        return [];
      }

      try {
        const segments = [];
        const latestTime = this.latestTime;
        const firstDataTime = this.ecgTime[0] ?? 0;
        const totalDuration = latestTime - firstDataTime;

        if (totalDuration <= 0) return [];

        const numFullSegments = Math.floor(totalDuration / this.historyInterval);

        for (let i = 0; i < numFullSegments; i++) {
          const segmentStartTime = firstDataTime + i * this.historyInterval;
          const segmentEndTime = segmentStartTime + this.historyInterval;
          
          const indices = this.findDataIndices(segmentStartTime, segmentEndTime);
          if (indices.startIndex === -1) continue;
          
          segments.push({
            startTime: segmentStartTime,
            endTime: segmentEndTime,
            ecgDataSlice: this.ecgData.slice(indices.startIndex, indices.endIndex),
            timeDataSlice: this.ecgTime.slice(indices.startIndex, indices.endIndex),
            rPeaksData: this.rPeaks.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
            qPointsData: this.qPoints.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
            tEndPointsData: this.tEndPoints.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
            tPeaksData: this.tPeaks.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex)
          });
        }

        const lastFullSegmentEndTime = firstDataTime + numFullSegments * this.historyInterval;
        if (latestTime > lastFullSegmentEndTime) {
          const currentStartTime = lastFullSegmentEndTime;
          const currentEndTime = currentStartTime + this.historyInterval;
          const indices = this.findDataIndices(currentStartTime, currentEndTime);

          if (indices.startIndex !== -1) {
            segments.push({
              startTime: currentStartTime,
              endTime: currentEndTime,
              ecgDataSlice: this.ecgData.slice(indices.startIndex, indices.endIndex),
              timeDataSlice: this.ecgTime.slice(indices.startIndex, indices.endIndex),
              rPeaksData: this.rPeaks.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
              qPointsData: this.qPoints.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
              tEndPointsData: this.tEndPoints.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex),
              tPeaksData: this.tPeaks.filter(p => p.index >= indices.startIndex && p.index < indices.endIndex)
            });
          }
        }
        
        // Return only the last 3 segments, in reverse chronological order (most recent first)
        return segments.slice(-3).reverse();
        
      } catch (err) {
        console.error("Error calculating history segments:", err);
        return [];
      }
    }
  },

  watch: {
    device: {
      immediate: true,
      handler(newDevice, oldDevice) {
        this.cleanup();
        
        if (this.device) {
          this.ecgService = new EcgService(this.device);
          
          this.ecgSubscription = this.ecgService
            .getEcgObservable()
            .subscribe(data => this.handleEcgData(data));
            
          this.rPeakSubscription = this.ecgService
            .getRPeakObservable()
            .subscribe(data => this.handleRPeak(data));
            
          this.qPointSubscription = this.ecgService
            .getQPointObservable()
            .subscribe(data => this.handleQPoint(data));
            
          this.tEndSubscription = this.ecgService
            .getTEndObservable()
            .subscribe(data => this.handleTEnd(data));
            
          this.tPeakSubscription = this.ecgService
            .getTPeakObservable()
            .subscribe(data => this.handleTPeak(data));
        }
      }
    }
  },

  mounted() {
    this.updateTimer = setInterval(this.updateDisplay, this.updateInterval);
    
    this.themeListener = (theme) => {
      this.$forceUpdate();
    };
    themeManager.addListener(this.themeListener);
  },

  beforeUnmount() {
    this.cleanup();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    if (this.themeListener) {
      themeManager.removeListener(this.themeListener);
    }
  },
  
  methods: {
    getTextColor() {
      return themeManager.isDarkTheme() ? '#FFFFFF' : '#333333';
    },
    
    getGridColor() {
      return themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    },
    
    cleanup() {
      if (this.ecgSubscription) {
        try {
          if (typeof this.ecgSubscription.unsubscribe === 'function') {
            this.ecgSubscription.unsubscribe();
          }
        } catch (e) {
          console.debug('ECG unsubscribe error (non-critical):', e.message);
        } finally {
          this.ecgSubscription = null;
        }
      }
      
      if (this.rPeakSubscription) {
        try {
          if (typeof this.rPeakSubscription.unsubscribe === 'function') {
            this.rPeakSubscription.unsubscribe();
          }
        } catch (e) {
          console.debug('R-Peak unsubscribe error (non-critical):', e.message);
        } finally {
          this.rPeakSubscription = null;
        }
      }
      
      if (this.qPointSubscription) {
        try {
          if (typeof this.qPointSubscription.unsubscribe === 'function') {
            this.qPointSubscription.unsubscribe();
          }
        } catch (e) {
          console.debug('Q-Point unsubscribe error (non-critical):', e.message);
        } finally {
          this.qPointSubscription = null;
        }
      }
      
      if (this.tEndSubscription) {
        try {
          if (typeof this.tEndSubscription.unsubscribe === 'function') {
            this.tEndSubscription.unsubscribe();
          }
        } catch (e) {
          console.debug('T-End unsubscribe error (non-critical):', e.message);
        } finally {
          this.tEndSubscription = null;
        }
      }
      
      if (this.tPeakSubscription) {
        try {
          if (typeof this.tPeakSubscription.unsubscribe === 'function') {
            this.tPeakSubscription.unsubscribe();
          }
        } catch (e) {
          console.debug('T-Peak unsubscribe error (non-critical):', e.message);
        } finally {
          this.tPeakSubscription = null;
        }
      }
      
      if (this.ecgService) {
        try {
          this.ecgService.destroy();
        } catch (e) {
          console.debug('ECG service destroy error (non-critical):', e.message);
        } finally {
          this.ecgService = null;
        }
      }
      
      this.ecgData = [];
      this.ecgTime = [];
      this.rPeaks = [];
      this.qPoints = [];
      this.tEndPoints = [];
      this.tPeaks = [];
    },
    
    findDataIndices(startTime, endTime) {
        if (!this.ecgTime || this.ecgTime.length === 0) {
            return { startIndex: -1, endIndex: -1 };
        }

        let startIndex = -1;
        let endIndex = -1; 

        // Find first point >= startTime
        for (let i = 0; i < this.ecgTime.length; i++) {
          if (this.ecgTime[i] >= startTime) {
            startIndex = i;
            break;
          }
        }

        if (startIndex === -1) {
            return { startIndex: -1, endIndex: -1 };
        }

        // Find first point > endTime (exclusive)
        for (let i = startIndex; i < this.ecgTime.length; i++) {
            if (this.ecgTime[i] > endTime) {
                endIndex = i;
                break;
            }
        }

        if (endIndex === -1) {
            endIndex = this.ecgTime.length;
        }
        
        // Edge case: start point is already past end time
        if (startIndex < this.ecgTime.length && this.ecgTime[startIndex] > endTime) {
           return { startIndex: -1, endIndex: -1 };
        }

        return { startIndex, endIndex }; // endIndex is exclusive
    },
    
    handleEcgData(data) {
      if (!this.initialTimestamp && data.times && data.times.length > 0) {
        this.initialTimestamp = Date.now() / 1000;
      }
      
      this.ecgData.push(...data.samples);
      this.ecgTime.push(...data.times);
      
      // Auto-adjust yScale based on data range
      if (this.autoScaleEnabled && this.ecgData.length > 100) {
        const recentData = this.ecgData.slice(-500); // Last 500 points
        const min = Math.min(...recentData);
        const max = Math.max(...recentData);
        const range = max - min;
        
        if (range > 0) {
          // Target: make the range occupy ~150 pixels
          const targetPixels = 150;
          const newScale = targetPixels / range;
          
          // Smooth transition - don't change too abruptly
          this.yScale = this.yScale * 0.9 + newScale * 0.1;
        }
      }
    },
    
    handleRPeak(data) {
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.rPeaks.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
      }
    },
    
    handleQPoint(data) {
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.qPoints.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
      }
    },
    
    handleTEnd(data) {
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.tEndPoints.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
      }
    },
    
    handleTPeak(data) {
      this.tPeaks.push(data);
      if (this.tPeaks.length > MAX_POINTS_STORED * 2) {
        this.tPeaks.splice(0, this.tPeaks.length - MAX_POINTS_STORED * 2);
      }
    },
    
    updateDisplay() {
      this.$forceUpdate();
    }
  }
}
</script>

<style scoped>
.ecg-container {
  width: 100%;
  height: 450px;
  display: flex;
  flex-direction: column;
  font-family: monospace;
  color: var(--text-color);
}

.chart-area {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 10px;
  min-height: 0;
}

.chart-column {
  display: flex;
  flex-direction: column;
  flex-basis: 50%;
  min-width: 0;
  width: 50%;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
}

.chart-scroll-container {
  overflow-y: hidden;
  flex: 1;
  width: 100%;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  background: var(--background-color, transparent);
}

.history-lines-container {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px;
}

.history-segment {
  width: 100%;
  border: 1px solid var(--border-color-secondary, #555);
  border-radius: 3px;
  background-color: rgba(20,20,50,0.4);
  padding: 2px 5px;
  position: relative;
  margin-bottom: 5px;
}

.chart-legend {
  display: flex;
  justify-content: flex-start;
  gap: 15px;
  margin-top: 8px;
  margin-left: 10px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-marker {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>

