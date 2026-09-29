# Arquitectura AWS · Solutions Machine

Infraestructura serverless diseñada para costar **cerca de 1 USD al mes** en una
empresa pequeña, sin sacrificar seguridad ni trazabilidad.

---

## 1. Diagrama

```
                    Internet
                       │
                       ▼
            ┌──────────────────────┐
            │     CloudFront       │  HTTPS, caché y certificado gratis
            └──────────┬───────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
     /*  ▼                    /api/* ▼
  ┌────────────┐            ┌──────────────────┐
  │ S3 (web)   │            │ Lambda (Node 22) │  arm64 · 512 MB
  │ React build│            │  Function URL    │  privada (OAC + IAM)
  └────────────┘            └────────┬─────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
            ┌─────────────────┐            ┌────────────────────┐
            │   DynamoDB      │            │  S3 (reportes)     │
            │  tabla única    │            │  PDF + evidencias  │
            │  GSI1 · GSI2    │            │  ciclo de vida     │
            └─────────────────┘            └────────────────────┘
```

**La decisión central:** CloudFront sirve el frontend *y* la API bajo el mismo
dominio. Eso elimina API Gateway, elimina el CORS y deja la Lambda privada
(solo CloudFront puede invocarla, mediante Origin Access Control con IAM).

---

## 2. Por qué cada servicio

| Servicio | Elección | Motivo |
|---|---|---|
| **CloudFront** | Price Class 100 | 1 TB de tráfico al mes siempre gratis. La clase 100 usa solo las ubicaciones más económicas. |
| **Lambda** | Function URL, arm64, 512 MB | Sin costo de API Gateway. Graviton cuesta ~20 % menos. 1 M de invocaciones al mes siempre gratis. |
| **DynamoDB** | Bajo demanda, tabla única | 25 GB siempre gratis. Sin VPC ni límite de conexiones: encaja de forma natural con Lambda. |
| **S3** | 2 buckets privados | Uno para el frontend, otro para reportes. Ambos cerrados al público; el acceso va por URL prefirmada. |
| **CloudWatch** | Retención de 14 días | Sin retención, los logs crecen para siempre y terminan siendo el mayor gasto. |

### Lo que deliberadamente NO se usa

| Descartado | Habría costado |
|---|---|
| NAT Gateway | **32 USD/mes** — el error más común. Solo hace falta si Lambda va en VPC; con DynamoDB no se necesita VPC. |
| API Gateway | 1 USD por millón de peticiones + complejidad de CORS |
| RDS / Aurora | 15 – 45 USD/mes |
| RDS Proxy | 15 USD/mes |
| Secrets Manager | 0,40 USD por secreto (se usan variables de entorno de Lambda) |

---

## 3. Modelo de datos (tabla única)

Una sola tabla resuelve todas las consultas sin un solo `Scan`.

| Entidad | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|---|---|---|---|---|---|---|
| Empresa | `EMPRESA#<id>` | `META` | — | — | `T#EMPRESA` | `<nombre>` |
| Equipo | `EQUIPO#<id>` | `META` | `EMPRESA#<empId>` | `EQUIPO#<codigo>` | `T#EQUIPO` | `<codigo>` |
| Usuario | `USUARIO#<id>` | `META` | — | — | `T#USUARIO` | `<usuario>` |
| Revisión | `EQUIPO#<equipoId>` | `REVISION#<fecha>#<id>` | `EMPRESA#<empId>` | `REVISION#<fecha>#<id>` | `T#REVISION` | `<fecha>#<id>` |

**GSI1** resuelve «hijos de una empresa». **GSI2** resuelve «listar todo de un
tipo» y «buscar por clave única» (código QR, nombre de usuario).

| Consulta del negocio | Cómo se resuelve |
|---|---|
| Login por nombre de usuario | GSI2 · `T#USUARIO` + SK exacto |
| Escanear QR → equipo | GSI2 · `T#EQUIPO` + SK exacto |
| Equipos de una empresa | GSI1 · `EMPRESA#<id>` + `begins_with(EQUIPO#)` |
| Historial de un equipo | Tabla · `EQUIPO#<id>` + `begins_with(REVISION#)`, descendente |
| Historial de una empresa | GSI1 · `EMPRESA#<id>` + `begins_with(REVISION#)` |
| Historial global | GSI2 · `T#REVISION`, descendente |

El consecutivo (`SM-2026-00153`) se genera con `ADD` atómico: dos técnicos que
cierren un reporte a la vez nunca obtienen el mismo número.

---

## 4. Flujo de evidencias

Las fotos **no pasan por Lambda**. El navegador pide una URL prefirmada y sube
el archivo directo a S3:

```
Navegador → POST /api/revisiones/evidencias → Lambda devuelve URL firmada
Navegador → PUT (la foto) → S3 directo
```

Esto evita el límite de 6 MB de payload de Lambda y reduce el tiempo de
ejecución facturado a unos pocos milisegundos.

Ciclo de vida del bucket de reportes:
- **0 – 90 días**: almacenamiento estándar
- **90 días**: clase de acceso infrecuente (–46 % de costo)
- **1 año**: Glacier Instant Retrieval (–68 %), recuperación inmediata

---

## 5. Seguridad

- La Lambda Function URL es **privada** (`AWS_IAM` + Origin Access Control).
  Solo CloudFront puede invocarla; no es accesible desde internet.
- Ambos buckets tienen bloqueo total de acceso público y cifrado en reposo.
- El PIN se guarda como hash `scrypt` con sal única. Nunca en texto plano.
- El JWT se firma con HMAC-SHA256 y se valida con comparación en tiempo
  constante.
- El rol `cliente` queda acotado a su empresa **en el servidor**: aunque
  manipule la petición, no puede leer datos de otra empresa.
- Los errores internos van a CloudWatch; el cliente nunca recibe trazas.

---

## 6. Despliegue

### Requisitos
- Node.js 20 o superior
- AWS CLI configurada (`aws configure`)
- Una cuenta de AWS

### Primera vez

```bash
# 1. Dependencias de todo el monorepo
npm run install:all

# 2. Secreto para firmar los JWT (guárdelo en un gestor de contraseñas)
#    PowerShell:
$env:JWT_SECRET = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
#    bash:
export JWT_SECRET=$(openssl rand -hex 32)

# 3. Correo para la alerta de presupuesto (opcional pero recomendado)
$env:EMAIL_ALERTAS = "alertas@solutionsmachine.co"
$env:PRESUPUESTO_USD = "5"

# 4. Preparar la cuenta para CDK (una sola vez por cuenta y región)
npm --prefix infra run bootstrap

# 5. Desplegar (compila el frontend y sube todo)
npm run deploy

# 6. Sembrar los datos iniciales con el nombre de tabla que devolvió el paso 5
$env:TABLE_NAME = "solutions-machine"
npm run seed
```

Al terminar, la salida `UrlPortal` muestra la URL pública del portal.

### Despliegues posteriores

```bash
npm run diff     # ver qué va a cambiar
npm run deploy   # aplicar
```

### Dominio propio (opcional, +0,50 USD/mes)

1. Registrar el dominio o crear una zona alojada en Route 53.
2. Solicitar un certificado en ACM **en la región us-east-1** (CloudFront solo
   acepta certificados de esa región).
3. Añadir `domainNames` y `certificate` a la distribución en
   `infra/lib/solutions-stack.ts`.

---

## 7. Costo mensual estimado

Escenario: 5 técnicos, ~200 equipos, ~100 reportes al mes con 10 fotos cada uno.

| Servicio | Consumo estimado | Costo |
|---|---|---|
| Lambda | ~25.000 invocaciones (gratis: 1 M) | **0,00** |
| CloudFront | ~5 GB (gratis: 1 TB) | **0,00** |
| DynamoDB | ~50 MB (gratis: 25 GB) | **0,00** |
| S3 reportes | ~300 MB nuevos al mes | 0,01 – 0,15 |
| CloudWatch Logs | < 1 GB con retención de 14 días | 0,00 |
| Route 53 (si usan dominio propio) | 1 zona alojada | 0,50 |
| **Total** | | **≈ 0,50 – 1,00 USD/mes** |

Crecimiento: aunque tripliquen el volumen siguen dentro del nivel gratuito. El
único rubro que crece es S3, a razón de unos **0,08 USD por cada GB acumulado
al año**.

> **Cuenta nueva:** AWS entrega hasta 200 USD en créditos que cubren los
> primeros ~6 meses. Los límites de Lambda, CloudFront y DynamoDB citados arriba
> son «siempre gratis»: no vencen.

### Control de gasto

El stack crea una alerta de presupuesto si se define `EMAIL_ALERTAS`:
- Aviso al superar el **80 %** del tope real
- Aviso si la **proyección** del mes supera el 100 %

---

## 8. Estructura del repositorio

```
SOLUTIONS/
├── frontend/          React + Vite (portal admin, técnico y cliente)
├── backend/           Lambda: API REST
│   └── src/
│       ├── handler.ts     enrutador único
│       ├── lib/           dynamo · auth · s3 · http
│       ├── routes/        auth · empresas · equipos · revisiones · usuarios
│       └── seed.ts        datos iniciales
├── infra/             CDK: toda la infraestructura como código
└── docs/AWS.md        este documento
```

---

## 9. API

Todas las rutas van bajo `/api`. Autenticación por `Authorization: Bearer <jwt>`.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | — | Usuario + PIN, devuelve JWT |
| GET | `/auth/sesion` | cualquiera | Valida la sesión guardada |
| GET | `/empresas` | cualquiera | Lista (el cliente solo ve la suya) |
| POST | `/empresas` | admin | Crear |
| PUT/DELETE | `/empresas/:id` | admin | Editar / eliminar |
| GET | `/equipos` | cualquiera | Lista, filtro `?empresa=` |
| GET | `/equipos/codigo/:codigo` | cualquiera | Resolver un QR |
| POST | `/equipos` | admin | Crear |
| PUT/DELETE | `/equipos/:id` | admin | Editar / eliminar |
| GET | `/revisiones` | cualquiera | Historial, filtros `?empresa=` `?equipo=` |
| GET | `/revisiones/:equipoId/:id` | cualquiera | Detalle con enlaces a fotos y PDF |
| POST | `/revisiones` | técnico, admin | Crear (asigna consecutivo) |
| PUT | `/revisiones/:equipoId/:id` | técnico, admin | Actualizar |
| POST | `/revisiones/evidencias` | técnico, admin | URL prefirmada para subir foto |
| POST | `/revisiones/pdf` | técnico, admin | URL prefirmada para subir el PDF |
| GET/POST | `/usuarios` | admin | Listar / crear |
| PUT/DELETE | `/usuarios/:id` | admin | Editar / eliminar |
| POST | `/usuarios/:id/pin` | admin | Restablecer PIN |
