import type { CSSProperties } from 'react'

export const SKIN = '#b8875f'

type Common = {
  x: number
  y: number
  s?: number
  className?: string
  style?: CSSProperties
}

/** 主席台上的老人，用在凑近看的特写里。局部坐标：宽 60、高 160，原点在两脚之间（30, 160） */
export function Elder({ x, y, s = 1, gaze = 0, stare = false }: Common & { gaze?: number; stare?: boolean }) {
  return (
    <g transform={`translate(${x - 30 * s} ${y - 160 * s}) scale(${s})`}>
      <path d="M13 47 Q15 40 23 38.5 L37 38.5 Q45 40 47 47 L45.5 92 L14.5 92 Z" fill="#4a5634" />
      <path d="M13 47 L10.5 86 Q12 90 15.5 88 L16.8 52 Z M47 47 L49.5 86 Q48 90 44.5 88 L43.2 52 Z" fill="#434e2f" />
      {/* 领章、扣子 */}
      <path d="M23 39 L30 50 L37 39" stroke="#2c331e" strokeWidth="1.5" fill="none" />
      <rect x="21" y="40" width="4" height="3" fill="#8e2a1c" />
      <rect x="35" y="40" width="4" height="3" fill="#8e2a1c" />
      {[56, 66, 76].map(cy => (
        <circle key={cy} cx="30" cy={cy} r="1" fill="#c9b47a" />
      ))}
      <rect x="25.5" y="30" width="9" height="10" fill="#9c6c47" />
      {/* 脸：花白的短发，脸色发灰 */}
      <ellipse cx="30" cy="22" rx="10" ry="11.5" fill={stare ? '#a39784' : SKIN} style={{ transition: 'fill 3s' }} />
      <path d="M20 19 Q20 9 30 9 Q40 9 40 19 Q37 13 30 13 Q23 13 20 19 Z" fill="#cfcbc2" />
      <path d="M24 20 h4 M32 20 h4" stroke="#3a3a36" strokeWidth="1.2" />
      <g style={{ transform: `translateX(${gaze * 1.6}px)`, transition: 'transform 2.5s ease' }}>
        <circle cx="26" cy="22.5" r={stare ? 1.6 : 1.1} fill="#0c0a08" style={{ transition: 'r 2s' }} />
        <circle cx="34" cy="22.5" r={stare ? 1.6 : 1.1} fill="#0c0a08" style={{ transition: 'r 2s' }} />
      </g>
      <path d="M26 29 Q30 27.8 34 29" stroke="#5a3d2a" strokeWidth="1" fill="none" />
      <path d="M23 26 Q24 30 26 31 M37 26 Q36 30 34 31" stroke="#7a573c" strokeWidth="0.7" fill="none" opacity="0.7" />
      {/* 大檐帽 */}
      <path d="M17 12 Q18 3 30 2.5 Q42 3 43 12 Z" fill="#46522f" />
      <path d="M17 12 L43 12 L45 14.5 L15 14.5 Z" fill="#1d2214" />
      <circle cx="30" cy="8" r="1.8" fill="#c9a94a" />
    </g>
  )
}
