import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../audio/engine'
import type { SceneProps } from '../types'
import { Backdrop } from './Backdrop'
import { Inspect, type InspectTarget } from './Closeups'
import { CamoPattern, Elder, Facing, GirlBack, Sitter, Stander } from './Figure'
import { heatOf } from './time'
import './scene.css'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// 角落里那一排：在操场右边的远角
const LINE_N = 40
const LINE_Y = 540
const lineX = (i: number) => 1340 - i * 6.4

export function Scene({ milestones, questionCount, thinking, idle, paused, cue }: SceneProps) {
  const has = (m: string) => milestones.includes(m)
  const dead = has('dead')
  const voice = has('voice')
  const post = has('post')
  const girl = has('girl')
  const line = has('line')
  const right = has('right')
  const chief = has('chief')
  const heat = heatOf(questionCount)
  const dread = Math.min(1, milestones.length / 7)

  const [freeze, setFreeze] = useState(false)
  const [blackout, setBlackout] = useState(0)
  const [hush, setHush] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const live = useRef({ paused, heat, hushUntil: 0 })
  live.current.paused = paused
  live.current.heat = heat
  const cicadaLevel = () => 0.035 + live.current.heat * 0.035
  const hushFor = (ms: number) => {
    live.current.hushUntil = Date.now() + ms
    audio.setCicadas(0, true)
    setHush(true)
    setTimeout(() => {
      if (Date.now() < live.current.hushUntil - 50) return
      setHush(false)
      if (!live.current.paused) audio.setCicadas(cicadaLevel())
    }, ms)
  }

  // ---------- 环境声：蝉、风 ----------
  useEffect(() => {
    if (paused) {
      audio.stopAll()
      return
    }
    audio.startRoom(0.02)
    audio.startCicadas(cicadaLevel())
    return () => audio.stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  useEffect(() => {
    if (paused) return
    if (Date.now() > live.current.hushUntil) audio.setCicadas(cicadaLevel())
    audio.setDrone(Math.min(1, dread * 0.9 + questionCount / 50))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionCount, milestones.length, paused])

  // ---------- 远处别的连在操练，偶尔一声哨 ----------
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        if (!live.current.paused && Date.now() > live.current.hushUntil) audio.whistle({ vol: rand(0.05, 0.09), pan: rand(-0.8, 0.8), wet: 0.85 })
        loop()
      }, rand(28000, 60000))
    }
    loop()
    return () => clearTimeout(t)
  }, [])

  // ---------- 里程碑带来的变化 ----------
  const prev = useRef<string[] | null>(null)
  useEffect(() => {
    const before = prev.current
    prev.current = milestones
    if (!before) return // 首次加载（刷新恢复）不播放转场
    const added = milestones.filter(m => !before.includes(m))
    if (!added.length) return
    if (added.includes('dead')) {
      hushFor(3500)
      audio.sting()
    } else if (added.includes('voice')) {
      audio.whisper({ vol: 0.75, pan: 0.05 })
      setTimeout(() => audio.sting(), 500)
    } else if (added.includes('post')) {
      audio.whistle({ vol: 0.3 })
    } else if (added.includes('right')) {
      // 一整排人，一个接一个把头转过去
      for (let i = 0; i < 14; i++) setTimeout(() => audio.stamp(), 300 + i * 150)
      setTimeout(() => audio.sting(), 2600)
    } else if (added.includes('chief')) {
      audio.whistle({ long: true, vol: 0.36 })
      setTimeout(() => hushFor(6000), 1100)
      setTimeout(() => audio.sting(), 1300)
    } else {
      audio.sting()
    }
  }, [milestones])

  // ---------- 主持人的氛围指令 ----------
  useEffect(() => {
    if (!cue || paused) return
    const timers: ReturnType<typeof setTimeout>[] = []
    if (cue.id === 'whistle') {
      audio.whistle({ long: true, vol: 0.38 })
      audio.setCicadas(0, true)
      setFreeze(true)
      timers.push(
        setTimeout(() => {
          setFreeze(false)
          if (Date.now() > live.current.hushUntil) audio.setCicadas(cicadaLevel())
        }, 2800),
      )
    } else if (cue.id === 'heat') {
      setBlackout(b => b + 1)
      audio.thump({ vol: 0.35 })
      timers.push(setTimeout(() => audio.thump({ vol: 0.3 }), 280))
      if (!reduced)
        stageRef.current?.animate([{ filter: 'none' }, { filter: 'blur(3px) brightness(1.6)' }, { filter: 'blur(1px) brightness(.5)' }, { filter: 'none' }], {
          duration: 1600,
          easing: 'ease-out',
        })
    } else if (cue.id === 'silence') {
      hushFor(8000)
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.n])

  // ---------- 发呆太久：身后有人说话 ----------
  useEffect(() => {
    if (!idle || paused) return
    audio.whisper({ vol: 0.55, pan: 0.1 })
    const t = setTimeout(() => audio.whisper({ vol: 0.4, pan: 0.1 }), 1400)
    return () => clearTimeout(t)
  }, [idle, paused])

  // ---------- 凑近看 ----------
  const [inspect, setInspect] = useState<InspectTarget | null>(null)
  const [tip, setTip] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setTip(true), 4000)
    const b = setTimeout(() => setTip(false), 16000)
    return () => (clearTimeout(a), clearTimeout(b))
  }, [])
  const open = (t: InspectTarget) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setTip(false)
    setInspect(t)
  }

  // ---------- 偶尔眨一下眼 ----------
  const [blink, setBlink] = useState(0)
  useEffect(() => {
    if (reduced) return
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        if (!live.current.paused) setBlink(b => b + 1)
        loop()
      }, rand(9000, 26000))
    }
    loop()
    return () => clearTimeout(t)
  }, [reduced])

  // 树荫下的全连：每排的人数、位置固定
  const sitters = useMemo(() => {
    const out: { x: number; y: number; s: number; lean: number }[] = []
    const rows = [
      [586, 0.5, 40, 520],
      [612, 0.58, 20, 500],
      [644, 0.68, 0, 480],
      [684, 0.8, -20, 450],
    ] as const
    let k = 0
    for (const [y, s, x0, x1] of rows) {
      for (let x = x0; x <= x1; x += 64 * s) {
        k++
        out.push({ x: x + ((k * 37) % 11) - 5, y: y + ((k * 13) % 5) - 2, s, lean: ((k * 29) % 9) - 4 })
      }
    }
    return out
  }, [])

  const lineFolk = useMemo(
    () => Array.from({ length: LINE_N }, (_, i) => ({ x: lineX(i), girl: (i * 7) % 3 === 0, camo: i / (LINE_N - 1), dy: ((i * 11) % 3) - 1 })),
    [],
  )

  // 女生出现时，“我”退到她身后一排；向右看齐时，女生不在眼前了
  const showGirl = girl && !right
  // 身后有人：画面下沿压上来一层暗
  const presence = voice || girl

  return (
    <div className={`xy-root absolute inset-0 overflow-hidden ${thinking ? 'xy-thinking' : ''} ${freeze ? 'xy-freeze' : ''} ${hush ? 'xy-hush' : ''}`}>
      <div ref={stageRef} className="xy-stage absolute inset-0">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
            <CamoPattern id="xy-camo" />
            <CamoPattern id="xy-camo-big" scale={4.5} />
            <radialGradient id="xy-vignette" cx="0.5" cy="0.5" r="0.72">
              <stop offset="0.5" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#140804" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="xy-dread" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5b2414" />
              <stop offset="1" stopColor="#5b2414" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="xy-behind" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#0d0805" stopOpacity="0.85" />
              <stop offset="0.5" stopColor="#0d0805" stopOpacity="0.25" />
              <stop offset="1" stopColor="#0d0805" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="xy-brim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e2214" />
              <stop offset="1" stopColor="#3a4127" />
            </linearGradient>
            <filter id="xy-blur" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="xy-softshadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="xy-ghost" colorInterpolationFilters="sRGB" x="-20%" y="-10%" width="140%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.04" numOctaves="2" seed="3" result="n">
                <animate attributeName="seed" values="3;4;5;6;3" dur="1.6s" repeatCount="indefinite" calcMode="discrete" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="saturate" values="0.2" />
            </filter>
            <filter id="xy-far" colorInterpolationFilters="sRGB" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.15" numOctaves="1" seed="9" />
              <feDisplacementMap in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="saturate" values="0.35" />
            </filter>
          </defs>

          {/* ===== “我”的视野：转头时整个往左移 ===== */}
          <g className="xy-world" style={{ transform: `translateX(${right ? -240 : 0}px)` }}>
            <g className="xy-breathe">
              <Backdrop />
              {/* 越往下推，天色越不对 */}
              <rect x="-300" width="2300" height="420" fill="url(#xy-dread)" style={{ opacity: dread * 0.45, mixBlendMode: 'multiply', transition: 'opacity 4s' }} />

              {/* 旗子 */}
              <g className="xy-flag">
                <path d="M1231 44 Q1270 36 1306 50 Q1338 60 1368 52 L1368 112 Q1338 120 1306 108 Q1270 96 1231 104 Z" fill="#b2261a" />
                <path d="M1231 44 Q1270 36 1306 50 Q1338 60 1368 52" stroke="#d64b32" strokeWidth="2" fill="none" opacity="0.6" />
              </g>

              {/* ===== 主席台上的人：就在正前方 ===== */}
              <Elder x={800} y={440} s={1.05} gaze={chief ? 0 : line ? 1 : 0} stare={chief} />
              <rect x="560" y="370" width="480" height="42" fill="#8a2318" />
              <path d="M560 370 L1040 370" stroke="#b0402c" strokeWidth="2.5" />
              <rect x="776" y="350" width="48" height="62" fill="#6f2b1e" />
              <path d="M800 350 L810 330" stroke="#222" strokeWidth="2" />
              <circle cx="811" cy="328" r="3.4" fill="#222" />

              {/* ===== 角落里那一排：操场右边的远角 ===== */}
              <g className="xy-line" style={{ opacity: line ? 1 : 0 }} filter="url(#xy-far)">
                {lineFolk.map((p, i) => (
                  <Stander
                    key={i}
                    camoId="xy-camo"
                    x={p.x}
                    y={LINE_Y + p.dy}
                    s={0.3}
                    camo={p.camo}
                    girl={p.girl}
                    shadow={0}
                    // 最右边那个人不用转头
                    turn={right && i > 0 ? 1 : 0}
                    turnDelay={right ? 0.25 + i * 0.12 : 0}
                    opacity={0.72}
                  />
                ))}
                {/* 最左边空着一个位置 */}
                {girl && <ellipse cx={lineX(LINE_N) - 2} cy={LINE_Y + 1} rx="3" ry="1" fill="#f2efe0" opacity="0.7" className="xy-empty" />}
              </g>

              {/* ===== 树荫下的全连 ===== */}
              {sitters.map((p, i) => (
                <Sitter key={i} camoId="xy-camo" x={p.x} y={p.y} s={p.s} lean={p.lean} />
              ))}
              {/* 教官站在树荫边上，招手叫“我”过去 */}
              <Facing camoId="xy-camo" x={560} y={652} s={0.82} wave={!dead} />
              {/* 点名册放在小马扎上 */}
              <g transform="translate(610 690) scale(1.3)">
                <path d="M-14 0 L14 -12 M14 0 L-14 -12" stroke="#3b2d1d" strokeWidth="2" />
                <rect x="-16" y="-15" width="32" height="4" fill="#4a3824" />
                <rect x="-9" y="-24" width="18" height="10" fill="#d9d3bd" transform="rotate(-8)" />
                <rect x="-3" y="-26" width="6" height="2.5" fill="#777" transform="rotate(-8)" />
              </g>

              {/* 热浪从地面往上冒 */}
              <g className="xy-shimmer" style={{ opacity: 0.25 + heat * 0.55 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <path key={i} style={{ animationDelay: `${i * -1.1}s` }} d={`M${640 + i * 130} 840 q 18 -50 0 -100 q -18 -50 0 -100 q 18 -50 0 -100`} stroke="#fff8e4" strokeOpacity="0.14" strokeWidth="40" fill="none" />
                ))}
              </g>

              {/* ===== 脚下：自己的定位点、自己的影子 ===== */}
              <ellipse cx="800" cy="892" rx="120" ry="22" fill={post ? '#a3170d' : '#f3f0e2'} opacity={post ? 0.85 : 0.4} style={{ transition: 'fill 2s, opacity 2s' }} />
              {/* 太阳在身后，影子投在眼前的地上 */}
              <g style={{ opacity: dead || showGirl ? 0 : 0.42, transition: 'opacity 4s ease' }} filter="url(#xy-softshadow)">
                <path d="M610 920 Q622 842 700 826 L744 818 Q752 790 758 774 Q742 768 740 750 Q738 712 800 706 Q862 712 860 750 Q858 768 842 774 Q848 790 856 818 L900 826 Q978 842 990 920 Z" fill="#1b1a10" />
                <path d="M730 728 L870 728 L884 736 L716 736 Z" fill="#1b1a10" />
              </g>
              {/* 地上的旧水壶 */}
              <g transform="translate(1060 812) scale(3)">
                <ellipse cx="0" cy="2" rx="11" ry="2.5" fill="#000" opacity="0.3" />
                <path d="M-8 0 Q-9 -14 -4 -18 L4 -18 Q9 -14 8 0 Z" fill="#6a6f4c" />
                <rect x="-3" y="-23" width="6" height="5" fill="#3a3a30" />
                <path d="M-6 -12 Q0 -14 6 -12" stroke="#c8c3a8" strokeOpacity="0.4" fill="none" />
                <path d="M-8 -10 Q-16 -4 -14 2" stroke="#4a4630" strokeWidth="1.2" fill="none" />
              </g>

              {/* ===== 女生，就在“我”眼前 ===== */}
              <g className="xy-girl" style={{ opacity: showGirl ? 1 : 0 }}>
                <GirlBack camoId="xy-camo-big" cx={690} top={300} className="xy-standing" />
              </g>

              {/* ===== 向右看齐：“我”右边那个人 ===== */}
              <g className="xy-neighbor" style={{ opacity: right ? 0.5 : 0 }} filter="url(#xy-ghost)">
                <Stander camoId="xy-camo" x={1400} y={1660} s={9} camo={0.35} shadow={0} turn={1} turnDelay={2.2} />
              </g>

              {/* 可以凑近看的东西 */}
              <g>
                <rect className="xy-hot" x="740" y="262" width="120" height="110" onClick={open('chief')} />
                <rect className="xy-hot" x="580" y="650" width="64" height="48" onClick={open('roster')} />
                <rect className="xy-hot" x="1026" y="734" width="70" height="86" onClick={open('canteen')} />
              </g>
            </g>
          </g>

          {/* ===== 下面这些跟着头走，不随视野移动 ===== */}
          {/* 身后有人 */}
          <rect y="560" width="1600" height="340" fill="url(#xy-behind)" className="xy-presence" style={{ opacity: presence ? 1 : 0 }} pointerEvents="none" />
          {/* 白得晃眼 + 越晒视野越窄 */}
          <rect width="1600" height="900" fill="#fff8e6" style={{ opacity: heat * 0.12 }} pointerEvents="none" />
          <rect width="1600" height="900" fill="url(#xy-vignette)" style={{ opacity: 0.4 + heat * 0.15 + dread * 0.4, transition: 'opacity 4s' }} pointerEvents="none" />
          {/* 帽檐 */}
          <g pointerEvents="none">
            <path d="M-100 0 L1700 0 L1700 58 Q800 150 -100 58 Z" fill="url(#xy-brim)" filter="url(#xy-blur)" />
            <path d="M-100 0 L1700 0 L1700 40 Q800 124 -100 40 Z" fill="url(#xy-camo)" opacity="0.35" filter="url(#xy-blur)" />
          </g>
        </svg>
      </div>

      {/* 眨眼 */}
      {blink > 0 && <div key={`b${blink}`} className="xy-blink pointer-events-none absolute inset-0" />}

      {/* 眼前一黑 */}
      {blackout > 0 && <div key={blackout} className="xy-blackout pointer-events-none absolute inset-0" />}

      {/* 发呆太久 */}
      <p className={`xy-hand pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 text-2xl text-[#3a1a10] transition-opacity duration-[2500ms] ${idle && !paused ? 'opacity-60' : 'opacity-0'}`}>
        谁都不许动。
      </p>

      <p className={`pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] tracking-[.35em] text-[#3d2a1a]/70 transition-opacity duration-1000 ${tip ? 'opacity-100' : 'opacity-0'}`}>
        · 场景里的东西，可以点开凑近看 ·
      </p>

      {inspect && <Inspect target={inspect} milestones={milestones} onClose={() => setInspect(null)} />}
    </div>
  )
}
