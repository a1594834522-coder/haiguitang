import type { SceneDef } from '../types'
import { Scene } from './Scene'
import './scene.css'

function CardArt() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#2a1e1a,#050404_70%)]">
      <div className="absolute left-1/2 top-[18%] h-3 w-3 -translate-x-1/2 rounded-full bg-[#ffcf8a] shadow-[0_0_60px_30px_rgba(255,170,90,.25)]" />
    </div>
  )
}

export const generic: SceneDef = { Scene, accent: '#9a2a1f', CardArt }
