# 🐳 Docker Configuration for Fitron

## 📁 Archivos Creados

- `Dockerfile` - Configuración multi-stage optimizada
- `nginx.conf` - Configuración nginx para Vue.js SPA
- `.dockerignore` - Excluir archivos innecesarios
- `revert-docker.sh` / `revert-docker.bat` - Script para revertir cambios

## 🚀 Construcción y Deploy

### Opción 1: Docker (Producción)
```bash
# Construir imagen
docker build -t fitron-app .

# Ejecutar localmente
docker run -p 8080:80 fitron-app

# Acceder en http://localhost:8080
```

### Opción 2: Vercel/Netlify (Recomendado)
```bash
# Build tradicional
npm run build

# Subir a GitHub
git add .
git commit -m "Ready for deploy"
git push origin main

# Conectar en Vercel/Netlify
```

## 🔄 Revertir Cambios

### Windows
```cmd
revert-docker.bat
```

### Linux/Mac
```bash
chmod +x revert-docker.sh
./revert-docker.sh
```

## ⚙️ Características Docker

- ✅ Multi-stage build (tamaño optimizado)
- ✅ Nginx con gzip y caché
- ✅ Headers de seguridad
- ✅ Health checks
- ✅ Usuario no-root
- ✅ Vue.js SPA routing

## 🐛 Problemas Comunes y Soluciones

### Error: "RUN rm -rf server" o "Step 6/15"
**Problema**: Usando Dockerfile antiguo o cacheado
```bash
# Solución 1: Forzar rebuild sin cache
docker build --no-cache -t fitron-app .

# Solución 2: Limpiar todo y rebuild
docker system prune -a
docker build -t fitron-app .

# Solución 3: Verificar que estás usando el Dockerfile correcto
cat Dockerfile  # Linux/Mac
type Dockerfile # Windows
```

### Error: "port already in use"
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/Mac
netstat -tulpn | grep :8080
sudo kill -9 <PID>
```

### Error: "npm install failed" o "dependencies error"
```bash
# Limpiar node_modules local
rm -rf node_modules package-lock.json
npm install

# Rebuild Docker sin cache
docker build --no-cache -t fitron-app .
```

### Error: "nginx: [emerg] open() failed"
**Problema**: nginx.conf no encontrado
```bash
# Verificar que nginx.conf existe
ls -la nginx.conf  # Linux/Mac
dir nginx.conf     # Windows

# Si no existe, el archivo debería estar en la raíz del proyecto
```

### Error: "COPY failed: file not found"
**Problema**: Archivos excluidos por .dockerignore
```bash
# Verificar .dockerignore
cat .dockerignore

# Asegurar que dist/ está excluido (se reconstruye en Docker)
# Asegurar que node_modules/ está excluido
```

## 📊 Tamaño de Imagen

- **Con optimización**: ~50MB
- **Sin optimización**: ~200MB

## 🔧 Variables de Entorno

```bash
# Build con variables
docker build --build-arg NODE_ENV=production -t fitron-app .
```

## 📱 Deploy en Cloud

### Docker Hub
```bash
docker tag fitron-app username/fitron-app
docker push username/fitron-app
```

### Railway/Render
Subir código con Dockerfile y conectar repositorio.

---

## ⚠️ Importante: Bluetooth

**El Bluetooth NO funcionará en deploy web** por seguridad del navegador. Para producción:

1. **PWA con Capacitor** - App móvil
2. **Electron** - App desktop  
3. **Tauri** - App desktop ligera

Para deploy web, el Bluetooth estará deshabilitado pero el resto de la app funcionará perfectamente.
