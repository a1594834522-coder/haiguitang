import { memo } from 'react'

/**
 * 训练馆的静态背景：墙、窗、标语、奖状、黑板、地面、远处的球台。
 * 纹理滤镜（水渍、剥落、胶垫）开销大，单独放在一层，只在天色/时间变化时重绘。
 */

const W = [120, 400, 1040, 1320] // 四扇高窗的 x

function prng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

type Props = { sky: string; dawn: number; hourDeg: number; minDeg: number }

export const Backdrop = memo(function Backdrop({ sky, dawn, hourDeg, minDeg }: Props) {
  const r = prng(11)
  const floorSpecks = Array.from({ length: 60 }, () => ({ x: r() * 1600, y: 560 + r() * 340, w: 2 + r() * 10 }))
  const chips = Array.from({ length: 34 }, () => {
    const x = r() * 1600
    const y = 406 + (r() < 0.6 ? r() * 14 : r() * 110)
    const w = 4 + r() * 16
    const h = 2 + r() * 7
    return `M${x} ${y} l${w * 0.4} ${-h * 0.3} l${w * 0.6} ${h * 0.5} l${-w * 0.2} ${h * 0.6} l${-w * 0.7} ${h * 0.1} z`
  })
  const scuffs = Array.from({ length: 26 }, () => ({ x: r() * 1600, y: 440 + r() * 70, w: 6 + r() * 26, d: (r() - 0.5) * 4 }))

  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="bd-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c0d0c" />
          <stop offset="1" stopColor="#151613" />
        </linearGradient>
        <linearGradient id="bd-wainscot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1813" />
          <stop offset="1" stopColor="#08100c" />
        </linearGradient>
        <linearGradient id="bd-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120605" />
          <stop offset="1" stopColor="#2a0c09" />
        </linearGradient>
        <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor={sky} stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="bd-moon">
          <stop offset="0" stopColor="#d8dce4" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#b8c0d0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#b8c0d0" stopOpacity="0" />
        </radialGradient>
        {/* 墙上的水渍与霉斑 */}
        <filter id="bd-stains" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.018" numOctaves="4" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.025  0 0 0 0 0.02  0 0 0 -3.2 1.55" />
        </filter>
        {/* 细颗粒：粉刷墙面 */}
        <filter id="bd-plaster" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="8" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0 0.38  0 0 0 0.12 0" />
        </filter>
        {/* 标语的漆剥落 */}
        <filter id="bd-peel" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="5" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -7 4.2" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        {/* 橡胶地垫 */}
        <filter id="bd-rubber" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4 0.5" numOctaves="2" seed="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0.2 0" />
        </filter>
        <filter id="bd-blur" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ===== 墙 ===== */}
      <rect width="1600" height="532" fill="url(#bd-wall)" />
      <rect width="1600" height="532" filter="url(#bd-plaster)" />
      <rect width="1600" height="532" filter="url(#bd-stains)" opacity="0.9" />
      {/* 墙裙 */}
      <rect y="405" width="1600" height="127" fill="url(#bd-wainscot)" />
      {/* 掉漆的碎块与球拍磕出的擦痕 */}
      <g fill="#1a2620" opacity="0.7">
        {chips.map((c, i) => (
          <path key={i} d={c} />
        ))}
      </g>
      <g stroke="#000" strokeOpacity="0.35" strokeWidth="1.2">
        {scuffs.map((c, i) => (
          <line key={i} x1={c.x} y1={c.y} x2={c.x + c.w} y2={c.y + c.d} />
        ))}
      </g>
      <rect y="402" width="1600" height="4" fill="#132019" />
      <rect y="406" width="1600" height="1.5" fill="#000" opacity="0.6" />

      {/* 屋顶钢架 */}
      <g stroke="#060606" strokeWidth="5">
        <line x1="0" y1="22" x2="1600" y2="22" />
        <line x1="0" y1="4" x2="1600" y2="4" />
        {Array.from({ length: 33 }, (_, i) => (
          <line key={i} x1={i * 50} y1="4" x2={i * 50 + 25} y2="22" />
        ))}
      </g>

      {/* 沿墙走的电线管，通到门边的开关 */}
      <path d="M0 236 H300 V410" stroke="#1a1b19" strokeWidth="4" fill="none" />
      <rect x="292" y="410" width="16" height="22" rx="2" fill="#1e1f1c" />
      <rect x="297" y="415" width="6" height="8" fill="#0c0c0b" />

      {/* ===== 高窗 ===== */}
      {W.map((x, i) => (
        <g key={x}>
          <rect x={x} y="62" width="160" height="138" fill="url(#bd-sky)" />
          {i === 2 && <circle cx={x + 120} cy="96" r="38" fill="url(#bd-moon)" opacity={1 - dawn} />}
          {i === 2 && <circle cx={x + 120} cy="96" r="9" fill="#cdd2db" opacity={(1 - dawn) * 0.8} />}
          {/* 窗外的树枝 */}
          <g className={i % 2 ? 'pw-branch' : 'pw-branch pw-branch-b'} fill="none" stroke="#020203" strokeLinecap="round">
            {i === 0 && <path d="M120 150 Q170 130 210 140 Q240 120 280 126 M180 136 Q190 112 214 104 M232 128 Q246 108 268 100" strokeWidth="3" />}
            {i === 1 && <path d="M560 90 Q510 100 480 86 Q450 92 420 80 M500 96 Q490 120 470 128 M454 88 Q446 70 430 66" strokeWidth="2.5" />}
            {i === 3 && <path d="M1320 180 Q1370 160 1400 168 Q1440 150 1480 154 M1380 164 Q1386 140 1404 130" strokeWidth="3" />}
          </g>
          <rect x={x} y="62" width="160" height="138" fill="#9aa6b8" opacity="0.025" />
          <g stroke="#0b0c0a" strokeWidth="6" fill="none">
            <rect x={x} y="62" width="160" height="138" />
            <line x1={x + 53} y1="62" x2={x + 53} y2="200" />
            <line x1={x + 107} y1="62" x2={x + 107} y2="200" />
            <line x1={x} y1="131" x2={x + 160} y2="131" />
          </g>
          <rect x={x - 6} y="200" width="172" height="7" fill="#121310" />
          <rect x={x - 6} y="207" width="172" height="5" fill="#000" opacity="0.5" />
        </g>
      ))}

      {/* 广播喇叭 */}
      <g transform="translate(1220 40) scale(.8)">
        <path d="M0 0 L22 -10 L22 30 L0 20 Z" fill="#161714" />
        <path d="M22 -10 L46 -22 L46 42 L22 30 Z" fill="#1d1e1b" />
        <ellipse cx="46" cy="10" rx="5" ry="32" fill="#0c0c0b" />
        <rect x="-10" y="6" width="10" height="6" fill="#121310" />
      </g>

      {/* 挂钟 */}
      <g transform="translate(800 135)">
        <circle r="54" fill="#141412" />
        <circle r="50" fill="#2b2a25" stroke="#080807" strokeWidth="5" />
        <circle r="45" fill="#4b4940" />
        {Array.from({ length: 60 }, (_, i) => (
          <rect key={i} x="-0.6" y="-43" width="1.2" height={i % 5 ? 3 : 7} fill="#121210" transform={`rotate(${i * 6})`} />
        ))}
        {[
          ['12', 0, -29],
          ['3', 31, 4],
          ['6', 0, 37],
          ['9', -31, 4],
        ].map(([t, x, y]) => (
          <text key={t as string} x={x as number} y={y as number} textAnchor="middle" fontSize="10" fontWeight="600" fill="#121210" className="pw-serif">
            {t}
          </text>
        ))}
        <path d="M-3 2 L-2 -24 L2 -24 L3 2 Z" fill="#0b0b0a" style={{ transform: `rotate(${hourDeg}deg)`, transition: 'transform 1.2s ease' }} />
        <path d="M-2 3 L-1 -38 L1 -38 L2 3 Z" fill="#0b0b0a" style={{ transform: `rotate(${minDeg}deg)`, transition: 'transform 1.2s ease' }} />
        <line className="pw-second" x1="0" y1="8" x2="0" y2="-39" stroke="#7a1a14" strokeWidth="1.2" />
        <circle r="3" fill="#0b0b0a" />
        <path d="M-40 -16 A44 44 0 0 1 -6 -44" stroke="#fff" strokeOpacity="0.07" strokeWidth="8" fill="none" />
      </g>
      <text x="800" y="228" textAnchor="middle" fontSize="15" fill="#5d594e" opacity="0.55" letterSpacing="3" className="pw-serif">
        青石镇业余体校 · 乒乓球训练馆
      </text>

      {/* 旧标语：红漆剥落 */}
      <text x="800" y="318" textAnchor="middle" fontSize="58" fontWeight="900" fill="#4f1612" letterSpacing="14" className="pw-serif" filter="url(#bd-peel)" opacity="0.75">
        友谊第一　比赛第二
      </text>

      {/* 奖状 */}
      {[
        [474, 346, '先进集体'],
        [540, 350, '优秀教练'],
      ].map(([x, y, t], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i ? 2 : -1.5}) scale(.9)`} opacity="0.7">
          <rect width="58" height="42" fill="#1a1612" />
          <rect x="4" y="4" width="50" height="34" fill="#3e2a1a" />
          <rect x="6" y="6" width="46" height="30" fill="none" stroke="#6b4a1e" strokeWidth="1" />
          <text x="29" y="19" textAnchor="middle" fontSize="9" fill="#7c2a1c" fontWeight="900" className="pw-serif">
            奖 状
          </text>
          <text x="29" y="30" textAnchor="middle" fontSize="5.5" fill="#5a4426" className="pw-serif">
            {t as string}
          </text>
        </g>
      ))}

      {/* 锦旗 */}
      {[
        [1072, '桃李天下'],
        [1134, '执教有方'],
      ].map(([x, t]) => (
        <g key={x as number} transform={`translate(${x} 236)`} opacity="0.8">
          <line x1="-4" y1="0" x2="56" y2="0" stroke="#2c2418" strokeWidth="3" />
          <path d="M0 0 H52 V78 L26 96 L0 78 Z" fill="#350b0a" />
          <path d="M3 4 H49 V76 L26 92 L3 76 Z" fill="none" stroke="#6d5524" strokeWidth="0.8" opacity="0.6" />
          {(t as string).split('').map((c, i) => (
            <text key={i} x="26" y={20 + i * 17} textAnchor="middle" fontSize="14" fill="#7d6328" className="pw-serif">
              {c}
            </text>
          ))}
          <path d="M6 96 l0 10 M14 100 l0 10 M38 100 l0 10 M46 96 l0 10" stroke="#5d4a1e" strokeWidth="1" opacity="0.7" />
        </g>
      ))}

      {/* 训练安排的小黑板 */}
      <g transform="translate(1082 346) scale(.9)">
        <rect x="-6" y="-6" width="182" height="122" fill="#1d150d" />
        <rect width="170" height="110" fill="#0d1612" />
        <rect width="170" height="110" fill="#fff" opacity="0.025" />
        <g className="pw-hand" fill="#b8b6ad" opacity="0.55">
          <text x="85" y="20" textAnchor="middle" fontSize="15">
            训练安排
          </text>
          <text x="12" y="42" fontSize="11">
            一　发球 · 搓球
          </text>
          <text x="12" y="58" fontSize="11">
            三　多球
          </text>
          <text x="12" y="74" fontSize="11">
            五　对抗赛
          </text>
        </g>
        {/* 孩子用粉笔画的两个小人 */}
        <g stroke="#c8c6bc" strokeOpacity="0.45" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <circle cx="112" cy="58" r="6" />
          <path d="M112 64 V84 M112 70 L102 76 M112 70 L122 66 M112 84 L106 96 M112 84 L118 96" />
          <ellipse cx="126" cy="63" rx="4" ry="3" />
          <circle cx="150" cy="70" r="4" />
          <path d="M150 74 V88 M150 78 L142 82 M150 78 L156 74 M150 88 L146 97 M150 88 L154 97" />
          <ellipse cx="159" cy="72" rx="3" ry="2.4" />
        </g>
        <g className="pw-hand" fill="#c8c6bc" opacity="0.4" fontSize="8">
          <text x="104" y="106">
            爷爷
          </text>
          <text x="146" y="106">
            我
          </text>
        </g>
        <rect x="0" y="110" width="170" height="5" fill="#2a1d10" />
        <rect x="20" y="108" width="14" height="3" fill="#cfcabc" opacity="0.5" />
      </g>

      {/* 消防栓箱 */}
      <g transform="translate(560 430)" opacity="0.7">
        <rect width="46" height="62" fill="#2a0807" />
        <rect x="4" y="4" width="38" height="54" fill="none" stroke="#0e0303" strokeWidth="2" />
        <text x="23" y="22" textAnchor="middle" fontSize="8" fill="#6d1d16" className="pw-serif">
          消火栓
        </text>
        <circle cx="23" cy="40" r="10" fill="none" stroke="#3c0b09" strokeWidth="3" />
      </g>

      {/* ===== 地面 ===== */}
      <rect y="530" width="1600" height="370" fill="url(#bd-floor)" />
      <rect y="530" width="1600" height="370" filter="url(#bd-rubber)" />
      <g stroke="#ffffff" strokeOpacity="0.025" strokeWidth="2">
        {Array.from({ length: 13 }, (_, i) => (
          <line key={i} x1={800 + (i - 6) * 70} y1="530" x2={800 + (i - 6) * 420} y2="900" />
        ))}
        {[565, 625, 720, 860].map(y => (
          <line key={y} x1="0" y1={y} x2="1600" y2={y} />
        ))}
      </g>
      {/* 地垫上的磨痕 */}
      <g fill="#000" opacity="0.25">
        {floorSpecks.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.w} height="1.2" />
        ))}
      </g>
      <rect y="530" width="1600" height="10" fill="#000" opacity="0.45" filter="url(#bd-blur)" />

      {/* 远处的球台 */}
      {[
        [150, 470],
        [1130, 1450],
      ].map(([a, b]) => (
        <g key={a} opacity="0.28">
          <polygon points={`${a + 20},508 ${b - 20},508 ${b},526 ${a},526`} fill="#0b221e" />
          <polygon points={`${a + 20},508 ${b - 20},508 ${b},526 ${a},526`} fill="none" stroke="#9fb0a8" strokeOpacity="0.3" />
          <rect x={(a + b) / 2 - 1} y="496" width="2" height="30" fill="#5c6460" opacity="0.6" />
          <rect x={a + 10} y="526" width="5" height="26" fill="#0c0c0c" />
          <rect x={b - 15} y="526" width="5" height="26" fill="#0c0c0c" />
        </g>
      ))}
      {/* 挡板 */}
      <g opacity="0.6">
        {Array.from({ length: 16 }, (_, i) => (
          <g key={i}>
            <rect x={i * 100 + 2} y="532" width="96" height="24" fill={i % 2 ? '#090c16' : '#1a0706'} />
            <rect x={i * 100 + 2} y="532" width="96" height="2" fill="#fff" opacity="0.04" />
          </g>
        ))}
      </g>
    </svg>
  )
})
