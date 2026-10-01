import { useEffect, useMemo, useState } from 'react'
import { audio } from '../../audio/engine'
import type { SceneProps } from '../types'

/** 没有专属布景的汤使用的通用场景：浓雾、一盏摇晃的灯、漂浮的尘埃。 */
export function Scene({ milestones, questionCount, thinking, paused, cue }: SceneProps) {
  const [jolt, setJolt] = useState(false)
  useEffect(() => {
    if (!cue || paused) return
    if (cue.id === 'knock') audio.thump({ vol: 1 })
    if (cue.id === 'silence') audio.setDrone(0)
    setJolt(true)
    const t = setTimeout(() => setJolt(false), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.n])

  useEffect(() => {
    if (paused) {
      audio.stopAll()
      return
    }
    audio.startRoom(0.05)
    return () => audio.stopAll()
  }, [paused])

  useEffect(() => {
    if (!paused) audio.setDrone(Math.min(1, milestones.length / 5 + questionCount / 40))
  }, [milestones.length, questionCount, paused])

  const prev = useMemo(() => ({ n: milestones.length }), [])
  useEffect(() => {
    if (milestones.length > prev.n) audio.sting()
    prev.n = milestones.length
  }, [milestones.length, prev])

  const motes = useMemo(() => Array.from({ length: 40 }, () => ({ l: Math.random() * 100, t: Math.random() * 100, d: 10 + Math.random() * 20, s: 1 + Math.random() * 2 })), [])
  const heat = Math.min(1, milestones.length / 5)

  return (
    <div className={`gs-root absolute inset-0 overflow-hidden ${thinking || jolt ? 'gs-thinking' : ''}`} style={{ ['--heat' as string]: heat }}>
      <div className="gs-fog gs-fog-a" />
      <div className="gs-fog gs-fog-b" />
      <div className="gs-lamp" />
      {motes.map((m, i) => (
        <span key={i} className="gs-mote" style={{ left: `${m.l}%`, top: `${m.t}%`, width: m.s, height: m.s, animationDuration: `${m.d}s`, animationDelay: `${-m.d * Math.random()}s` }} />
      ))}
      <div className="gs-vignette" />
    </div>
  )
}
