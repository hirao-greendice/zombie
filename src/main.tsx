import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/orbitron/500.css'
import '@fontsource/orbitron/800.css'
import '@fontsource/share-tech-mono/400.css'
import './styles/theme.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
