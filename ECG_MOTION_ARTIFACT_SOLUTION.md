# Solución para Artefactos de Movimiento en ECG

## Problema Identificado

El ECG del Polar H10 se vuelve **ilegible al moverse** debido a **artefactos de movimiento** (motion artifacts). Este es un problema común en dispositivos ECG portátiles.

## Causa del Problema

### ¿Qué son los artefactos de movimiento?

Los artefactos de movimiento en ECG son señales de ruido causadas por:

1. **Movimiento del electrodo** sobre la piel
2. **Contracción muscular** (EMG - electromiografía)
3. **Cambios en la impedancia** entre el electrodo y la piel
4. **Aceleración del cuerpo** durante el movimiento

### Características del ruido de movimiento:

- **Frecuencia**: 0.5-20 Hz (se solapa con el ECG que es 0.5-40 Hz)
- **Amplitud**: Puede ser mayor que la señal ECG real
- **Correlación**: Alta correlación con la aceleración del cuerpo

## Solución: Filtrado Adaptativo con Acelerómetro

### Principio

La investigación científica demuestra que **usar el acelerómetro como referencia de ruido** es la técnica más efectiva para eliminar artefactos de movimiento en ECG.

### Algoritmos Recomendados

1. **LMS (Least Mean Squares)** - Más simple, menor costo computacional
2. **NLMS (Normalized LMS)** - Mejor convergencia
3. **RLS (Recursive Least Squares)** - Mejor rendimiento, mayor costo

### Cómo Funciona

```
ECG_limpio = ECG_ruidoso - Filtro_Adaptativo(Acelerómetro)
```

El filtro adaptativo:
1. Toma la señal del acelerómetro como **referencia de ruido**
2. Encuentra la correlación entre aceleración y ruido en ECG
3. Estima el componente de ruido en el ECG
4. Lo resta de la señal ECG original

## Implementación Propuesta

### Fase 1: Filtro Adaptativo LMS Básico

**Ventajas**:
- Simple de implementar
- Bajo costo computacional
- Funciona en tiempo real

**Pasos**:
1. Usar los datos del acelerómetro (X, Y, Z) que ya tenemos
2. Implementar algoritmo LMS adaptativo
3. Aplicar el filtro antes de la normalización actual

### Fase 2: Mejoras Avanzadas (Opcional)

1. **Filtro de dos etapas**:
   - Primera etapa: LMS con acelerómetro
   - Segunda etapa: Hampel filter recursivo para outliers

2. **Detección de movimiento**:
   - Usar magnitud del acelerómetro para detectar movimiento
   - Aplicar filtrado más agresivo durante movimiento
   - Filtrado suave durante reposo

3. **Filtro Kalman**:
   - Para predicción y suavizado óptimo
   - Mayor complejidad pero mejor resultado

## Código de Referencia

### Algoritmo LMS Básico

```javascript
class AdaptiveLMSFilter {
  constructor(filterOrder = 10, stepSize = 0.01) {
    this.filterOrder = filterOrder
    this.stepSize = stepSize
    this.weights = new Array(filterOrder).fill(0)
    this.buffer = new Array(filterOrder).fill(0)
  }
  
  filter(ecgSample, accSample) {
    // Shift buffer
    this.buffer.shift()
    this.buffer.push(accSample)
    
    // Calculate output (estimated noise)
    let estimatedNoise = 0
    for (let i = 0; i < this.filterOrder; i++) {
      estimatedNoise += this.weights[i] * this.buffer[i]
    }
    
    // Calculate error (difference between ECG and estimated noise)
    const error = ecgSample - estimatedNoise
    
    // Update weights (LMS algorithm)
    for (let i = 0; i < this.filterOrder; i++) {
      this.weights[i] += this.stepSize * error * this.buffer[i]
    }
    
    // Return filtered ECG (error signal)
    return error
  }
}
```

### Integración con Código Actual

```javascript
// En EcgService constructor
this.motionFilter = new AdaptiveLMSFilter(10, 0.01)
this.accService = null // Referencia al servicio de acelerómetro

// En handleData, antes de normalizeData
normalizeDataWithMotionFilter(rawEcgData, accData) {
  if (!accData || accData.length === 0) {
    // Si no hay datos de acelerómetro, usar normalización actual
    return this.normalizeData(rawEcgData)
  }
  
  // Calcular magnitud del acelerómetro
  const accMagnitude = accData.map(sample => 
    Math.sqrt(sample.x**2 + sample.y**2 + sample.z**2)
  )
  
  // Aplicar filtro adaptativo
  const filteredEcg = []
  for (let i = 0; i < rawEcgData.length; i++) {
    const accSample = accMagnitude[Math.min(i, accMagnitude.length - 1)]
    const filtered = this.motionFilter.filter(rawEcgData[i], accSample)
    filteredEcg.push(filtered)
  }
  
  // Aplicar normalización existente al ECG filtrado
  return this.normalizeData(filteredEcg)
}
```

## Sincronización ECG-Acelerómetro

### Problema de Sincronización

- ECG: 130 Hz
- Acelerómetro: 200 Hz

### Solución

1. **Downsampling del acelerómetro**: Reducir de 200Hz a 130Hz
2. **Interpolación**: Interpolar valores del acelerómetro para cada muestra ECG
3. **Buffer temporal**: Mantener ventana deslizante de datos sincronizados

## Parámetros Recomendados

Basado en la literatura científica:

```javascript
// Filtro LMS
filterOrder: 10-20      // Orden del filtro
stepSize: 0.001-0.01    // Tamaño de paso (μ)

// Detección de movimiento
movementThreshold: 0.1  // g (gravedad)
highMotionStepSize: 0.05
lowMotionStepSize: 0.001
```

## Referencias Científicas

1. **Raya & Sison (2002)**: "Adaptive noise cancelling of motion artifact in stress ECG signals using accelerometer"
   - Demostró que LMS y RLS son efectivos
   - Acelerómetro de un solo eje es suficiente

2. **PMC Article (2018)**: "Two-stage motion artefact reduction algorithm"
   - Propone usar aceleración como referencia
   - Correlación entre aceleración y ECG como peso

3. **IEEE Study**: "Adaptive Motion Artifacts Reduction Using 3-axis Accelerometer"
   - Usa acelerómetro 3-ejes como referencia
   - NLMS con normalización adaptativa

## Ventajas de Nuestra Implementación

✅ **Ya tenemos el acelerómetro funcionando** - No necesitamos hardware adicional
✅ **Datos sincronizados** - ECG y ACC vienen del mismo dispositivo
✅ **Tiempo real** - LMS es suficientemente rápido para procesamiento en vivo
✅ **Mejora progresiva** - El filtro se adapta automáticamente

## Plan de Implementación

### Paso 1: Crear clase AdaptiveLMSFilter
- Implementar algoritmo LMS básico
- Probar con datos sintéticos

### Paso 2: Integrar con EcgService
- Conectar con servicio de acelerómetro
- Sincronizar timestamps
- Aplicar filtro antes de normalización

### Paso 3: Optimizar parámetros
- Ajustar filterOrder y stepSize
- Probar con diferentes niveles de movimiento
- Comparar ECG antes/después

### Paso 4: Mejoras opcionales
- Detección de movimiento automática
- Filtro de dos etapas
- Visualización de nivel de ruido

## Resultado Esperado

- ✅ ECG legible durante movimiento moderado
- ✅ Reducción de 60-80% en artefactos de movimiento
- ✅ Preservación de características del QRS
- ✅ Mejor detección de picos R, Q, T

## Notas Importantes

⚠️ **El filtro NO es perfecto**: Durante movimiento muy intenso, el ECG seguirá teniendo ruido
⚠️ **Latencia**: El filtro adaptativo necesita ~1-2 segundos para converger
⚠️ **Calibración**: Los primeros segundos después de empezar a moverse tendrán más ruido

## Alternativas si LMS no es Suficiente

1. **Wavelet Transform**: Descomposición en frecuencias
2. **Kalman Filter**: Predicción óptima del estado
3. **ICA (Independent Component Analysis)**: Separación de fuentes
4. **Deep Learning**: Red neuronal entrenada (más complejo)
