#!/bin/bash

# Script para revertir cambios de Docker
# Uso: ./revert-docker.sh

echo "🔄 Revirtiendo cambios de Docker..."

# Eliminar archivos Docker creados
echo "🗑️ Eliminando archivos Docker..."
rm -f Dockerfile
rm -f nginx.conf
rm -f .dockerignore

# Restaurar backup si existe
if [ -f "Dockerfile.backup" ]; then
    echo "📦 Restaurando Dockerfile original..."
    mv Dockerfile.backup Dockerfile
    echo "✅ Dockerfile original restaurado"
else
    echo "ℹ️ No se encontró backup de Dockerfile"
fi

echo "🎉 Cambios revertidos exitosamente!"
echo ""
echo "📋 Resumen:"
echo "- Eliminado: Dockerfile, nginx.conf, .dockerignore"
echo "- Restaurado: Dockerfile.backup (si existía)"
echo ""
echo "🚀 Para deploy web tradicional (Vercel/Netlify):"
echo "   npm run build"
echo "   git add . && git commit -m 'Ready for web deploy'"
echo "   # Conectar repositorio en Vercel/Netlify"
