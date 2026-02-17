@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Sistema de Locação - Desinstalador
color 0C

echo ============================================================
echo    SISTEMA DE LOCAÇÃO - DESINSTALADOR
echo ============================================================
echo.

:: ── Verificar privilégios de administrador ──
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Execute como Administrador.
    pause
    exit /b 1
)

:: ── Obter diretório do script ──
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

:: ── Parar servidor se estiver rodando ──
echo Parando servidor...
taskkill /f /im node.exe >nul 2>&1
echo.

:: ── Perguntar sobre dados ──
echo O que deseja remover?
echo.
echo   1 - Remover apenas atalhos (manter dados e sistema)
echo   2 - Remover atalhos + dependencias (manter dados)
echo   3 - Remover TUDO (incluindo banco de dados e backups)
echo   0 - Cancelar
echo.
set /p "OPCAO=Escolha [0-3]: "

if "%OPCAO%"=="0" (
    echo Cancelado.
    pause
    exit /b 0
)

:: ── Remover atalhos ──
echo.
echo Removendo atalhos...

:: Desktop
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\Sistema de Locacao.lnk"
if exist "%DESKTOP_SHORTCUT%" del "%DESKTOP_SHORTCUT%"

:: Tentar Desktop público também
set "PUBLIC_DESKTOP=%PUBLIC%\Desktop\Sistema de Locacao.lnk"
if exist "%PUBLIC_DESKTOP%" del "%PUBLIC_DESKTOP%"

:: Menu Iniciar
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Sistema de Locacao.lnk"
if exist "%STARTMENU%" del "%STARTMENU%"

echo     Atalhos removidos.

if "%OPCAO%"=="1" goto fim

:: ── Remover dependências (node_modules) ──
echo.
echo Removendo dependencias (node_modules)...
if exist "%BACKEND_DIR%\node_modules" (
    rmdir /s /q "%BACKEND_DIR%\node_modules"
    echo     node_modules removido.
) else (
    echo     node_modules nao encontrado.
)

if "%OPCAO%"=="2" goto fim

:: ── Remover dados ──
if "%OPCAO%"=="3" (
    echo.
    echo ============================================
    echo  ATENCAO: Isso vai APAGAR todos os dados!
    echo  Banco de dados, backups, tudo sera perdido.
    echo ============================================
    echo.
    set /p "CONFIRMA=Tem certeza? Digite SIM para confirmar: "
    
    if /i "!CONFIRMA!"=="SIM" (
        echo.
        echo Removendo banco de dados...
        if exist "%BACKEND_DIR%\data" (
            rmdir /s /q "%BACKEND_DIR%\data"
            echo     Banco de dados removido.
        )
        
        echo Removendo backups...
        if exist "%BACKEND_DIR%\backups" (
            rmdir /s /q "%BACKEND_DIR%\backups"
            echo     Backups removidos.
        )

        echo.
        echo     [!] Arquivo de licenca (.license) foi PRESERVADO.
        echo         Ao reinstalar, a mesma chave sera reconhecida automaticamente.
    ) else (
        echo     Dados mantidos.
    )
)

:fim
echo.
echo ============================================================
echo    DESINSTALACAO CONCLUIDA
echo ============================================================
echo.
if "%OPCAO%"=="1" (
    echo    Atalhos removidos. Sistema e dados mantidos.
)
if "%OPCAO%"=="2" (
    echo    Atalhos e dependencias removidos. Dados mantidos.
    echo    Execute "instalar.bat" para reinstalar.
)
if "%OPCAO%"=="3" (
    echo    Sistema completamente removido.
    echo    Voce pode deletar esta pasta manualmente.
)
echo.
pause
