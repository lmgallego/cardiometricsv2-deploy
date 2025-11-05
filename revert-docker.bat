@echo off
REM Script para revertir cambios de Docker (Windows)
REM Uso: revert-docker.bat

echo 🔄 Revirtiendo cambios de Docker...

REM Eliminar archivos Docker creados
echo 🗑️ Eliminando archivos Docker...
if exist Dockerfile del Dockerfile
if exist nginx.conf del nginx.conf
if exist .dockerignore del .dockerignore

REM Restaurar backup si existe
if exist Dockerfile.backup (
    echo 📦 Restaurando Dockerfile original...
    ren Dockerfile.backup Dockerfile
    echo ✅ Dockerfile original restaurado
) else (
    echo ℹ️ No se encontró backup de Dockerfile
)

echo 🎉 Cambios revertidos exitosamente!
echo.
echo 📋 Resumen:
echo - Eliminado: Dockerfile, nginx.conf, .dockerignore
echo - Restaurado: Dockerfile.backup (si existía)
echo.
echo 🚀 Para deploy web tradicional (Vercel/Netlify):
echo    npm run build
echo    git add . && git commit -m "Ready for web deploy"
echo    # Conectar repositorio en Vercel/Netlify
pause
