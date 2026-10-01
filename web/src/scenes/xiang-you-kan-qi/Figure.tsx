import type { CSSProperties } from 'react'

/**
 * 操场上的人。全部是背影（面朝主席台），只有台上的人面朝操场。
 * 局部坐标：宽 60、高 160，原点在两脚之间（30, 160）。
 *
 * camo：0 = 老式纯绿军训服，1 = 现在的迷彩服，中间按比例过渡。
 */
export const SKIN = '#b8875f'
const HAIR = '#17130f'
const OLD = '#5a6640'
const BELT = '#26251b'

type Common = {
  x: number
  y: number
  s?: number
  camo?: number
  className?: string
  style?: CSSProperties
  opacity?: number
}

/** 迷彩图案，场景里只需要定义一次 */
export function CamoPattern({ id, scale = 1 }: { id: string; scale?: number }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="26" height="22" patternTransform={`rotate(-18) scale(${scale})`}>
      <rect width="26" height="22" fill="#6c7547" />
      <path d="M2 3 q5 -3 9 1 q3 4 -2 6 q-6 1 -7 -7 Z" fill="#454c2e" />
      <path d="M14 10 q6 -2 9 3 q1 5 -5 5 q-5 -1 -4 -8 Z" fill="#8d8a5a" />
      <path d="M5 14 q4 -1 5 3 q-1 4 -5 3 q-3 -2 0 -6 Z" fill="#343824" />
      <path d="M18 1 q4 0 5 3 q-2 3 -5 1 Z" fill="#343824" />
    </pattern>
  )
}

/** 站军姿的背影 */
export function Stander({
  x,
  y,
  s = 1,
  camo = 1,
  girl = false,
  shadow = 1,
  turn = 0,
  turnDelay = 0,
  camoId,
  className,
  style,
  opacity,
}: Common & { girl?: boolean; shadow?: number; turn?: number; turnDelay?: number; camoId: string }) {
  const fillCamo = `url(#${camoId})`
  const cloth = (d: string, extra?: CSSProperties) => (
    <>
      <path d={d} fill={OLD} style={extra} />
      {camo > 0 && <path d={d} fill={fillCamo} opacity={camo} style={extra} />}
    </>
  )
  // 女生肩膀窄一点
  const sx = girl ? 0.9 : 1
  return (
    // className / style 放在里层：CSS 的 transform 动画会覆盖 SVG 的 transform 属性
    <g transform={`translate(${x - 30 * s} ${y - 160 * s}) scale(${s})`} opacity={opacity}>
      <g className={className} style={style}>
      {/* 正午的影子很短，就在脚下 */}
      <ellipse cx="26" cy="160" rx="25" ry="4.5" fill="#1b1a10" style={{ opacity: 0.42 * shadow, transition: 'opacity 3s ease' }} />
      <g transform={`translate(${30 - 30 * sx} 0) scale(${sx} 1)`}>
        {/* 鞋：脚跟并拢，脚尖分开 */}
        <path d="M14 152 h14 v6 q0 2 -2 2 h-12 q-3 0 -3 -2 Z" fill="#1c1a15" />
        <path d="M32 152 h14 v6 q0 2 -2 2 h-12 q-3 0 0 -2 Z" fill="#1c1a15" />
        {cloth('M16 88 L44 88 L45 153 L31 153 L30 113 L29 153 L15 153 Z')}
        <path d="M30 113 L30 153" stroke="#000" strokeOpacity="0.3" strokeWidth="1" />
        <path d="M16 96 L44 96" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />
        {/* 上衣、腰带 */}
        {cloth('M13 47 Q15 40 23 38.5 L37 38.5 Q45 40 47 47 L45.5 90 L14.5 90 Z')}
        <path d="M17 53 Q30 57 43 53" stroke="#000" strokeOpacity="0.22" strokeWidth="1.2" fill="none" />
        <path d="M30 57 L30 88" stroke="#000" strokeOpacity="0.12" strokeWidth="1" />
        <rect x="14.5" y="85.5" width="31" height="5" fill={BELT} />
        {/* 汗湿的后背 */}
        <ellipse cx="30" cy="62" rx="9" ry="12" fill="#000" opacity="0.13" />
        {/* 胳膊贴紧裤缝 */}
        {cloth('M13 47 L10.5 86 Q12 90 15.5 88 L16.8 52 Z')}
        {cloth('M47 47 L49.5 86 Q48 90 44.5 88 L43.2 52 Z')}
        <ellipse cx="12.6" cy="90.5" rx="2.7" ry="3.6" fill={SKIN} />
        <ellipse cx="47.4" cy="90.5" rx="2.7" ry="3.6" fill={SKIN} />
        {/* 脖子、领子 */}
        <rect x="25.5" y="29" width="9" height="11" fill="#9c6c47" />
        {cloth('M22.5 39 Q30 43 37.5 39 L36.5 35.5 Q30 39 23.5 35.5 Z')}
      </g>
      {/* 头：turn 越大，转向右边越多，露出半张侧脸 */}
      <g style={{ transform: `translateX(${turn * 1.6}px)`, transition: `transform .45s ease-out ${turnDelay}s` }}>
        <ellipse cx="30" cy="22" rx="10" ry="11.5" fill={SKIN} />
        <ellipse cx="30" cy="24.5" rx="9.7" ry="9.4" fill={HAIR} />
        {girl && <path d="M27.5 27 Q26 37 30 46 Q34 37 32.5 27 Z" fill={HAIR} />}
        <ellipse cx="19.8" cy="23" rx="1.8" ry="3" fill={SKIN} opacity={1 - turn * 0.8} style={{ transition: `opacity .45s ${turnDelay}s` }} />
        <ellipse cx="40.2" cy="23" rx="1.8" ry="3" fill={SKIN} />
        <path d="M39.5 18 q5 2.5 2.4 7.5 q-1 3 -3.6 4.4 Z" fill={SKIN} opacity={turn} style={{ transition: `opacity .45s ${turnDelay}s` }} />
        {cloth('M19.5 18 Q20 6.5 30 6.5 Q40 6.5 40.5 18 L40.5 20.5 L19.5 20.5 Z')}
        <path d="M19.5 18.5 L40.5 18.5" stroke="#000" strokeOpacity="0.3" strokeWidth="1" />
        {/* 转头时帽檐露出来 */}
        <path d="M40 17.5 l7 1.5 l-1 2 l-6.5 -0.5 Z" fill={OLD} opacity={turn} style={{ transition: `opacity .45s ${turnDelay}s` }} />
      </g>
      </g>
    </g>
  )
}

/** 盘腿坐在树荫下的背影。局部坐标：宽 60、高 64，原点 (30, 64) */
export function Sitter({ x, y, s = 1, camoId, lean = 0 }: Common & { camoId: string; lean?: number }) {
  return (
    <g transform={`translate(${x - 30 * s} ${y - 64 * s}) scale(${s})`}>
      <ellipse cx="30" cy="58" rx="24" ry="6.5" fill={`url(#${camoId})`} />
      <ellipse cx="30" cy="62" rx="26" ry="3" fill="#000" opacity="0.18" />
      <g transform={`rotate(${lean} 30 58)`}>
        <path d="M17 58 L19 31 Q30 26 41 31 L43 58 Z" fill={`url(#${camoId})`} />
        <path d="M19 31 Q30 34 41 31" stroke="#000" strokeOpacity="0.2" fill="none" />
        <rect x="26" y="20" width="8" height="8" fill="#93653f" />
        <ellipse cx="30" cy="15" rx="8.5" ry="9.5" fill={SKIN} />
        <ellipse cx="30" cy="17" rx="8.2" ry="7.8" fill={HAIR} />
        <path d="M21.5 12 Q22 3 30 3 Q38 3 38.5 12 L38.5 14 L21.5 14 Z" fill={`url(#${camoId})`} />
      </g>
    </g>
  )
}

/** 主席台上面朝操场的老人。局部坐标同 Stander */
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

/** 面朝“我”的教官，站在树荫边上。wave：抬手招“我”过去。局部坐标同 Stander */
export function Facing({ x, y, s = 1, camoId, wave = false }: Common & { camoId: string; wave?: boolean }) {
  const camo = `url(#${camoId})`
  return (
    <g transform={`translate(${x - 30 * s} ${y - 160 * s}) scale(${s})`}>
      <ellipse cx="30" cy="160" rx="22" ry="4" fill="#1b1a10" opacity="0.35" />
      <path d="M14 152 h14 v6 q0 2 -2 2 h-12 q-3 0 -3 -2 Z M32 152 h14 v6 q0 2 -2 2 h-12 q-3 0 0 -2 Z" fill="#1c1a15" />
      <path d="M16 88 L44 88 L45 153 L31 153 L30 113 L29 153 L15 153 Z" fill={camo} />
      <path d="M13 47 Q15 40 23 38.5 L37 38.5 Q45 40 47 47 L45.5 90 L14.5 90 Z" fill={camo} />
      <path d="M23 39 L30 48 L37 39" stroke="#2a2d1c" strokeWidth="1.4" fill="none" />
      <rect x="14.5" y="85.5" width="31" height="5" fill={BELT} />
      <rect x="28" y="86" width="4" height="4" fill="#9a8a5a" />
      {/* 垂着的那只手 */}
      <path d="M47 47 L49.5 86 Q48 90 44.5 88 L43.2 52 Z" fill={camo} />
      <ellipse cx="47.4" cy="90.5" rx="2.7" ry="3.6" fill={SKIN} />
      {/* 招手的那只手：抬起来，手掌朝下扇 */}
      <g className={wave ? 'xy-wave' : undefined} style={{ transformOrigin: '15px 47px', transformBox: 'view-box', opacity: wave ? 1 : 0, transition: 'opacity 2s' }}>
        <path d="M13 47 L2 30 L5 27 L17 44 Z" fill={camo} />
        <ellipse cx="2.5" cy="27" rx="3" ry="3.4" fill={SKIN} />
      </g>
      <g style={{ opacity: wave ? 0 : 1, transition: 'opacity 2s' }}>
        <path d="M13 47 L10.5 86 Q12 90 15.5 88 L16.8 52 Z" fill={camo} />
        <ellipse cx="12.6" cy="90.5" rx="2.7" ry="3.6" fill={SKIN} />
      </g>
      <rect x="25.5" y="29" width="9" height="11" fill="#9c6c47" />
      <ellipse cx="30" cy="22" rx="10" ry="11.5" fill={SKIN} />
      <circle cx="26" cy="22" r="1.1" fill="#0c0a08" />
      <circle cx="34" cy="22" r="1.1" fill="#0c0a08" />
      <path d="M26 29 Q30 28 34 29" stroke="#5a3d2a" strokeWidth="1" fill="none" />
      <path d="M19.5 16 Q20 5.5 30 5.5 Q40 5.5 40.5 16 Z" fill={camo} />
      <path d="M18 16 L42 16 Q41 19.5 30 19.5 Q19 19.5 18 16 Z" fill="#3d4428" />
    </g>
  )
}

/**
 * 近在眼前的女生背影（第一人称：“我”就站在她身后一步）。
 * cx 是头的中线，top 是帽顶。比例按 1600×900 画面设计，下半身在画面外。
 */
export function GirlBack({ cx, top, camoId, className }: { cx: number; top: number; camoId: string; className?: string }) {
  const camo = `url(#${camoId})`
  const X = (dx: number) => cx + dx
  const Y = (dy: number) => top + dy
  return (
    <g className={className}>
      {/* 肩膀和后背 */}
      <path d={`M${X(-250)} ${Y(700)} L${X(-236)} ${Y(372)} Q${X(-226)} ${Y(296)} ${X(-120)} ${Y(268)} L${X(-56)} ${Y(244)} L${X(56)} ${Y(244)} L${X(120)} ${Y(268)} Q${X(226)} ${Y(296)} ${X(236)} ${Y(372)} L${X(250)} ${Y(700)} Z`} fill="#5d6740" />
      <path d={`M${X(-250)} ${Y(700)} L${X(-236)} ${Y(372)} Q${X(-226)} ${Y(296)} ${X(-120)} ${Y(268)} L${X(-56)} ${Y(244)} L${X(56)} ${Y(244)} L${X(120)} ${Y(268)} Q${X(226)} ${Y(296)} ${X(236)} ${Y(372)} L${X(250)} ${Y(700)} Z`} fill={camo} />
      {/* 衣服的褶子、背缝 */}
      <path d={`M${X(-150)} ${Y(330)} Q${X(0)} ${Y(372)} ${X(150)} ${Y(330)}`} stroke="#000" strokeOpacity="0.22" strokeWidth="5" fill="none" />
      <path d={`M${X(0)} ${Y(372)} L${X(0)} ${Y(700)}`} stroke="#000" strokeOpacity="0.14" strokeWidth="3" />
      <path d={`M${X(-236)} ${Y(372)} L${X(-226)} ${Y(700)} M${X(236)} ${Y(372)} L${X(226)} ${Y(700)}`} stroke="#000" strokeOpacity="0.18" strokeWidth="10" />
      {/* 汗湿了一大片 */}
      <ellipse cx={X(6)} cy={Y(452)} rx="92" ry="120" fill="#0f1208" opacity="0.26" />
      <ellipse cx={X(0)} cy={Y(300)} rx="70" ry="30" fill="#0f1208" opacity="0.2" />
      {/* 后颈 */}
      <path d={`M${X(-46)} ${Y(170)} L${X(46)} ${Y(170)} L${X(52)} ${Y(258)} Q${X(0)} ${Y(270)} ${X(-52)} ${Y(258)} Z`} fill="#a8774f" />
      <path d={`M${X(-46)} ${Y(200)} Q${X(0)} ${Y(214)} ${X(46)} ${Y(200)}`} stroke="#6e4a2f" strokeOpacity="0.4" strokeWidth="6" fill="none" />
      {/* 脖子上的汗 */}
      {[
        [-22, 224, 3],
        [18, 238, 2.4],
        [30, 210, 2],
      ].map(([dx, dy, r], i) => (
        <circle key={i} cx={X(dx)} cy={Y(dy)} r={r} fill="#f3e6c8" opacity="0.7" />
      ))}
      {/* 领子竖着，压在后颈上 */}
      <path d={`M${X(-70)} ${Y(250)} Q${X(0)} ${Y(232)} ${X(70)} ${Y(250)} L${X(62)} ${Y(282)} Q${X(0)} ${Y(266)} ${X(-62)} ${Y(282)} Z`} fill="#4b5434" />
      <path d={`M${X(-70)} ${Y(250)} Q${X(0)} ${Y(232)} ${X(70)} ${Y(250)} L${X(62)} ${Y(282)} Q${X(0)} ${Y(266)} ${X(-62)} ${Y(282)} Z`} fill={camo} opacity="0.7" />
      {/* 耳朵 */}
      <ellipse cx={X(-88)} cy={Y(126)} rx="13" ry="24" fill="#b07e55" />
      <ellipse cx={X(88)} cy={Y(126)} rx="13" ry="24" fill="#b07e55" />
      {/* 头发：从帽子底下露出来，后颈有碎发 */}
      <path d={`M${X(-86)} ${Y(86)} Q${X(-92)} ${Y(160)} ${X(-48)} ${Y(186)} Q${X(0)} ${Y(196)} ${X(48)} ${Y(186)} Q${X(92)} ${Y(160)} ${X(86)} ${Y(86)} Z`} fill="#17130f" />
      <path d={`M${X(-40)} ${Y(186)} l-4 14 M${X(-22)} ${Y(190)} l-2 12 M${X(26)} ${Y(190)} l3 12 M${X(42)} ${Y(186)} l5 13`} stroke="#17130f" strokeWidth="2" />
      {/* 马尾：从帽子后面的开口穿出来，垂到领子上 */}
      <path d={`M${X(-16)} ${Y(92)} Q${X(-26)} ${Y(170)} ${X(-10)} ${Y(250)} Q${X(2)} ${Y(290)} ${X(6)} ${Y(300)} Q${X(14)} ${Y(260)} ${X(18)} ${Y(200)} Q${X(22)} ${Y(140)} ${X(16)} ${Y(92)} Z`} fill="#120e0b" />
      <path d={`M${X(-4)} ${Y(110)} Q${X(-8)} ${Y(190)} ${X(4)} ${Y(270)}`} stroke="#3a2f26" strokeOpacity="0.6" strokeWidth="2" fill="none" />
      <rect x={X(-17)} y={Y(96)} width="34" height="10" rx="3" fill="#2b1d16" />
      {/* 军帽：后面的调节带 */}
      <path d={`M${X(-100)} ${Y(96)} Q${X(-104)} ${Y(4)} ${X(0)} ${Y(0)} Q${X(104)} ${Y(4)} ${X(100)} ${Y(96)} Q${X(0)} ${Y(82)} ${X(-100)} ${Y(96)} Z`} fill="#5d6740" />
      <path d={`M${X(-100)} ${Y(96)} Q${X(-104)} ${Y(4)} ${X(0)} ${Y(0)} Q${X(104)} ${Y(4)} ${X(100)} ${Y(96)} Q${X(0)} ${Y(82)} ${X(-100)} ${Y(96)} Z`} fill={camo} />
      <path d={`M${X(0)} ${Y(4)} L${X(0)} ${Y(84)} M${X(-60)} ${Y(16)} Q${X(-70)} ${Y(50)} ${X(-64)} ${Y(88)} M${X(60)} ${Y(16)} Q${X(70)} ${Y(50)} ${X(64)} ${Y(88)}`} stroke="#000" strokeOpacity="0.18" strokeWidth="2" fill="none" />
      <path d={`M${X(-34)} ${Y(84)} Q${X(0)} ${Y(64)} ${X(34)} ${Y(84)}`} fill="#120e0b" />
      <path d={`M${X(-46)} ${Y(86)} L${X(46)} ${Y(86)}`} stroke="#3b3f2a" strokeWidth="7" />
      {/* 帽檐从两边露出一点 */}
      <path d={`M${X(-100)} ${Y(92)} l-26 10 l4 8 l24 -6 Z M${X(100)} ${Y(92)} l26 10 l-4 8 l-24 -6 Z`} fill="#3d4428" />
    </g>
  )
}
