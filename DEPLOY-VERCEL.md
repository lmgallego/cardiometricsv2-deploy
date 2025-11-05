# 🚀 Deploy en Vercel - Guía Completa

## 📋 Archivos Creados

- ✅ `vercel.json` - Configuración de Vercel
- ✅ `.vercelignore` - Archivos a ignorar
- ✅ `package.json` - Actualizado con script vercel-build

## 🎯 Método 1: Deploy con Interfaz Web (Más Fácil)

### Paso 1: Subir a GitHub

```bash
# Agregar todos los archivos
git add .

# Commit
git commit -m "Ready for Vercel deploy"

# Push a GitHub
git push origin main
```

### Paso 2: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Click en **"Sign Up"** o **"Login"**
3. Conecta con tu cuenta de GitHub
4. Click en **"New Project"**
5. Importa tu repositorio `cardiometrics`
6. Vercel detectará automáticamente que es un proyecto Vite
7. **Configuración automática:**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
8. Click en **"Deploy"**
9. ¡Espera 1-2 minutos! ☕

### Paso 3: ¡Listo! 🎉

Tu app estará disponible en:
```
https://cardiometrics-[tu-usuario].vercel.app
```

---

## 🖥️ Método 2: Deploy con CLI (Avanzado)

### Paso 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Paso 2: Login

```bash
vercel login
```

Esto abrirá tu navegador para autenticarte.

### Paso 3: Deploy

```bash
# Desde la carpeta del proyecto
cd d:\fitron\fitron

# Deploy a producción
vercel --prod
```

### Responde las preguntas:

```
? Set up and deploy "~/cardiometrics"? [Y/n] y
? Which scope do you want to deploy to? [Tu usuario]
? Link to existing project? [y/N] n
? What's your project's name? cardiometrics
? In which directory is your code located? ./
? Want to override the settings? [y/N] n
```

---

## ⚙️ Configuración Automática

Vercel detectará automáticamente:

- ✅ **Framework**: Vite
- ✅ **Build Command**: `npm run build`
- ✅ **Output Directory**: `dist`
- ✅ **Node Version**: 18.x

---

## 🔧 Configuración Manual (Si es necesario)

Si Vercel no detecta automáticamente, configura:

### En la Interfaz Web:
```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
Node.js Version: 18.x
```

### Variables de Entorno (Opcional):
```
VITE_APP_NAME=CardioMetrics
VITE_APP_VERSION=1.0.0
```

---

## 🌐 Dominios Personalizados

### Dominio Gratuito de Vercel:
```
https://cardiometrics.vercel.app
https://cardiometrics-git-main-[usuario].vercel.app
```

### Dominio Personalizado:
1. Ve a tu proyecto en Vercel
2. Settings → Domains
3. Agrega tu dominio
4. Configura DNS según instrucciones

---

## 🔄 Redeploy Automático

Cada vez que hagas `git push`:
- ✅ Vercel detecta el cambio
- ✅ Build automático
- ✅ Deploy automático
- ✅ Preview URL para cada branch

---

## 📊 Monitoreo

### Ver Logs:
```bash
vercel logs [deployment-url]
```

### Ver Deployments:
```bash
vercel ls
```

### Ver Proyecto:
```bash
vercel inspect [deployment-url]
```

---

## 🐛 Troubleshooting

### Error: "Build failed"
```bash
# Probar build localmente primero
npm run build

# Si funciona local, verificar:
# 1. package.json tiene todas las dependencias
# 2. No hay imports absolutos sin configurar
# 3. vite.config.js está correcto
```

### Error: "Module not found"
```bash
# Asegurar que todas las dependencias están en package.json
npm install

# Verificar imports en el código
# Usar rutas relativas o alias configurados
```

### Error: "404 on refresh"
```bash
# Verificar que vercel.json tiene la configuración de SPA
# El archivo vercel.json ya está configurado correctamente
```

---

## ⚡ Optimizaciones

### 1. Habilitar Edge Functions (Opcional)
```json
// vercel.json
{
  "functions": {
    "api/**/*.js": {
      "runtime": "edge"
    }
  }
}
```

### 2. Configurar Headers de Caché
Ya configurado en `vercel.json`:
- Assets: 1 año de caché
- HTML: Sin caché

### 3. Analytics (Gratis)
1. Ve a tu proyecto en Vercel
2. Analytics → Enable
3. Ver métricas en tiempo real

---

## 📱 Preview Deployments

### Cada branch tiene su propia URL:
```
main → https://cardiometrics.vercel.app
dev → https://cardiometrics-git-dev.vercel.app
feature → https://cardiometrics-git-feature.vercel.app
```

---

## 🎯 Comandos Útiles

```bash
# Deploy a producción
vercel --prod

# Deploy a preview
vercel

# Ver lista de deployments
vercel ls

# Ver logs
vercel logs

# Eliminar deployment
vercel rm [deployment-url]

# Ver información del proyecto
vercel inspect

# Abrir dashboard
vercel open
```

---

## ⚠️ Importante: Bluetooth

**El Bluetooth NO funcionará en Vercel** (ni en ningún deploy web) por seguridad del navegador.

### Alternativas para Bluetooth:

1. **Capacitor** - App móvil nativa
2. **Electron** - App desktop
3. **Tauri** - App desktop ligera

Para desarrollo local con Bluetooth:
```bash
npm run dev
# Abre http://localhost:3000
```

---

## 🎉 ¡Listo!

Tu aplicación estará disponible en:
```
https://cardiometrics.vercel.app
```

Con:
- ✅ HTTPS automático
- ✅ CDN global
- ✅ Deploy automático en cada push
- ✅ Preview deployments
- ✅ Analytics
- ✅ 100% gratis para proyectos personales

---

## 📞 Soporte

- [Documentación Vercel](https://vercel.com/docs)
- [Comunidad Discord](https://vercel.com/discord)
- [GitHub Issues](https://github.com/vercel/vercel/issues)
