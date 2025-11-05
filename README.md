# Fitron - Heart Rate Variability (HRV) Analysis Platform

## 📋 Descripción General

Fitron es una aplicación web avanzada para el análisis en tiempo real de la variabilidad de la frecuencia cardíaca (HRV) utilizando dispositivos Polar H10 a través de Web Bluetooth API. La aplicación proporciona métricas cardiovasculares detalladas, análisis de dominio de frecuencia, y visualizaciones interactivas de datos ECG y acelerométricos.

## 🚀 Características Principales

- **Conexión Bluetooth Low Energy (BLE)** con dispositivos Polar H10
- **Análisis HRV en tiempo real** con múltiples métricas
- **Visualización ECG** con detección de ondas Q, R, T
- **Análisis de frecuencia** (VLF, LF, HF)
- **Índices de salud** (Stress Index, Energy Index, Health Index)
- **Monitoreo de acelerómetro** para análisis de movimiento
- **Interfaz responsive** con tema claro/oscuro
- **Gráficos interactivos** usando Plotly y ECharts

## 🛠️ Tecnologías Utilizadas

- **Vue.js 3** - Framework frontend
- **Vite** - Build tool y dev server
- **RxJS** - Programación reactiva para streams de datos
- **Plotly.js** - Visualizaciones interactivas
- **ECharts** - Gráficos de alta performance
- **TailwindCSS** - Estilos y diseño responsive
- **Web Bluetooth API** - Comunicación con dispositivos BLE
- **FFT.js** - Análisis de frecuencia (Fast Fourier Transform)
- **Math.js** - Cálculos matemáticos avanzados

## 📊 Métricas HRV Implementadas

### 1. Métricas de Dominio de Tiempo

#### SDNN (Standard Deviation of NN intervals)
**Archivo:** `src/services/SDNN.js`

**Descripción:** Desviación estándar de todos los intervalos RR normales.

**Cálculo:**
```
SDNN = √(Σ(RRᵢ - RR̄)² / (n-1))
```

**Interpretación:**
- **Alto (>100 ms):** Buena variabilidad cardíaca, sistema nervioso autónomo saludable
- **Normal (50-100 ms):** Variabilidad cardíaca adecuada
- **Bajo (<50 ms):** Baja variabilidad, posible estrés o fatiga

**Ventana de análisis:** 300 segundos (5 minutos)

---

#### RMSSD (Root Mean Square of Successive Differences)
**Archivo:** `src/services/RMSSD.js`

**Descripción:** Raíz cuadrada de la media de las diferencias al cuadrado entre intervalos RR sucesivos.

**Cálculo:**
```
RMSSD = √(Σ(RRᵢ₊₁ - RRᵢ)² / (n-1))
```

**Interpretación:**
- **Alto (>40 ms):** Alta actividad parasimpática (relajación)
- **Normal (20-40 ms):** Balance autonómico adecuado
- **Bajo (<20 ms):** Baja actividad parasimpática, posible estrés

**Ventana de análisis:** 300 segundos

---

#### pNN50 (Percentage of NN50)
**Archivo:** `src/services/pNN50.js`

**Descripción:** Porcentaje de intervalos RR consecutivos que difieren en más de 50 ms.

**Cálculo:**
```
pNN50 = (NN50 / total_intervalos) × 100
donde NN50 = count(|RRᵢ₊₁ - RRᵢ| > 50ms)
```

**Interpretación:**
- **Alto (>15%):** Alta variabilidad, buena salud cardiovascular
- **Normal (5-15%):** Variabilidad adecuada
- **Bajo (<5%):** Baja variabilidad, posible fatiga o estrés

**Ventana de análisis:** 300 segundos

---

#### MxDMn (Difference between Max and Min RR)
**Archivo:** `src/services/MxDMn.js`

**Descripción:** Diferencia entre el intervalo RR máximo y mínimo.

**Cálculo:**
```
MxDMn = max(RR) - min(RR)
```

**Interpretación:**
- **Alto (>400 ms):** Gran variabilidad, excelente adaptabilidad
- **Normal (200-400 ms):** Variabilidad adecuada
- **Bajo (<200 ms):** Poca variabilidad, posible rigidez cardiovascular

**Ventana de análisis:** 300 segundos

---

#### AMo50 (Amplitude of Mode 50)
**Archivo:** `src/services/AMo50.js`

**Descripción:** Porcentaje de intervalos RR que caen dentro de ±50 ms del valor más frecuente (moda).

**Cálculo:**
```
1. Calcular moda de intervalos RR
2. Contar intervalos dentro de [moda-50, moda+50]
3. AMo50 = (count / total) × 100
```

**Interpretación:**
- **Alto (>50%):** Alta centralización, posible estrés o fatiga
- **Normal (30-50%):** Distribución equilibrada
- **Bajo (<30%):** Alta dispersión, buena variabilidad

**Ventana de análisis:** 300 segundos

---

#### CV (Coefficient of Variation)
**Archivo:** `src/services/CV.js`

**Descripción:** Coeficiente de variación de los intervalos RR.

**Cálculo:**
```
CV = (SDNN / RR̄) × 100
```

**Interpretación:**
- **Alto (>10%):** Alta variabilidad relativa
- **Normal (5-10%):** Variabilidad adecuada
- **Bajo (<5%):** Baja variabilidad relativa

---

### 2. Métricas de Dominio de Frecuencia

**Archivo:** `src/services/FrequencyDomain.js`

Utiliza FFT (Fast Fourier Transform) para analizar las componentes de frecuencia de la señal HRV.

#### Total Power
**Archivo:** `src/services/TotalPower.js`

**Rango:** 0.003 - 0.4 Hz

**Descripción:** Potencia total del espectro de frecuencia.

**Cálculo:**
```
Total Power = Σ(potencia en todas las frecuencias)
```

---

#### VLF (Very Low Frequency)
**Archivo:** `src/services/VLFPower.js`

**Rango:** 0.003 - 0.04 Hz

**Descripción:** Componente de muy baja frecuencia, relacionada con termorregulación y sistema renina-angiotensina.

**Interpretación:**
- Refleja procesos fisiológicos lentos
- Relacionado con inflamación y estrés crónico

---

#### LF (Low Frequency)
**Archivo:** `src/services/LFPower.js`

**Rango:** 0.04 - 0.15 Hz

**Descripción:** Componente de baja frecuencia, refleja principalmente actividad simpática y algo de parasimpática.

**Interpretación:**
- **Alto:** Mayor actividad simpática (estrés, activación)
- **Bajo:** Menor actividad simpática (relajación)

---

#### HF (High Frequency)
**Archivo:** `src/services/HFPower.js`

**Rango:** 0.15 - 0.4 Hz

**Descripción:** Componente de alta frecuencia, refleja actividad parasimpática (vagal).

**Interpretación:**
- **Alto:** Mayor actividad parasimpática (relajación, recuperación)
- **Bajo:** Menor actividad parasimpática (estrés, fatiga)

---

#### LF/HF Ratio
**Archivo:** `src/services/LFHFRatio.js`

**Cálculo:**
```
LF/HF = LF_Power / HF_Power
```

**Interpretación:**
- **Alto (>2.5):** Predominio simpático (estrés, activación)
- **Normal (1.5-2.5):** Balance autonómico
- **Bajo (<1.5):** Predominio parasimpático (relajación)

---

### 3. Índices de Salud Cardiovascular

#### Stress Index (SI)
**Archivo:** `src/services/StressIndex.js`

**Descripción:** Índice de estrés basado en el método de Baevsky.

**Cálculo:**
```
SI = AMo / (2 × MxDMn × Mo)

donde:
- AMo = Amplitude of Mode (%)
- MxDMn = Max - Min RR interval
- Mo = Mode (valor más frecuente)
```

**Interpretación:**
- **<50:** Muy bajo estrés, posible bradicardia
- **50-150:** Estrés normal
- **150-300:** Estrés moderado
- **300-500:** Estrés alto
- **>500:** Estrés muy alto, posible agotamiento

**Ventana de análisis:** 300 segundos

---

#### Energy Index
**Archivo:** `src/services/EnergyIndex.js`

**Descripción:** Índice de energía basado en la variabilidad y potencia espectral.

**Cálculo:**
```
Energy Index = (RMSSD × HF_Power) / (1 + Stress_Index)
```

**Componentes:**
- **RMSSD:** Variabilidad a corto plazo
- **HF Power:** Actividad parasimpática
- **Stress Index:** Factor de corrección por estrés

**Interpretación:**
- **Alto (>100):** Alta energía y capacidad de recuperación
- **Normal (50-100):** Nivel de energía adecuado
- **Bajo (<50):** Baja energía, posible fatiga

---

#### Health Index
**Archivo:** `src/services/HealthIndex.js`

**Descripción:** Índice de salud cardiovascular general.

**Cálculo:**
```
Health Index = (SDNN × Total_Power) / (1 + Stress_Index)
```

**Componentes:**
- **SDNN:** Variabilidad general
- **Total Power:** Potencia total del espectro
- **Stress Index:** Factor de corrección

**Interpretación:**
- **Alto (>80):** Excelente salud cardiovascular
- **Normal (50-80):** Salud cardiovascular adecuada
- **Bajo (<50):** Salud cardiovascular comprometida

---

### 4. Métricas ECG

#### QTc (Corrected QT Interval)
**Archivo:** `src/services/QTc.js`

**Descripción:** Intervalo QT corregido por frecuencia cardíaca usando la fórmula de Bazett.

**Cálculo:**
```
QTc = QT / √RR

donde:
- QT = tiempo desde inicio Q hasta fin de onda T (ms)
- RR = intervalo RR en segundos
```

**Interpretación:**
- **Normal:** 350-450 ms (hombres), 350-460 ms (mujeres)
- **Prolongado (>450/460 ms):** Riesgo de arritmias
- **Corto (<350 ms):** Posible hipercalcemia o efecto de medicamentos

**Detección de ondas:**
- **Onda Q:** Primer mínimo antes del pico R
- **Onda R:** Pico máximo del complejo QRS
- **Onda T:** Segundo máximo después de R (en ventana de 200-400ms)
- **Fin de T:** Punto donde la señal retorna a la línea base

---

## 🔧 Arquitectura del Proyecto

### Estructura de Directorios

```
src/
├── components/          # Componentes Vue
│   ├── Ecg.vue         # Visualización ECG
│   ├── HeartRateChart.vue
│   ├── HRVDisplay.vue
│   ├── Accelerometer.vue
│   └── ...
├── services/           # Lógica de negocio y cálculos
│   ├── Metric.js       # Clase base para métricas
│   ├── SDNN.js
│   ├── RMSSD.js
│   ├── StressIndex.js
│   └── ...
├── platforms/          # Integración con dispositivos
│   └── web_bluetooth/
│       ├── base_device.js
│       └── devices/
│           └── polar/
│               └── h10.js
├── mixins/            # Vue mixins
│   ├── BluetoothDeviceMixin.js
│   └── RRIntMixin.js
└── web/
    └── App.vue        # Componente principal
```

---

## 🔌 Integración con Polar H10

### Servicios Bluetooth

**Archivo:** `src/platforms/web_bluetooth/devices/polar/h10.js`

#### UUIDs de Servicios:
- **Heart Rate Service:** `0000180d-0000-1000-8000-00805f9b34fb`
- **PMD Service:** `fb005c80-02e7-f387-1cad-8acd2d8df0c8`
  - **PMD Control:** `fb005c81-02e7-f387-1cad-8acd2d8df0c8`
  - **PMD Data:** `fb005c82-02e7-f387-1cad-8acd2d8df0c8`

#### Datos Disponibles:
1. **Heart Rate (HR):** Frecuencia cardíaca en BPM
2. **RR Intervals:** Intervalos entre latidos en ms
3. **ECG:** Señal electrocardiográfica a 130 Hz
4. **Accelerometer:** Datos de acelerómetro a 200 Hz

### Gestión de Concurrencia

**Archivo:** `src/platforms/web_bluetooth/mutex.js`

Implementa un mutex para serializar operaciones GATT y evitar el error "GATT operation already in progress".

```javascript
const unlock = await this.mutex.lock()
try {
  // Operación GATT
} finally {
  unlock()
}
```

### Observable Compartido

Usa RxJS `share()` para compartir una única suscripción Bluetooth entre múltiples consumidores:

```javascript
this.observes.hrm ||= this.createHeartRateObservable().pipe(share())
```

---

## 📈 Procesamiento de Señales

### ECG Processing
**Archivo:** `src/services/Ecg.js`

#### Pipeline de Procesamiento:
1. **Normalización:** Moving average filter (ventana de ~10ms)
2. **Corrección de línea base:** Estimación por percentil 20%
3. **Detección de picos R:** Umbral adaptativo basado en desviación estándar
4. **Refinamiento de R:** Búsqueda del máximo real en ventana de ±20ms
5. **Detección de Q:** Primer mínimo antes de R
6. **Detección de T:** Segundo máximo después de R (200-400ms)
7. **Detección de fin de T:** Método del trapecio

#### Parámetros:
- **Sampling Rate:** 130 Hz
- **Ventana de análisis:** 5 segundos
- **Umbral R-peak:** mean + 1.5 × std
- **Distancia mínima entre R:** 300 ms (200 BPM máx)

---

### Accelerometer Processing
**Archivo:** `src/services/Acc.js`

#### Pipeline:
1. **Calibración:** Primeros 40 samples para baseline
2. **Corrección de offset:** Resta de valores baseline
3. **Filtrado:** Moving median en ventanas configurables
4. **Estabilización:** Detección de valores dentro de rango normal

#### Parámetros:
- **Sampling Rate:** 200 Hz
- **Rango:** ±2G
- **Resolución:** 16 bits
- **Ventana mediana:** Configurable (default: 5 segundos)

---

## 🎨 Visualizaciones

### Gráficos Implementados:

1. **Heart Rate Over Time** (Plotly)
   - Zonas de frecuencia cardíaca (Resting, Fat Burn, Cardio, Peak)
   - Actualización en tiempo real
   - Ventana temporal configurable

2. **ECG Waveform** (ECharts)
   - Señal ECG en tiempo real
   - Marcadores de ondas Q, R, T
   - Zoom y pan interactivo

3. **RR Intervals** (ECharts)
   - Tachograma (RR intervals vs tiempo)
   - Detección de arritmias

4. **Frequency Spectrum** (ECharts)
   - Espectro de potencia (VLF, LF, HF)
   - Actualización cada 60 segundos

5. **Accelerometer** (Canvas)
   - Tres ejes (X, Y, Z)
   - Valores medianos superpuestos
   - Alta performance con renderizado optimizado

---

## ⚙️ Configuración y Uso

### Instalación

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run serve
```

### Requisitos del Sistema

- **Navegador:** Chrome/Edge 89+ (soporte Web Bluetooth)
- **Dispositivo:** Polar H10 con firmware actualizado
- **Conexión:** Bluetooth 4.0+ (BLE)

### Uso Básico

1. **Conectar dispositivo:**
   - Click en botón "Connect"
   - Seleccionar "Polar H10" en el diálogo Bluetooth
   - Esperar confirmación de conexión

2. **Visualizar métricas:**
   - Las métricas HRV se calculan automáticamente
   - Requieren al menos 5 minutos de datos para estabilizarse
   - Las métricas de frecuencia requieren 60 segundos

3. **Configuración:**
   - Ajustar ventana de historial (30s - 5min)
   - Cambiar tema (claro/oscuro)
   - Configurar ventana de mediana del acelerómetro

---

## 🔬 Consideraciones Científicas

### Validación de Datos

- **Filtrado de artefactos:** Intervalos RR fuera de 300-2000 ms son descartados
- **Detección de ectópicos:** Diferencias >20% entre intervalos consecutivos
- **Ventanas mínimas:** 
  - Dominio de tiempo: 5 minutos
  - Dominio de frecuencia: 2-5 minutos recomendados

### Limitaciones

1. **Movimiento:** El acelerómetro puede interferir con ECG
2. **Posición:** La calidad de ECG depende de la colocación del sensor
3. **Arritmias:** Pueden afectar la precisión de las métricas HRV
4. **Frecuencia de muestreo:** 130 Hz para ECG puede limitar detección de ondas

### Referencias

- Task Force of ESC/NASPE (1996). Heart rate variability standards
- Baevsky et al. (2002). Analysis of heart rate variability in space medicine
- Bazett (1920). An analysis of the time-relations of electrocardiograms
- Shaffer & Ginsberg (2017). An Overview of Heart Rate Variability Metrics

---

## 🐛 Debugging

### Logs

El proyecto usa `loglevel` para logging:

```javascript
import log from '@/log'
log.debug('Mensaje de debug')
```

### Errores Comunes

1. **"GATT operation already in progress"**
   - Solucionado con mutex en operaciones GATT
   
2. **"Device disconnected"**
   - Verificar batería del Polar H10
   - Evitar iniciar ECG y Acelerómetro simultáneamente

3. **Métricas en 0.00**
   - Requiere tiempo de estabilización (5 min)
   - Verificar que hay datos RR válidos

---

## 📝 Licencia

GNU Affero General Public License v3.0 (AGPL-3.0)

---

## 👥 Contribuciones

Este proyecto es de código abierto. Las contribuciones son bienvenidas siguiendo las mejores prácticas de desarrollo y documentación.

---

## 📧 Contacto

Para preguntas, sugerencias o reportar problemas, por favor abrir un issue en el repositorio.

---

**Última actualización:** Noviembre 2024
**Versión:** 1.0.0