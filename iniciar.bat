@echo off
chcp 65001 >nul 2>&1
title Sistema de Locação

:: ── Obter diretório do script ──
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "PORT=3000"
set "URL=http://localhost:%PORT%"

:: ── Verificar Node.js ──
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo        Execute "instalar.bat" como administrador primeiro.
    pause
    exit /b 1
)

:: ── Verificar se já está rodando ──
powershell -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorLevel% equ 0 (
    echo Sistema ja esta em execucao!
    echo Abrindo no navegador...
    start "" "%URL%"
    exit /b 0
)

:: ── Verificar dependências ──
if not exist "%BACKEND_DIR%\node_modules" (
    echo Instalando dependencias...
    cd /d "%BACKEND_DIR%"
    call npm install --production >nul 2>&1
)

:: ── Garantir diretórios de dados ──
if not exist "%BACKEND_DIR%\data" mkdir "%BACKEND_DIR%\data"
if not exist "%BACKEND_DIR%\backups" mkdir "%BACKEND_DIR%\backups"

:: ── Iniciar o servidor em segundo plano ──
echo.
echo ============================================================
echo    SISTEMA DE LOCAÇÃO
echo ============================================================
echo.
echo    Iniciando servidor...
echo.

cd /d "%BACKEND_DIR%"
start /b "" node dist/server.js

:: ── Aguardar o servidor ficar pronto ──
set "TENTATIVAS=0"
:aguardar
if %TENTATIVAS% geq 30 (
    echo.
    echo [ERRO] Servidor nao iniciou a tempo.
    echo        Verifique se a porta %PORT% nao esta em uso.
    pause
    exit /b 1
)

powershell -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorLevel% neq 0 (
    set /a TENTATIVAS+=1
    powershell -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
    goto aguardar
)

echo    Servidor iniciado com sucesso!
echo.
echo    Endereco: %URL%
echo    Pressione Ctrl+C ou feche esta janela para parar.
echo.
echo ============================================================
echo.

:: ── Abrir navegador ──
start "" "%URL%"

:: ── Manter janela aberta até o usuário fechar ──
echo    Sistema em execucao. Nao feche esta janela.
echo    Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.

:: Rodar loop para manter a janela aberta e detectar se o servidor caiu
:loop
powershell -Command "Start-Sleep -Seconds 5" >nul 2>&1
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorLevel% neq 0 (
    echo.
    echo    [!] Servidor encerrado.
    echo.
    pause
    exit /b 0
)
goto loop
