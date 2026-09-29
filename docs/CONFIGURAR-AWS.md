# Configurar la cuenta de AWS

Guía única para dejar la cuenta lista antes del primer despliegue.
Tiempo estimado: **20 minutos**.

> ⚠️ **Las claves de acceso nunca se comparten por chat, correo ni WhatsApp.**
> Se escriben una sola vez en su propia terminal y quedan guardadas
> localmente en `C:\Users\<usuario>\.aws\credentials`.

---

## 1. Crear la cuenta

1. Entrar a <https://aws.amazon.com/free> → **Crear una cuenta de AWS**.
2. **Correo**: usar uno que el cliente pueda heredar más adelante, por ejemplo
   `aws@solutionsmachine.co`. Evitar correos personales.
3. **Nombre de la cuenta**: `Solutions Machine`.
4. Elegir el plan **Free**: otorga 100 USD en créditos al registrarse y hasta
   100 USD adicionales al explorar servicios.
5. Pide una tarjeta de crédito para validar identidad. Con el plan Free **no se
   generan cobros** hasta que usted autorice el cambio a plan de pago.

---

## 2. Asegurar la cuenta raíz

El usuario *root* puede hacer cualquier cosa, incluso cerrar la cuenta. Se
protege una vez y no se vuelve a usar.

1. Iniciar sesión como root.
2. Arriba a la derecha: **nombre de la cuenta → Credenciales de seguridad**.
3. En *Multi-factor authentication (MFA)* → **Asignar dispositivo MFA**.
4. Elegir **Aplicación de autenticación** y escanear el código con Google
   Authenticator, Microsoft Authenticator o similar.
5. Guardar los códigos de recuperación en un lugar seguro.

---

## 3. Crear el usuario de despliegue

1. En la consola, buscar el servicio **IAM**.
2. Menú lateral → **Usuarios** → **Crear usuario**.
3. Nombre: `deploy-solutions`.
   - *No* marcar «Proporcionar acceso a la consola» (este usuario es solo para
     la línea de comandos).
4. **Establecer permisos** → *Adjuntar políticas directamente* → buscar y
   marcar **`AdministratorAccess`**.
5. Crear el usuario.

### Generar la clave de acceso

1. Abrir el usuario recién creado → pestaña **Credenciales de seguridad**.
2. Bajar hasta *Claves de acceso* → **Crear clave de acceso**.
3. Caso de uso: **Interfaz de línea de comandos (CLI)** → confirmar la
   advertencia → **Crear**.
4. Se muestran dos valores. El *Secret access key* **solo se ve esta vez**:
   - `Access key ID` → empieza por `AKIA…`
   - `Secret access key` → cadena larga
5. Guardarlos en un gestor de contraseñas antes de cerrar la ventana.

---

## 4. Configurar el perfil local

Abrir **PowerShell** y ejecutar:

```powershell
aws configure --profile solutions
```

Responder las cuatro preguntas:

| Pregunta | Qué escribir |
|---|---|
| `AWS Access Key ID` | la clave `AKIA…` |
| `AWS Secret Access Key` | el secreto guardado |
| `Default region name` | **`us-east-1`** (exactamente así) |
| `Default output format` | `json` |

### Comprobar que quedó bien

```powershell
aws sts get-caller-identity --profile solutions
```

Debe responder algo como:

```json
{
  "UserId": "AIDA...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/deploy-solutions"
}
```

Si aparece `deploy-solutions` en el `Arn`, está listo. ✅

---

## 5. Desplegar

```powershell
.\scripts\desplegar.ps1 -Perfil solutions -EmailAlertas "su-correo@dominio.com"
```

El script se encarga de todo:

1. Verifica las credenciales
2. Genera y guarda el secreto de firma de los JWT
3. Compila el frontend
4. Prepara la cuenta para CDK (*bootstrap*, solo la primera vez)
5. Despliega la infraestructura
6. Siembra los datos iniciales
7. Muestra la URL del portal

La primera ejecución tarda unos **10–15 minutos** porque CloudFront debe
propagarse por la red global. Los despliegues siguientes tardan 1–2 minutos.

---

## 6. Después del despliegue

### Confirmar la alerta de presupuesto
AWS envía un correo de confirmación de suscripción a la alerta. **Hay que
aceptarlo** para que las notificaciones lleguen.

### Revisar el gasto
Consola → **Billing and Cost Management** → *Free tier*. Ahí se ve el consumo
de cada servicio contra su límite gratuito.

### Cambiar los PIN por defecto
Los tres usuarios se crean con PIN `1234`. Antes de entregar al cliente,
entrar como `admin` → **Usuarios** y actualizarlos.

---

## 7. Trabajar con varias cuentas

El proyecto usa **perfiles nombrados** del AWS CLI, así que cambiar de cuenta
es cambiar un parámetro.

### Ver las cuentas configuradas

```powershell
.\scripts\cuentas.ps1
```

Muestra cada perfil con su número de cuenta, región y si las credenciales
siguen siendo válidas. Nunca imprime claves.

### Añadir una cuenta

```powershell
aws configure --profile <nombre>
```

### Desplegar en una u otra

```powershell
.\scripts\desplegar.ps1 -Perfil vicente     # cuenta de pruebas
.\scripts\desplegar.ps1 -Perfil solutions   # cuenta del cliente
```

El script muestra la identidad y el número de cuenta antes de desplegar, para
confirmar que no se está apuntando a la cuenta equivocada.

### ⚠️ Los datos no se mueven entre cuentas

Cada cuenta de AWS está aislada. Al desplegar en una cuenta nueva se crean una
tabla DynamoDB y un bucket S3 **vacíos**: los equipos, revisiones y fotos de
otra cuenta no se copian solos.

**Estrategia recomendada**

1. Probar la arquitectura en una cuenta personal con datos de prueba.
2. Cuando todo funcione, crear la cuenta definitiva de Solutions Machine.
3. Desplegar ahí desde cero y cargar allí los datos reales.

Si aun así hiciera falta migrar datos ya cargados:

```powershell
# Copiar los archivos de reportes y evidencias entre cuentas
aws s3 sync s3://<bucket-origen> ./respaldo --profile <origen>
aws s3 sync ./respaldo s3://<bucket-destino> --profile <destino>
```

Para DynamoDB, la vía simple es exportar los registros a JSON con un script y
volver a insertarlos en la tabla nueva.

---

## Preguntas frecuentes

**¿Me pueden cobrar sin darme cuenta?**
Con el plan Free no hay cobros: al agotarse los créditos la cuenta se
suspende en lugar de facturar. Además el stack crea una alerta que avisa al
80 % del tope definido.

**¿Cómo transfiero la cuenta al cliente?**
Consola → *Configuración de la cuenta* → cambiar el correo raíz y la
información de facturación. Los recursos y los datos no se tocan.

**¿Cómo elimino todo si quiero empezar de cero?**

```powershell
npm --prefix infra exec cdk -- destroy
```

La tabla de DynamoDB y el bucket de reportes tienen política `RETAIN`: **no se
borran** para proteger los datos. Si se desean eliminar, hay que hacerlo a mano
desde la consola.

**¿Y si pierdo el archivo `.env.deploy`?**
Solo implica que se generará un secreto nuevo y todos los usuarios deberán
iniciar sesión otra vez. No se pierde ningún dato.
