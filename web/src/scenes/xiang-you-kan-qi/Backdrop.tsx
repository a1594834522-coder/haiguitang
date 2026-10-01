import { memo } from 'react'

/**
 * 静态布景：站在一连第三排第七个，“我”眼里的操场。正前方就是主席台。
 * 返回一个 <g>，放在 Scene 的“视野”里，转头时跟着一起平移。
 * 坐标 1600×900，视线高度（地平线）y=400。转头会往右看 240，所以右边一直画到 x=1900。
 * 开销大的滤镜都在这一层，内容不随游戏状态变化。
 */
export const HORIZON = 400

export const Backdrop = memo(function Backdrop() {
  const windows = (x0: number, y0: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number) =>
    Array.from({ length: cols * rows }, (_, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      return <rect key={i} x={x0 + c * gx} y={y0 + r * gy} width={w} height={h} fill={(c * 7 + r * 3) % 5 === 0 ? '#8d9196' : '#a9adae'} />
    })

  return (
    <g>
      <defs>
        <linearGradient id="xb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9d6c8" />
          <stop offset="0.7" stopColor="#ece6d2" />
          <stop offset="1" stopColor="#f3ecd8" />
        </linearGradient>
        <linearGradient id="xb-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3a476" />
          <stop offset="0.35" stopColor="#8f9566" />
          <stop offset="1" stopColor="#66724a" />
        </linearGradient>
        <linearGradient id="xb-track" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3523c" />
          <stop offset="1" stopColor="#8a402e" />
        </linearGradient>
        <linearGradient id="xb-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2ecda" stopOpacity="0" />
          <stop offset="0.6" stopColor="#f2ecda" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f2ecda" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="xb-concrete" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9c4b5" />
          <stop offset="1" stopColor="#a39e90" />
        </linearGradient>
        <radialGradient id="xb-shade" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1d2410" stopOpacity="0.6" />
          <stop offset="0.75" stopColor="#1d2410" stopOpacity="0.42" />
          <stop offset="1" stopColor="#1d2410" stopOpacity="0" />
        </radialGradient>
        <filter id="xb-heat" colorInterpolationFilters="sRGB" x="-2%" y="-5%" width="104%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.09" numOctaves="2" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="xb-turf" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.25" numOctaves="2" seed="8" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.24  0 0 0 0 0.12  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="xb-leaves" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="12" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="xb-soft" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect x="-300" width="2300" height={HORIZON + 20} fill="url(#xb-sky)" />

      {/* ===== 远景：主席台后面的楼，被晒得发白 ===== */}
      <g filter="url(#xb-heat)" opacity="0.85">
        <g fill="#b9bab4">
          <rect x="40" y="214" width="420" height="190" />
          <rect x="1150" y="190" width="420" height="214" />
          <rect x="1570" y="262" width="260" height="142" />
        </g>
        <rect x="40" y="206" width="420" height="9" fill="#a7a8a2" />
        <rect x="1150" y="182" width="420" height="9" fill="#a7a8a2" />
        <g opacity="0.8">
          {windows(58, 232, 15, 6, 16, 18, 27, 28)}
          {windows(1170, 212, 15, 7, 16, 18, 27, 27)}
          {windows(1588, 280, 9, 4, 16, 18, 27, 28)}
        </g>
        <text x="1360" y="206" textAnchor="middle" fontSize="18" fill="#7d7f7a" className="xy-serif" letterSpacing="8">
          第 二 教 学 楼
        </text>
        <rect x="1500" y="146" width="40" height="36" fill="#a9aaa4" />
        <path d="M120 214 L120 170 M120 178 l18 -8" stroke="#9a9b96" strokeWidth="2.5" />
        {/* 围墙外的一圈树 */}
        <path
          d="M-300 404 Q-200 352 -120 372 Q-40 340 40 368 Q120 350 200 376 Q300 358 380 380 L460 404 Z M1140 404 Q1200 360 1270 376 Q1340 346 1420 372 Q1500 352 1580 374 Q1660 350 1740 372 Q1820 360 1900 404 Z"
          fill="#7f8a62"
          opacity="0.75"
        />
      </g>

      {/* ===== 操场 ===== */}
      <rect x="-300" y={HORIZON} width="2300" height={900 - HORIZON} fill="url(#xb-field)" />
      <rect x="-300" y={HORIZON} width="2300" height={900 - HORIZON} fill="#fff" filter="url(#xb-turf)" />
      {/* 割草留下的条纹，近大远小 */}
      {Array.from({ length: 8 }, (_, i) => {
        const y0 = 520 + Math.pow(i / 8, 1.8) * 380
        const y1 = 520 + Math.pow((i + 0.5) / 8, 1.8) * 380
        return <rect key={i} x="-300" y={y0} width="2300" height={y1 - y0} fill="#fff" opacity="0.045" />
      })}

      {/* 主席台前的红色塑胶跑道 */}
      <rect x="-300" y="486" width="2300" height="34" fill="url(#xb-track)" />
      <g stroke="#efe6d4" fill="none">
        <path d="M-300 486 L2000 486" strokeWidth="1.5" opacity="0.6" />
        <path d="M-300 497 L2000 497" strokeWidth="1" opacity="0.45" />
        <path d="M-300 508 L2000 508" strokeWidth="1.2" opacity="0.45" />
        <path d="M-300 520 L2000 520" strokeWidth="2.5" opacity="0.65" />
      </g>

      {/* 别的连的定位点：地上一格一格白点，近大远小 */}
      <g fill="#f3f0e2" opacity="0.5">
        {[548, 584, 636, 712, 820].map((y, r) => {
          const k = (y - HORIZON) / 110
          return Array.from({ length: 16 }, (_, c) => {
            const x = 800 + (c - 7.5) * 46 * k
            return <ellipse key={`${r}-${c}`} cx={x} cy={y} rx={3 * k} ry={1.1 * k} />
          })
        })}
      </g>

      {/* ===== 主席台 ===== */}
      <g>
        <path d="M424 148 L1176 148 L1156 176 L444 176 Z" fill="#9e9a8e" />
        <rect x="444" y="176" width="712" height="8" fill="#7d796f" />
        {[470, 600, 1000, 1130].map(x => (
          <rect key={x} x={x - 6} y="184" width="12" height="236" fill="#b2ad9f" />
        ))}
        <rect x="476" y="184" width="648" height="236" fill="url(#xb-concrete)" />
        <rect x="560" y="204" width="480" height="48" fill="#9d2a1d" />
        <rect x="560" y="204" width="480" height="48" fill="#fff" opacity="0.08" />
        <text x="800" y="239" textAnchor="middle" fontSize="30" fill="#f1e2b8" letterSpacing="16" className="xy-serif" fontWeight="900">
          新 生 军 训
        </text>
        {/* 台面、台阶 */}
        <rect x="430" y="412" width="740" height="12" fill="#cfc9b8" />
        <path d="M430 424 L1170 424 L1176 486 L424 486 Z" fill="#b5af9f" />
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${440 + i * 56} 426 v58`} stroke="#9e988a" strokeWidth="1.2" />
        ))}
        <path d="M730 424 L870 424 L884 486 L716 486 Z" fill="#c4bead" />
        {[440, 456, 472].map(y => (
          <path key={y} d={`M${728 - (y - 424) * 0.25} ${y} L${872 + (y - 424) * 0.25} ${y}`} stroke="#a29c8e" strokeWidth="2" />
        ))}
        <path d="M424 486 L1176 486" stroke="#6e6a5f" strokeWidth="2.5" />
      </g>

      {/* 旗杆 */}
      <rect x="1226" y="40" width="5" height="446" fill="#bdbab1" />
      <circle cx="1228.5" cy="38" r="5" fill="#c9b47a" />
      <rect x="1210" y="480" width="38" height="10" fill="#a29d90" />

      {/* 主席台两边的大喇叭 */}
      {[
        [404, 196, -1],
        [1196, 196, 1],
      ].map(([x, y, d]) => (
        <g key={x}>
          <rect x={x - 2.5} y={y} width="5" height={486 - y} fill="#a8a59c" />
          <path d={`M${x} ${y + 8} l${24 * d} -16 l0 34 Z`} fill="#8b8a82" />
          <path d={`M${x} ${y + 46} l${24 * d} -16 l0 34 Z`} fill="#8b8a82" />
        </g>
      ))}

      {/* 地平线上的热浪 */}
      <rect x="-300" y="360" width="2300" height="110" fill="url(#xb-haze)" />

      {/* ===== 左边的大树，树荫底下坐着休息的全连 ===== */}
      <ellipse cx="250" cy="650" rx="380" ry="96" fill="url(#xb-shade)" />
      <g>
        {[
          [120, 300, 150],
          [330, 280, 160],
          [500, 330, 110],
        ].map(([x, y, r]) => (
          <g key={x}>
            <path d={`M${x - 10} ${y + r * 0.6} Q${x - 5} ${y + r * 1.5} ${x - 15} 612 L${x + 15} 612 Q${x + 5} ${y + r * 1.5} ${x + 10} ${y + r * 0.6} Z`} fill="#4a3a28" />
            <path d={`M${x - 10} 612 q-16 2 -24 7 M${x + 10} 612 q16 2 24 7`} stroke="#4a3a28" strokeWidth="5" fill="none" />
          </g>
        ))}
        <g className="xy-canopy" filter="url(#xb-leaves)">
          <ellipse cx="110" cy="310" rx="210" ry="140" fill="#3e4f27" />
          <ellipse cx="330" cy="280" rx="220" ry="150" fill="#465a2c" />
          <ellipse cx="510" cy="340" rx="130" ry="100" fill="#3a4a24" />
          <ellipse cx="250" cy="220" rx="160" ry="80" fill="#56693a" />
          <ellipse cx="420" cy="210" rx="120" ry="66" fill="#5f7340" />
          {/* 树冠底下的暗面 */}
          <ellipse cx="130" cy="410" rx="200" ry="52" fill="#25301a" />
          <ellipse cx="340" cy="398" rx="210" ry="56" fill="#2a361c" />
          <ellipse cx="520" cy="420" rx="120" ry="36" fill="#232d18" />
          {[
            [220, 200],
            [400, 186],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9" fill="#b9bf84" opacity="0.4" />
          ))}
        </g>
      </g>
      {/* 地上漏下来的光斑 */}
      {[
        [140, 620, 18],
        [300, 690, 22],
        [450, 640, 13],
        [60, 700, 15],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.35} fill="#d8d6a0" opacity="0.28" filter="url(#xb-soft)" />
      ))}
    </g>
  )
})
