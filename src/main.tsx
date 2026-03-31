import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, getStoredTheme } from './hooks/use-theme'
import { App } from './app'

// Apply saved theme before first paint
applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
