<template>
  <div id="app" class="max-w-7xl mx-auto p-4">
    <div class="flex justify-center mb-4">
      <button v-if="!device" @click="pairAndConnect" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
        Pair & Connect
      </button>
      <div v-else class="flex items-center space-x-4">
        <span class="text-lg">Connected to {{device.name()}}</span>
        <button @click="disconnectDevice" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
          Disconnect
        </button>
      </div>
    </div>

    <div v-if="device" class="space-y-4">
      <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
        <div class="w-full md:w-1/3">
          <StressDisplay :device="device" />
        </div>
        <div class="w-full md:w-1/3">
          <EnergyDisplay :device="device" />
        </div>
        <div class="w-full md:w-1/3">
          <HealthDisplay :device="device" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Battery :device="device" />
        <HeartRateMonitor :device="device" />
        <RRInterval :device="device" />

        <SDNN :device="device" />
        <RMSSD :device="device" />
        <pNN50 :device="device" />
        <MxDMn :device="device" />
        <AMo50 :device="device" />
        <CV :device="device" />
        <QTc :device="device" />
        
        <TotalPower :device="device" />
        <VLFPower :device="device" />
        <LFPower :device="device" />
        <HFPower :device="device" />
        <LFHFRatio :device="device" />
      </div>

      <HeartRateChart :device="device" class="w-full" />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Ecg :device="device" />
        <Accelerometer :device="device" />
      </div>
    </div>
  </div>
</template>

<script>
import log from '@/log.js'
import BluetoothDeviceMixin from '../mixins/BluetoothDeviceMixin'

export default {
  name: 'WebApp',
  mixins: [BluetoothDeviceMixin],
  
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

