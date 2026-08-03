import React from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import './ui/components.css'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
