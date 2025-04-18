<template>
  <div id=app >
    <button v-if=!device @click=pairAndConnect>Pair & Connect</button>
    <div v-else >
      Connected to {{device.name()}}
      <button @click=disconnectDevice>Disconnect</button>
    </div>

    <div v-if=device>
      <Battery :device=device />
      <HeartRateMonitor :device=device />
      <RRInterval :device=device />

      <SDNN :device=device />
      <RMSSD :device=device />
      <pNN50 :device=device />
      <MxDMn :device=device />
      <AMo50 :device=device />
      <CV :device=device />
      <QTc :device=device />
      
      <TotalPower :device=device />
      <VLFPower :device=device />
      <LFPower :device=device />
      <HFPower :device=device />
      <LFHFRatio :device=device />
      <StressDisplay :device=device />
      <EnergyDisplay :device=device />

      <HeartRateChart :device=device />

      <Ecg :device=device />
      <Accelerometer :device=device />
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

