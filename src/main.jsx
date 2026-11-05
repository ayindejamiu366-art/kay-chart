import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { I18nProvider } from './context/I18nContext'
import './index.css'

// Render first, talk to native plugins second.
//
// The UI used to be mounted only after awaiting StatusBar/SplashScreen calls.
// On a device that is a trap: the splash background (#0A0A0F) is what the
// WebView shows before first paint, so if any of those calls is slow, rejects
// in a way the catch cannot recover, or never settles, the app is left showing a
// blank black screen with no error. Mounting synchronously guarantees pixels;
// plugin setup then only adjusts chrome around an app that already works.
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
)

// If anything above throws during the first render, replace the empty screen
// with something the user (or a logcat read) can actually see, instead of the
// near-black background.
window.addEventListener('error', event => {
  if (document.getElementById('root')?.childElementCount) return
  showBootFailure(event?.message || 'Unknown startup error')
})
window.addEventListener('unhandledrejection', event => {
  if (document.getElementById('root')?.childElementCount) return
  showBootFailure(event?.reason?.message || String(event?.reason || 'Unhandled promise rejection'))
})

function showBootFailure(message) {
  const target = document.getElementById('root')
  if (!target) return
  target.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.setAttribute('style', 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0A0A0F;color:#D6FF3D;font-family:system-ui,sans-serif')
  const box = document.createElement('div')
  box.setAttribute('style', 'max-width:32rem;text-align:center')
  const title = document.createElement('h1')
  title.textContent = 'Kay Chart could not start'
  title.setAttribute('style', 'font-size:1.125rem;margin:0 0 8px')
  const detail = document.createElement('p')
  detail.textContent = String(message)
  detail.setAttribute('style', 'font-size:0.875rem;color:#9AA0A6;margin:0 0 16px;word-break:break-word')
  const retry = document.createElement('button')
  retry.textContent = 'Retry'
  retry.setAttribute('style', 'padding:10px 20px;border-radius:999px;background:#D6FF3D;color:#0A0A0F;border:0;font-weight:600;cursor:pointer')
  retry.addEventListener('click', () => window.location.reload())
  box.append(title, detail, retry)
  wrap.append(box)
  target.append(wrap)
  console.error('[KayChart] Startup failure:', message)
}

async function setupNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    // Each plugin is optional. A failure must never take the app down, so each
    // is isolated and the splash hide is always attempted.
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      // setBackgroundColor is iOS-only; on Android it can reject.
      await StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {})
    } catch { /* status bar is cosmetic */ }

    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    } catch { /* auto-hides after launchShowDuration */ }

    try {
      const { App } = await import('@capacitor/app')
      await App.addListener('appStateChange', () => {})
      await App.addListener('backButton', ({ canGoBack }) => {
        if (window.history.length > 1) {
          window.history.back()
        } else {
          App.minimizeApp()
        }
      })
    } catch { /* back button falls back to platform default */ }
  } catch (err) {
    // Not running in a Capacitor environment (plain web browser).
  }
}

setupNative()
