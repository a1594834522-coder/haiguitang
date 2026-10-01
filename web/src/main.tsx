import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 字体本地托管，不依赖 Google Fonts；异步加载，不阻塞首屏
void import('./fonts.ts')
import { Game } from './components/Game'
import { Lobby } from './components/Lobby'
import { usePath } from './router'
import './styles.css'

function App() {
  const path = usePath()
  const m = path.match(/^\/soup\/([a-z0-9-]+)\/?$/)
  if (m) return <Game key={m[1]} storyId={m[1]} />
  return <Lobby />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
