<template>
  <div id=app >
    <button v-if=!device @click=pair >Pair & Connect</button>
    <div v-else >
      Connected to {{device.name()}}
      <button @click=disconnect >Disconnect</button>
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

      <HeartRateChart :device=device />

      <Ecg :device=device />
      <Accelerometer :device=device />
    </div>

  </div>
</template>

<script>
import log from '@/log.js'

import {PairService, ConnectService} from '../web_bluetooth.js'
import QTc from '../components/QTc.vue'
import VLFPower from '../components/VLFPower.vue'
import TotalPower from '../components/TotalPower.vue'

export default {
  components: {
    QTc,
    VLFPower,
    TotalPower
  },

  data() {
    return {
      pairedDevice: null,
      device:       null,
    }
  },
  name: 'WebApp',

  async mounted() {
  },

  methods: {

    async pair() {
      this.pairedDevice = await (new PairService).pair()
      await this.connect()
    },

    async connect() {
      this.device = await (new ConnectService).connect(this.pairedDevice)
      log.debug('App: got device', this.device)
      this.device.onDisconnect(_ => this.device = null)
    },

    disconnect() {
      this.device.disconnect()
    },

    
  }
}
</script>

