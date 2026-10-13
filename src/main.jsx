import React from 'react'
import {BrowserRouter} from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

// Phones: keep --app-height equal to the part of the screen the keyboard leaves free.
// Android shrinks the page by itself (see the viewport tag), iOS slides it up instead
const viewport = window.visualViewport
if (viewport && window.matchMedia('(pointer: coarse)').matches) {
  const syncHeight = () => {
    // a pinch zoom also changes the size, that is not the keyboard
    if (viewport.scale > 1.01) return
    document.documentElement.style.setProperty('--app-height', `${Math.round(viewport.height)}px`)
    window.scrollTo(0, 0)
  }
  viewport.addEventListener('resize', syncHeight)
  syncHeight()
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
)
