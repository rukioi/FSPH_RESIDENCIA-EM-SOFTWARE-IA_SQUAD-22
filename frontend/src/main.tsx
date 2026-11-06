import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { telaPreviewSvo } from './features/svo/preview'
import './shared/styles/tema.css'

const elementoRaiz = document.getElementById('root')

if (!elementoRaiz) {
  throw new Error('Elemento raiz não encontrado.')
}

const reactRoot = createRoot(elementoRaiz)

async function iniciar() {
  if (import.meta.env.DEV && telaPreviewSvo(window.location.pathname)) {
    const { PreviewSvo } = await import('./features/svo/PreviewSvo')

    reactRoot.render(
      <StrictMode>
        <PreviewSvo />
      </StrictMode>,
    )

    return
  }

  const { App } = await import('./app/App')

  reactRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void iniciar()
