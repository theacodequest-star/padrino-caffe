import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'

export type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (load('padrino.theme') === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    save('padrino.theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
