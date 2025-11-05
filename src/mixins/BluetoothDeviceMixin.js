import deviceManager from '../services/DeviceManager'
import log from '@/log'
import SubscriptionMixin from './SubscriptionMixin'
import { metrics } from '../services/store.js'

/**
 * Mixin that provides Bluetooth device access to Vue components
 * with proper handling for Hot Module Replacement (HMR)
 */
export default {
  mixins: [SubscriptionMixin],
  
  data() {
    return {
      device: null
    }
  },
  
  created() {
    // Get the current device from the device manager
    this.device = deviceManager.getDevice()
    
    // Subscribe to device changes using the SubscriptionMixin
    this.safeSubscribe(
      'device-manager', 
      deviceManager.observeDevice(), 
      device => {
        log.debug('BluetoothDeviceMixin: Device changed')
        this.device = device
        
        // Subscribe to heart rate to update central store
        if (device && device.observeHeartRate) {
          this.safeSubscribe(
            'heart-rate-store',
            device.observeHeartRate(),
            hr => {
              metrics.heartRate = hr
            }
          )
        }
      }
    )
    
    // Support for HMR
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        log.debug('BluetoothDeviceMixin: HMR triggered')
      })
    }
  },
  
  methods: {
    /**
     * Pair with a new Bluetooth device
     */
    async pairDevice() {
      try {
        // Import the pair service dynamically to avoid circular dependencies
        const { PairService } = await import('../web_bluetooth.js')
        const pairService = new PairService()
        const pairedDevice = await pairService.pair()
        
        // Save the paired device
        deviceManager.setPairedDevice(pairedDevice)
        
        return pairedDevice
      } catch (error) {
        log.debug('BluetoothDeviceMixin: Error pairing device', error)
        throw error
      }
    },
    
    /**
     * Connect to the previously paired device
     */
    async connectDevice() {
      try {
        // Make sure we have a paired device
        const pairedDevice = deviceManager.getPairedDevice()
        if (!pairedDevice) {
          throw new Error('No paired device available. Call pairDevice() first.')
        }
        
        // Import the connect service dynamically
        const { ConnectService } = await import('../web_bluetooth.js')
        const connectService = new ConnectService()
        
        // Connect to the device
        const device = await connectService.connect(pairedDevice)
        
        // Save the connected device
        deviceManager.setDevice(device)
        
        return device
      } catch (error) {
        log.debug('BluetoothDeviceMixin: Error connecting device', error)
        throw error
      }
    },
    
    /**
     * Disconnect the current device
     */
    disconnectDevice() {
      deviceManager.disconnect()
    },
    
    /**
     * Pair and connect in one step
     */
    async pairAndConnect() {
      try {
        const pairedDevice = await this.pairDevice()
        return await this.connectDevice()
      } catch (error) {
        log.debug('BluetoothDeviceMixin: Error in pairAndConnect', error)
        throw error
      }
    }
  }
  
  // No need for beforeDestroy as SubscriptionMixin handles cleanup
} 