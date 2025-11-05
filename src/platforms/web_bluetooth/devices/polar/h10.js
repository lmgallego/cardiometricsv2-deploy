import log from '@/log'
import BaseDevice from '../../base_device.js'
import { map, filter, share } from 'rxjs/operators'
import { Observable } from 'rxjs'

const PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8'
const PMD_CONTROL = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8'
const PMD_DATA    = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8'

const acc_timestep = 1000 / 200; // Assuming 200Hz sampling rate
const acc_range    = 0x04; //hex(2) for range of 2G - 4 and 8G available
const acc_rate     = 0xC8; //hex(200) for sampling freqency of 200Hz
const acc2_rate    = 416;  //0xA0;//acc2_rate=208;//26Hz, 52Hz, 104Hz, 208Hz, 416Hz
const acc_res      = 0x10; //hex(16) 16bit resolution
const ACC_START    = new Uint8Array([0x02, 0x02, 0x00, 0x01, 0xC8, 0x00, 0x01, 0x01, 0x10, 0x00, 0x02, 0x01, 0x08, 0x00])

// ECG sampling rate in Hz (from 0x00, 0x01 = 130Hz)
const ECG_SAMPLING_RATE = 130

const ECG_START =  new Uint8Array([
  0x02, // Start measurement
  0x00, // ECG stream ID
  // Content of the measurement settings (from Polar SDK issue #207)
  0x00, 0x01, // Sample rate (130 Hz) - 0x0001 = 130Hz
  0x82, 0x00, // Resolution (14 bits) - 0x0082 = 130 decimal
  0x01, 0x01, // Channels (1 channel)
  0x0E, 0x00  // Range (0x0E for ECG)
])

// Alternative ECG command if first one fails
const ECG_START_ALT = new Uint8Array([
  0x02, // Start measurement
  0x00, // ECG stream ID
  0x00, 0x01, // Sample rate (130 Hz)
  0x01, 0x00, // Resolution (8 bits)
  0x01, 0x00, // Channels (1 channel) - little endian
  0x0E, 0x00  // Range
])

// Basic ECG command - most compatible
const ECG_START_BASIC = new Uint8Array([
  0x02, // Start measurement
  0x00, // ECG stream ID
  0x00, 0x01, // Sample rate (130 Hz)
  0x00, 0x00, // Resolution (default)
  0x01, 0x00, // Channels (1 channel)
  0x00, 0x00  // Range (default)
])

// Request device status
const GET_DEVICE_STATUS = new Uint8Array([0x01, 0x00])

export default class H10 extends BaseDevice {

  static services = [
    '00001800-0000-1000-8000-00805f9b34fb',
    '00001801-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb',
    '0000180d-0000-1000-8000-00805f9b34fb',
    '0000180f-0000-1000-8000-00805f9b34fb',
    '0000feee-0000-1000-8000-00805f9b34fb',
    '6217ff4b-fb31-1140-ad5a-a45545d7ecf3',
    PMD_SERVICE,
  ]

  static chars = [
    PMD_CONTROL,
    PMD_DATA,
  ]

  constructor(connection) {
    super(connection);
    this.ecgDataReceived = false;
    this.accDataReceived = false;
    this.accStarted = false;
  }

  // Getter for ECG sampling rate
  get ecgSamplingRate() {
    return ECG_SAMPLING_RATE
  }

  // Shared PMD data observable - only subscribe once to PMD_DATA
  _getPmdDataObservable() {
    if (!this.observes.pmdData) {
      console.log('H10: Creating PMD data observable - ECG stream will be started');
      
      const self = this; // Store reference to this
      
      this.observes.pmdData = this.observeNotifications(PMD_SERVICE, PMD_DATA, {
        init: async () => {
          console.log('H10: PMD init - Starting ECG stream...');
          try {
            // Start ECG by default (can be changed to start both if needed)
            let charac = await this.fetchCharac(PMD_SERVICE, PMD_CONTROL)
            console.log('H10: PMD Control characteristic fetched');
            
            // First, request device status to check ECG capability
            console.log('H10: Requesting device status...');
            try {
              await charac.writeValue(GET_DEVICE_STATUS);
              console.log('H10: Device status requested');
              // Wait a moment for status response
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (statusError) {
              console.log('H10: Could not get device status, continuing...');
            }
            
            console.log('H10: Sending ECG_START command WITHOUT mutex:', Array.from(ECG_START));
            
            // Send ECG start command directly without mutex
            const writePromise = charac.writeValue(ECG_START);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Write timeout')), 5000)
            );
            
            await Promise.race([writePromise, timeoutPromise]);
            console.log('H10: ✅ ECG stream started successfully!');
            
            // Check if data starts flowing, if not try alternative
            setTimeout(() => {
              if (!self.ecgDataReceived) {
                console.log('H10: ⚠️ No ECG data received, trying alternative command...');
                self.tryAlternativeEcgCommands(charac);
              } else {
                console.log('H10: ✅ ECG data is flowing properly');
              }
            }, 3000);
            
          } catch (error) {
            console.error('H10: ❌ Failed to start ECG stream:', error);
            console.error('H10: Error details:', error.message, error.name);
          }
        },
        handler: (sub, event) => {
          const data = event.target.value;
          const dataType = data.getUint8(0);
          
          // Mark ECG data as received when type 0 comes in
          if (dataType === 0) {
            self.ecgDataReceived = true;
          }
          
          // Mark ACC data as received when type 2 comes in
          if (dataType === 2) {
            self.accDataReceived = true;
          }
          
          sub.next(data)
        },
      }).pipe(share())
    } else {
      console.log('H10: PMD data observable already exists');
    }
    return this.observes.pmdData
  }

  // Try alternative ECG commands if first one doesn't work
  async tryAlternativeEcgCommands(charac) {
    console.log('H10: Trying alternative ECG command...');
    try {
      await charac.writeValue(ECG_START_ALT);
      console.log('H10: ✅ Alternative ECG stream started!');
      
      // Wait and check if this works
      setTimeout(async () => {
        const hasData = this.observes.pmdData && this.ecgDataReceived;
        if (!hasData) {
          console.log('H10: ⚠️ Alternative failed, trying basic command...');
          await charac.writeValue(ECG_START_BASIC);
          console.log('H10: ✅ Basic ECG stream started!');
        }
      }, 2000);
      
    } catch (error) {
      console.error('H10: ❌ Alternative ECG command failed:', error);
    }
  }

  // Start accelerometer stream
  async startAccelerometer() {
    if (this.accStarted) {
      console.log('H10: Accelerometer already started');
      return;
    }

    // Use mutex to prevent concurrent writes to PMD_CONTROL
    const mutexKey = `${PMD_SERVICE}/${PMD_CONTROL}`;
    
    try {
      console.log('H10: Acquiring mutex for accelerometer start...');
      await this.mutex.lock(mutexKey);
      
      // Check again after acquiring mutex
      if (this.accStarted) {
        console.log('H10: Accelerometer already started (after mutex)');
        this.mutex.unlock(mutexKey);
        return;
      }
      
      console.log('H10: Starting accelerometer stream...');
      const charac = await this.fetchCharac(PMD_SERVICE, PMD_CONTROL);
      
      console.log('H10: Sending ACC_START command:', Array.from(ACC_START));
      await charac.writeValue(ACC_START);
      
      this.accStarted = true;
      console.log('H10: ✅ Accelerometer stream started successfully!');
      
      this.mutex.unlock(mutexKey);
      
      // Check if data starts flowing
      setTimeout(() => {
        if (!this.accDataReceived) {
          console.log('H10: ⚠️ No accelerometer data received after 3 seconds');
        } else {
          console.log('H10: ✅ Accelerometer data is flowing properly');
        }
      }, 3000);
      
    } catch (error) {
      this.mutex.unlock(mutexKey);
      console.error('H10: ❌ Failed to start accelerometer stream:', error);
      console.error('H10: Error details:', error.message, error.name);
    }
  }

  observeEcg() {
    console.log('H10: observeEcg called');
    return this.observes.ecg ||= this._getPmdDataObservable().pipe(
      map(data => {
        const dataView = new DataView(data.buffer);
        const dataType = dataView.getUint8(0);

        if (dataType === 0) { // ECG data type
          // Extract ECG samples starting from byte 10 (24-bit values)
          // Return RAW values - let EcgService handle normalization
          const samples = [];
          for (let i = 10; i + 2 < data.byteLength; i += 3) {
            // Read 24-bit signed integer (little-endian)
            const raw24 = dataView.getUint8(i)
                        | (dataView.getUint8(i + 1) << 8)
                        | (dataView.getUint8(i + 2) << 16);
            
            // Convert to signed (two's complement)
            const rawSample = raw24 >= 0x800000 ? raw24 - 0x1000000 : raw24;
            
            // Return RAW value without scaling
            // EcgService will handle baseline correction and normalization
            samples.push(rawSample);
          }
          return samples
        }
        return null
      }),
      filter(samples => samples !== null && samples.length > 0)
    )
  }

  observeAccelerometer() {
    console.log('H10: observeAccelerometer called');
    
    // Start accelerometer stream if not already started
    if (!this.accStarted) {
      // Delay start to ensure PMD data observable is set up and ECG has started
      setTimeout(() => this.startAccelerometer(), 3000);
    }
    
    return this.observes.acc ||= this._getPmdDataObservable().pipe(
      map(data => {
        const dataView = new DataView(data.buffer);
        const dataType = dataView.getUint8(0);
        
        // Check if DataType is accelerometer data
        if (dataType === 2) {
          // Process accelerometer data
          let frame_type = dataView.getUint8(9)
          if (frame_type === 1) {
            // Frame type 1 (uncompressed data)
            let samples = new Int16Array(data.buffer.slice(10))
            let ACC = []
            for (let offset = 0; offset < samples.length; offset += 3) {
              let i = offset / 3
              ACC[i] = {
                x: samples[offset],
                y: samples[offset + 1],
                z: samples[offset + 2],
              }
            }
            return ACC
          }
        }
        return null
      }),
      filter(acc => acc !== null && acc.length > 0)
    )
  }

  wordToSignedInt16LE(byteArray) {
    const value = (byteArray[1] << 8) | byteArray[0];
    return value >= 32768 ? value - 65536 : value;
  }

}

