<#
.SYNOPSIS
    Muestra las cuentas de AWS configuradas y verifica que funcionen.

.DESCRIPTION
    Recorre todos los perfiles del AWS CLI y consulta a quién pertenece cada
    uno. Sirve para confirmar en qué cuenta se va a desplegar antes de
    ejecutar nada, y para detectar credenciales vencidas.

    Nunca muestra claves de acceso: solo identidad, número de cuenta y región.

.EXAMPLE
    .\scripts\cuentas.ps1

.EXAMPLE
    # Verificar un perfil concreto
    .\scripts\cuentas.ps1 -Perfil solutions
#>
param(
    [string]$Perfil = ''
)

$ErrorActionPreference = 'Continue'
$env:AWS_PAGER = ''

# Cuentas conocidas del proyecto: ayuda a reconocerlas de un vistazo.
$conocidas = @{
    '330226906054' = 'Vicente - pruebas'
}

function Consultar($nombrePerfil) {
    $arn = aws sts get-caller-identity --profile $nombrePerfil --query 'Arn' --output text 2>&1
    if ($LASTEXITCODE -ne 0) {
        return [pscustomobject]@{
            Perfil  = $nombrePerfil
            Estado  = 'SIN ACCESO'
            Cuenta  = '-'
            Detalle = 'Credenciales ausentes, vencidas o inválidas'
            Region  = '-'
        }
    }

    $cuenta = aws sts get-caller-identity --profile $nombrePerfil --query 'Account' --output text 2>&1
    $region = aws configure get region --profile $nombrePerfil 2>&1
    if (-not $region -or $LASTEXITCODE -ne 0) { $region = '(sin definir)' }

    # El alias es opcional; si no hay permisos para leerlo, no pasa nada.
    $alias = aws iam list-account-aliases --profile $nombrePerfil --query 'AccountAliases[0]' --output text 2>&1
    if ($LASTEXITCODE -ne 0 -or $alias -eq 'None') { $alias = '' }

    $etiqueta = $conocidas[$cuenta]
    if (-not $etiqueta) { $etiqueta = $alias }
    if (-not $etiqueta) { $etiqueta = ($arn -split '/')[-1] }

    return [pscustomobject]@{
        Perfil  = $nombrePerfil
        Estado  = 'OK'
        Cuenta  = $cuenta
        Detalle = $etiqueta
        Region  = $region
    }
}

$perfiles = if ($Perfil) { @($Perfil) } else { aws configure list-profiles }

if (-not $perfiles) {
    Write-Host "No hay perfiles configurados." -ForegroundColor Yellow
    Write-Host "Cree uno con:  aws configure --profile <nombre>"
    exit 0
}

Write-Host ""
Write-Host "Cuentas de AWS configuradas" -ForegroundColor Cyan
Write-Host "---------------------------"

$resultados = foreach ($p in $perfiles) { Consultar $p }
$resultados | Format-Table -AutoSize

$activo = $env:AWS_PROFILE
if ($activo) {
    Write-Host "Perfil activo en esta terminal: $activo" -ForegroundColor Green
} else {
    Write-Host "Sin perfil activo: los comandos usarán 'default'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para desplegar en una cuenta concreta:" -ForegroundColor Cyan
Write-Host "    .\scripts\desplegar.ps1 -Perfil <nombre>"
Write-Host ""
