<template>
  <CardWrapper title="Accelerometer">
    <div ref="accelerometerChart" style="width: 100%; min-height: 400px;"></div>
  </CardWrapper>
</template>

<script>
import Plotly from 'plotly.js-dist-min'
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
    const accelerometerChart = ref(null);
    const plotInitialized = ref(false);
    
    // Computed property for dynamic history interval
    const historyInterval = computed(() => opts.historyInterval);
    
    // Computed property for max data points based on interval and sampling rate
    const maxDataPoints = computed(() => {
      // Assuming accelerometer typically samples at around 50Hz
      // Calculate points needed for the history interval
      const typicalSamplingRate = 50; // Hz
      return historyInterval.value * typicalSamplingRate;
    });
    
    // Watch for changes in history interval
    watch(historyInterval, (newInterval) => {
      if (plotInitialized.value && accelerometerChart.value) {
        // Update the x-axis range to reflect new interval
        // Keep the range fixed starting from 0
        const displayInterval = Math.max(0.1, newInterval);
        Plotly.relayout(accelerometerChart.value, {
          'xaxis.range': [0, displayInterval]
        });
        
        console.log(`Accelerometer chart display interval updated to ${newInterval} seconds`);
      }
    });
    
    return {
      accelerometerChart,
      plotInitialized,
      historyInterval,
      maxDataPoints
    };
  },
  
  data() {
    return {
      accData: [], // Array to store received accelerometer data
      axData: [],
      ayData: [],
      azData: [],
      timeData: [],
      startTime: null,
      layout: {
        title: '',
        autosize: true,
        margin: { t: 5, r: 5, b: 30, l: 40 },
        xaxis: {
          title: 'Time (s)',
          automargin: true,
          range: [0, Math.max(0.1, this.historyInterval)],
          showgrid: true,
          zeroline: true,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          zerolinecolor: this.getZeroLineColor(),
          color: this.getTextColor()
        },
        yaxis: {
          title: 'Acceleration',
          automargin: true,
          range: [-3, 3],
          showgrid: true,
          zeroline: true,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          zerolinecolor: this.getZeroLineColor(),
          zerolinewidth: 1,
          color: this.getTextColor()
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          color: this.getTextColor()
        },
        legend: {
          orientation: 'h'
        }
      },
      plotData: [
        {
          x: [],
          y: [],
          type: 'scatter',
          mode: 'lines',
          name: 'X',
          line: { color: 'red', width: 1.5 }
        },
        {
          x: [],
          y: [],
          type: 'scatter',
          mode: 'lines',
          name: 'Y',
          line: { color: 'green', width: 1.5 }
        },
        {
          x: [],
          y: [],
          type: 'scatter',
          mode: 'lines',
          name: 'Z',
          line: { color: 'blue', width: 1.5 }
        }
      ],
      config: { responsive: true, displayModeBar: false },
      subscription: null,
      themeListener: null,
      scaleFactor: 0.01,
      sampleIndex: 0,
      scrolling: false, // Disable scrolling behavior to accumulate history
      normalizeValues: true, // Normalize the values to ensure visibility
      baselineValues: null,
      calibrationCount: 20
    }
  },
  
  methods: {
    getTextColor() {
      return themeManager.isDarkTheme() ? '#FFFFFF' : '#333333'
    },
    
    getGridColor() {
      return themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    },
    
    getGridWidth() {
      return themeManager.isDarkTheme() ? 0.5 : 1
    },
    
    getZeroLineColor() {
      return themeManager.isDarkTheme() ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    },
    
    updateTheme() {
      if (!this.plotInitialized || !this.$refs.accelerometerChart) return
      
      const update = {
        'xaxis.color': this.getTextColor(),
        'yaxis.color': this.getTextColor(),
        'font.color': this.getTextColor(),
        'paper_bgcolor': 'rgba(0,0,0,0)',
        'plot_bgcolor': 'rgba(0,0,0,0)',
        'xaxis.gridcolor': this.getGridColor(),
        'yaxis.gridcolor': this.getGridColor(),
        'xaxis.gridwidth': this.getGridWidth(),
        'yaxis.gridwidth': this.getGridWidth(),
        'xaxis.zerolinecolor': this.getZeroLineColor(),
        'yaxis.zerolinecolor': this.getZeroLineColor()
      }
      
      Plotly.relayout(this.$refs.accelerometerChart, update)
    },
    
    initializePlot() {
      Plotly.newPlot(this.$refs.accelerometerChart, this.plotData, this.layout, this.config)
      this.plotInitialized = true
    },
    
    calculateBaseline() {
      if (this.sampleIndex < this.calibrationCount || this.baselineValues) {
        return;
      }
      
      let sumX = 0, sumY = 0, sumZ = 0;
      for (let i = 0; i < this.calibrationCount; i++) {
        if (i < this.axData.length) {
          sumX += this.axData[i];
          sumY += this.ayData[i];
          sumZ += this.azData[i];
        }
      }
      
      this.baselineValues = {
        x: sumX / this.calibrationCount,
        y: sumY / this.calibrationCount,
        z: sumZ / this.calibrationCount
      };
      
      console.log('Established baseline values:', this.baselineValues);
    },
    
    processAccelerometerData() {
      if (!this.accData || this.accData.length === 0) {
        return;
      }
      
      // Get the batch of data to process
      const dataToProcess = [...this.accData];
      this.accData = [];
      
      if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
        // Set up time tracking if not already done
        if (!this.startTime) {
          this.startTime = Date.now();
          console.log('Accelerometer tracking started at:', new Date(this.startTime).toISOString());
        }
        
        // Process each reading in the batch
        dataToProcess.forEach((reading, index) => {
          if (!reading || typeof reading !== 'object' || !('x' in reading) || !('y' in reading) || !('z' in reading)) {
            return;
          }
          
          // Scale the values down to a reasonable range
          let x = reading.x * this.scaleFactor;
          let y = reading.y * this.scaleFactor;
          let z = reading.z * this.scaleFactor;
          
          // Calculate time relative to start
          const now = Date.now();
          const elapsedSeconds = (now - this.startTime) / 1000;
          
          // Add data with real elapsed time (no resets)
          let timePoint = elapsedSeconds;
          
          // Add small offsets for multiple points in a batch to prevent overlap
          if (index > 0) {
            timePoint += (index * 0.01);
          }
          
          this.timeData.push(timePoint);
          this.axData.push(x);
          this.ayData.push(y);
          this.azData.push(z);
          
          this.sampleIndex++;
        });
        
        // Debug info for time series data
        if (this.sampleIndex % 100 === 0) {
          console.log(`Accelerometer: ${this.timeData.length} points, time range ${this.timeData[0].toFixed(1)} to ${this.timeData[this.timeData.length-1].toFixed(1)} seconds`);
          console.log(`Current history interval: ${this.historyInterval}s, max points: ${this.maxDataPoints}`);
        }
        
        // Try to calculate baseline values if we don't have them yet
        if (!this.baselineValues && this.normalizeValues) {
          this.calculateBaseline();
        }
        
        // If we have baseline values, normalize the data for better visibility
        if (this.baselineValues && this.normalizeValues) {
          // Adjust most recent data relative to baseline
          const startIdx = Math.max(0, this.axData.length - dataToProcess.length);
          for (let i = startIdx; i < this.axData.length; i++) {
            this.axData[i] = this.axData[i] - this.baselineValues.x;
            this.ayData[i] = this.ayData[i] - this.baselineValues.y;
            this.azData[i] = this.azData[i] - this.baselineValues.z;
          }
        }
        
        // Ensure there's data to plot
        if (this.timeData.length === 0) return;

        // Calculate window start time for relative plotting
        const latestTime = this.timeData[this.timeData.length - 1];
        const displayInterval = Math.max(0.1, this.historyInterval);
        const windowStartTime = Math.max(0, latestTime - displayInterval);
        
        // Filter data to include only points within the current display window
        const plotTimeData = [];
        const plotAxData = [];
        const plotAyData = [];
        const plotAzData = [];
        
        for (let i = 0; i < this.timeData.length; i++) {
          const currentTime = this.timeData[i];
          // Include points that are within the current time window
          if (currentTime >= windowStartTime) {
            // Calculate time relative to the window start
            plotTimeData.push(currentTime - windowStartTime);
            plotAxData.push(this.axData[i]);
            plotAyData.push(this.ayData[i]);
            plotAzData.push(this.azData[i]);
          }
        }
        
        // Prepare update data with filtered and relative times
        const updateData = {
          x: [plotTimeData, plotTimeData, plotTimeData],
          y: [plotAxData, plotAyData, plotAzData]
        };
        
        // Calculate dynamic Y-axis range based on visible data
        const allVisibleY = [...plotAxData, ...plotAyData, ...plotAzData];
        let yMin = Math.min(...allVisibleY);
        let yMax = Math.max(...allVisibleY);
        const yRange = yMax - yMin;
        const yPadding = yRange * 0.1; // Add 10% padding
        
        // Ensure finite values and some minimum range
        yMin = isFinite(yMin) ? yMin - yPadding : -1;
        yMax = isFinite(yMax) ? yMax + yPadding : 1;
        if (yMax - yMin < 0.1) { // Ensure a minimum range span
            yMax = yMin + 0.1;
        }

        const layoutUpdate = {
            'yaxis.range': [yMin, yMax]
        };

        // Update the chart using Plotly.update for efficiency
        if (this.plotInitialized) {
          // Update data and layout (dynamic y-axis range)
          Plotly.update(this.$refs.accelerometerChart, updateData, layoutUpdate);
        } else {
          // If plot not initialized, initialize it (should ideally not happen here)
          // Apply dynamic range during initialization as well
          this.layout.yaxis.range = [yMin, yMax];
          this.initializePlot();
        }

        // Clean up old data from storage based on time (keep historyInterval + buffer)
        const cleanupThreshold = latestTime - displayInterval - 5; // Keep 5s buffer
        let removeCount = 0;
        for (let i = 0; i < this.timeData.length; i++) {
          if (this.timeData[i] < cleanupThreshold) {
            removeCount++;
          } else {
            // Data is sorted by time, so we can stop checking
            break;
          }
        }
        if (removeCount > 0) {
          this.timeData.splice(0, removeCount);
          this.axData.splice(0, removeCount);
          this.ayData.splice(0, removeCount);
          this.azData.splice(0, removeCount);
        }
      }
    },
    
    resetDataArrays() {
      this.axData = [];
      this.ayData = [];
      this.azData = [];
      this.timeData = [];
      this.startTime = null;
      this.sampleIndex = 0;
      this.baselineValues = null;
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
        
        setTimeout(() => {
          if (this.sampleIndex === 0) {
            console.warn('No accelerometer data received after 3 seconds');
          }
        }, 3000);
      } else {
        console.error('Device does not support observeAccelerometer()');
      }
    },
    
    resetChart() {
      this.accData = [];
      this.resetDataArrays();
      
      this.plotData[0].x = [];
      this.plotData[0].y = [];
      this.plotData[1].x = [];
      this.plotData[1].y = [];
      this.plotData[2].x = [];
      this.plotData[2].y = [];
      
      if (this.plotInitialized) {
        Plotly.react(this.$refs.accelerometerChart, this.plotData, this.layout, this.config);
      }
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
        
        this.resetChart();
        
        if (newDevice) {
          this.$nextTick(() => {
            this.initializePlot();
            this.subscribeToAccelerometer();
          });
        }
      }
    }
  },
  
  mounted() {
    // Store reference to the chart element
    this.accelerometerChart = this.$refs.accelerometerChart;
    
    // Initialize plot
    this.initializePlot();
    
    // Subscribe to accelerometer if device is already available
    if (this.device) {
      this.subscribeToAccelerometer();
    }
    
    // Listen for theme changes
    this.themeListener = (theme) => {
      this.updateTheme();
    };
    themeManager.addListener(this.themeListener);
  },
  
  beforeDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    if (this.themeListener) {
      themeManager.removeListener(this.themeListener);
    }
    
    if (this.plotInitialized && this.$refs.accelerometerChart) {
      Plotly.purge(this.$refs.accelerometerChart);
    }
  }
}
</script>

<style scoped>
/* Ensure consistent sizing */
div {
  width: 100%;
}
</style>

