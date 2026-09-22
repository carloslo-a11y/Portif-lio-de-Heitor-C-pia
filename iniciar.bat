@echo off
title Colmeia de Atividades - Servidor
cd /d "%~dp0"
echo ==========================================
echo   Colmeia de Atividades - Servidor
echo ==========================================
echo.
echo  Verificando dependencias...
if not exist node_modules (
    echo  Instalando dependencias...
    call npm install
)
echo.
echo  Iniciando servidor em http://localhost:3000
echo  Abra o navegador em:
echo    Login:    http://localhost:3000/login.html
echo    Cadastro: http://localhost:3000/cadastro.html
echo.
echo  Pressione Ctrl+C para encerrar o servidor.
echo ==========================================
node server.js
pause
