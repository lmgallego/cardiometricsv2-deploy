<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-4 transition-colors duration-300 border border-gray-100 dark:border-gray-700">
    <div class="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 sm:space-x-4">
      <h2 class="text-xl font-semibold text-gray-800 dark:text-white">Chart History Settings</h2>
      
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          History Window:
        </label>
        <select 
          v-model="historyInterval" 
          @change="updateInterval"
          class="block w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-700 dark:text-gray-200"
        >
          <option value="15">15 seconds</option>
          <option value="30">30 seconds</option>
          <option value="60">60 seconds</option>
          <option value="120">2 minutes</option>
          <option value="300">5 minutes</option>
          <option value="600">10 minutes</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { opts } from '../services/store.js'

export default {
  name: 'HistoryIntervalControl',
  
  setup() {
    const historyInterval = ref(opts.historyInterval);
    
    // Update the global setting when the control changes
    const updateInterval = () => {
      opts.historyInterval = parseInt(historyInterval.value);
      console.log(`History interval updated to ${opts.historyInterval} seconds`);
    };
    
    // Watch for external changes to the store
    watch(() => opts.historyInterval, (newValue) => {
      if (newValue !== parseInt(historyInterval.value)) {
        historyInterval.value = newValue;
      }
    });
    
    // Initialize from store on component mount
    onMounted(() => {
      historyInterval.value = opts.historyInterval;
    });
    
    return {
      historyInterval,
      updateInterval
    };
  }
}
</script> 