import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'

/**
 * Envío de correos con Amazon SES.
 *
 * Mientras la cuenta esté en el entorno de pruebas de SES, solo se puede
 * escribir a direcciones verificadas. Por eso ninguna operación depende de
 * que el correo llegue: si falla, quien crea el usuario recibe el enlace en
 * pantalla para entregarlo por otro medio.
 */

const REMITENTE = process.env.EMAIL_REMITENTE ?? ''
const URL_PORTAL = process.env.URL_PORTAL ?? ''

const ses = new SESv2Client({})

export const correoConfigurado = () => Boolean(REMITENTE)

interface ResultadoEnvio {
  enviado: boolean
  motivo?: string
}

async function enviar(
  destino: string,
  asunto: string,
  html: string,
  texto: string,
): Promise<ResultadoEnvio> {
  if (!REMITENTE) return { enviado: false, motivo: 'SES no está configurado' }
  if (!destino) return { enviado: false, motivo: 'El usuario no tiene correo' }

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: REMITENTE,
        Destination: { ToAddresses: [destino] },
        Content: {
          Simple: {
            Subject: { Data: asunto, Charset: 'UTF-8' },
            Body: {
              Html: { Data: html, Charset: 'UTF-8' },
              Text: { Data: texto, Charset: 'UTF-8' },
            },
          },
        },
      }),
    )
    return { enviado: true }
  } catch (e) {
    // El alta del usuario no debe fallar porque el correo no salga.
    console.error('No se pudo enviar el correo', { destino, error: e })
    return {
      enviado: false,
      motivo: e instanceof Error ? e.message : 'Error desconocido al enviar',
    }
  }
}

export function enlaceActivacion(token: string) {
  return `${URL_PORTAL}/activar/${token}`
}

export async function enviarInvitacion(
  destino: string,
  nombre: string,
  token: string,
  esRestablecimiento = false,
): Promise<ResultadoEnvio> {
  const enlace = enlaceActivacion(token)
  const titulo = esRestablecimiento
    ? 'Restablezca su PIN de acceso'
    : 'Active su cuenta en Solutions Machine'
  const intro = esRestablecimiento
    ? 'Se solicitó restablecer el PIN de su cuenta.'
    : 'Se ha creado una cuenta para usted en el portal de Solutions Machine.'

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background:#0a0a0c;padding:24px;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Solutions Machine</p>
          <p style="margin:4px 0 0;color:#a1a1aa;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Gestión de activos</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;">
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#18181b;">Hola, ${nombre}</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#52525b;">
            ${intro} Para continuar, defina su PIN de acceso de cuatro dígitos.
          </p>
          <a href="${enlace}"
             style="display:inline-block;background:#d21f30;color:#ffffff;text-decoration:none;
                    padding:12px 28px;border-radius:12px;font-size:14px;font-weight:700;">
            ${esRestablecimiento ? 'Restablecer mi PIN' : 'Definir mi PIN'}
          </a>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a;">
            Este enlace caduca en 48 horas y solo puede usarse una vez.
            Si no esperaba este mensaje, puede ignorarlo.
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;word-break:break-all;">
            Si el botón no funciona, copie esta dirección en su navegador:<br />${enlace}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const texto = `Hola, ${nombre}

${intro} Para continuar, defina su PIN de acceso de cuatro dígitos:

${enlace}

Este enlace caduca en 48 horas y solo puede usarse una vez.`

  return enviar(destino, titulo, html, texto)
}
