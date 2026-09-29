<#
.SYNOPSIS
    Despliega Solutions Machine completo en AWS.

.DESCRIPTION
    Compila el frontend, prepara la cuenta (bootstrap), despliega la
    infraestructura y siembra los datos iniciales.

    El secreto de firma de los JWT se genera una sola vez y queda guardado en
    .env.deploy (ignorado por git). Reutilizarlo evita que cada despliegue
    cierre la sesión de todos los usuarios.

.EXAMPLE
    .\scripts\desplegar.ps1 -Perfil solutions

.EXAMPLE
    # Solo actualizar el código, sin volver a sembrar datos
    .\scripts\desplegar.ps1 -Perfil solutions -SinSembrar
#>
param(
    [string]$Perfil = 'solutions',
    [string]$Region = 'us-east-1',
    [string]$EmailAlertas = '',
    [int]$PresupuestoUsd = 5,
    [switch]$SinSembrar
)

# Los comandos nativos (aws, npm) escriben avisos en stderr de forma habitual.
# Con 'Stop', PowerShell los trataría como errores fatales; el control real se
# hace revisando $LASTEXITCODE despues de cada paso.
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$env:AWS_PROFILE = $Perfil
$env:AWS_REGION = $Region
$env:CDK_DEFAULT_REGION = $Region
$env:AWS_PAGER = ''

function Paso($texto) {
    Write-Host ""
    Write-Host "==> $texto" -ForegroundColor Cyan
}

function Fallo($texto) {
    Write-Host "ERROR: $texto" -ForegroundColor Red
    exit 1
}

# --- 1. Verificar credenciales --------------------------------------------
Paso "Verificando el perfil de AWS '$Perfil'"

$identidad = aws sts get-caller-identity --query 'Arn' --output text 2>$null
if ($LASTEXITCODE -ne 0) {
    Fallo @"
No se pudo autenticar con el perfil '$Perfil'.

Configurelo primero con:
    aws configure --profile $Perfil
"@
}

$cuenta = aws sts get-caller-identity --query 'Account' --output text 2>$null
Write-Host "    Identidad : $identidad"
Write-Host "    Cuenta    : $cuenta"
Write-Host "    Region    : $Region"

if ($identidad -match ':root$') {
    Write-Host ""
    Write-Host "    AVISO: esta usando las credenciales del usuario raiz." -ForegroundColor Yellow
    Write-Host "    Funciona, pero AWS recomienda crear un usuario IAM." -ForegroundColor Yellow
    Write-Host "    Vea docs/CONFIGURAR-AWS.md, seccion 3." -ForegroundColor Yellow
}

# --- 2. Secreto de firma de los JWT ---------------------------------------
Paso "Preparando el secreto de firma"

$archivoEnv = Join-Path $raiz '.env.deploy'
if (Test-Path $archivoEnv) {
    Get-Content $archivoEnv | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            Set-Item -Path "env:$($Matches[1].Trim())" -Value $Matches[2].Trim()
        }
    }
    Write-Host "    Secreto reutilizado desde .env.deploy"
} else {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secreto = -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
    $env:JWT_SECRET = $secreto
    "JWT_SECRET=$secreto" | Set-Content $archivoEnv -Encoding utf8
    Write-Host "    Secreto nuevo generado y guardado en .env.deploy" -ForegroundColor Yellow
    Write-Host "    Haga una copia en su gestor de contraseñas." -ForegroundColor Yellow
}

if ($EmailAlertas) {
    $env:EMAIL_ALERTAS = $EmailAlertas
    $env:PRESUPUESTO_USD = $PresupuestoUsd
    Write-Host "    Alerta de presupuesto: $EmailAlertas (tope $PresupuestoUsd USD)"
}

# --- 3. Compilar el frontend ----------------------------------------------
Paso "Compilando el frontend"
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) { Fallo "Falló la compilación del frontend" }

# --- 4. Bootstrap (solo la primera vez) -----------------------------------
Paso "Verificando el bootstrap de CDK"

$bootstrapOk = $false
# Si la pila no existe, el CLI devuelve error: es el caso normal la primera vez.
$stack = aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus' --output text 2>$null
if ($LASTEXITCODE -eq 0 -and $stack -match 'COMPLETE') { $bootstrapOk = $true }

if ($bootstrapOk) {
    Write-Host "    Ya estaba preparada"
} else {
    Write-Host "    Preparando la cuenta (solo ocurre la primera vez)..."
    # CDK necesita ejecutarse dentro de infra/ para encontrar su cdk.json.
    Push-Location (Join-Path $raiz 'infra')
    npx cdk bootstrap "aws://$cuenta/$Region"
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { Fallo "Fallo el bootstrap de CDK" }
}

# --- 5. Desplegar ----------------------------------------------------------
Paso "Desplegando la infraestructura"

Push-Location (Join-Path $raiz 'infra')
npx cdk deploy --require-approval never --outputs-file (Join-Path $raiz 'infra\salidas.json')
$codigo = $LASTEXITCODE
Pop-Location
if ($codigo -ne 0) { Fallo "Fallo el despliegue" }

# --- 6. Sembrar datos iniciales -------------------------------------------
$salidas = Get-Content (Join-Path $raiz 'infra\salidas.json') -Raw | ConvertFrom-Json
$stackOut = $salidas.SolutionsMachine
$urlPortal = $stackOut.UrlPortal
$tabla = $stackOut.NombreTabla

if (-not $SinSembrar) {
    Paso "Sembrando los datos iniciales"
    $env:TABLE_NAME = $tabla
    npm --prefix backend run seed
    if ($LASTEXITCODE -ne 0) { Fallo "Falló la siembra de datos" }
}

# --- Resumen ---------------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host " Despliegue completado" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Portal : $urlPortal"
Write-Host "  Tabla  : $tabla"
Write-Host "  Bucket : $($stackOut.BucketReportesNombre)"
Write-Host ""
Write-Host "  Usuarios de acceso (PIN 1234):"
Write-Host "    admin    - portal administrativo"
Write-Host "    tecnico  - escaner y reportes"
Write-Host "    cliente  - inventario e historial"
Write-Host ""
Write-Host "  CAMBIE LOS PIN ANTES DE ENTREGAR AL CLIENTE." -ForegroundColor Yellow
Write-Host ""
