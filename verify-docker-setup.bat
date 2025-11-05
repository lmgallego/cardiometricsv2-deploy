@echo off
REM Script para verificar configuración Docker antes del deploy
echo 🔍 Verificando configuración Docker...
echo.

set ERROR=0

REM Verificar Dockerfile
echo [1/5] Verificando Dockerfile...
if exist Dockerfile (
    echo ✅ Dockerfile encontrado
    findstr /C:"npm install" Dockerfile >nul
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Comando npm install correcto
    ) else (
        echo ❌ Dockerfile no tiene npm install
        set ERROR=1
    )
    findstr /C:"rm -rf server" Dockerfile >nul
    if %ERRORLEVEL% EQU 0 (
        echo ⚠️  ADVERTENCIA: Dockerfile contiene 'rm -rf server' - esto puede causar problemas
        set ERROR=1
    )
) else (
    echo ❌ Dockerfile NO encontrado
    set ERROR=1
)
echo.

REM Verificar nginx.conf
echo [2/5] Verificando nginx.conf...
if exist nginx.conf (
    echo ✅ nginx.conf encontrado
) else (
    echo ❌ nginx.conf NO encontrado
    set ERROR=1
)
echo.

REM Verificar .dockerignore
echo [3/5] Verificando .dockerignore...
if exist .dockerignore (
    echo ✅ .dockerignore encontrado
) else (
    echo ⚠️  .dockerignore NO encontrado (recomendado pero no crítico)
)
echo.

REM Verificar package.json
echo [4/5] Verificando package.json...
if exist package.json (
    echo ✅ package.json encontrado
    findstr /C:"vite build" package.json >nul
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Script 'build' configurado
    ) else (
        echo ❌ Script 'build' NO encontrado en package.json
        set ERROR=1
    )
) else (
    echo ❌ package.json NO encontrado
    set ERROR=1
)
echo.

REM Verificar vite.config.js
echo [5/5] Verificando vite.config.js...
if exist vite.config.js (
    echo ✅ vite.config.js encontrado
) else (
    echo ⚠️  vite.config.js NO encontrado (puede causar problemas)
)
echo.

REM Resumen
echo ==========================================
if %ERROR% EQU 0 (
    echo ✅ VERIFICACIÓN EXITOSA
    echo.
    echo 🚀 Listo para deploy! Puedes ejecutar:
    echo    docker build -t fitron-app .
    echo    docker run -p 8080:80 fitron-app
) else (
    echo ❌ VERIFICACIÓN FALLIDA
    echo.
    echo 🔧 Corrige los errores antes de hacer deploy
    echo.
    echo 💡 Sugerencias:
    echo    - Asegúrate de estar en la carpeta correcta del proyecto
    echo    - Verifica que todos los archivos necesarios existan
    echo    - Revisa el DOCKER-README.md para más información
)
echo ==========================================
echo.
pause
