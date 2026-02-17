@echo off
chcp 65001 >nul 2>&1
title Sistema de Locação - Instalador
color 0A

echo ============================================================
echo    SISTEMA DE LOCAÇÃO - INSTALADOR
echo ============================================================
echo.

:: ── Verificar privilégios de administrador ──
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Este instalador precisa ser executado como Administrador.
    echo     Clique com o botao direito e selecione "Executar como administrador".
    echo.
    pause
    exit /b 1
)

:: ── Obter diretório do script ──
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

:: ── 1. Verificar/Instalar Node.js ──
echo [1/5] Verificando Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [!] Node.js NAO encontrado. Instalando automaticamente...
    echo.

    :: Detectar arquitetura
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
        set "NODE_ARCH=x64"
    ) else (
        set "NODE_ARCH=x86"
    )

    set "NODE_VERSION=22.16.0"
    set "NODE_MSI=node-v%NODE_VERSION%-%NODE_ARCH%.msi"
    set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-%NODE_ARCH%.msi"
    set "NODE_INSTALLER=%TEMP%\%NODE_MSI%"

    echo     Baixando Node.js v%NODE_VERSION% (%NODE_ARCH%)...
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing }" 2>nul

    if not exist "%NODE_INSTALLER%" (
        echo.
        echo [ERRO] Falha ao baixar Node.js.
        echo        Baixe manualmente em: https://nodejs.org
        echo        Apos instalar, execute este script novamente.
        echo.
        pause
        exit /b 1
    )

    echo     Instalando Node.js (pode demorar alguns minutos)...
    msiexec /i "%NODE_INSTALLER%" /qn /norestart

    :: Atualizar PATH na sessão atual
    set "PATH=%PATH%;C:\Program Files\nodejs"

    :: Limpar instalador
    del "%NODE_INSTALLER%" >nul 2>&1

    :: Verificar instalação
    where node >nul 2>&1
    if %errorLevel% neq 0 (
        echo.
        echo [ERRO] Node.js foi instalado mas nao foi encontrado no PATH.
        echo        Feche este terminal, abra um novo e execute novamente.
        echo.
        pause
        exit /b 1
    )

    echo     Node.js instalado com sucesso!
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo     Node.js %NODE_VER% encontrado.
)
echo.

:: ── 2. Instalar dependências ──
echo [2/5] Instalando dependencias do sistema...
cd /d "%BACKEND_DIR%"
call npm install --production 2>nul
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)
echo     Dependencias instaladas com sucesso!
echo.

:: ── 3. Criar diretórios de dados ──
echo [3/5] Configurando banco de dados local...
if not exist "%BACKEND_DIR%\data" mkdir "%BACKEND_DIR%\data"
if not exist "%BACKEND_DIR%\backups" mkdir "%BACKEND_DIR%\backups"
echo     Diretorios de dados criados.
echo.

:: ── 4. Inicializar banco de dados (primeira execução) ──
echo [4/5] Inicializando banco de dados...
cd /d "%BACKEND_DIR%"
node dist/server.js &
set "SERVER_PID=%errorLevel%"
:: Aguarda o servidor iniciar e criar as tabelas
powershell -Command "Start-Sleep -Seconds 4" >nul 2>&1

:: Testar se o servidor está respondendo
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method POST -ContentType 'application/json' -Body '{\"email\":\"admin@sistema.local\",\"password\":\"admin123\"}' -UseBasicParsing -TimeoutSec 5; Write-Host '     Banco de dados inicializado com sucesso!' } catch { Write-Host '     Banco sera inicializado na primeira execucao.' }" 2>nul

:: Matar o servidor de teste
taskkill /f /im node.exe >nul 2>&1
echo.

:: ── 5. Criar atalho na Área de Trabalho ──
echo [5/5] Criando atalho na Area de Trabalho...

:: Criar atalho usando PowerShell
powershell -Command "& { $WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Sistema de Locacao.lnk')); $Shortcut.TargetPath = '%SCRIPT_DIR%iniciar.bat'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.IconLocation = 'shell32.dll,21'; $Shortcut.Description = 'Sistema de Locacao de Itens'; $Shortcut.WindowStyle = 7; $Shortcut.Save(); }"

echo     Atalho "Sistema de Locacao" criado na Area de Trabalho!
echo.

:: ── Criar atalho no Menu Iniciar (opcional) ──
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -Command "& { $WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine('%STARTMENU%', 'Sistema de Locacao.lnk')); $Shortcut.TargetPath = '%SCRIPT_DIR%iniciar.bat'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.IconLocation = 'shell32.dll,21'; $Shortcut.Description = 'Sistema de Locacao de Itens'; $Shortcut.WindowStyle = 7; $Shortcut.Save(); }" >nul 2>&1

echo ============================================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo ============================================================
echo.
echo    Para iniciar o sistema:
echo      - Clique duas vezes no atalho "Sistema de Locacao"
echo        na sua Area de Trabalho
echo      - Ou execute o arquivo "iniciar.bat"
echo.
echo    Credenciais padrao:
echo      Email: admin@sistema.local
echo      Senha: admin123
echo.
echo    O sistema funciona 100%% offline!
echo ============================================================
echo.
pause
