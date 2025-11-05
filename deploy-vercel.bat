@echo off
REM Script para deploy automático en Vercel
echo 🚀 Deploy Automático en Vercel
echo ================================
echo.

REM Verificar que estamos en la carpeta correcta
if not exist package.json (
    echo ❌ Error: No se encuentra package.json
    echo    Asegúrate de estar en la carpeta del proyecto
    pause
    exit /b 1
)

REM Paso 1: Verificar build local
echo [1/5] 🔨 Probando build local...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error en el build local
    echo    Corrige los errores antes de hacer deploy
    pause
    exit /b 1
)
echo ✅ Build local exitoso
echo.

REM Paso 2: Git add
echo [2/5] 📦 Agregando archivos a Git...
git add .
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Advertencia: Error al agregar archivos a Git
    echo    ¿Git está inicializado? Ejecuta: git init
)
echo ✅ Archivos agregados
echo.

REM Paso 3: Git commit
echo [3/5] 💾 Creando commit...
git commit -m "Deploy to Vercel - %date% %time%"
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  No hay cambios para commitear o error en commit
)
echo ✅ Commit creado
echo.

REM Paso 4: Git push
echo [4/5] ⬆️  Subiendo a GitHub...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Advertencia: Error al hacer push
    echo    ¿Tienes configurado el remote? Ejecuta: git remote -v
    echo.
    echo 💡 Si no tienes repositorio en GitHub:
    echo    1. Crea un repo en github.com
    echo    2. git remote add origin [URL-del-repo]
    echo    3. git push -u origin main
)
echo ✅ Código subido a GitHub
echo.

REM Paso 5: Instrucciones finales
echo [5/5] 🎯 Próximos pasos:
echo.
echo ================================
echo 📋 OPCIONES DE DEPLOY:
echo ================================
echo.
echo OPCIÓN 1: Deploy con Interfaz Web (Recomendado)
echo ------------------------------------------------
echo 1. Ve a https://vercel.com
echo 2. Login con GitHub
echo 3. Click en "New Project"
echo 3. Importa el repositorio "cardiometrics"
echo 5. Click en "Deploy"
echo 6. ¡Espera 1-2 minutos!
echo.
echo OPCIÓN 2: Deploy con CLI
echo ------------------------
echo 1. Instala Vercel CLI: npm install -g vercel
echo 2. Login: vercel login
echo 3. Deploy: vercel --prod
echo.
echo ================================
echo.
echo 🌐 Tu app estará en: https://cardiometrics-[tu-usuario].vercel.app
echo.
echo 📖 Más información: Lee DEPLOY-VERCEL.md
echo.
pause
