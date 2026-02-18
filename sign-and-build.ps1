# ============================================================
# Sistema de Locação — Build + Sign Script
# Gera o instalador .exe e assina com certificado autoassinado
# ============================================================
param(
    [string]$CertPath = ".\cert.pfx",
    [string]$CertPassword = "SistemaLocacao2026!"
)

$ErrorActionPreference = "Stop"
$ReleaseDir = ".\release"

Write-Host "`n=== Sistema de Locação — Build & Sign ===" -ForegroundColor Cyan
Write-Host ""

# 1. Build
Write-Host "[1/5] Compilando frontend e backend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build falhou!" }

# 2. Rebuild better-sqlite3 para Electron
Write-Host "[2/5] Recompilando better-sqlite3 para Electron..." -ForegroundColor Yellow
npx @electron/rebuild -m backend -v 33.2.1 -o better-sqlite3
if ($LASTEXITCODE -ne 0) { throw "Rebuild falhou!" }

# 3. Gerar instalador (sem assinatura)
Write-Host "[3/5] Gerando instalador .exe..." -ForegroundColor Yellow
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win --config
if ($LASTEXITCODE -ne 0) { throw "electron-builder falhou!" }

# 4. Assinar os executáveis
Write-Host "[4/5] Assinando executáveis com certificado..." -ForegroundColor Yellow

if (!(Test-Path $CertPath)) {
    Write-Host "  ⚠️  Certificado não encontrado em $CertPath" -ForegroundColor Red
    Write-Host "  Execute: New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=Sistema de Locacao' -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(5)" -ForegroundColor Gray
    throw "Certificado não encontrado."
}

$securePass = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText
$cert = Get-PfxCertificate -FilePath $CertPath -Password $securePass

# Assina o .exe principal
$mainExe = Get-ChildItem -Path "$ReleaseDir\win-unpacked" -Filter "*.exe" -Recurse | Select-Object -First 1
if ($mainExe) {
    Write-Host "  Assinando: $($mainExe.Name)..." -ForegroundColor Gray
    Set-AuthenticodeSignature -FilePath $mainExe.FullName -Certificate $cert -TimestampServer "http://timestamp.digicert.com" -HashAlgorithm SHA256
}

# Assina o instalador Setup
$setupExe = Get-ChildItem -Path $ReleaseDir -Filter "*Setup*.exe" | Select-Object -First 1
if ($setupExe) {
    Write-Host "  Assinando: $($setupExe.Name)..." -ForegroundColor Gray
    Set-AuthenticodeSignature -FilePath $setupExe.FullName -Certificate $cert -TimestampServer "http://timestamp.digicert.com" -HashAlgorithm SHA256
}

# 5. Verificar assinatura
Write-Host "[5/5] Verificando assinaturas..." -ForegroundColor Yellow
if ($setupExe) {
    $sig = Get-AuthenticodeSignature -FilePath $setupExe.FullName
    Write-Host "  Status: $($sig.Status)" -ForegroundColor $(if ($sig.Status -eq "Valid") { "Green" } else { "Yellow" })
    Write-Host "  Assinante: $($sig.SignerCertificate.Subject)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Build concluído! ===" -ForegroundColor Green
Write-Host "Instalador: $($setupExe.FullName)" -ForegroundColor Cyan
Write-Host ""

# Lembrete: voltar better-sqlite3 para dev
Write-Host "⚠️  Para voltar ao modo desenvolvimento:" -ForegroundColor Yellow
Write-Host "   cd backend; npm rebuild better-sqlite3" -ForegroundColor Gray
Write-Host ""
