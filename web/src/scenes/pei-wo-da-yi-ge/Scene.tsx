import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../audio/engine'
import type { SceneProps } from '../types'
import { Backdrop } from './Backdrop'
import { Inspect, type InspectTarget } from './Closeups'
import { Portrait } from './Portrait'
import { DAWN_Q, FATHER_Q, dawnProgress, gameMinutes } from './time'
import './scene.css'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const mix = (a: string, b: string, t: number) => {
  const pa = a.match(/\w\w/g)!.map(h => parseInt(h, 16))
  const pb = b.match(/\w\w/g)!.map(h => parseInt(h, 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

type Lamp = 'on' | 'dying' | 'off'

export function Scene({ milestones, questionCount, thinking, idle, paused, cue }: SceneProps) {
  const has = (m: string) => milestones.includes(m)
  const funeral = has('funeral') || has('coffin')
  const coffin = has('coffin')
  const knockKnown = has('knock')
  const fatherKnown = has('father')
  const cycle = has('cycle')
  const dawn = dawnProgress(questionCount)
  const isDawn = questionCount >= DAWN_Q

  const [lamp, setLamp] = useState<Lamp>(funeral ? 'off' : 'on')
  const [flick, setFlick] = useState(false)
  const [score, setScore] = useState({ me: 0, ye: 0 })
  const [pingKey, setPingKey] = useState(0)
  const [thumpKey, setThumpKey] = useState(0)
  const [fatherVisit, setFatherVisit] = useState(false)
  const [flash, setFlash] = useState(0)
  const [gust, setGust] = useState(false)
  const [hush, setHush] = useState(false)
  const svgRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<SVGGElement>(null)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const shake = () => {
    if (reduced) return
    svgRef.current?.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }],
      { duration: 520, easing: 'ease-out' },
    )
  }
  const thud = (strength = 1) => {
    if (reduced) return
    boxRef.current?.animate(
      [{ transform: 'translate(0,0)' }, { transform: `translate(0,${-2.5 * strength}px)` }, { transform: `translate(${strength}px,0)` }, { transform: 'translate(0,0)' }],
      { duration: 220, easing: 'ease-out' },
    )
  }

  // 用 ref 把最新状态喂给长期运行的定时器，避免定时器随渲染重建
  const live = useRef({ questionCount, paused, isDawn, unanswered: 0, silentUntil: 0 })
  live.current.questionCount = questionCount
  live.current.paused = paused
  live.current.isDawn = isDawn

  // ---------- 环境声 ----------
  useEffect(() => {
    if (paused) {
      audio.stopAll()
      return
    }
    audio.startRoom(0.045)
    if (lamp === 'on') audio.startHum()
    return () => audio.stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  useEffect(() => {
    if (!paused) audio.setDrone(Math.min(1, milestones.length / 6 + questionCount / 40))
  }, [milestones.length, questionCount, paused])

  // ---------- 乒……咚 ----------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const loop = (first = false) => {
      const q = live.current.questionCount
      const wait = first ? 2600 : 5200 + q * 320 + rand(0, 2600)
      timer = setTimeout(() => {
        if (stopped) return
        const L = live.current
        // 天亮后：“我”又敲了几下，没有回应，然后就不敲了
        if (L.isDawn && L.unanswered >= 3) return loop()
        if (!L.paused && Date.now() >= L.silentUntil) {
          audio.ping({ pan: -0.05, vol: 0.85 })
          setScore(s => ({ ...s, me: s.me + 1 }))
          setPingKey(k => k + 1)
          if (L.isDawn) {
            L.unanswered++
          } else {
            const delay = 650 + q * 55 + rand(0, 350)
            const vol = Math.max(0.12, 1 - q / 23)
            setTimeout(() => {
              if (stopped || live.current.paused) return
              audio.thump({ vol, pan: 0.04 })
              setScore(s => ({ ...s, ye: s.ye + 1 }))
              setThumpKey(k => k + 1)
              thud(vol)
            }, delay)
          }
        }
        loop()
      }, wait)
    }
    loop(true)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [])

  // ---------- 日光灯偶尔闪一下 ----------
  useEffect(() => {
    if (lamp !== 'on') return
    let t: ReturnType<typeof setTimeout>
    const next = () => {
      t = setTimeout(() => {
        setFlick(true)
        audio.flicker()
        setTimeout(() => setFlick(false), 260)
        next()
      }, rand(4000, 13000))
    }
    next()
    return () => clearTimeout(t)
  }, [lamp])

  // ---------- 里程碑：布景异变 ----------
  const prevMilestones = useRef(milestones)
  useEffect(() => {
    const prev = prevMilestones.current
    prevMilestones.current = milestones
    const added = milestones.filter(m => !prev.includes(m))
    if (!added.length) return

    if ((added.includes('funeral') || added.includes('coffin')) && lamp === 'on') {
      setLamp('dying')
      audio.flicker()
      setTimeout(() => audio.flicker(), 500)
      setTimeout(() => {
        audio.stopHum()
        setLamp('off')
      }, 1800)
    }
    if (added.includes('help')) {
      setTimeout(() => {
        audio.thump({ vol: 1 })
        audio.whisper({ vol: 0.7 })
        setFlash(f => f + 1)
        shake()
        thud(2)
      }, 400)
    } else if (added.includes('father')) {
      audio.creak({ pan: -0.6 })
      setTimeout(() => audio.sting(), 600)
    } else {
      audio.sting()
      if (added.includes('coffin')) setTimeout(() => audio.thump({ vol: 1 }), 900)
    }
  }, [milestones, lamp])

  // ---------- 主持人的氛围指令 ----------
  useEffect(() => {
    if (!cue || paused) return
    const timers: ReturnType<typeof setTimeout>[] = []
    if (cue.id === 'knock') {
      timers.push(
        setTimeout(() => {
          audio.thump({ vol: 1 })
          setScore(s => ({ ...s, ye: s.ye + 1 }))
          setThumpKey(k => k + 1)
          thud(2.4)
        }, 700),
      )
    } else if (cue.id === 'flicker') {
      if (lamp === 'on') {
        setFlick(true)
        audio.flicker()
        timers.push(setTimeout(() => audio.flicker(), 180), setTimeout(() => setFlick(false), 600))
      } else {
        setGust(true)
        timers.push(setTimeout(() => setGust(false), 1400))
      }
    } else if (cue.id === 'silence') {
      live.current.silentUntil = Date.now() + 9000
      audio.setDrone(0)
      setHush(true)
      timers.push(
        setTimeout(() => {
          setHush(false)
          audio.setDrone(Math.min(1, milestones.length / 6 + questionCount / 40))
        }, 9000),
      )
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.n])

  // ---------- 半夜两点：门开了 ----------
  const prevQ = useRef(questionCount)
  useEffect(() => {
    const before = prevQ.current
    prevQ.current = questionCount
    if (before < FATHER_Q && questionCount >= FATHER_Q && !fatherKnown) {
      audio.creak({ pan: -0.6 })
      setFatherVisit(true)
      const t = setTimeout(() => {
        audio.creak({ pan: -0.6, vol: 0.3, closing: true })
        setFatherVisit(false)
      }, 7500)
      return () => clearTimeout(t)
    }
  }, [questionCount, fatherKnown])

  // ---------- 发呆太久：重重的两下 ----------
  useEffect(() => {
    if (!idle || paused || isDawn) return
    audio.thump({ vol: 1 })
    thud(2)
    const t = setTimeout(() => {
      audio.thump({ vol: 1 })
      thud(2)
    }, 260)
    shake()
    return () => clearTimeout(t)
  }, [idle, paused, isDawn])

  const sky = dawn < 0.5 ? mix('05070d', '141b30', dawn * 2) : mix('141b30', '56657f', (dawn - 0.5) * 2)
  const mins = gameMinutes(questionCount)
  const hourDeg = ((mins / 60) % 12) * 30
  const minDeg = (mins % 60) * 6
  const doorOpen = fatherVisit || fatherKnown
  const showCandle = lamp !== 'on'

  const dust = useMemo(
    () => Array.from({ length: 26 }, () => ({ x: rand(580, 1020), y: rand(280, 600), r: rand(0.7, 1.8), d: rand(9, 20), delay: rand(-20, 0) })),
    [],
  )
  // 地上散落的纸钱（位置固定）
  const floorPaper = useMemo(() => {
    let k = 5
    const r = () => ((k = (k * 16807) % 2147483647) - 1) / 2147483646
    return Array.from({ length: 16 }, () => ({ x: 380 + r() * 860, y: 700 + r() * 180, rot: r() * 180, s: 0.7 + r() * 0.5 }))
  }, [])

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

  // 整体有多黑：日光灯下 / 只剩烛火 / 天快亮
  const darkness = Math.max(0.3, (showCandle ? 0.82 : 0.6) - dawn * 0.3)
  const paddle = coffin ? 'translate(790px, 534px) rotate(-6deg)' : 'translate(812px, 624px) rotate(-3deg) scale(1, .7)'

  return (
    <div className={`pw-root absolute inset-0 overflow-hidden ${thinking ? 'pw-thinking' : ''} ${gust ? 'pw-gust' : ''} ${hush ? 'pw-hush' : ''}`}>
      <div ref={svgRef} className="pw-stage absolute inset-0">
        <Backdrop sky={sky} dawn={dawn} hourDeg={hourDeg} minDeg={minDeg} />

        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="pw-cone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4f2ea" stopOpacity="0.16" />
              <stop offset="1" stopColor="#e4f2ea" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="pw-pool">
              <stop offset="0" stopColor="#d9efe4" stopOpacity="0.16" />
              <stop offset="1" stopColor="#d9efe4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pw-candle">
              <stop offset="0" stopColor="#ffbe7a" stopOpacity="0.55" />
              <stop offset="0.25" stopColor="#ff8a33" stopOpacity="0.18" />
              <stop offset="1" stopColor="#ff6a10" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pw-hole">
              <stop offset="0" stopColor="#000" stopOpacity="1" />
              <stop offset="0.55" stopColor="#000" stopOpacity="0.7" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pw-lacquer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e0705" />
              <stop offset="0.6" stopColor="#2c0a07" />
              <stop offset="1" stopColor="#40120b" />
            </linearGradient>
            <linearGradient id="pw-lid" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3a100b" />
              <stop offset="0.5" stopColor="#250806" />
              <stop offset="1" stopColor="#1a0504" />
            </linearGradient>
            <linearGradient id="pw-cloth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24221e" />
              <stop offset="1" stopColor="#77705f" />
            </linearGradient>
            <radialGradient id="pw-wallwash" cx="0.44" cy="1" r="0.8">
              <stop offset="0" stopColor="#ff8a3a" stopOpacity="0.22" />
              <stop offset="1" stopColor="#ff8a3a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pw-doorlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24190e" />
              <stop offset="1" stopColor="#0d0906" />
            </linearGradient>
            <linearGradient id="pw-spill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c28a4a" stopOpacity="0.32" />
              <stop offset="1" stopColor="#c28a4a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pw-altar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a140b" />
              <stop offset="1" stopColor="#120805" />
            </linearGradient>
            <linearGradient id="pw-flame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#5a7cff" stopOpacity="0.8" />
              <stop offset="0.18" stopColor="#ffd27a" />
              <stop offset="0.7" stopColor="#ff9a2e" />
              <stop offset="1" stopColor="#ff6a10" stopOpacity="0.2" />
            </linearGradient>
            <radialGradient id="pw-vignette" cx="0.5" cy="0.6" r="0.66">
              <stop offset="0.35" stopColor="#000" stopOpacity="0" />
              <stop offset="0.8" stopColor="#000" stopOpacity="0.5" />
              <stop offset="1" stopColor="#000" stopOpacity="0.95" />
            </radialGradient>
            <filter id="pw-woodgrain" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.003 0.11" numOctaves="3" seed="12" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.02  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.4" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <filter id="pw-blur" colorInterpolationFilters="sRGB" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="pw-soft" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <filter id="pw-big-blur" colorInterpolationFilters="sRGB" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <symbol id="pw-coin" viewBox="0 0 20 20">
              <path fillRule="evenodd" fill="#a2946c" d="M10 0a10 10 0 1 1 0 20a10 10 0 1 1 0-20zM7.5 7.5v5h5v-5z" />
            </symbol>
            {/* 黑暗：只有光源附近能看清 */}
            <mask id="pw-dark" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
              <rect width="1600" height="900" fill="#fff" />
              {lamp !== 'off' && (
                <g className={`pw-lamp pw-lamp-${lamp} ${flick ? 'pw-flick' : ''}`}>
                  <ellipse className="pw-tube" cx="800" cy="560" rx="560" ry="360" fill="url(#pw-hole)" />
                </g>
              )}
              {showCandle && <ellipse className="pw-glow" cx="700" cy="690" rx="640" ry="440" fill="url(#pw-hole)" />}
              {doorOpen && <ellipse cx="400" cy="560" rx="230" ry="280" fill="url(#pw-hole)" opacity="0.85" />}
              <g opacity={0.45 + dawn * 0.5}>
                {[120, 400, 1040, 1320].map(x => (
                  <rect key={x} x={x} y="62" width="160" height="138" fill="#000" />
                ))}
              </g>
              {dawn > 0 && <rect width="1600" height="900" fill="#000" opacity={dawn * 0.35} />}
            </mask>
          </defs>

          {/* ===== 葬礼布置：奠、挽联 ===== */}
          <g className="pw-fade" style={{ opacity: funeral ? 1 : 0 }}>
            <line x1="560" y1="232" x2="1040" y2="232" stroke="#141310" strokeWidth="2" />
            <g className="pw-cloth">
              <rect x="722" y="248" width="156" height="152" fill="url(#pw-cloth)" />
              <path d="M722 248 v152 M878 248 v152" stroke="#000" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M760 248 q4 76 -2 152 M840 248 q-4 76 2 152" stroke="#000" strokeOpacity="0.08" strokeWidth="6" fill="none" />
              <text x="800" y="358" textAnchor="middle" fontSize="108" fontWeight="900" fill="#050505" opacity="0.88" className="pw-serif">
                奠
              </text>
            </g>
            {[
              [598, '驾鹤别球台'],
              [956, '执拍四十载'],
            ].map(([x, t], j) => (
              <g key={x as number} className="pw-cloth" style={{ animationDelay: `${j * -2.7}s` }}>
                <rect x={x as number} y="236" width="46" height="252" fill="url(#pw-cloth)" />
                <path d={`M${(x as number) + 12} 236 q3 120 -1 252`} stroke="#000" strokeOpacity="0.1" strokeWidth="5" fill="none" />
                {(t as string).split('').map((c, i) => (
                  <text key={i} x={(x as number) + 23} y={278 + i * 45} textAnchor="middle" fontSize="34" fill="#050505" opacity="0.85" className="pw-serif">
                    {c}
                  </text>
                ))}
              </g>
            ))}
          </g>

          {/* 烛光照亮墙面，投出一个巨大的、会晃的影子 */}
          <g className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }}>
            <rect className="pw-glow" x="0" y="0" width="1600" height="560" fill="url(#pw-wallwash)" />
            <path className="pw-wall-shadow" opacity="0.92" d="M440 470 Q800 396 1170 424 L1180 540 L430 540 Z" fill="#000" filter="url(#pw-big-blur)" />
          </g>

          {/* ===== 休息室的门 ===== */}
          <g transform="translate(330 0)">
            <rect x="-6" y="348" width="130" height="184" fill="#020202" />
            <rect x="-6" y="348" width="130" height="184" fill="none" stroke="#1b1a17" strokeWidth="3" />
            <g className="pw-door-inside" style={{ opacity: doorOpen ? 1 : 0 }}>
              <rect x="0" y="354" width="118" height="178" fill="url(#pw-doorlight)" />
              <g className={fatherKnown ? 'pw-father-stay' : ''}>
                <g fill="#010101" filter="url(#pw-soft)">
                  <ellipse cx="60" cy="383" rx="13" ry="16" transform="rotate(-6 60 383)" />
                  <rect x="55" y="396" width="10" height="10" />
                  <path d="M34 410 Q60 400 86 410 L90 470 L84 532 L66 532 L62 486 L58 532 L40 532 L34 470 Z" />
                  <path d="M34 412 Q27 450 31 488 L38 488 Q36 450 41 418 Z" />
                  <path d="M86 412 Q104 420 113 438 L108 446 Q98 430 84 425 Z" />
                  <rect x="108" y="434" width="8" height="14" rx="2" />
                </g>
                <path d="M48 378 Q46 392 52 399 M35 412 Q30 440 33 470" stroke="#a37a46" strokeOpacity="0.28" strokeWidth="1.2" fill="none" />
                {fatherKnown && (
                  <g className="pw-eyes">
                    <circle cx="55" cy="383" r="1.3" fill="#d9cfb6" />
                    <circle cx="65" cy="383" r="1.3" fill="#d9cfb6" />
                  </g>
                )}
              </g>
            </g>
            <g className="pw-door" style={{ transform: doorOpen ? `scaleX(${fatherKnown ? 0.3 : 0.16})` : 'scaleX(1)' }}>
              <rect x="0" y="354" width="118" height="178" fill="#0d0c0a" />
              <rect x="12" y="366" width="94" height="66" fill="none" stroke="#1d1b17" strokeWidth="2" />
              <rect x="12" y="444" width="94" height="76" fill="none" stroke="#1d1b17" strokeWidth="2" />
              <rect x="34" y="384" width="50" height="20" fill="#18160f" />
              <text x="59" y="399" textAnchor="middle" fontSize="13" fill="#57524a" className="pw-serif">
                休息室
              </text>
              <circle cx="104" cy="448" r="3.5" fill="#24221d" />
            </g>
            {!doorOpen && <rect x="0" y="529" width="118" height="3" fill="#3a2a14" opacity="0.35" />}
            {/* 门口的鞋 */}
            <g fill="#050505">
              <path d="M-2 536 q6 -8 20 -7 q8 1 9 6 z" />
              <path d="M22 540 q6 -8 20 -7 q8 1 9 6 z" />
              <path d="M70 537 q5 -7 16 -6 q7 1 8 5 z" transform="rotate(10 80 536)" />
              <path d="M96 541 q6 -8 20 -7 q8 1 9 6 z" />
            </g>
          </g>
          {/* 门里的光洒在地上，拖着一道人影 */}
          <g className="pw-fade" style={{ opacity: doorOpen ? 1 : 0 }}>
            <polygon points="336,532 446,532 540,720 230,720" fill="url(#pw-spill)" filter="url(#pw-soft)" />
            <polygon points="372,532 410,532 478,705 398,705" fill="#000" opacity="0.55" filter="url(#pw-soft)" />
          </g>

          {/* 地上的纸钱 */}
          <g className="pw-fade" style={{ opacity: funeral ? 0.55 : 0 }}>
            {floorPaper.map((p, i) => (
              <use key={i} href="#pw-coin" x={p.x} y={p.y} width={13 * p.s} height={7 * p.s} transform={`rotate(${p.rot} ${p.x} ${p.y})`} />
            ))}
          </g>

          {/* ===== 一号台 ===== */}
          <ellipse cx="800" cy="770" rx="430" ry="36" fill="#000" opacity="0.65" filter="url(#pw-blur)" />
          <g ref={boxRef}>
            {/* 折叠台架与轮子 */}
            <g fill="#0b0b0b">
              <rect x="540" y="600" width="10" height="136" />
              <rect x="1050" y="600" width="10" height="136" />
              <rect x="476" y="662" width="14" height="96" />
              <rect x="1110" y="662" width="14" height="96" />
              <rect x="490" y="700" width="620" height="6" fill="#090909" />
              <path d="M560 665 L650 740 M650 665 L560 740 M950 665 L1040 740 M1040 665 L950 740" stroke="#0a0a0a" strokeWidth="5" />
            </g>
            {[483, 1117, 545, 1055].map((x, i) => (
              <g key={x}>
                <circle cx={x} cy={i < 2 ? 764 : 740} r="7" fill="#050505" stroke="#1a1a1a" strokeWidth="2" />
              </g>
            ))}
            {/* 台面 */}
            <polygon points="500,600 1100,600 1150,652 450,652" fill="#0a2420" />
            <polygon points="500,600 1100,600 1150,652 450,652" fill="none" stroke="#d3ded8" strokeOpacity="0.28" strokeWidth="2.5" />
            <line x1="800" y1="600" x2="800" y2="652" stroke="#d3ded8" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="450" y="652" width="700" height="13" fill="#051411" />
            <rect x="450" y="652" width="700" height="1.5" fill="#d3ded8" opacity="0.15" />
            <g transform="translate(1100 655)">
              <rect width="22" height="9" fill="#cfd8d3" opacity="0.25" />
              <text x="11" y="8" textAnchor="middle" fontSize="8" fill="#051411" className="pw-serif">
                1
              </text>
            </g>
            {/* 灯照在台面上的反光 */}
            <g className="pw-fade" style={{ opacity: lamp === 'on' && !coffin ? 1 : 0 }}>
              <ellipse cx="790" cy="622" rx="190" ry="14" fill="#e8f4ee" opacity="0.06" filter="url(#pw-soft)" />
            </g>
            {/* 球网：棺材显形后就看不到了 */}
            <g className="pw-fade" style={{ opacity: coffin ? 0 : 1 }}>
              <rect x="799" y="586" width="2" height="66" fill="#d3ded8" opacity="0.18" />
              <rect x="797" y="584" width="6" height="6" fill="#222" />
              <rect x="797" y="636" width="6" height="18" fill="#1c1c1c" />
              <path d="M799.5 590 V652 M800.5 590 V652" stroke="#fff" strokeOpacity="0.08" strokeDasharray="1 2" />
            </g>

            {/* 棺材：玩家问出“棺材”之前，这里什么都没有 */}
            <g className="pw-fade" style={{ opacity: coffin ? 1 : 0 }}>
              <path d="M586 634 L578 564 L1034 532 L1024 634 Z" fill="url(#pw-lacquer)" />
              <path d="M586 634 L578 564 L1034 532 L1024 634 Z" fill="#000" filter="url(#pw-woodgrain)" opacity="0.55" />
              <path d="M590 578 L1028 548 M592 624 L1020 622" stroke="#8a6a2c" strokeOpacity="0.22" strokeWidth="1.4" fill="none" />
              {/* 烛光从左下方照在棺身上 */}
              <path d="M586 634 L582 596 L830 586 L828 634 Z" fill="#ff7a2a" opacity="0.08" filter="url(#pw-soft)" />
              {/* 头端：描金寿字与云纹 */}
              <path d="M1024 634 L1034 532 L1060 520 L1052 618 Z" fill="#170504" />
              <circle cx="1042" cy="574" r="12" fill="none" stroke="#8a6a2c" strokeWidth="1.4" opacity="0.55" />
              <text x="1042" y="579" textAnchor="middle" fontSize="12" fill="#8a6a2c" opacity="0.65" className="pw-serif">
                寿
              </text>
              <path d="M1032 600 q5 -6 10 0 q-5 4 -1 7 M1046 604 q5 -6 10 0 q-5 4 -1 7 M1036 548 q5 -5 10 0 q-5 3 -1 6" stroke="#8a6a2c" strokeOpacity="0.4" strokeWidth="1" fill="none" />
              {/* 棺盖：没钉死，和棺身之间有一道缝 */}
              <path d="M564 566 Q572 550 592 548 L1034 516 Q1052 513 1062 504 L1060 520 L1034 532 L578 564 Z" fill="url(#pw-lid)" />
              <path d="M564 566 Q572 550 592 548 L1034 516 Q1052 513 1062 504 L1060 520 L1034 532 L578 564 Z" fill="#000" filter="url(#pw-woodgrain)" opacity="0.4" />
              <path d="M592 548 L1034 516" stroke="#a6452f" strokeOpacity="0.3" strokeWidth="1.5" />
              <path d="M600 552 L820 538" stroke="#ffb070" strokeOpacity="0.18" strokeWidth="2" filter="url(#pw-soft)" />
              <path d="M578 565 L1034 533" stroke="#000" strokeWidth="2.2" />
            </g>

            {/* 球拍 */}
            <g className="pw-paddle" style={{ transform: paddle }}>
              <path d="M20 -5 L54 -4 Q58 0 54 4 L20 5 Z" fill="#5a3d22" />
              {[26, 32, 38, 44].map(x => (
                <path key={x} d={`M${x} -5 l3 10`} stroke="#cfc8b4" strokeOpacity="0.4" strokeWidth="2" />
              ))}
              <ellipse cx="0" cy="0" rx="31" ry="13" fill="#0c0c0c" />
              <ellipse cx="0" cy="0" rx="29" ry="12" fill="#6e1410" />
              <ellipse cx="-3" cy="-1" rx="14" ry="5" fill="#b35747" opacity="0.25" />
              <ellipse cx="-6" cy="-4" rx="16" ry="3.5" fill="#fff" opacity={lamp === 'on' ? 0.12 : 0.05} />
            </g>
          </g>

          {/* 记分牌：我 : 爷爷 */}
          <g transform="translate(1168 590)">
            <rect x="8" y="64" width="5" height="110" fill="#0d0d0c" transform="rotate(-4 10 64)" />
            <rect x="98" y="64" width="5" height="110" fill="#0d0d0c" transform="rotate(4 100 64)" />
            <rect width="110" height="72" rx="3" fill="#141513" stroke="#050505" strokeWidth="3" />
            {[8, 60].map(x => (
              <g key={x}>
                <rect x={x} y="8" width="42" height="52" fill="#8e897d" />
                <rect x={x} y="8" width="42" height="26" fill="#9b968a" />
                <rect x={x + 8} y="3" width="4" height="9" rx="2" fill="none" stroke="#3a3833" strokeWidth="1.5" />
                <rect x={x + 30} y="3" width="4" height="9" rx="2" fill="none" stroke="#3a3833" strokeWidth="1.5" />
                <line x1={x} y1="34" x2={x + 42} y2="34" stroke="#141513" strokeWidth="1.5" />
              </g>
            ))}
            <text key={`m${score.me}`} className="pw-flip pw-serif" x="29" y="49" textAnchor="middle" fontSize="34" fontWeight="900" fill="#111">
              {score.me % 100}
            </text>
            <text key={`y${score.ye}`} className="pw-flip pw-serif" x="81" y="49" textAnchor="middle" fontSize="34" fontWeight="900" fill="#111">
              {score.ye % 100}
            </text>
            <rect x="16" y="76" width="26" height="13" fill="#9f9884" opacity="0.6" transform="rotate(-3 29 82)" />
            <rect x="64" y="76" width="34" height="13" fill="#9f9884" opacity="0.6" transform="rotate(2 81 82)" />
            <text x="29" y="87" textAnchor="middle" fontSize="11" fill="#1d1b17" className="pw-hand">
              我
            </text>
            <text x="81" y="87" textAnchor="middle" fontSize="11" fill="#1d1b17" className="pw-hand">
              爷爷
            </text>
          </g>

          {/* ===== 供桌：遗像、长明灯、倒头饭、馒头、香炉 ===== */}
          <g className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }}>
            <polygon points="660,740 940,740 952,750 648,750" fill="#2c160c" />
            <rect x="648" y="750" width="304" height="22" fill="url(#pw-altar)" />
            <path d="M660 761 H940" stroke="#4a2a14" strokeOpacity="0.5" />
            <rect x="660" y="772" width="12" height="84" fill="#120805" />
            <rect x="928" y="772" width="12" height="84" fill="#120805" />
            <rect x="700" y="772" width="8" height="60" fill="#0c0603" />
            <rect x="892" y="772" width="8" height="60" fill="#0c0603" />
            {/* 长明灯的灯座 */}
            <rect x="682" y="728" width="16" height="13" fill="#2e2112" />
            <ellipse cx="690" cy="727" rx="17" ry="5" fill="#3e2c14" />
            <ellipse cx="690" cy="726" rx="12" ry="3" fill="#6d4c14" />
            <line x1="690" y1="726" x2="690" y2="718" stroke="#111" strokeWidth="1.5" />
            {/* 馒头 */}
            <ellipse cx="728" cy="741" rx="19" ry="4" fill="#77716a" />
            <path d="M712 740 q8 -14 16 0 Z M728 740 q8 -14 16 0 Z M720 733 q8 -14 16 0 Z" fill="#a69f90" />
            {/* 遗像 */}
            <rect x="790" y="738" width="20" height="4" fill="#0a0806" />
            <Portrait x={756} y={626} width={88} height={115} gaze={fatherKnown ? 'door' : 'front'} cracked={has('help')} candleGlare />
            {/* 倒头饭：一碗插着筷子的饭 */}
            <path d="M856 730 Q872 748 888 730 Z" fill="#8f897d" />
            <ellipse cx="872" cy="730" rx="16" ry="4" fill="#c4bdae" />
            <path d="M858 730 Q872 720 886 730" fill="#c9c2b3" />
            <line x1="868" y1="727" x2="866" y2="696" stroke="#3a2a1a" strokeWidth="2" />
            <line x1="876" y1="727" x2="878" y2="696" stroke="#3a2a1a" strokeWidth="2" />
            {/* 香炉 */}
            <path d="M900 728 Q914 748 928 728 Z" fill="#2a2116" />
            <ellipse cx="914" cy="728" rx="14" ry="3.5" fill="#3a2e1c" />
            <path d="M903 740 l-3 8 M925 740 l3 8 M914 745 v6" stroke="#2a2116" strokeWidth="2" />
            {[908, 914, 920].map((x, i) => (
              <line key={x} x1={x} y1="727" x2={x + (i - 1) * 2} y2="694" stroke="#3a2a1a" strokeWidth="1.4" />
            ))}
          </g>

          {/* 多年以后：另一个孩子 */}
          <g className="pw-fade" style={{ opacity: cycle ? 1 : 0 }} fill="#010101">
            <ellipse cx="520" cy="672" rx="11" ry="13" />
            <path d="M504 690 Q520 682 536 690 L540 742 L532 772 L508 772 L500 742 Z" />
            <path d="M536 696 L560 670" stroke="#010101" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="566" cy="662" rx="12" ry="9" fill="#2a0605" transform="rotate(-30 566 662)" />
          </g>

          {/* ===== 黑暗 ===== */}
          <rect className="pw-darkness" width="1600" height="900" fill="#000" opacity={darkness} mask="url(#pw-dark)" pointerEvents="none" />

          {/* ===== 光源本体（不受黑暗影响） ===== */}
          <g className={`pw-lamp pw-lamp-${lamp} ${flick ? 'pw-flick' : ''}`}>
            <line x1="740" y1="0" x2="740" y2="248" stroke="#0a0a0a" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="860" y1="0" x2="860" y2="248" stroke="#0a0a0a" strokeWidth="2" strokeDasharray="3 2" />
            <polygon points="690,246 910,246 898,262 702,262" fill="#161714" />
            <line x1="692" y1="247" x2="908" y2="247" stroke="#3a3c37" strokeWidth="1.5" />
            <rect className="pw-tube" x="708" y="261" width="184" height="5" rx="2" fill="#effff7" />
            <rect className="pw-tube" x="700" y="252" width="200" height="22" rx="10" fill="#e4fff0" opacity="0.18" filter="url(#pw-soft)" />
            <polygon className="pw-tube" points="708,266 892,266 1190,665 410,665" fill="url(#pw-cone)" filter="url(#pw-blur)" style={{ mixBlendMode: 'screen' }} />
            <ellipse className="pw-tube" cx="800" cy="628" rx="410" ry="72" fill="url(#pw-pool)" />
            <g className="pw-tube">
              {dust.map((p, i) => (
                <circle key={i} className="pw-dust" cx={p.x} cy={p.y} r={p.r} fill="#e6f2ec" opacity="0.5" style={{ animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />
              ))}
            </g>
            {lamp === 'on' && (
              <g className="pw-moth">
                <path d="M846 282 l-6 -4 l2 5 l-5 2 l6 1 l2 4 l1 -5 z" fill="#2a2a26" />
              </g>
            )}
          </g>
          <g className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }}>
            <circle className="pw-glow" cx="690" cy="716" r="560" fill="url(#pw-candle)" style={{ mixBlendMode: 'screen' }} />
            <ellipse className="pw-flame" cx="690" cy="711" rx="4.5" ry="10" fill="url(#pw-flame)" />
            <ellipse className="pw-flame" cx="690" cy="714" rx="1.8" ry="4.5" fill="#fff6dc" />
            <circle cx="690" cy="711" r="16" fill="#ffc27a" opacity="0.18" filter="url(#pw-soft)" />
            {[908, 914, 920].map((x, i) => (
              <g key={x}>
                <circle cx={x + (i - 1) * 2} cy="694" r="1.5" fill="#ff5a1a" className="pw-ember" />
                <path className="pw-smoke" style={{ animationDelay: `${i * -2.3}s` }} d={`M${x + (i - 1) * 2} 692 q -8 -20 2 -40 q 10 -20 -2 -44`} stroke="#a59e92" strokeOpacity="0.16" strokeWidth="2.5" fill="none" filter="url(#pw-soft)" />
              </g>
            ))}
          </g>

          {/* 敲击的声音，看得见 */}
          {knockKnown && pingKey > 0 && (
            <text key={`p${pingKey}`} className="pw-knock-text pw-hand" x={760 + (pingKey % 3) * 30} y="500" fontSize="34" fill="#c9c2ae">
              乒
            </text>
          )}
          {knockKnown && thumpKey > 0 && !isDawn && (
            <text key={`t${thumpKey}`} className="pw-knock-text pw-knock-in pw-hand" x={820 - (thumpKey % 3) * 26} y="600" fontSize="30" fill="#8a1a14">
              咚
            </text>
          )}

          <rect width="1600" height="900" fill="url(#pw-vignette)" pointerEvents="none" />

          {/* ===== 可以凑近看的东西 ===== */}
          <g className="pw-hots">
            {showCandle && <rect className="pw-hot" x="752" y="622" width="96" height="124" onClick={open('portrait')} />}
            <rect className="pw-hot" x={coffin ? 744 : 768} y={coffin ? 512 : 606} width="110" height="40" onClick={open('paddle')} />
            <rect className="pw-hot" x="1162" y="584" width="122" height="110" onClick={open('scoreboard')} />
            <rect className="pw-hot" x="324" y="348" width="130" height="200" onClick={open('door')} />
            <rect className="pw-hot" x="1076" y="340" width="164" height="116" onClick={open('board')} />
          </g>
        </svg>
      </div>

      {/* 纸钱 */}
      {funeral && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="pw-paper" style={{ left: `${8 + i * 10.5}%`, animationDuration: `${16 + (i % 4) * 4}s`, animationDelay: `${-i * 3.1}s` }} />
          ))}
        </div>
      )}

      {/* “救” */}
      {flash > 0 && (
        <div key={flash} className="pw-jiu pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="pw-hand">救</span>
        </div>
      )}

      <p className={`pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] tracking-[.35em] text-ash/60 transition-opacity duration-1000 ${tip ? 'opacity-100' : 'opacity-0'}`}>
        · 场景里的东西，可以点开凑近看 ·
      </p>

      {inspect && <Inspect target={inspect} state={{ milestones, isDawn, score }} onClose={() => setInspect(null)} />}
    </div>
  )
}
