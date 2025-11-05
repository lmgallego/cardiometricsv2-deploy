@echo off
REM Script para probar Docker localmente antes del deploy
echo 🐳 Probando configuración Docker...
echo.

REM Limpiar builds anteriores
echo 🧹 Limpiando builds anteriores...
docker system prune -f
echo.

REM Construir imagen
echo 🔨 Construyendo imagen Docker...
docker build -t fitron-test .
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error en el build de Docker
    pause
    exit /b 1
)
echo.

REM Ejecutar contenedor
echo 🚀 Iniciando contenedor en puerto 8080...
docker run -d -p 8080:80 --name fitron-container fitron-test
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error al iniciar contenedor
    pause
    exit /b 1
)
echo.

echo ✅ Contenedor iniciado exitosamente!
echo.
echo 📊 Información del contenedor:
docker ps | findstr fitron-container
echo.
echo 🌐 Accede a la aplicación en: http://localhost:8080
echo.
echo 📋 Comandos útiles:
echo    Ver logs:     docker logs fitron-container
echo    Detener:      docker stop fitron-container
echo    Eliminar:     docker rm fitron-container
echo    Ver tamaño:   docker images fitron-test
echo.
pause
