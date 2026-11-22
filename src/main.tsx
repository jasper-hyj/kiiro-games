import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './i18n'
import './games/mahjong/styles.css'
import './games/mahjong/parlour.css'
createRoot(document.getElementById('root')!).render(<LangProvider><App /></LangProvider>)
