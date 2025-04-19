<template>
  <CardWrapper title="ECG Waveform">
    <div ref="ecgChart" style="width: 100%; min-height: 400px;"></div>
  </CardWrapper>
</template>

<script>
import log from '@/log'
import Plotly from 'plotly.js-dist-min'
import EcgService from '../services/Ecg.js'
import CardWrapper from './CardWrapper.vue'
import themeManager from '../services/ThemeManager.js'
import { opts } from '../services/store.js'
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'

export default {
  components: {
    CardWrapper
  },
  props: ['device'],
  
  setup(props) {
    // References
    const ecgChart = ref(null);
    const plotInitialized = ref(false);
    
    // Computed property for dynamic history interval
    const historyInterval = computed(() => opts.historyInterval);
    
    // Computed property for max data points based on interval and sampling rate
    const maxDataPoints = computed(() => {
      // Assuming ECG typically samples at around 250Hz
      // Calculate points needed for the history interval
      const typicalSamplingRate = 250; // Hz
      return historyInterval.value * typicalSamplingRate;
    });
    
    // Watch for changes in history interval
    watch(historyInterval, (newInterval) => {
      if (plotInitialized.value && ecgChart.value) {
        // Update the x-axis range to reflect new interval
        // Keep the range fixed starting from 0
        const displayInterval = Math.max(0.1, newInterval);
        Plotly.relayout(ecgChart.value, {
          'xaxis.range': [0, displayInterval]
        });
        
        console.log(`ECG chart display interval updated to ${newInterval} seconds`);
      }
    });
    
    return {
      ecgChart,
      plotInitialized,
      historyInterval,
      maxDataPoints
    };
  },
  
  data() {
    return {
      ecgData: [],
      ecgTime: [],
      maxPoints: 3000, // This will be overridden by computed maxDataPoints
      updateInterval: 200, // Chart update interval in milliseconds
      ecgService: null,
      ecgSubscription: null,
      rPeakSubscription: null,
      qPointSubscription: null,
      tEndSubscription: null,
      rPeaks: [], // For visualization of R peaks
      qPoints: [], // For visualization
      tEndPoints: [], // For visualization
      updateTimer: null, // Timer for scheduled chart updates
      themeListener: null, // For theme changes
      initialTimestamp: null, // To track start time for relative time
      displayDuration: 60 // Default display window - will use historyInterval from store
    }
  },

  watch: {
    device: {
      immediate: true,
      handler(newDevice, oldDevice) {
        this.cleanup();
        
        if (this.device) {
          // Initialize the ECG service
          this.ecgService = new EcgService(this.device);
          
          // Subscribe to ECG data
          this.ecgSubscription = this.ecgService
            .getEcgObservable()
            .subscribe(data => this.handleEcgData(data));
            
          // Subscribe to R peaks for visualization
          this.rPeakSubscription = this.ecgService
            .getRPeakObservable()
            .subscribe(data => this.handleRPeak(data));
            
          // Subscribe to Q points for visualization
          this.qPointSubscription = this.ecgService
            .getQPointObservable()
            .subscribe(data => this.handleQPoint(data));
            
          // Subscribe to T-end points for visualization
          this.tEndSubscription = this.ecgService
            .getTEndObservable()
            .subscribe(data => this.handleTEnd(data));
        }
      }
    }
  },

  mounted() {
    // Store reference to chart
    this.ecgChart = this.$refs.ecgChart;
    
    this.initializePlot();
    // Start the timer to update the chart at regular intervals
    this.updateTimer = setInterval(this.updatePlot, this.updateInterval);
    
    // Listen for theme changes
    this.themeListener = (theme) => {
      this.updateTheme();
    };
    themeManager.addListener(this.themeListener);
  },

  beforeDestroy() {
    this.cleanup();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    // Remove theme listener
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
    
    getGridWidth() {
      return themeManager.isDarkTheme() ? 0.5 : 1;
    },
    
    updateTheme() {
      if (!this.plotInitialized || !this.$refs.ecgChart) return;
      
      const update = {
        'xaxis.color': this.getTextColor(),
        'yaxis.color': this.getTextColor(),
        'font.color': this.getTextColor(),
        'paper_bgcolor': 'rgba(0,0,0,0)',
        'plot_bgcolor': 'rgba(0,0,0,0)',
        'xaxis.gridcolor': this.getGridColor(),
        'yaxis.gridcolor': this.getGridColor(),
        'xaxis.gridwidth': this.getGridWidth(),
        'yaxis.gridwidth': this.getGridWidth()
      };
      
      Plotly.relayout(this.$refs.ecgChart, update);
    },
    
    cleanup() {
      // Clean up subscriptions
      if (this.ecgSubscription) {
        this.ecgSubscription.unsubscribe();
        this.ecgSubscription = null;
      }
      
      if (this.rPeakSubscription) {
        this.rPeakSubscription.unsubscribe();
        this.rPeakSubscription = null;
      }
      
      if (this.qPointSubscription) {
        this.qPointSubscription.unsubscribe();
        this.qPointSubscription = null;
      }
      
      if (this.tEndSubscription) {
        this.tEndSubscription.unsubscribe();
        this.tEndSubscription = null;
      }
      
      // Clean up service
      if (this.ecgService) {
        this.ecgService.destroy();
        this.ecgService = null;
      }
      
      // Reset data arrays
      this.ecgData = [];
      this.ecgTime = [];
      this.rPeaks = [];
      this.qPoints = [];
      this.tEndPoints = [];
    },
    
    handleEcgData(data) {
      // Initialize time tracking if needed
      if (!this.initialTimestamp && data.times && data.times.length > 0) {
        this.initialTimestamp = Date.now() / 1000; // Current time in seconds
      }
      
      // Add new samples to the arrays
      this.ecgData.push(...data.samples);
      
      // Calculate times relative to our window
      const newTimes = [];
      for (let i = 0; i < data.times.length; i++) {
        const relativeTime = data.times[i];
        newTimes.push(relativeTime);
      }
      this.ecgTime.push(...newTimes);
      
      // Limit to max points based on history interval
      const maxPointsToKeep = this.maxDataPoints;
      if (this.ecgData.length > maxPointsToKeep) {
        const removeCount = this.ecgData.length - maxPointsToKeep;
        this.ecgData.splice(0, removeCount);
        this.ecgTime.splice(0, removeCount);
        
        // Also adjust point indices
        this.rPeaks = this.rPeaks.filter(point => point.index >= removeCount)
          .map(point => ({ ...point, index: point.index - removeCount }));
        
        this.qPoints = this.qPoints.filter(point => point.index >= removeCount)
          .map(point => ({ ...point, index: point.index - removeCount }));
        
        this.tEndPoints = this.tEndPoints.filter(point => point.index >= removeCount)
          .map(point => ({ ...point, index: point.index - removeCount }));
      }
      
      // Log data size periodically for debugging
      if (this.ecgData.length % 500 === 0) {
        console.log(`ECG data points: ${this.ecgData.length}, time range: ${this.ecgTime[0]} to ${this.ecgTime[this.ecgTime.length-1]}`);
        console.log(`Current history interval: ${this.historyInterval}s, max points: ${maxPointsToKeep}`);
      }
    },
    
    handleRPeak(data) {
      // Store R peak for visualization
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.rPeaks.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
        
        // Limit number of points stored
        if (this.rPeaks.length > 10) {
          this.rPeaks.shift();
        }
      }
    },
    
    handleQPoint(data) {
      // Store Q point for visualization
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.qPoints.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
        
        // Limit number of points stored
        if (this.qPoints.length > 5) {
          this.qPoints.shift();
        }
      }
    },
    
    handleTEnd(data) {
      // Store T-end point for visualization
      const relativeIndex = this.ecgData.length - (this.ecgService.ecgSamples.length - data.index);
      if (relativeIndex >= 0 && relativeIndex < this.ecgData.length) {
        this.tEndPoints.push({
          index: relativeIndex,
          time: this.ecgTime[relativeIndex],
          value: this.ecgData[relativeIndex]
        });
        
        // Limit number of points stored
        if (this.tEndPoints.length > 5) {
          this.tEndPoints.shift();
        }
      }
    },

    initializePlot() {
      const ecgTrace = {
        x: this.ecgTime,
        y: this.ecgData,
        type: 'scatter',
        mode: 'lines',
        name: 'ECG Signal',
        line: { color: 'red', width: 1 }
      };
      
      const rPeaksTrace = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'markers',
        name: 'R Peaks',
        marker: { color: 'purple', size: 10, symbol: 'circle' }
      };
      
      const qPointsTrace = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'markers',
        name: 'Q Points',
        marker: { color: 'blue', size: 8, symbol: 'circle' }
      };
      
      const tEndPointsTrace = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'markers',
        name: 'T-end Points',
        marker: { color: 'green', size: 8, symbol: 'circle' }
      };
      
      const layout = {
        title: '',
        autosize: true,
        margin: { t: 5, r: 5, b: 30, l: 40 },
        xaxis: {
          title: 'Time (s)',
          automargin: true,
          range: [0, Math.max(0.1, this.historyInterval)],
          showgrid: true,
          zeroline: false,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          color: this.getTextColor()
        },
        yaxis: {
          title: 'Amplitude (µV)',
          automargin: true,
          showgrid: true,
          zeroline: false,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          color: this.getTextColor()
        },
        legend: {
          orientation: 'h'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          color: this.getTextColor()
        }
      };
      
      Plotly.newPlot(this.$refs.ecgChart, [ecgTrace, rPeaksTrace, qPointsTrace, tEndPointsTrace], layout, { responsive: true });
      this.plotInitialized = true;
    },
    
    updatePlot() {
      if (!this.plotInitialized || !this.$refs.ecgChart || this.ecgData.length === 0) return;
      
      const latestTime = this.ecgTime[this.ecgTime.length - 1];
      const displayInterval = Math.max(0.1, this.historyInterval);
      const windowStartTime = Math.max(0, latestTime - displayInterval);

      // Adjust times to be relative to the start of the current display window
      const plotEcgTime = this.ecgTime.map(t => t - windowStartTime);
      const plotRPeakTimes = this.rPeaks.map(p => p.time - windowStartTime);
      const plotQPointTimes = this.qPoints.map(p => p.time - windowStartTime);
      const plotTEndTimes = this.tEndPoints.map(p => p.time - windowStartTime);
      
      const updateData = {
        x: [plotEcgTime, plotRPeakTimes, plotQPointTimes, plotTEndTimes],
        y: [
          this.ecgData,
          this.rPeaks.map(p => p.value),
          this.qPoints.map(p => p.value),
          this.tEndPoints.map(p => p.value)
        ]
      };
      
      // Update only the data, keeping the layout (and fixed axis range) unchanged
      Plotly.update(this.$refs.ecgChart, updateData, {});
    }
  }
}
</script>

<style scoped>
/* Ensure consistent height */
div {
  width: 100%;
}
</style>

