import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ThemeProvider } from './lib/theme'
import { I18nProvider } from './lib/i18n'
import { AuthProvider } from './lib/auth'
import { DialogProvider } from './components/Dialog'
import { CartProvider } from './lib/guest'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <DialogProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </DialogProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
