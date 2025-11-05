# Implementación del Acelerómetro Polar H10

## Resumen de Cambios

Se ha implementado el soporte completo para el acelerómetro del Polar H10 utilizando Web Bluetooth API y el protocolo PMD (Polar Measurement Data).

## Archivos Modificados

### 1. `src/platforms/web_bluetooth/devices/polar/h10.js`

**Cambios realizados:**

- **Comando ACC_START actualizado**: Se convirtió a `Uint8Array` con el formato correcto para iniciar el streaming del acelerómetro:
  ```javascript
  const ACC_START = new Uint8Array([0x02, 0x02, 0x00, 0x01, 0xC8, 0x00, 0x01, 0x01, 0x10, 0x00, 0x02, 0x01, 0x08, 0x00])
  ```
  - `0x02`: Comando de inicio de medición
  - `0x02`: ID del stream de acelerómetro
  - Configuración: 200Hz, 16-bit resolution, rango ±2G

- **Tracking de datos del acelerómetro**: Se agregaron flags para rastrear el estado:
  ```javascript
  this.accDataReceived = false;
  this.accStarted = false;
  ```

- **Método `startAccelerometer()`**: Nuevo método que inicia el streaming del acelerómetro:
  - Envía el comando `ACC_START` al dispositivo
  - Verifica que los datos empiecen a fluir después de 3 segundos
  - Maneja errores y proporciona logging detallado

- **Actualización del handler PMD**: Se agregó detección de datos tipo 2 (acelerómetro):
  ```javascript
  if (dataType === 2) {
    self.accDataReceived = true;
  }
  ```

- **Método `observeAccelerometer()` mejorado**: 
  - Inicia automáticamente el stream cuando se llama
  - Procesa frames tipo 1 (datos sin comprimir)
  - Extrae valores X, Y, Z de 16-bit signed integers

### 2. `src/services/Acc.js`

**Cambios realizados:**

- **Auto-inicio habilitado**: Se descomentó la inicialización automática del acelerómetro:
  ```javascript
  if (device) {
    setTimeout(() => this.initialize(), 100)
  }
  ```

### 3. `src/web/App.vue`

**Cambios realizados:**

- **Import del componente**: Se agregó la importación del componente Accelerometer:
  ```javascript
  import Accelerometer from '../components/Accelerometer.vue'
  ```

- **Registro del componente**: Se agregó al objeto components para que esté disponible en el template

## Protocolo de Comunicación

### UUIDs de Polar BLE

- **PMD Service**: `fb005c80-02e7-f387-1cad-8acd2d8df0c8`
- **PMD Control**: `fb005c81-02e7-f387-1cad-8acd2d8df0c8` (para enviar comandos)
- **PMD Data**: `fb005c82-02e7-f387-1cad-8acd2d8df0c8` (para recibir datos)

### Formato de Datos del Acelerómetro

Los datos del acelerómetro llegan en el siguiente formato:

```
Byte 0: Data Type (0x02 para acelerómetro)
Bytes 1-9: Header con metadata
Byte 9: Frame Type (0x01 para datos sin comprimir)
Bytes 10+: Datos de muestras (Int16Array)
```

Cada muestra contiene 3 valores de 16-bit (X, Y, Z) en orden:
- **X**: samples[offset]
- **Y**: samples[offset + 1]
- **Z**: samples[offset + 2]

### Configuración del Stream

- **Frecuencia de muestreo**: 200 Hz
- **Resolución**: 16 bits
- **Rango**: ±2G (configurable a ±4G o ±8G)
- **Factor de escala**: 0.01 (aplicado en `Acc.js`)

## Flujo de Datos

1. **Inicialización**:
   - El componente `Accelerometer.vue` se monta con el dispositivo
   - Se crea una instancia de `Acc` service
   - El servicio llama a `device.observeAccelerometer()`

2. **Inicio del Stream**:
   - `observeAccelerometer()` detecta que no se ha iniciado el stream
   - Llama a `startAccelerometer()` después de 1 segundo
   - Se envía el comando `ACC_START` al PMD Control characteristic

3. **Recepción de Datos**:
   - Los datos llegan a través del PMD Data characteristic
   - El handler filtra datos tipo 2 (acelerómetro)
   - Se extraen las muestras X, Y, Z
   - Los datos se procesan en `Acc.js`:
     - Escalado con factor 0.01
     - Normalización de baseline
     - Agregación en ventanas de tiempo
     - Cálculo de medianas
     - Eliminación de outliers

4. **Visualización**:
   - `Accelerometer.vue` se suscribe a los observables del servicio
   - Actualiza el gráfico SVG en tiempo real
   - Muestra 3 ejes (X=rojo, Y=verde, Z=azul)

## Características Implementadas

### En `Acc.js`:
- ✅ Procesamiento de datos en tiempo real
- ✅ Calibración automática de baseline
- ✅ Detección de estabilización
- ✅ Agregación por ventanas de tiempo
- ✅ Cálculo de medianas
- ✅ Filtrado de outliers
- ✅ Manejo de reintentos automáticos
- ✅ Gestión de memoria (poda de datos antiguos)

### En `Accelerometer.vue`:
- ✅ Visualización SVG responsive
- ✅ Grid dinámico con etiquetas
- ✅ Control de ventana de mediana ajustable
- ✅ Indicador de estabilización
- ✅ Soporte para tema claro/oscuro
- ✅ Actualización a 20 FPS

## Uso

1. **Conectar el dispositivo Polar H10**:
   - Click en "Pair & Connect"
   - Seleccionar el dispositivo H10

2. **Visualizar datos del acelerómetro**:
   - El componente aparece automáticamente después del ECG
   - Los datos comienzan a fluir después de ~1-2 segundos
   - Ajustar la ventana de mediana con el slider (0.1s - 0.5s)

3. **Monitoreo**:
   - Abrir la consola del navegador para ver logs detallados
   - Verificar mensajes de inicio exitoso: "✅ Accelerometer stream started successfully!"
   - Confirmar flujo de datos: "✅ Accelerometer data is flowing properly"

## Troubleshooting

### No se reciben datos del acelerómetro

1. **Verificar en la consola**:
   ```
   H10: observeAccelerometer called
   H10: Acquiring mutex for accelerometer start...
   H10: Starting accelerometer stream...
   H10: ✅ Accelerometer stream started successfully!
   ```

2. **Si aparece "GATT operation already in progress"**:
   - **SOLUCIONADO**: Se implementó mutex locking para evitar comandos concurrentes
   - El acelerómetro ahora espera 3 segundos antes de iniciar
   - Esto permite que el ECG se inicie completamente primero

3. **Si aparece "No accelerometer data received"**:
   - El dispositivo puede necesitar reiniciarse
   - Verificar que el H10 esté en modo SDK (se activa automáticamente)
   - Desconectar y reconectar el dispositivo

4. **Conflictos con ECG**:
   - Ambos streams (ECG y ACC) pueden funcionar simultáneamente
   - El PMD Data observable es compartido entre ambos
   - El inicio está secuenciado: ECG primero, luego ACC después de 3 segundos

### Datos inestables al inicio

- Es normal ver valores extremos en los primeros 2-3 segundos
- El sistema tiene un período de estabilización de ~40 muestras
- El indicador "Stabilizing..." desaparece cuando los datos son estables

## Referencias

- [Polar BLE SDK](https://github.com/polarofficial/polar-ble-sdk)
- [Polar Measurement Data Specification](https://github.com/polarofficial/polar-ble-sdk/blob/master/technical_documentation/Polar_Measurement_Data_Specification.pdf)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Ejemplo de implementación](https://github.com/cjs30/FingerPulseLatency)

## Próximos Pasos Sugeridos

1. **Optimización**:
   - Implementar compresión de datos (frame type 0)
   - Ajustar frecuencia de muestreo según necesidad

2. **Análisis**:
   - Detección de movimiento
   - Cálculo de magnitud vectorial
   - Análisis de frecuencia (FFT)

3. **Exportación**:
   - Guardar datos en CSV
   - Sincronización con datos ECG
