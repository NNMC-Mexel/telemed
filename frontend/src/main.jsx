import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const updateViewportVars = () => {
  if (typeof window === 'undefined') return
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`)
}

if (typeof window !== 'undefined' && !window.__telemedViewportBound) {
  window.__telemedViewportBound = true
  updateViewportVars()
  window.addEventListener('resize', updateViewportVars, { passive: true })
  window.visualViewport?.addEventListener('resize', updateViewportVars, { passive: true })
  window.visualViewport?.addEventListener('scroll', updateViewportVars, { passive: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
