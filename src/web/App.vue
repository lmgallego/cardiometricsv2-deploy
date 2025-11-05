<template>
  <div id="app" class="max-w-7xl mx-auto p-4 bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
    <ThemeToggle />
    
    <div class="flex justify-center mb-4">
      <button v-if="!device" @click="pairAndConnect" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
        Pair & Connect
      </button>
      <div v-else-if="device" class="flex items-center space-x-4">
        <span class="text-lg text-gray-800 dark:text-white">Connected to {{device.name()}}</span>
        <button @click="disconnectDevice" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
          Disconnect
        </button>
      </div>
    </div>

    <div v-if="device" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StressDisplay :device="device" />
        <EnergyDisplay :device="device" />
        <HealthDisplay :device="device" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HRVDisplay :device="device" />
        <FrequencyAnalysis :device="device" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Battery :device="device" />
        <HeartRateMonitor :device="device" />
        <RRInterval :device="device" />
        <QTc :device="device" />
      </div>

      <!-- Chart history control -->
      <HistoryIntervalControl />

      <HeartRateChart :device="device" class="w-full" />

      <div class="grid grid-cols-1 gap-4">
        <Ecg :device="device" />
        <Accelerometer :device="device" />
      </div>
    </div>
  </div>
</template>

<script>
import log from '@/log.js'
import BluetoothDeviceMixin from '../mixins/BluetoothDeviceMixin'
import FrequencyAnalysis from '../components/FrequencyAnalysis.vue'
import HRVDisplay from '../components/HRVDisplay.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import HistoryIntervalControl from '../components/HistoryIntervalControl.vue'
import Accelerometer from '../components/Accelerometer.vue'

export default {
  name: 'WebApp',
  mixins: [BluetoothDeviceMixin],
  components: {
    FrequencyAnalysis,
    HRVDisplay,
    ThemeToggle,
    HistoryIntervalControl,
    Accelerometer
  },
  
  // Support for HMR
  beforeCreate() {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        log.debug('App.vue: HMR triggered')
      })
    }
  }
}
</script>

<style>
/* Add Tailwind dark mode support */
:root {
  color-scheme: light dark;
}

/* Global transition for theme changes */
* {
  transition-property: color, background-color, border-color;
  transition-duration: 200ms;
}
</style>

