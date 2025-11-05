import { defineConfig } from 'vite'
import vue  from '@vitejs/plugin-vue'
import path from 'path'

import Components from 'unplugin-vue-components/vite'

export default defineConfig({

  plugins: [
    vue(),

    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      deep: true,
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // Configuración para producción
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    
    // Optimización de chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue'],
          rxjs: ['rxjs'],
          charts: ['chart.js', 'vue-chartjs'],
          math: ['mathjs', 'fft.js', 'cubic-spline'],
          plotting: ['plotly.js', 'echarts']
        }
      }
    },
    
    // Límites de chunks
    chunkSizeWarningLimit: 1000,
    
    // Target para compatibilidad
    target: 'es2015'
  },
  
  // Base path para subrutas (importante para deploy)
  base: './',
  
  // Optimización del servidor de desarrollo
  server: {
    host: true,
    port: 3000
  },
  
  // Preview server
  preview: {
    host: true,
    port: 4173
  }

})

