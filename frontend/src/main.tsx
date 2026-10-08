import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
// Conserva los enlaces anteriores de CloudFront, incluidos los de activación.
if (window.location.pathname !== basename && !window.location.pathname.startsWith(`${basename}/`)) {
  const { pathname, search, hash } = window.location
  window.history.replaceState(window.history.state, '', `${basename}${pathname}${search}${hash}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
