<template>
  <CardWrapper title="Heart Rate Over Time">
    <div ref="chart" style="width: 100%; min-height: 400px;"></div>
  </CardWrapper>
</template>

<script>
import Plotly from 'plotly.js-dist-min' // Ensure Plotly is installed via npm or yarn
import CardWrapper from './CardWrapper.vue'
import themeManager from '../services/ThemeManager.js'
import { opts } from '../services/store.js'
import { computed, watch, ref } from 'vue'

export default {
  name: 'HeartRateChart',
  components: {
    CardWrapper
  },
  props: {
    device: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    // References
    const chart = ref(null);
    const plotInitialized = ref(false);
    
    // Computed property for dynamic history interval
    const historyInterval = computed(() => opts.historyInterval);
    
    // Computed property for max data points based on interval and sampling rate
    const maxDataPoints = computed(() => {
      // Assume typical heart rate sensor samples at 1Hz (1 sample per second)
      // Double for safety to ensure we don't run out of points
      return historyInterval.value * 2;
    });
    
    // Watch for changes in history interval
    watch(historyInterval, (newInterval) => {
      if (plotInitialized.value && chart.value) {
        // Update the x-axis range
        Plotly.relayout(chart.value, {
          'xaxis.range': [0, newInterval]
        });
        
        console.log(`Heart rate chart display interval updated to ${newInterval} seconds`);
      }
    });
    
    return {
      chart,
      plotInitialized,
      historyInterval,
      maxDataPoints
    };
  },
  data() {
    return {
      heartRateData: [],
      timeData: [],
      startTime: null,
      layout: {
        title: '',
        autosize: true,
        margin: { t: 5, r: 5, b: 30, l: 40 },
        xaxis: {
          title: 'Time (s)',
          automargin: true,
          range: [0, this.historyInterval],
          showgrid: true,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          color: this.getTextColor()
        },
        yaxis: {
          title: 'Heart Rate (bpm)',
          automargin: true,
          range: [50, 220],
          showgrid: true,
          gridcolor: this.getGridColor(),
          gridwidth: this.getGridWidth(),
          color: this.getTextColor()
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          color: this.getTextColor()
        },
        shapes: [
          // Resting Zone
          {
            type: 'rect',
            xref: 'paper',
            x0: 0,
            x1: 1,
            y0: 50,
            y1: 100,
            fillcolor: 'rgba(173, 216, 230, 0.2)', // Light Blue
            line: { width: 0 },
            layer: 'below'
          },
          // Fat Burn Zone
          {
            type: 'rect',
            xref: 'paper',
            x0: 0,
            x1: 1,
            y0: 100,
            y1: 140,
            fillcolor: 'rgba(144, 238, 144, 0.2)', // Light Green
            line: { width: 0 },
            layer: 'below'
          },
          // Cardio Zone
          {
            type: 'rect',
            xref: 'paper',
            x0: 0,
            x1: 1,
            y0: 140,
            y1: 180,
            fillcolor: 'rgba(255, 160, 122, 0.2)', // Light Salmon
            line: { width: 0 },
            layer: 'below'
          },
          // Peak Zone
          {
            type: 'rect',
            xref: 'paper',
            x0: 0,
            x1: 1,
            y0: 180,
            y1: 220,
            fillcolor: 'rgba(255, 255, 102, 0.2)', // Light Yellow
            line: { width: 0 },
            layer: 'below'
          }
        ],
        annotations: [
          {
            xref: 'paper',
            yref: 'y',
            x: 0.02,
            y: 75,
            text: 'Resting',
            showarrow: false,
            font: { color: this.getTextColor(), size: 12 }
          },
          {
            xref: 'paper',
            yref: 'y',
            x: 0.02,
            y: 120,
            text: 'Fat Burn',
            showarrow: false,
            font: { color: this.getTextColor(), size: 12 }
          },
          {
            xref: 'paper',
            yref: 'y',
            x: 0.02,
            y: 160,
            text: 'Cardio',
            showarrow: false,
            font: { color: this.getTextColor(), size: 12 }
          },
          {
            xref: 'paper',
            yref: 'y',
            x: 0.02,
            y: 200,
            text: 'Peak',
            showarrow: false,
            font: { color: this.getTextColor(), size: 12 }
          }
        ],
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
          name: 'Heart Rate',
          line: { color: '#17BECF' }
        },
        {
          x: [],
          y: [],
          type: 'scatter',
          mode: 'markers',
          name: 'Current Heart Rate',
          marker: { symbol: 'heart', size: 12, color: 'red' }
        }
      ],
      config: { 
        responsive: true, 
        displayModeBar: false 
      },
      subscription: null,
      themeListener: null
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
    
    updateTheme() {
      // Update colors for dark/light theme
      this.layout.font.color = this.getTextColor()
      this.layout.xaxis.color = this.getTextColor()
      this.layout.yaxis.color = this.getTextColor()
      this.layout.xaxis.gridcolor = this.getGridColor()
      this.layout.yaxis.gridcolor = this.getGridColor()
      this.layout.xaxis.gridwidth = this.getGridWidth()
      this.layout.yaxis.gridwidth = this.getGridWidth()
      
      // Update annotation colors
      this.layout.annotations.forEach(annotation => {
        annotation.font.color = this.getTextColor()
      })
      
      // Redraw the plot if initialized
      if (this.plotInitialized) {
        Plotly.react(this.$refs.chart, this.plotData, this.layout, this.config)
      }
    },
    
    initializePlot() {
      Plotly.newPlot(this.$refs.chart, this.plotData, this.layout, this.config)
      this.plotInitialized = true
    },
    
    updateChart(hr) {
      const now = Date.now()
      if (!this.startTime) this.startTime = now
      const elapsedTime = (now - this.startTime) / 1000 // seconds

      this.heartRateData.push(hr)
      this.timeData.push(elapsedTime)

      // Keep only enough data points for the current history interval
      while (this.timeData.length > this.maxDataPoints) {
        this.timeData.shift()
        this.heartRateData.shift()
      }

      // Update Heart Rate Trace
      this.plotData[0].x = [...this.timeData]
      this.plotData[0].y = [...this.heartRateData]

      // Update Current Heart Rate Marker
      this.plotData[1].x = [elapsedTime]
      this.plotData[1].y = [hr]

      // Adjust x-axis range to show the latest history interval
      const xMin = Math.max(0, elapsedTime - this.historyInterval)
      const xMax = xMin + this.historyInterval
      this.layout.xaxis.range = [xMin, xMax]

      // Redraw the plot if initialized
      if (this.plotInitialized) {
        Plotly.react(this.$refs.chart, this.plotData, this.layout, this.config)
      } else {
        // If not initialized, initialize plot
        this.initializePlot()
      }
    },
    
    subscribeToHeartRate() {
      if (this.device && this.device.observeHeartRate) {
        this.subscription = this.device.observeHeartRate().subscribe(hr => {
          this.updateChart(hr)
        })
      } else {
        console.error('Device does not support observeHeartRate()')
      }
    },
    
    resetChart() {
      this.heartRateData = []
      this.timeData = []
      this.startTime = null
      this.plotData[0].x = []
      this.plotData[0].y = []
      this.plotData[1].x = []
      this.plotData[1].y = []
      this.layout.xaxis.range = [0, this.historyInterval]

      if (this.plotInitialized) {
        Plotly.react(this.$refs.chart, this.plotData, this.layout, this.config)
      }
    }
  },
  watch: {
    device: {
      immediate: false,
      handler(newDevice) {
        this.resetChart()
        if (newDevice) {
          this.$nextTick(() => {
            this.initializePlot()
            this.subscribeToHeartRate()
          })
        }
      }
    }
  },
  mounted() {
    // Store reference to the chart element
    this.chart = this.$refs.chart;
    
    // If device is already provided at mount
    if (this.device) {
      this.initializePlot()
      this.subscribeToHeartRate()
    }
    
    // Listen for theme changes
    this.themeListener = (theme) => {
      this.updateTheme()
    }
    themeManager.addListener(this.themeListener)
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
    
    // Remove theme listener
    if (this.themeListener) {
      themeManager.removeListener(this.themeListener)
    }
    
    Plotly.purge(this.$refs.chart)
  }
}
</script>

<style scoped>
/* Optional: Customize the plot container */
div {
  width: 100%;
  /* height: 400px; <-- Removed fixed height */
}
</style>
