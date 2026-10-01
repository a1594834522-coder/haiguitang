import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../audio/engine'
import type { SceneProps } from '../types'
import { Inspect, type InspectTarget } from './Closeups'
import girlPhoto from './photos/girl.webp'
import linePhoto from './photos/line.webp'
import platePhoto from './photos/plate.webp'
import turnPhoto from './photos/turn.webp'
import { heatOf } from './time'
import './scene.css'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// 场景是 AI 生成的照片（第一人称），会变化的地方另外叠图。坐标就是照片的像素
const W = 1448
const H = 1086
// 角落那一排只存了远处那一小块（LINE_CROP），和底图逐像素对齐
const LINE_CROP = { x: 1120, y: 450, width: 328, height: 170 }
const LINE_AREA = { x: 1160, y: 490, width: 300, height: 90 }
const HOT: Record<InspectTarget, { x: number; y: number; width: number; height: number }> = {
  chief: { x: 745, y: 400, width: 100, height: 115 },
  roster: { x: 292, y: 455, width: 80, height: 115 },
  canteen: { x: 1180, y: 860, width: 250, height: 165 },
}
// “我”的影子：头、帽檐、肩膀，从画面下沿伸进来
const MY_SHADOW =
  'M470 1120 Q480 1040 560 1018 L640 1004 Q652 984 660 968 Q630 958 626 930 Q622 880 668 862 Q664 850 676 846 L772 846 Q784 850 780 862 Q826 880 822 930 Q818 958 788 968 Q796 984 808 1004 L888 1018 Q968 1040 978 1120 Z'

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

  // 女生出现时，“我”退到她身后一排；向右看齐时，女生不在眼前了
  const showGirl = girl && !right
  // 身后有人：画面下沿压上来一层暗
  const presence = voice || girl

  return (
    <div className={`xy-root absolute inset-0 overflow-hidden ${thinking ? 'xy-thinking' : ''} ${freeze ? 'xy-freeze' : ''} ${hush ? 'xy-hush' : ''}`}>
      <div ref={stageRef} className="xy-stage absolute inset-0">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
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
            <filter id="xy-soft" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="xy-shadow-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="xy-feather" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
            {/* 角落那一排只在远处一小块，换图时只换这一块 */}
            <mask id="xy-m-line" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <rect {...LINE_AREA} fill="#fff" filter="url(#xy-feather)" />
            </mask>
          </defs>

          {/* ===== “我”的视野 ===== */}
          <g className="xy-world" style={{ transform: `translateX(${right ? -60 : 0}px)` }}>
            <g className="xy-breathe">
              <image href={platePhoto} width={W} height={H} />
              {/* 太阳在身后，影子投在眼前的地上 */}
              <g className="xy-fade" style={{ opacity: dead || showGirl ? 0 : 0.5, mixBlendMode: 'multiply' }} filter="url(#xy-shadow-blur)">
                <path d={MY_SHADOW} fill="#2a2c14" />
              </g>
              {/* 女生就站在“我”眼前 */}
              <image href={girlPhoto} width={W} height={H} className="xy-girl" style={{ opacity: showGirl ? 1 : 0 }} />
              {/* 角落里那一排：操场右边的远角 */}
              <image href={linePhoto} {...LINE_CROP} mask="url(#xy-m-line)" className="xy-line" style={{ opacity: line ? 1 : 0 }} />

              {/* 越往下推，天色越不对 */}
              <rect width={W} height={H * 0.42} fill="url(#xy-dread)" style={{ opacity: dread * 0.45, mixBlendMode: 'multiply', transition: 'opacity 4s' }} />
              {/* 脚下的定位点，漆成红色 */}
              <ellipse cx={W / 2} cy={H - 6} rx="150" ry="26" fill="#a3170d" style={{ opacity: post ? 0.55 : 0, mixBlendMode: 'multiply', transition: 'opacity 3s' }} filter="url(#xy-soft)" />
              {/* 热浪从地面往上冒 */}
              <g className="xy-shimmer" style={{ opacity: 0.2 + heat * 0.45 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <path key={i} style={{ animationDelay: `${i * -1.1}s` }} d={`M${420 + i * 150} ${H - 60} q 18 -60 0 -120 q -18 -60 0 -120 q 18 -60 0 -120`} stroke="#fff8e4" strokeOpacity="0.12" strokeWidth="44" fill="none" />
                ))}
              </g>

              {/* 可以凑近看的东西 */}
              <g>
                <rect className="xy-hot" {...HOT.chief} onClick={open('chief')} />
                <rect className="xy-hot" {...HOT.roster} onClick={open('roster')} />
                <rect className="xy-hot" {...HOT.canteen} onClick={open('canteen')} />
              </g>
            </g>
          </g>

          {/* ===== 向右看齐：把头转过去 ===== */}
          <g className="xy-turn" style={{ opacity: right ? 1 : 0, transform: `translateX(${right ? 0 : 80}px)` }}>
            <image href={turnPhoto} width={W} height={H} />
          </g>

          {/* ===== 下面这些跟着头走，不随视野移动 ===== */}
          <rect y={H * 0.6} width={W} height={H * 0.4} fill="url(#xy-behind)" className="xy-presence" style={{ opacity: presence ? 1 : 0 }} pointerEvents="none" />
          <rect width={W} height={H} fill="#fff8e6" style={{ opacity: heat * 0.12 }} pointerEvents="none" />
          <rect width={W} height={H} fill="url(#xy-vignette)" style={{ opacity: 0.3 + heat * 0.15 + dread * 0.45, transition: 'opacity 4s' }} pointerEvents="none" />
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
