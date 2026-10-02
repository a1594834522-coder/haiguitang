import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../audio/engine'
import type { SceneProps } from '../types'
import { Inspect, type InspectTarget } from './Closeups'
import coffinPhoto from './photos/coffin.webp'
import cyclePhoto from './photos/cycle.webp'
import dawnPhoto from './photos/dawn.webp'
import doorPhoto from './photos/door.webp'
import funeralPhoto from './photos/funeral.webp'
import handPhoto from './photos/hand.webp'
import platePhoto from './photos/plate.webp'
import { DAWN_Q, FATHER_Q, dawnProgress } from './time'
import './scene.css'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** 照片坐标系（art.json 里的坐标都按这个量） */
const W = 1536
const H = 1024
// 叠加层：和 art.json 里各层的 crop 一致
const DOOR_CROP = { x: 1340, y: 90, width: 196, height: 370 }
const DAWN_CROP = { x: 0, y: 0, width: 380, height: 345 }
const CYCLE_CROP = { x: 1140, y: 260, width: 240, height: 410 }
/** 长明灯的火苗、香头 */
const FLAME = { x: 104, y: 393 }
const INCENSE = [338, 349, 360]
/** 记分牌两张翻牌：中心、高度、轻微的倾斜 */
const CARDS = [
  { x: 1398, y: 503, h: 100, rot: -2 },
  { x: 1460, y: 513, h: 112, rot: 3 },
]
/** 握拍的手：图层放在右下角；问出棺材后，手抬高一些（棺盖比台面高） */
const HAND = { x: 891, y: 594, width: 645, height: 430 }
const HOT = {
  portrait: { x: 112, y: 320, width: 110, height: 135 },
  paddle: { x: 1000, y: 600, width: 280, height: 270 },
  scoreboard: { x: 1340, y: 428, width: 180, height: 160 },
  door: { x: 1380, y: 150, width: 156, height: 300 },
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
  const stageRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<SVGGElement>(null)
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const shake = () => {
    if (reduced) return
    stageRef.current?.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }],
      { duration: 520, easing: 'ease-out' },
    )
  }
  /** 里面回了一下：整张台子轻轻一震 */
  const thud = (strength = 1) => {
    if (reduced) return
    photoRef.current?.animate(
      [{ transform: 'translate(0,0)' }, { transform: `translate(0,${-1.6 * strength}px)` }, { transform: `translate(${0.6 * strength}px,0)` }, { transform: 'translate(0,0)' }],
      { duration: 220, easing: 'ease-out' },
    )
  }

  // 手机上场景区域接近正方形：铺满会把供桌和门裁掉，改成完整显示、上下留黑
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width / Math.max(1, e.contentRect.height) < 1.3))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
          audio.ping({ pan: 0.15, vol: 0.85 })
          setScore(s => ({ ...s, me: s.me + 1 }))
          setPingKey(k => k + 1)
          if (L.isDawn) {
            L.unanswered++
          } else {
            const delay = 650 + q * 55 + rand(0, 350)
            const vol = Math.max(0.12, 1 - q / 23)
            setTimeout(() => {
              if (stopped || live.current.paused) return
              audio.thump({ vol, pan: -0.02 })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      audio.creak({ pan: 0.6 })
      setTimeout(() => audio.sting(), 600)
    } else {
      audio.sting()
      if (added.includes('coffin')) setTimeout(() => audio.thump({ vol: 1 }), 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      audio.creak({ pan: 0.6 })
      setFatherVisit(true)
      const t = setTimeout(() => {
        audio.creak({ pan: 0.6, vol: 0.3, closing: true })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, paused, isDawn])

  const doorOpen = fatherVisit || fatherKnown
  // 灯管先闪几下，灭了之后才换成烛光下的灵堂
  const showCandle = lamp === 'off'

  // 日光灯下的灰尘
  const dust = useMemo(
    () => Array.from({ length: 30 }, () => ({ x: rand(560, 990), y: rand(130, 560), r: rand(0.9, 2.2), d: rand(9, 20), delay: rand(-20, 0) })),
    [],
  )

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

  const handLift = coffin ? -70 : 0

  return (
    <div className={`pw-root absolute inset-0 overflow-hidden ${thinking ? 'pw-thinking' : ''} ${gust ? 'pw-gust' : ''} ${hush ? 'pw-hush' : ''}`}>
      <div ref={stageRef} className="pw-stage absolute inset-0">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={narrow ? 'xMidYMid meet' : 'xMidYMid slice'} className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="pw-candle">
              <stop offset="0" stopColor="#ffb766" stopOpacity="0.32" />
              <stop offset="0.3" stopColor="#ff8a33" stopOpacity="0.1" />
              <stop offset="1" stopColor="#ff6a10" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pw-vignette" cx="0.5" cy="0.55" r="0.7">
              <stop offset="0.45" stopColor="#000" stopOpacity="0" />
              <stop offset="0.85" stopColor="#000" stopOpacity="0.45" />
              <stop offset="1" stopColor="#000" stopOpacity="0.85" />
            </radialGradient>
            <filter id="pw-soft" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            {/* 握拍的手：熄灯后只剩烛光，压暗、偏暖 */}
            <filter id="pw-candlelit" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0.42 0.12 0 0 0  0.08 0.24 0.02 0 0  0 0.04 0.12 0 0  0 0 0 1 0" />
            </filter>
          </defs>

          {/* ===== 照片 ===== */}
          <g ref={photoRef}>
            <image href={platePhoto} width={W} height={H} />
            <image href={funeralPhoto} width={W} height={H} className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }} />
            <image href={coffinPhoto} width={W} height={H} className="pw-fade" style={{ opacity: coffin ? 1 : 0 }} />
            <image href={dawnPhoto} {...DAWN_CROP} className="pw-dawn" style={{ opacity: dawn }} />
            <image href={doorPhoto} {...DOOR_CROP} className="pw-door" style={{ opacity: doorOpen ? 1 : 0 }} />
            <image href={cyclePhoto} {...CYCLE_CROP} className="pw-fade" style={{ opacity: cycle ? 1 : 0 }} />
          </g>

          {/* 日光灯下飘着的灰尘 */}
          <g className="pw-fade" style={{ opacity: lamp === 'on' ? 1 : 0 }}>
            {dust.map((p, i) => (
              <circle key={i} className="pw-dust" cx={p.x} cy={p.y} r={p.r} fill="#e6f2ec" opacity="0.45" style={{ animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />
            ))}
          </g>

          {/* 长明灯：火光在整个画面上轻轻晃；香烟往上飘 */}
          <g className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }}>
            <circle className="pw-glow" cx={FLAME.x} cy={FLAME.y} r="900" fill="url(#pw-candle)" style={{ mixBlendMode: 'screen' }} />
            {INCENSE.map((x, i) => (
              <path
                key={x}
                className="pw-smoke"
                style={{ animationDelay: `${i * -2.3}s` }}
                d={`M${x} 388 q -10 -26 3 -52 q 13 -26 -3 -56`}
                stroke="#b3aa9b"
                strokeOpacity="0.2"
                strokeWidth="3"
                fill="none"
                filter="url(#pw-soft)"
              />
            ))}
          </g>

          {/* 记分牌：左边是我，右边是爷爷 */}
          <g className="pw-score" style={{ opacity: showCandle ? 0.45 : 0.8 }}>
            {[score.me, score.ye].map((n, i) => {
              const c = CARDS[i]
              // 旋转放在外层、按画布坐标算；里面的翻牌动画按数字自身算
              return (
                <g key={i} transform={`rotate(${c.rot} ${c.x} ${c.y})`} style={{ transformBox: 'view-box' }}>
                  <text key={n} className="pw-flip pw-serif" x={c.x} y={c.y + c.h * 0.3} textAnchor="middle" fontSize={c.h * (n % 100 >= 10 ? 0.62 : 0.82)} fontWeight="900" fill="#1a1712">
                    {n % 100}
                  </text>
                </g>
              )
            })}
          </g>

          {/* 握拍的手：每敲一下，挥一下 */}
          <g className="pw-hand-lift" style={{ transform: `translateY(${handLift}px)` }}>
            <g key={pingKey} className={pingKey > 0 ? 'pw-swing' : ''}>
              <image href={handPhoto} x={HAND.x} y={HAND.y} width={HAND.width} height={HAND.height} />
              <image href={handPhoto} x={HAND.x} y={HAND.y} width={HAND.width} height={HAND.height} filter="url(#pw-candlelit)" className="pw-fade" style={{ opacity: showCandle ? 1 : 0 }} />
            </g>
          </g>

          {/* 日光灯一闪：整个馆跟着暗一下 */}
          <rect width={W} height={H} fill="#000" className={`pw-lampdark pw-lamp-${lamp} ${flick ? 'pw-flick' : ''}`} />

          {/* 敲击的声音，看得见 */}
          {knockKnown && pingKey > 0 && (
            <text key={`p${pingKey}`} className="pw-knock-text pw-hand" x={1010 + (pingKey % 3) * 30} y={coffin ? 560 : 640} fontSize="44" fill="#c9c2ae">
              乒
            </text>
          )}
          {knockKnown && thumpKey > 0 && !isDawn && (
            <text key={`t${thumpKey}`} className="pw-knock-text pw-knock-in pw-hand" x={740 - (thumpKey % 3) * 28} y={coffin ? 520 : 560} fontSize="40" fill="#8a1a14">
              咚
            </text>
          )}

          <rect width={W} height={H} fill="url(#pw-vignette)" pointerEvents="none" />

          {/* ===== 可以凑近看的东西 ===== */}
          <g>
            {showCandle && <rect className="pw-hot" {...HOT.portrait} onClick={open('portrait')} />}
            <rect className="pw-hot" {...HOT.paddle} y={HOT.paddle.y + handLift} onClick={open('paddle')} />
            <rect className="pw-hot" {...HOT.scoreboard} onClick={open('scoreboard')} />
            <rect className="pw-hot" {...HOT.door} onClick={open('door')} />
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
