# ✅ Checklist para Deploy en Vercel

## 📋 Antes de Empezar

- [ ] Tienes cuenta en GitHub
- [ ] Tu proyecto está en un repositorio Git
- [ ] Node.js instalado (v18 o superior)
- [ ] npm funciona correctamente

---

## 🔧 Preparación del Proyecto

- [x] ✅ `vercel.json` creado
- [x] ✅ `.vercelignore` creado
- [x] ✅ `package.json` actualizado con script vercel-build
- [x] ✅ `vite.config.js` optimizado para producción
- [ ] Build local funciona: `npm run build`

---

## 📤 Subir a GitHub

### Si ya tienes repositorio:
```bash
git add .
git commit -m "Ready for Vercel deploy"
git push origin main
```

### Si NO tienes repositorio:
```bash
# 1. Inicializar Git
git init

# 2. Agregar archivos
git add .

# 3. Primer commit
git commit -m "Initial commit - Ready for Vercel"

# 4. Crear repo en GitHub (github.com/new)

# 5. Conectar con GitHub
git remote add origin https://github.com/[tu-usuario]/cardiometrics.git

# 6. Subir código
git branch -M main
git push -u origin main
```

---

## 🚀 Deploy en Vercel

### Opción A: Interfaz Web (Recomendado)

- [ ] 1. Ir a [vercel.com](https://vercel.com)
- [ ] 2. Click en "Sign Up" o "Login"
- [ ] 3. Conectar con GitHub
- [ ] 4. Click en "New Project"
- [ ] 5. Buscar repositorio "cardiometrics"
- [ ] 6. Click en "Import"
- [ ] 7. Verificar configuración:
  - Framework: Vite ✅
  - Build Command: `npm run build` ✅
  - Output Directory: `dist` ✅
- [ ] 8. Click en "Deploy"
- [ ] 9. Esperar 1-2 minutos ☕
- [ ] 10. ¡Ver tu app en vivo! 🎉

### Opción B: CLI

- [ ] 1. Instalar CLI: `npm install -g vercel`
- [ ] 2. Login: `vercel login`
- [ ] 3. Deploy: `vercel --prod`
- [ ] 4. Seguir instrucciones en pantalla

---

## ✅ Verificación Post-Deploy

- [ ] La app carga correctamente
- [ ] No hay errores en la consola del navegador
- [ ] Las rutas funcionan (refresh en /about, etc.)
- [ ] Los assets (imágenes, CSS, JS) cargan
- [ ] El diseño se ve correcto
- [ ] Dark mode funciona (si aplica)

---

## 🔍 Troubleshooting

### ❌ Error: "Build failed"
```bash
# Probar build local
npm run build

# Ver errores específicos
# Corregir y volver a deployar
```

### ❌ Error: "404 on refresh"
- Verificar que `vercel.json` existe
- Verificar configuración de rutas en `vercel.json`

### ❌ Error: "Module not found"
- Verificar que todas las dependencias están en `package.json`
- Ejecutar `npm install` localmente
- Hacer commit y push de `package.json` actualizado

---

## 🎯 Próximos Pasos

### Después del primer deploy:

- [ ] Configurar dominio personalizado (opcional)
- [ ] Habilitar Analytics en Vercel
- [ ] Configurar variables de entorno (si necesitas)
- [ ] Configurar notificaciones de deploy

### Para desarrollo continuo:

- [ ] Cada `git push` hace deploy automático
- [ ] Branches tienen preview URLs automáticas
- [ ] Main branch → Producción
- [ ] Otras branches → Preview

---

## 📱 Recordatorio: Bluetooth

⚠️ **El Bluetooth NO funcionará en Vercel** (ni en ningún deploy web)

Para usar Bluetooth necesitas:
- **Capacitor** para app móvil
- **Electron** para app desktop
- **Desarrollo local** con `npm run dev`

---

## 🆘 Ayuda

Si tienes problemas:

1. **Revisa logs en Vercel:**
   - Ve a tu proyecto
   - Click en el deployment
   - Ver "Build Logs"

2. **Verifica configuración:**
   - Settings → General
   - Build & Development Settings

3. **Documentación:**
   - [Vercel Docs](https://vercel.com/docs)
   - [Vite + Vercel](https://vercel.com/guides/deploying-vite-with-vercel)

---

## ✨ ¡Éxito!

Una vez completado, tu app estará en:
```
🌐 https://cardiometrics.vercel.app
```

Con:
- ✅ HTTPS automático
- ✅ CDN global (carga rápida en todo el mundo)
- ✅ Deploy automático en cada push
- ✅ Preview deployments
- ✅ 100% gratis

---

**¡Felicitaciones por tu deploy! 🎉**
