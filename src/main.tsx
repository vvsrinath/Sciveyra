/// <reference types="vite/client" />
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { AppProvider } from './app/AppContext'
import './styles/tailwind.css'
import './styles/index.css'

// Offline support is production-only so the dev server and HMR stay untouched.
if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Progressive enhancement: a failed registration must never break the app.
    })
  }
  if (document.readyState === 'complete') registerServiceWorker()
  else window.addEventListener('load', registerServiceWorker, { once: true })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
)
