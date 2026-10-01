import { useId, useMemo } from 'react'

/**
 * 爷爷的遗像：一张老式黑白照片，黑漆相框，顶上扎着黑纱花。
 * 同一个组件既用在场景里（很小），也用在“凑近看”的特写里（很大）。
 */
export type Gaze = 'front' | 'door'

type Props = {
  gaze?: Gaze
  cracked?: boolean
  /** 只在特写里：眨一下眼 */
  blink?: boolean
  /** 场景里的烛光反射 */
  candleGlare?: boolean
  className?: string
  /** 嵌入到场景 SVG 时的位置 */
  x?: number
  y?: number
  width?: number
  height?: number
}

// 脸型：颧骨略宽，两腮下垂，下巴收
const FACE =
  'M128 48 C166 48 187 74 188 110 C190 130 190 148 186 164 C182 188 170 206 154 216 C144 222 136 225 128 225 C120 225 112 222 102 216 C86 206 74 188 70 164 C66 148 66 130 68 110 C69 74 90 48 128 48 Z'

// 确定性的伪随机，保证每次渲染头发纹理一样
function prng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export function Portrait({ gaze = 'front', cracked = false, blink = false, candleGlare = false, className, x, y, width, height }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (n: string) => `${uid}-${n}`
  const url = (n: string) => `url(#${id(n)})`
  const eye = gaze === 'door' ? { x: -3.4, y: 0.6 } : { x: 0, y: 0 }

  const hair = useMemo(() => {
    const r = prng(7)
    const strands: string[] = []
    for (let i = 0; i < 260; i++) {
      const t = r()
      // 沿头顶弧线分布
      const a = Math.PI * (1.05 + t * 0.9)
      const rad = 60 + r() * 12
      const x = 128 + Math.cos(a) * rad
      const y = 118 + Math.sin(a) * (rad + 6)
      if (y > 96 && x > 92 && x < 164) continue // 发际线后退
      const len = 3 + r() * 4
      const ang = a + Math.PI / 2 + (r() - 0.5) * 0.8
      strands.push(`M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(ang) * len).toFixed(1)} ${(Math.sin(ang) * len).toFixed(1)}`)
    }
    return strands.join('')
  }, [])

  return (
    <svg viewBox="0 0 300 392" x={x} y={y} width={width} height={height} className={className} role="img" aria-label="爷爷的遗像">
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a968e" />
          <stop offset="1" stopColor="#4f4c47" />
        </linearGradient>
        <radialGradient id={id('halo')} cx="0.5" cy="0.36" r="0.5">
          <stop offset="0" stopColor="#c9c5bc" stopOpacity="0.7" />
          <stop offset="1" stopColor="#c9c5bc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('face')} cx="0.44" cy="0.4" r="0.62">
          <stop offset="0" stopColor="#dcd8cf" />
          <stop offset="0.55" stopColor="#b9b4aa" />
          <stop offset="1" stopColor="#7e796f" />
        </radialGradient>
        <linearGradient id={id('jacket')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c1b19" />
          <stop offset="0.45" stopColor="#3a3835" />
          <stop offset="1" stopColor="#161513" />
        </linearGradient>
        <radialGradient id={id('vig')} cx="0.5" cy="0.45" r="0.72">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id={id('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('frame')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#24211e" />
          <stop offset="0.5" stopColor="#0a0908" />
          <stop offset="1" stopColor="#1a1816" />
        </linearGradient>
        <filter id={id('grain')} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.48  0 0 0 0 0.44  0 0 0 0.55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={id('soft')} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id={id('soft2')} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={id('soft05')} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id={id('photo-soft')} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <linearGradient id={id('sideLight')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={id('faceClip')}>
          <path d={FACE} />
        </clipPath>
        <clipPath id={id('photo')}>
          <rect x="24" y="30" width="252" height="336" />
        </clipPath>
      </defs>

      {/* 相框 */}
      <rect x="2" y="8" width="296" height="382" rx="3" fill={url('frame')} />
      <rect x="14" y="20" width="272" height="356" fill="none" stroke="#2e2a26" strokeWidth="2" />
      <rect x="20" y="26" width="260" height="344" fill="#0c0b0a" />

      {/* 照片 */}
      <g clipPath={url('photo')}>
        <g transform="translate(24 30)">
          <rect width="252" height="336" fill={url('bg')} />
          <rect width="252" height="336" fill={url('halo')} />

          {/* 外套：老式运动服立领，肩上两道白条 */}
          <path d="M-6 336 L2 280 Q14 248 52 238 L98 226 Q128 240 158 226 L204 238 Q242 248 254 280 L262 336 Z" fill={url('jacket')} />
          <path d="M60 236 Q30 252 14 300 M70 234 Q40 254 26 304" stroke="#d6d2c8" strokeOpacity="0.55" strokeWidth="4" fill="none" />
          <path d="M196 236 Q226 252 242 300 M186 234 Q216 254 230 304" stroke="#d6d2c8" strokeOpacity="0.5" strokeWidth="4" fill="none" />
          <path d="M98 218 L86 246 L126 262 L128 336 M158 218 L170 246 L130 262" stroke="#0e0d0c" strokeWidth="2.5" fill="none" />
          <path d="M98 218 L86 246 L126 262 L130 262 L170 246 L158 218 Q128 236 98 218 Z" fill="#2a2826" />
          <path d="M128 262 L128 336" stroke="#8d897f" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="1.5 2" />

          {/* 脖子 */}
          <path d="M100 196 L98 226 Q128 244 158 226 L156 196 Z" fill="#8f8a80" />
          <path d="M104 214 Q128 226 152 214" stroke="#6d685f" strokeWidth="1.2" fill="none" opacity="0.6" />

          <g filter={url('photo-soft')}>
          {/* 耳朵：露在脸外侧，大耳垂 */}
          <path d="M70 116 Q54 112 52 132 Q50 154 60 166 Q66 172 72 166 Z" fill="#a39e94" />
          <path d="M66 124 Q58 126 58 140 Q58 152 64 158" stroke="#6f6a61" strokeWidth="1.6" fill="none" />
          <path d="M186 116 Q202 112 204 132 Q206 154 196 166 Q190 172 184 166 Z" fill="#8f8a80" />
          <path d="M190 124 Q198 126 198 140 Q198 152 192 158" stroke="#5f5a52" strokeWidth="1.6" fill="none" />

          {/* 脸：颧骨略宽，两腮下垂，下巴收 */}
          <path d={FACE} fill={url('face')} />
          <g clipPath={url('faceClip')}>
            {/* 侧光：左亮右暗 */}
            <rect x="50" y="40" width="160" height="200" fill={url('sideLight')} />
            {/* 额头、颧骨的高光 */}
            <ellipse cx="118" cy="80" rx="30" ry="14" fill="#efebe3" opacity="0.35" filter={url('soft2')} />
            <ellipse cx="88" cy="152" rx="11" ry="7" fill="#e6e2d9" opacity="0.4" filter={url('soft2')} />
            <ellipse cx="166" cy="152" rx="9" ry="6" fill="#d6d1c7" opacity="0.2" filter={url('soft2')} />
            {/* 太阳穴、颧骨下的凹陷 */}
            <ellipse cx="72" cy="112" rx="8" ry="16" fill="#5e594f" opacity="0.35" filter={url('soft2')} />
            <ellipse cx="184" cy="112" rx="8" ry="16" fill="#4e4a43" opacity="0.5" filter={url('soft2')} />
            <path d="M80 170 Q88 186 100 196" stroke="#5e594f" strokeWidth="8" fill="none" opacity="0.3" filter={url('soft2')} />
            <path d="M176 170 Q168 186 156 196" stroke="#4e4a43" strokeWidth="9" fill="none" opacity="0.45" filter={url('soft2')} />
            {/* 两腮下垂 */}
            <path d="M74 178 Q82 206 108 218" stroke="#6d685f" strokeWidth="5" fill="none" opacity="0.45" filter={url('soft')} />
            <path d="M182 178 Q174 206 148 218" stroke="#5a554d" strokeWidth="6" fill="none" opacity="0.55" filter={url('soft')} />
            {/* 寿斑 */}
            <ellipse cx="160" cy="84" rx="4" ry="3" fill="#7d776c" opacity="0.5" filter={url('soft')} />
            <ellipse cx="86" cy="160" rx="3" ry="2.4" fill="#7d776c" opacity="0.45" filter={url('soft')} />
            <ellipse cx="172" cy="140" rx="2.2" ry="1.8" fill="#6f695f" opacity="0.45" filter={url('soft')} />
          </g>

          {/* 头发：花白的板寸，发际线后退，鬓角更白 */}
          <path d="M68 118 C62 70 92 40 128 40 C164 40 194 70 188 118 C184 96 174 82 154 78 C140 72 116 72 102 78 C82 82 72 96 68 118 Z" fill="#b3afa7" />
          <path d="M68 118 C66 104 68 96 72 90 L76 112 Z M188 118 C190 104 188 96 184 90 L180 112 Z" fill="#c9c5bd" opacity="0.45" filter={url('soft')} />
          <path d={hair} stroke="#e8e5de" strokeOpacity="0.6" strokeWidth="1" />
          <path d={hair} stroke="#5d5951" strokeOpacity="0.4" strokeWidth="0.8" transform="translate(1.2 1)" />

          <g filter={url('soft05')}>
            {/* 抬头纹，断断续续 */}
            <path d="M96 92 Q112 87 126 89 M132 88 Q148 87 160 93 M102 100 Q118 96 140 97 Q150 98 156 101 M108 108 Q122 104 134 105 M140 106 Q146 106 150 108" stroke="#6a655b" strokeWidth="1.3" fill="none" opacity="0.6" />
            <path d="M97 93 Q112 88 126 90 M103 101 Q118 97 140 98" stroke="#e2ded5" strokeWidth="0.8" fill="none" opacity="0.35" transform="translate(0 2)" />
            {/* 眉心的川字纹 */}
            <path d="M123 112 Q122 118 124 124 M133 112 Q134 118 132 124" stroke="#6a655b" strokeWidth="1.1" fill="none" opacity="0.55" />
          </g>

          {/* 眼窝 */}
          <ellipse cx="103" cy="132" rx="19" ry="11" fill="#5f5a50" opacity="0.5" filter={url('soft2')} />
          <ellipse cx="153" cy="132" rx="19" ry="11" fill="#555047" opacity="0.6" filter={url('soft2')} />

          {/* 眉毛：浓、花白、尾巴下垂 */}
          <g filter={url('soft05')}>
            <path d="M84 121 Q100 110 120 114 L119 118 Q100 116 86 125 Z" fill="#57534d" />
            <path d="M136 114 Q156 110 172 121 L170 125 Q156 116 137 118 Z" fill="#4f4b45" />
            <path d="M86 121 l6 -5 M92 118 l5 -4 M98 116 l6 -3 M106 114 l6 -2 M113 114 l5 -1 M138 113 l6 1 M144 113 l6 2 M152 114 l6 3 M160 116 l6 4 M166 119 l5 5" stroke="#e1ddd5" strokeOpacity="0.45" strokeWidth="0.9" />
          </g>

          {/* 眼睛 */}
          {[
            [103, 0],
            [153, 1],
          ].map(([cx, side]) => (
            <g key={side}>
              <path d={`M${cx - 13} 133 Q${cx} 125 ${cx + 13} 133 Q${cx} 138 ${cx - 13} 133 Z`} fill={side ? '#9d988e' : '#ada89e'} />
              <g style={{ transform: `translate(${eye.x}px, ${eye.y}px)`, transition: 'transform 3s ease' }}>
                <circle cx={cx} cy="132.5" r="4.4" fill="#2f2c28" />
                <circle cx={cx} cy="132.5" r="2" fill="#0d0c0b" />
                <circle cx={cx + 1.5} cy="131" r="0.8" fill="#f2efe8" opacity="0.8" />
              </g>
              {/* 下垂的上眼皮，盖住一部分黑眼珠 */}
              <path d={`M${cx - 15} 132 Q${cx} 121 ${cx + 15} 132 Q${cx} 127.5 ${cx - 15} 132 Z`} fill={side ? '#77726a' : '#8a857b'} />
              <path d={`M${cx - 13} 133 Q${cx} 126.5 ${cx + 13} 133`} stroke="#25221f" strokeWidth="1.5" fill="none" />
              <path d={`M${cx - 12} 129 Q${cx} 123 ${cx + 13} 129`} stroke="#5e594f" strokeWidth="0.8" fill="none" opacity="0.7" />
              {/* 眨眼 */}
              <path
                className={blink ? 'pt-blink' : ''}
                style={{ transformBox: 'fill-box', transformOrigin: '50% 0%', transform: 'scaleY(0)' }}
                d={`M${cx - 14} 126 Q${cx} 120 ${cx + 14} 126 L${cx + 14} 137 Q${cx} 140 ${cx - 14} 137 Z`}
                fill={side ? '#7f7a70' : '#9d988e'}
              />
              {/* 眼袋、鱼尾纹 */}
              <g filter={url('soft05')}>
                <path d={`M${cx - 11} 138 Q${cx} 143 ${cx + 11} 138`} stroke="#5f5a50" strokeWidth="1.2" fill="none" opacity="0.65" />
                <path d={`M${cx - 10} 143 Q${cx} 150 ${cx + 10} 143`} stroke="#6a655b" strokeWidth="1.1" fill="none" opacity="0.5" />
                <path d={`M${cx - 9} 141 Q${cx} 147 ${cx + 9} 141`} stroke="#d8d4cb" strokeWidth="1.4" fill="none" opacity="0.25" />
                <path
                  d={side ? `M${cx + 15} 129 l7 -4 M${cx + 15} 133 l9 -1 M${cx + 14} 137 l8 3 M${cx + 13} 140 l6 5` : `M${cx - 15} 129 l-7 -4 M${cx - 15} 133 l-9 -1 M${cx - 14} 137 l-8 3 M${cx - 13} 140 l-6 5`}
                  stroke="#615c52"
                  strokeWidth="0.9"
                  opacity="0.6"
                />
              </g>
            </g>
          ))}

          {/* 鼻子：鼻梁高光、右侧阴影、宽鼻头 */}
          <path d="M126 122 Q125 140 122 154" stroke="#ece8df" strokeWidth="3" fill="none" opacity="0.35" filter={url('soft')} />
          <path d="M134 124 Q138 142 142 156" stroke="#4f4b44" strokeWidth="5" fill="none" opacity="0.35" filter={url('soft2')} />
          <path d="M111 160 Q117 169 128 169 Q139 169 145 160 Q141 151 128 153 Q115 151 111 160 Z" fill="#a39e93" />
          <ellipse cx="124" cy="157" rx="6" ry="3" fill="#e6e2d9" opacity="0.4" filter={url('soft')} />
          <path d="M113 164 Q116 160 121 163 M143 164 Q140 160 135 163" stroke="#3e3a35" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M111 160 Q107 153 111 146" stroke="#6a655b" strokeWidth="1.2" fill="none" opacity="0.6" />
          <path d="M145 160 Q149 153 145 146" stroke="#5a554d" strokeWidth="1.4" fill="none" opacity="0.7" />
          <path d="M118 172 Q128 176 138 172" stroke="#4f4b44" strokeWidth="3" fill="none" opacity="0.3" filter={url('soft')} />

          {/* 法令纹：很深 */}
          <path d="M109 161 Q98 176 103 194" stroke="#5f5a50" strokeWidth="1.8" fill="none" opacity="0.65" filter={url('soft05')} />
          <path d="M110 164 Q101 177 105 192" stroke="#ddd9d0" strokeWidth="1.6" fill="none" opacity="0.25" transform="translate(-3 0)" />
          <path d="M147 161 Q158 176 153 194" stroke="#4f4b44" strokeWidth="2.2" fill="none" opacity="0.7" filter={url('soft05')} />

          {/* 人中 */}
          <path d="M125 171 Q124 177 125 182 M131 171 Q132 177 131 182" stroke="#6a655b" strokeWidth="0.9" fill="none" opacity="0.45" />

          {/* 嘴：薄唇，抿得紧紧的，嘴角往下 */}
          <path d="M108 187 Q118 183 128 185 Q138 183 148 187 Q138 189 128 188 Q118 189 108 187 Z" fill="#6f695f" />
          <path d="M107 187.5 Q118 186 128 186.5 Q138 186 149 187.5" stroke="#2f2c28" strokeWidth="1.7" fill="none" />
          <path d="M107 187.5 q-3 1 -4 4 M149 187.5 q3 1 4 4" stroke="#3e3a35" strokeWidth="1.2" fill="none" />
          <path d="M114 193 Q128 197 142 193" stroke="#ccc8bf" strokeWidth="2.4" fill="none" opacity="0.35" filter={url('soft')} />
          <path d="M116 200 Q128 205 140 200" stroke="#4f4b44" strokeWidth="3" fill="none" opacity="0.35" filter={url('soft')} />
          {/* 下巴 */}
          <ellipse cx="126" cy="210" rx="12" ry="6" fill="#d5d1c8" opacity="0.25" filter={url('soft2')} />
          {/* 脖子上的下颌阴影 */}
          <path d="M98 222 Q128 238 158 222" stroke="#2c2a26" strokeWidth="7" fill="none" opacity="0.4" filter={url('soft2')} />
          </g>
          {/* 相纸：泛黄、颗粒、暗角、划痕 */}
          <rect width="252" height="336" fill="#b8a27a" opacity="0.18" style={{ mixBlendMode: 'multiply' }} />
          <rect width="252" height="336" fill="#fff" filter={url('grain')} opacity="0.35" style={{ mixBlendMode: 'overlay' }} />
          <rect width="252" height="336" fill={url('vig')} />
          <path d="M40 0 L52 336 M210 60 L196 250 M0 300 L120 316" stroke="#f3efe6" strokeOpacity="0.12" strokeWidth="0.8" />
        </g>
      </g>

      {/* 玻璃 */}
      <polygon points="24,30 150,30 24,250" fill={url('glass')} />
      <polygon points="200,30 276,30 276,110 120,366 70,366" fill="#fff" opacity="0.03" />
      {candleGlare && <ellipse cx="226" cy="330" rx="26" ry="12" fill="#ffb366" opacity="0.18" filter={url('soft2')} />}
      {cracked && (
        <g stroke="#e9e5dc" strokeOpacity="0.55" strokeWidth="0.9" fill="none" className="pt-crack">
          <path d="M212 96 L180 132 L168 176 L140 214 M212 96 L246 70 L270 64 M212 96 L236 140 L244 196 L268 238 M212 96 L196 58 L190 30 M180 132 L150 138 M236 140 L262 132" />
          <path d="M212 96 L200 110 M212 96 L222 108" strokeWidth="1.6" />
        </g>
      )}

      {/* 黑纱：顶上一朵花，两条带子搭过相框两角 */}
      <path d="M150 18 Q90 22 36 54 L22 72 L4 46 Q20 26 40 22 Q96 8 150 10 Z" fill="#050505" />
      <path d="M150 18 Q210 22 264 54 L278 72 L296 46 Q280 26 260 22 Q204 8 150 10 Z" fill="#050505" />
      <path d="M40 26 Q90 16 140 16 M260 26 Q210 16 160 16" stroke="#2c2c2c" strokeWidth="1.2" fill="none" />
      <path d="M22 72 L8 104 L18 100 L24 110 L32 64 Z M278 72 L292 104 L282 100 L276 110 L268 64 Z" fill="#070707" />
      <g transform="translate(150 14)">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-12" rx="9" ry="15" fill="#080808" stroke="#262626" strokeWidth="0.8" transform={`rotate(${i * 45})`} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-7" rx="6" ry="9" fill="#0b0b0b" stroke="#2e2e2e" strokeWidth="0.7" transform={`rotate(${i * 60 + 30})`} />
        ))}
        <circle r="5" fill="#111" stroke="#333" strokeWidth="0.8" />
      </g>
    </svg>
  )
}
