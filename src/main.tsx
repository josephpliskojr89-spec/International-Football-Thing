import React from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import './ui/components.css'
import { App } from './ui/App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
