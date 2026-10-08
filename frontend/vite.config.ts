import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * En producción, CloudFront publica el portal y la API en el mismo dominio.
 * Durante el desarrollo se reproduce ese esquema redirigiendo /api al entorno
 * desplegado, de modo que el código no necesita URLs distintas por entorno.
 *
 * Para apuntar a otro despliegue, defina VITE_API_ORIGIN en un archivo .env.local
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const destinoApi = env.VITE_API_ORIGIN ?? 'https://dyhxpji5c2d6x.cloudfront.net'

  return {
    base: '/appservices/',
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/appservices/api': {
          target: destinoApi,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
