import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'

import './index.css'
import i18n from './i18n'
import App from './App.tsx'
import { restoreAutosave, startAutosave } from './project/autosave.ts'
import { Providers } from './providers.tsx'

// Restore before the first render so a saved project doesn't flash the welcome screen.
const restored = restoreAutosave()
startAutosave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)

void restored.then((result) => {
  if (result === 'failed') toast.error(i18n.t('errors.restoreFailed'))
})
