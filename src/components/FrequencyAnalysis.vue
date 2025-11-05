<template>
  <CardWrapper :title="t.title">
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-2xl font-bold" :class="getStatusClass('totalPower', totalPower)">{{ Math.round(totalPower) }}ms²</span>
          <span class="ml-2">{{ getMetricDefinition('totalPower').name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Language Toggle -->
          <button
            @click="toggleLanguage"
            class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            :title="currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'"
          >
            {{ currentLang === 'es' ? 'EN' : 'ES' }}
          </button>
          
          <!-- Info Icon -->
          <div 
            class="rounded-full bg-gray-200 dark:bg-gray-700 p-1 cursor-help relative group"
            @click="showInfoModal = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
      <div class="text-sm" :class="getStatusClass('totalPower', totalPower)">
        {{ getTranslatedStatus('totalPower', totalPower) }}
      </div>
      <div class="text-gray-500 dark:text-gray-400">
        {{ t.normalRange }}: {{ getMetricDefinition('totalPower').normalRange.min }}—{{ getMetricDefinition('totalPower').normalRange.max }} ms²
      </div>
    </div>
    
    <div class="relative h-48 mb-6 bg-gray-100 dark:bg-gray-800 rounded">
      <!-- Dynamic frequency spectrum graph -->
      <div class="absolute inset-0 flex items-end p-2 gap-1">
        <div 
          class="bg-red-400 rounded-t-sm transition-all duration-500" 
          :style="{ width: '20%', height: getBarHeight(vlfPower) }"
        ></div>
        <div 
          class="bg-blue-500 rounded-t-sm transition-all duration-500" 
          :style="{ width: '30%', height: getBarHeight(lfPower) }"
        ></div>
        <div 
          class="bg-yellow-300 rounded-t-sm transition-all duration-500" 
          :style="{ width: '50%', height: getBarHeight(hfPower) }"
        ></div>
      </div>
      <div class="absolute bottom-0 left-0 w-full h-px bg-gray-400 dark:bg-gray-600"></div>
      <div class="absolute bottom-0 left-0 w-px h-full bg-gray-400 dark:bg-gray-600"></div>
      <div class="absolute bottom-0 left-2 text-xs text-gray-500 dark:text-gray-400 transform translate-y-4">0,0</div>
      <div class="absolute bottom-0 right-2 text-xs text-gray-500 dark:text-gray-400 transform translate-y-4">0,4</div>
    </div>
    
    <div class="space-y-4">
      <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <div class="flex items-center">
          <div class="w-16 h-1 bg-red-400 mr-2"></div>
          <span class="text-gray-700 dark:text-gray-200">{{ getMetricDefinition('vlfPower').name.split(' ')[0] }}</span>
        </div>
        <span :class="getStatusClass('vlfPower', vlfPower)">{{ Math.round(vlfPower) }}ms²</span>
      </div>
      
      <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <div class="flex items-center">
          <div class="w-16 h-1 bg-blue-500 mr-2"></div>
          <span class="text-gray-700 dark:text-gray-200">{{ getMetricDefinition('lfPower').name.split(' ')[0] }}</span>
        </div>
        <span :class="getStatusClass('lfPower', lfPower)">{{ Math.round(lfPower) }}ms²</span>
      </div>
      
      <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <div class="flex items-center">
          <div class="w-16 h-1 bg-yellow-300 mr-2"></div>
          <span class="text-gray-700 dark:text-gray-200">{{ getMetricDefinition('hfPower').name.split(' ')[0] }}</span>
        </div>
        <span :class="getStatusClass('hfPower', hfPower)">{{ Math.round(hfPower) }}ms²</span>
      </div>
    </div>
    
    <div class="mt-6">
      <h3 class="text-lg mb-2 text-gray-900 dark:text-gray-100">{{ t.conclusion }}</h3>
      <p class="text-gray-700 dark:text-gray-300">
        {{ t.yourSpectralPower }} {{ getTranslatedStatus('totalPower', totalPower).toLowerCase() }}. 
        {{ getSpectralAnalysisConclusion }}
      </p>
    </div>

    <!-- Info Modal -->
    <div 
      v-if="showInfoModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click="showInfoModal = false"
    >
      <div 
        class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ t.modal.title }}</h3>
          <button 
            @click="showInfoModal = false"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-4 text-gray-700 dark:text-gray-300">
          <p>{{ t.modal.intro }}</p>
          
          <div class="space-y-2">
            <p><strong>{{ t.modal.vlf }}</strong></p>
            <p><strong>{{ t.modal.lf }}</strong></p>
            <p><strong>{{ t.modal.hf }}</strong></p>
          </div>
          
          <div>
            <h4 class="font-semibold mb-2">{{ t.modal.references }}</h4>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>
                <a href="https://www.elsevier.es/es-revista-revista-andaluza-medicina-del-deporte-284-articulo-aplicacion-variabilidad-frecuencia-cardiaca-caracterizacion-X1888754609461988" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">
                  {{ t.modal.ref1 }}
                </a>
              </li>
              <li>
                <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11410424/" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">
                  {{ t.modal.ref2 }}
                </a>
              </li>
              <li>
                <a href="https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2019.00545/full" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">
                  {{ t.modal.ref3 }}
                </a>
              </li>
              <li>
                <a href="https://dialnet.unirioja.es/descarga/articulo/8670919.pdf" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">
                  {{ t.modal.ref4 }}
                </a>
              </li>
            </ul>
          </div>
          
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
            <h4 class="font-semibold mb-2 text-gray-900 dark:text-gray-100">{{ t.modal.quickInterpretation }}</h4>
            <p>{{ t.modal.quickText }}</p>
          </div>
        </div>
      </div>
    </div>
  </CardWrapper>
</template>

<script>
import TotalPower from '../services/TotalPower.js'
import VLFPower from '../services/VLFPower.js'
import LFPower from '../services/LFPower.js'
import HFPower from '../services/HFPower.js'
import { metrics } from '../services/store.js'
import { MetricDefinitions, getMetricStatus, getMetricStatusClass } from '../services/MetricDefinitions.js'
import SubscriptionMixin from '../mixins/SubscriptionMixin.js'
import CardWrapper from './CardWrapper.vue'

export default {
  components: {
    CardWrapper
  },
  mixins: [SubscriptionMixin],
  props: {
    device: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      // Dummy calculator class to satisfy RRIntMixin requirements
      calculatorClass: TotalPower,
      totalPower: 0,
      vlfPower: 0,
      lfPower: 0,
      hfPower: 0,
      metrics: metrics,
      showInfoModal: false,
      currentLang: 'es', // Default language
      translations: {
        es: {
          title: 'Análisis de frecuencia',
          normalRange: 'Rango normal',
          conclusion: 'Conclusión',
          yourSpectralPower: 'Tu potencia espectral es',
          status: {
            veryPoor: 'muy pobre',
            poor: 'pobre',
            normal: 'normal',
            good: 'buena',
            excellent: 'excelente'
          },
          modal: {
            title: '¿Qué significa el análisis espectral HRV?',
            intro: 'El análisis espectral de la variabilidad de la frecuencia cardíaca (HRV) evalúa el equilibrio del sistema nervioso autónomo midiendo la potencia de las bandas VLF, LF y HF en la señal cardíaca. Un valor bajo de potencia total puede indicar estrés, fatiga o mala recuperación, mientras que la proporción entre LF y HF ayuda a distinguir predominio simpático (activación/estrés) o parasimpático (relajación/recuperación).',
            vlf: 'VLF (0.0033–0.04 Hz): Regulación lenta, procesos hormonales y metabólicos.',
            lf: 'LF (0.04–0.15 Hz): Equilibrio simpático-parasimpático, reflejo de estrés y adaptación.',
            hf: 'HF (0.15–0.4 Hz): Recuperación, actividad vagal y relajación.',
            references: 'Referencia de papers:',
            ref1: 'Aplicación clínica y deportiva del análisis espectral HRV (Elsevier)',
            ref2: 'Balance autonómico y HRV espectral durante esfuerzo físico (Circulation, AHA)',
            ref3: 'Revisión técnica: cómo afecta la ventana temporal al análisis espectral HRV (Frontiers Neurology)',
            ref4: 'HRV y señal cardiaca en deportistas (Dialnet)',
            quickInterpretation: 'Interpretación rápida:',
            quickText: 'Valores bajos de potencia total y pocos HF sugieren menor capacidad de recuperación y posible estrés. Usa el análisis junto con tu estado físico y recuperación para planificar y ajustar tu entrenamiento.'
          },
          conclusions: {
            lowPower: 'Esto a menudo significa que algo no está bien. Tu medición tiene predominio de ondas LF y baja actividad HF. Esto podría ser señal de estrés, pero no hay suficiente información para una conclusión definitiva.',
            highLF: 'Tu medición muestra mayor actividad LF comparada con HF, lo que podría indicar predominio del sistema nervioso simpático, a menudo asociado con respuesta al estrés.',
            highHF: 'Tu medición muestra mayor actividad HF comparada con LF, lo que podría indicar predominio del sistema nervioso parasimpático, a menudo asociado con descanso y recuperación.',
            balanced: 'Tus componentes LF y HF están relativamente equilibrados, lo que a menudo indica un balance saludable del sistema nervioso autónomo.'
          }
        },
        en: {
          title: 'Frequency analysis',
          normalRange: 'Normal range',
          conclusion: 'Conclusion',
          yourSpectralPower: 'Your spectral power is',
          status: {
            veryPoor: 'very poor',
            poor: 'poor',
            normal: 'normal',
            good: 'good',
            excellent: 'excellent'
          },
          modal: {
            title: 'What does HRV spectral analysis mean?',
            intro: 'Heart rate variability (HRV) spectral analysis evaluates autonomic nervous system balance by measuring the power of VLF, LF, and HF bands in the cardiac signal. A low total power value may indicate stress, fatigue, or poor recovery, while the ratio between LF and HF helps distinguish sympathetic (activation/stress) or parasympathetic (relaxation/recovery) dominance.',
            vlf: 'VLF (0.0033–0.04 Hz): Slow regulation, hormonal and metabolic processes.',
            lf: 'LF (0.04–0.15 Hz): Sympathetic-parasympathetic balance, stress and adaptation reflection.',
            hf: 'HF (0.15–0.4 Hz): Recovery, vagal activity and relaxation.',
            references: 'Paper references:',
            ref1: 'Clinical and sports application of HRV spectral analysis (Elsevier)',
            ref2: 'Autonomic balance and HRV spectral during physical effort (Circulation, AHA)',
            ref3: 'Technical review: how time window affects HRV spectral analysis (Frontiers Neurology)',
            ref4: 'HRV and cardiac signal in athletes (Dialnet)',
            quickInterpretation: 'Quick interpretation:',
            quickText: 'Low total power values and low HF suggest reduced recovery capacity and possible stress. Use the analysis together with your physical state and recovery to plan and adjust your training.'
          },
          conclusions: {
            lowPower: "This often means that something's not right. Your measurement is heavy on the LF waves, and low on HF waves. This could be a sign of stress, but there's not enough information to make a definite conclusion.",
            highLF: 'Your measurement shows higher LF activity compared to HF, which could indicate sympathetic nervous system dominance, often associated with stress response.',
            highHF: 'Your measurement shows higher HF activity compared to LF, which could indicate parasympathetic nervous system dominance, often associated with rest and recovery.',
            balanced: 'Your LF and HF components are relatively balanced, which often indicates a healthy autonomic nervous system balance.'
          }
        }
      }
    }
  },
  mounted() {
    this.initializeCalculators()
    this.setupMetricWatchers()
  },
  computed: {
    t() {
      return this.translations[this.currentLang]
    },
    
    getSpectralAnalysisConclusion() {
      const lfhfRatio = this.lfPower / this.hfPower
      const conclusions = this.t.conclusions
      
      if (this.totalPower < MetricDefinitions.totalPower.normalRange.min) {
        return conclusions.lowPower
      }
      
      if (lfhfRatio > MetricDefinitions.lfhfRatio.normalRange.max) {
        return conclusions.highLF
      }
      
      if (lfhfRatio < MetricDefinitions.lfhfRatio.normalRange.min) {
        return conclusions.highHF
      }
      
      return conclusions.balanced
    }
  },
  methods: {
    toggleLanguage() {
      this.currentLang = this.currentLang === 'es' ? 'en' : 'es'
    },
    
    getTranslatedStatus(metricKey, value) {
      const statusText = getMetricStatus(metricKey, value)
      const statusMap = {
        'Very poor': this.t.status.veryPoor,
        'Poor': this.t.status.poor,
        'Normal': this.t.status.normal,
        'Good': this.t.status.good,
        'Excellent': this.t.status.excellent
      }
      return statusMap[statusText] || statusText
    },
    
    getBarHeight(power) {
      // Calculate height as percentage based on total power
      if (this.totalPower === 0) return '5%'
      const percentage = (power / this.totalPower) * 100
      // Clamp between 5% and 95% for visibility
      const clampedPercentage = Math.max(5, Math.min(95, percentage))
      return `${clampedPercentage}%`
    },
    
    initializeCalculators() {
      if (!this.device) return
      
      // Create calculators and set up subscriptions for all metrics
      this.setupCalculator('totalPower', TotalPower)
      this.setupCalculator('vlfPower', VLFPower)
      this.setupCalculator('lfPower', LFPower)
      this.setupCalculator('hfPower', HFPower)
      
      // Initialize with current values
      this.totalPower = this.metrics.totalPower || 0
      this.vlfPower = this.metrics.vlfPower || 0
      this.lfPower = this.metrics.lfPower || 0
      this.hfPower = this.metrics.hfPower || 0
    },
    
    setupCalculator(metricName, CalculatorClass) {
      const calculator = new CalculatorClass(this.device)
      
      // Subscribe to calculator updates
      this.safeSubscribe(
        `frequency-${metricName}`,
        calculator.subscribe(),
        (value) => {
          this[metricName] = value
        }
      )
    },
    
    setupMetricWatchers() {
      // Watch global metrics store and update local values
      Object.defineProperty(this, '$watcherTotalPower', {
        get: () => this.metrics.totalPower,
        set: () => {}
      })
      
      Object.defineProperty(this, '$watcherVlfPower', {
        get: () => this.metrics.vlfPower,
        set: () => {}
      })
      
      Object.defineProperty(this, '$watcherLfPower', {
        get: () => this.metrics.lfPower,
        set: () => {}
      })
      
      Object.defineProperty(this, '$watcherHfPower', {
        get: () => this.metrics.hfPower,
        set: () => {}
      })
      
      this.$watch('$watcherTotalPower', () => {
        this.totalPower = this.metrics.totalPower || 0
      })
      
      this.$watch('$watcherVlfPower', () => {
        this.vlfPower = this.metrics.vlfPower || 0
      })
      
      this.$watch('$watcherLfPower', () => {
        this.lfPower = this.metrics.lfPower || 0
      })
      
      this.$watch('$watcherHfPower', () => {
        this.hfPower = this.metrics.hfPower || 0
      })
    },
    
    // Get metric definition by key
    getMetricDefinition(key) {
      return MetricDefinitions[key] || {}
    },
    
    // Get status text for metric
    getStatusText(metricKey, value) {
      return getMetricStatus(metricKey, value)
    },
    
    // Get CSS class for metric status
    getStatusClass(metricKey, value) {
      return getMetricStatusClass(metricKey, value)
    }
  }
}
</script>

<style scoped>
</style> 