# Guía de Implementación ECG Mejorada

## 📋 Resumen de Cambios

Se ha creado una **nueva implementación del servicio ECG** basada en el repositorio [cardiometrics](https://github.com/lmgallego/cardiometrics) que funciona correctamente.

### ✅ Mejoras Implementadas

1. **Valores RAW sin escalar** - Los datos ECG se mantienen como valores RAW (counts) en lugar de escalarlos inmediatamente a microvolts
2. **Detección QRS por pendiente** - Usa análisis de pendiente (slope analysis) en lugar de umbral fijo
3. **Actualización optimizada** - Display se actualiza a 20 FPS (cada 50ms) en lugar de cada sample (130 Hz)
4. **Gestión de memoria** - Buffer limitado a 2000 puntos (~15 segundos)
5. **Procesamiento de 24 bits** - Lectura correcta de valores de 24 bits del Polar H10

---

## 🔄 Cómo Cambiar a la Nueva Implementación

### Opción 1: Usar EcgNew (Recomendado para pruebas)

```javascript
// En lugar de:
import EcgService from '@/services/Ecg'

// Usa:
import EcgService from '@/services/EcgNew'

// El resto del código permanece igual
const ecgService = new EcgService(device)
```

### Opción 2: Reemplazar completamente (Producción)

1. **Hacer backup del archivo antiguo:**
   ```bash
   cp src/services/Ecg.js src/services/Ecg.old.js
   ```

2. **Reemplazar con la nueva versión:**
   ```bash
   cp src/services/EcgNew.js src/services/Ecg.js
   ```

3. **Si algo falla, revertir:**
   ```bash
   cp src/services/Ecg.old.js src/services/Ecg.js
   ```

---

## 📊 Diferencias Clave

### Procesamiento de Datos

**ANTES (Ecg.js):**
```javascript
// Escalaba inmediatamente a microvolts
const sample = raw24 * 0.0078 // µV
```

**AHORA (EcgNew.js):**
```javascript
// Mantiene valores RAW para detección
const sample = raw24 >= 0x800000 ? raw24 - 0x1000000 : raw24
// Escalar solo para display si es necesario
```

### Detección de QRS

**ANTES:**
```javascript
// Umbral fijo en valores escalados
const threshold = mean + (1.5 * std)
if (normalizedData[i] > threshold) {
  // Detecta pico
}
```

**AHORA:**
```javascript
// Análisis de pendiente (slope)
const slopes = []
for (let i = 1; i < ecgData.length; i++) {
  slopes.push(ecgData[i].value - ecgData[i-1].value)
}
const threshold = meanSlope + (stdSlope * 0.7)

// Detecta cruces de pendiente
if (slopes[i] > threshold && slopes[i+1] < -threshold) {
  qrsPoints.push(ecgData[i])
}
```

### Actualización de Display

**ANTES:**
```javascript
// Procesaba en cada sample (130 Hz)
handleData(data) {
  this.processEcgData() // Muy pesado
}
```

**AHORA:**
```javascript
// Procesa cada 50ms (20 FPS)
setInterval(() => {
  this.displayData = this.processECGForDisplay()
  this.qrsPoints = this.detectQRS(this.displayData)
}, 50)
```

---

## 🎯 API del Nuevo Servicio

### Constructor

```javascript
const ecgService = new EcgService(device)
```

### Métodos Principales

#### `getDisplayObservable()`
Observable que emite actualizaciones de display a 20 FPS.

```javascript
ecgService.getDisplayObservable().subscribe(({ displayData, qrsPoints }) => {
  // displayData: Array de { timestamp, value } (últimos 5 segundos)
  // qrsPoints: Array de { timestamp, value } (picos R detectados)
  
  console.log(`Display: ${displayData.length} puntos`)
  console.log(`QRS detectados: ${qrsPoints.length}`)
})
```

#### `getEcgObservable()`
Observable para datos ECG crudos (compatibilidad con código antiguo).

```javascript
ecgService.getEcgObservable().subscribe(({ samples, times }) => {
  // samples: Array de valores RAW
  // times: Array de timestamps en segundos
})
```

#### `getRPeakObservable()`
Observable para picos R detectados.

```javascript
ecgService.getRPeakObservable().subscribe(({ index, time, value }) => {
  // index: Índice (no usado en nueva implementación)
  // time: Timestamp en segundos
  // value: Valor RAW del pico R
})
```

#### `getCurrentDisplayData()`
Obtener datos actuales sin suscribirse.

```javascript
const { displayData, qrsPoints } = ecgService.getCurrentDisplayData()
```

---

## 🔧 Configuración

### Parámetros Ajustables

```javascript
// En el constructor de EcgService
this.maxPoints = 2000           // Buffer máximo (~15s a 130Hz)
this.displayWindowMs = 5000     // Ventana de visualización (5s)

// QRS Detection Config
this.qrsConfig = {
  samplingRate: 130,            // Frecuencia de muestreo
  windowSize: 130,              // Ventana de detección (1s)
  slopeThreshold: 0.7,          // Umbral de pendiente
  refractoryPeriod: 200         // Período refractario (200ms)
}
```

---

## 📈 Ejemplo de Uso en Componente Vue

```vue
<template>
  <div>
    <h3>ECG Display</h3>
    <canvas ref="ecgCanvas" width="800" height="400"></canvas>
    <p>QRS Detectados: {{ qrsCount }}</p>
  </div>
</template>

<script>
import EcgService from '@/services/EcgNew'

export default {
  props: ['device'],
  data() {
    return {
      ecgService: null,
      qrsCount: 0,
      displaySubscription: null
    }
  },
  mounted() {
    if (this.device) {
      this.ecgService = new EcgService(this.device)
      
      // Suscribirse a actualizaciones de display
      this.displaySubscription = this.ecgService
        .getDisplayObservable()
        .subscribe(({ displayData, qrsPoints }) => {
          this.qrsCount = qrsPoints.length
          this.drawECG(displayData, qrsPoints)
        })
    }
  },
  beforeUnmount() {
    if (this.displaySubscription) {
      this.displaySubscription.unsubscribe()
    }
    if (this.ecgService) {
      this.ecgService.destroy()
    }
  },
  methods: {
    drawECG(displayData, qrsPoints) {
      const canvas = this.$refs.ecgCanvas
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height
      
      // Limpiar canvas
      ctx.clearRect(0, 0, width, height)
      
      if (displayData.length === 0) return
      
      // Calcular escala
      const values = displayData.map(d => d.value)
      const minValue = Math.min(...values)
      const maxValue = Math.max(...values)
      const range = maxValue - minValue || 1
      
      // Dibujar señal ECG
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      
      displayData.forEach((point, index) => {
        const x = (index / displayData.length) * width
        const y = height - ((point.value - minValue) / range) * height
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      
      // Dibujar picos QRS
      ctx.fillStyle = '#e879f9'
      qrsPoints.forEach(point => {
        const index = displayData.findIndex(d => d.timestamp === point.timestamp)
        if (index !== -1) {
          const x = (index / displayData.length) * width
          const y = height - ((point.value - minValue) / range) * height
          
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, 2 * Math.PI)
          ctx.fill()
        }
      })
    }
  }
}
</script>
```

---

## 🐛 Troubleshooting

### Problema: No se detectan picos QRS

**Solución:**
- Verificar que `h10.js` esté enviando valores RAW (no escalados)
- Ajustar `slopeThreshold` en `qrsConfig` (probar con 0.5 o 0.9)
- Verificar que hay suficientes datos (mínimo 130 samples = 1 segundo)

### Problema: Display no se actualiza

**Solución:**
- Verificar que el intervalo de procesamiento está activo
- Comprobar que hay datos en `ecgData`
- Revisar consola para errores

### Problema: Consumo alto de memoria

**Solución:**
- Reducir `maxPoints` (default: 2000)
- Reducir `displayWindowMs` (default: 5000ms)

---

## 🔬 Comparación de Performance

| Métrica | Implementación Antigua | Implementación Nueva |
|---------|----------------------|---------------------|
| **Procesamiento** | 130 Hz (cada sample) | 20 Hz (cada 50ms) |
| **Detección QRS** | Umbral fijo | Análisis de pendiente |
| **Valores ECG** | Escalados (µV) | RAW (counts) |
| **Buffer** | Ilimitado | 2000 puntos máx |
| **FPS Display** | Variable | Fijo 20 FPS |
| **Precisión QRS** | Media | Alta |

---

## 📚 Referencias

- **Repositorio cardiometrics:** https://github.com/lmgallego/cardiometrics
- **Polar H10 PMD Spec:** Valores de 24 bits, 130 Hz sampling rate
- **QRS Detection:** Slope-based method (más robusto que threshold)

---

## ✅ Checklist de Migración

- [ ] Backup del código antiguo (`Ecg.js` → `Ecg.old.js`)
- [ ] Probar `EcgNew.js` con dispositivo real
- [ ] Verificar detección de picos QRS
- [ ] Comprobar que display se actualiza suavemente
- [ ] Verificar que no hay memory leaks
- [ ] Actualizar componentes que usan ECG
- [ ] Documentar cambios en README principal
- [ ] Hacer commit con mensaje descriptivo

---

**Última actualización:** Noviembre 2024
**Versión:** 2.0.0 (Nueva implementación)
