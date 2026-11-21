import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('service-worker.js', new URL(import.meta.env.BASE_URL, window.location.href))
    navigator.serviceWorker.register(serviceWorkerUrl).catch(error => {
      console.warn('Não foi possível registrar o modo offline.', error)
    })
  })
}
