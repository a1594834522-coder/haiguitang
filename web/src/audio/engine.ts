/**
 * 全部用 Web Audio 实时合成，不依赖音频素材。
 * 所有声音都送进一个模拟空旷训练馆的混响，让最小的一声敲击也有回音。
 */
type Voice = { vol?: number; pan?: number; wet?: number }

/** 每次发声都略有不同：x 上下浮动 r */
const jitter = (x: number, r = 0.05) => x * (1 - r + Math.random() * 2 * r)
// 电平校准（窄带共鸣的输出很小，需要较大的增益）
const PING_LEVEL = 2.3
const CREAK_LEVEL = 2.8

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private dry!: GainNode
  private reverb!: ConvolverNode
  private wetBus!: GainNode
  private noise!: AudioBuffer
  private room: { stop: () => void } | null = null
  private hum: { gain: GainNode; stop: () => void } | null = null
  private droneGain: GainNode | null = null
  private cicadas: { level: GainNode; stop: () => void } | null = null
  private _muted = false
  private listeners = new Set<() => void>()

  get ready() {
    return !!this.ctx && this.ctx.state === 'running'
  }
  get muted() {
    return this._muted
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** 必须在用户手势里调用一次（浏览器自动播放策略） */
  async unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this._muted ? 0 : 0.9
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      this.master.connect(comp).connect(ctx.destination)

      this.dry = ctx.createGain()
      this.dry.connect(this.master)
      this.reverb = ctx.createConvolver()
      this.reverb.buffer = this.impulse(3.2, 2.6)
      this.wetBus = ctx.createGain()
      this.wetBus.gain.value = 0.55
      this.wetBus.connect(this.reverb).connect(this.master)

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state !== 'running') await this.ctx.resume()
    this.emit()
  }

  setMuted(m: boolean) {
    this._muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08)
    this.emit()
  }

  private emit() {
    this.listeners.forEach(f => f())
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  /** 输出链：声像 → 干声 + 混响 */
  private out(v: Voice = {}) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.value = v.vol ?? 1
    const p = ctx.createStereoPanner()
    p.pan.value = v.pan ?? 0
    g.connect(p)
    p.connect(this.dry)
    const send = ctx.createGain()
    send.gain.value = v.wet ?? 0.6
    p.connect(send).connect(this.wetBus)
    return g
  }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    s.loopStart = Math.random()
    return s
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  // ---------- 一次性音效 ----------

  /**
   * 乒：球拍敲在棺材盖上。木头碰木头，脆、短，底下是空的。
   * 一下极短的接触声，激起盖板的几个共鸣；不做音高滑动（滑音会像电子“哔”）。
   */
  ping(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const out = this.out({ wet: 0.7, ...v })
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = jitter(5200, 0.08)
    tone.connect(out)

    const n = this.noiseSrc()
    const burst = ctx.createGain()
    burst.gain.setValueAtTime(0, t)
    burst.gain.linearRampToValueAtTime(1, t + 0.0008)
    burst.gain.exponentialRampToValueAtTime(0.001, t + jitter(0.011, 0.15))
    n.connect(burst)
    n.start(t, Math.random() * 1.8)
    n.stop(t + 0.03)

    // 拍面碰到木板的“嗒”
    const click = ctx.createBiquadFilter()
    click.type = 'highpass'
    click.frequency.value = 1800
    const cg = ctx.createGain()
    cg.gain.value = PING_LEVEL * 0.35
    burst.connect(click).connect(cg).connect(tone)

    // 盖板的共鸣 + 底下空箱子的一点低音
    const board = jitter(1, 0.03)
    for (const [f, q, g] of [
      [560, 14, 5.5],
      [910, 16, 4.2],
      [1460, 14, 2.6],
      [2240, 12, 1.3],
      [190, 5, 2.2],
    ] as const) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = jitter(f * board, 0.015)
      bp.Q.value = q
      const bg = ctx.createGain()
      bg.gain.value = PING_LEVEL * g
      burst.connect(bp).connect(bg).connect(tone)
    }
  }

  /**
   * 咚：有人在密闭的木箱里，从里面拍了一下盖板。
   * 闷、空、短：手掌拍上去的一下噪声冲击，激起木箱的几个共鸣（固定音高、很快衰减，
   * 不做大幅滑音，否则像电子底鼓），紧接着盖板在框上轻轻弹一下。每一下都略有不同。
   */
  thump(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const vol = v.vol ?? 1
    const j = jitter

    // 隔着一层木板，高频几乎都被吃掉
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = j(820)
    muffle.Q.value = 0.4
    const out = this.out({ wet: 0.42, ...v, vol: 1 })
    muffle.connect(out)

    const box = j(1, 0.04) // 整个箱体的音高
    const hit = (at: number, amp: number) => {
      const n = this.noiseSrc()
      const burst = ctx.createGain()
      burst.gain.setValueAtTime(0, at)
      burst.gain.linearRampToValueAtTime(1, at + 0.002)
      burst.gain.exponentialRampToValueAtTime(0.001, at + j(0.03))
      n.connect(burst)
      n.start(at, Math.random() * 1.8)
      n.stop(at + 0.06)

      // 手掌拍在板上的“啪”，被闷住之后只剩中低频
      const slap = ctx.createBiquadFilter()
      slap.type = 'bandpass'
      slap.frequency.value = j(420)
      slap.Q.value = 0.8
      const sg = ctx.createGain()
      sg.gain.value = amp * 0.9
      burst.connect(slap).connect(sg).connect(muffle)

      // 木箱的共鸣：用窄带滤波器让噪声“响”起来，比纯正弦更像木头
      for (const [f, q, g] of [
        [150, 9, 5.5],
        [236, 8, 3.2],
        [371, 6, 1.6],
      ] as const) {
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = j(f * box, 0.02)
        bp.Q.value = q
        const bg = ctx.createGain()
        bg.gain.value = amp * g
        burst.connect(bp).connect(bg).connect(muffle)
      }

      // 箱体最低的一个模态，给一点分量；只有很小的音高回落
      const o = ctx.createOscillator()
      const f0 = 88 * box
      o.frequency.setValueAtTime(f0 * 1.05, at)
      o.frequency.exponentialRampToValueAtTime(f0, at + 0.04)
      const og = ctx.createGain()
      og.gain.setValueAtTime(0, at)
      og.gain.linearRampToValueAtTime(amp * 0.42, at + 0.005)
      og.gain.exponentialRampToValueAtTime(0.0001, at + j(0.2))
      o.connect(og).connect(muffle)
      o.start(at)
      o.stop(at + 0.24)
    }

    hit(t, 1.6 * vol)
    // 盖板在框上弹了一下
    hit(t + j(0.026, 0.2), 0.34 * vol)
  }

  /** 锤子砸钉子：金属 + 木头，尖锐 */
  hammer(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const out = this.out({ wet: 0.8, ...v })
    for (const [f, a, d] of [
      [2380, 0.22, 0.5],
      [3710, 0.14, 0.35],
      [5130, 0.08, 0.25],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const g = ctx.createGain()
      this.env(g, t, a, 0.001, d)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + d + 0.05)
    }
    const n = this.noiseSrc()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2500
    const ng = ctx.createGain()
    this.env(ng, t, 0.7, 0.001, 0.04)
    n.connect(hp).connect(ng).connect(out)
    n.start(t)
    n.stop(t + 0.08)
    const b = ctx.createOscillator()
    b.frequency.setValueAtTime(200, t)
    b.frequency.exponentialRampToValueAtTime(90, t + 0.15)
    const bg = ctx.createGain()
    this.env(bg, t, 0.6, 0.002, 0.2)
    b.connect(bg).connect(out)
    b.start(t)
    b.stop(t + 0.3)
  }

  /** 门把手 / 门扣的“咔哒”：一点金属，一点木头 */
  private latch(t: number, out: AudioNode, amp: number) {
    const ctx = this.ctx!
    const n = this.noiseSrc()
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amp, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.012)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2600
    n.connect(hp).connect(g).connect(out)
    n.start(t, Math.random() * 1.8)
    n.stop(t + 0.03)
    for (const [f, d, a] of [
      [jitter(2950), 0.05, 0.12],
      [jitter(4380), 0.035, 0.07],
      [jitter(210), 0.06, 0.25],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.setValueAtTime(0, t)
      og.gain.linearRampToValueAtTime(amp * a, t + 0.001)
      og.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(og).connect(out)
      o.start(t)
      o.stop(t + d + 0.01)
    }
  }

  /**
   * 老木门的吱呀声。
   * 门轴的吱呀是摩擦“粘住—滑开”一顿一顿发出来的：用一串很窄的脉冲模拟，
   * 脉冲的快慢和力度都不规则地变化，再经过木头和合页的共鸣。
   * 开门前先拧一下把手；关门时吱呀短一些，最后“咔哒”扣上。
   */
  creak(v: Voice & { closing?: boolean } = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const closing = !!v.closing
    const t = ctx.currentTime + 0.01
    const out = this.out({ wet: 0.65, vol: 0.5, ...v })
    if (!closing) this.latch(t, out, 0.3)

    const start = closing ? t : t + jitter(0.16, 0.2)
    const dur = closing ? jitter(1.0, 0.1) : jitter(2.0, 0.1)
    const steps = 220
    const rate = new Float32Array(steps)
    const amp = new Float32Array(steps)
    let wander = 0
    let gap = 0
    for (let i = 0; i < steps; i++) {
      const x = i / (steps - 1)
      // 推门：先慢后快再慢；中段会突然尖一下
      const contour = closing ? 40 + 110 * x : 26 + 120 * Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.15)), 0.8)
      const squeal = !closing && x > 0.42 && x < 0.55 ? 1 + 0.9 * Math.sin(((x - 0.42) / 0.13) * Math.PI) : 1
      wander = wander * 0.85 + (Math.random() - 0.5) * 0.3
      rate[i] = Math.max(10, contour * squeal * (1 + wander))
      // 力度：整体起伏 + 颗粒感，偶尔卡住一下
      if (gap > 0) gap--
      else if (Math.random() < 0.025) gap = 2 + Math.floor(Math.random() * 4)
      const body = Math.pow(Math.sin(Math.PI * x), 0.5)
      amp[i] = gap > 0 ? 0.05 : body * (0.55 + 0.45 * Math.random())
    }
    amp[0] = 0
    amp[steps - 1] = 0

    // 很窄的脉冲：所有谐波等幅叠加
    const H = 64
    const real = new Float32Array(H).fill(1)
    real[0] = 0
    const o = ctx.createOscillator()
    o.setPeriodicWave(ctx.createPeriodicWave(real, new Float32Array(H)))
    o.frequency.setValueCurveAtTime(rate, start, dur)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueCurveAtTime(amp, start, dur)
    o.connect(g)

    const sum = ctx.createGain()
    sum.gain.value = CREAK_LEVEL
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4200
    sum.connect(lp).connect(out)
    // 门板、合页的共鸣
    for (const [f, q, a] of [
      [jitter(640), 6, 1],
      [jitter(1190), 11, 0.8],
      [jitter(1950), 14, 0.55],
      [jitter(2880), 16, 0.3],
    ] as const) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = q
      const bg = ctx.createGain()
      bg.gain.value = a
      g.connect(bp).connect(bg).connect(sum)
    }
    // 一点摩擦的沙沙声，跟着同一条力度走
    const n = this.noiseSrc()
    const nbp = ctx.createBiquadFilter()
    nbp.type = 'bandpass'
    nbp.frequency.value = 2300
    nbp.Q.value = 0.8
    const ng = ctx.createGain()
    ng.gain.value = 0
    ng.gain.setValueCurveAtTime(amp.map(a => a * 0.05), start, dur)
    n.connect(nbp).connect(ng).connect(sum)

    o.start(start)
    o.stop(start + dur + 0.02)
    n.start(start, Math.random() * 1.8)
    n.stop(start + dur + 0.02)

    if (closing) {
      this.latch(start + dur, out, 0.45)
      // 门板撞上门框的闷响
      const b = ctx.createOscillator()
      b.frequency.setValueAtTime(jitter(92), start + dur)
      b.frequency.exponentialRampToValueAtTime(70, start + dur + 0.12)
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0, start + dur)
      bg.gain.linearRampToValueAtTime(0.5, start + dur + 0.004)
      bg.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.22)
      b.connect(bg).connect(out)
      b.start(start + dur)
      b.stop(start + dur + 0.25)
    }
  }

  /** 极轻的气声，像隔着木板的一个字 */
  whisper(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const out = this.out({ wet: 0.5, vol: 0.5, ...v })
    const n = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 6
    bp.frequency.setValueAtTime(3200, t)
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.7)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.12)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    n.connect(bp).connect(lp).connect(g).connect(out)
    n.start(t)
    n.stop(t + 1)
  }

  /** 揭示线索时的不协和长音 */
  sting(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const out = this.out({ wet: 0.9, vol: 0.18, ...v })
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(200, t)
    lp.frequency.exponentialRampToValueAtTime(1600, t + 1.4)
    lp.frequency.exponentialRampToValueAtTime(300, t + 3.5)
    lp.connect(out)
    for (const f of [110, 116.5, 155.6, 233]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = Math.random() * 14 - 7
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 1.2)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
      o.connect(g).connect(lp)
      o.start(t)
      o.stop(t + 3.7)
    }
  }

  /** 盖章的闷声 */
  stamp() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const out = this.out({ wet: 0.15, vol: 0.5 })
    const n = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.7, 0.002, 0.07)
    n.connect(lp).connect(g).connect(out)
    n.start(t)
    n.stop(t + 0.1)
  }

  // ---------- 持续环境声 ----------

  /** 空屋底噪 */
  startRoom(level = 0.05) {
    if (!this.ctx || this.room) return
    const ctx = this.ctx
    const n = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 260
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 3)
    n.connect(lp).connect(g).connect(this.dry)
    n.start()
    this.room = {
      stop: () => {
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5)
        n.stop(ctx.currentTime + 3)
      },
    }
  }

  /** 日光灯管的电流嗡嗡声 */
  startHum(level = 0.012) {
    if (!this.ctx || this.hum) return
    const ctx = this.ctx
    const g = ctx.createGain()
    g.gain.value = level
    g.connect(this.out({ wet: 0.2, pan: 0.05 }))
    const oscs = [100, 200, 300].map((f, i) => {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = [1, 0.35, 0.12][i]
      o.connect(og).connect(g)
      o.start()
      return o
    })
    this.hum = {
      gain: g,
      stop: () => {
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
        oscs.forEach(o => o.stop(ctx.currentTime + 0.5))
      },
    }
  }

  /** 灯管闪烁时的电流噼啪 */
  flicker() {
    if (!this.ctx || !this.hum) return
    const t = this.ctx.currentTime
    const g = this.hum.gain.gain
    const base = g.value
    g.setValueAtTime(0.0001, t)
    g.setValueAtTime(base * 2.2, t + 0.04)
    g.setValueAtTime(0.0001, t + 0.09)
    g.setValueAtTime(base, t + 0.16)
  }

  stopHum() {
    this.hum?.stop()
    this.hum = null
  }

  /** 低频压迫感，随推理推进加重（0~1） */
  setDrone(level: number) {
    if (!this.ctx) return
    const ctx = this.ctx
    if (!this.droneGain) {
      this.droneGain = ctx.createGain()
      this.droneGain.gain.value = 0.0001
      this.droneGain.connect(this.out({ wet: 0.6 }))
      for (const f of [41.2, 43.6, 61.7]) {
        const o = ctx.createOscillator()
        o.frequency.value = f
        o.connect(this.droneGain)
        o.start()
      }
    }
    this.droneGain.gain.setTargetAtTime(Math.max(0.0001, level * 0.09), ctx.currentTime, 2)
  }

  /** 军训的哨子：带“珠子”颤音的尖哨。long 是长哨，否则是两声短哨 */
  whistle(v: Voice & { long?: boolean } = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const out = this.out({ wet: 0.5, vol: 0.32, ...v })
    const blasts = v.long ? [[0, 1.1]] : [[0, 0.16], [0.24, 0.42]]
    for (const [at, len] of blasts) {
      const t = ctx.currentTime + 0.01 + at
      const o = ctx.createOscillator()
      o.frequency.value = jitter(2850, 0.03)
      // 哨子里的小珠子打转，频率一抖一抖
      const fm = ctx.createOscillator()
      fm.frequency.value = jitter(36, 0.15)
      const fmg = ctx.createGain()
      fmg.gain.value = 170
      fm.connect(fmg).connect(o.frequency)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.5, t + 0.015)
      g.gain.setValueAtTime(0.5, t + len - 0.05)
      g.gain.linearRampToValueAtTime(0, t + len)
      o.connect(g).connect(out)
      // 吹气的气声
      const n = this.noiseSrc()
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3000
      bp.Q.value = 1.5
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0, t)
      ng.gain.linearRampToValueAtTime(0.08, t + 0.01)
      ng.gain.linearRampToValueAtTime(0, t + len)
      n.connect(bp).connect(ng).connect(out)
      for (const s of [o, fm]) {
        s.start(t)
        s.stop(t + len + 0.02)
      }
      n.start(t, Math.random() * 1.8)
      n.stop(t + len + 0.02)
    }
  }

  /** 正午的蝉鸣：两群蝉，一左一右，各自一阵一阵地叫 */
  startCicadas(level = 0.05) {
    if (!this.ctx || this.cicadas) return
    const ctx = this.ctx
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 2.5)
    master.connect(this.dry)
    const nodes: AudioScheduledSourceNode[] = []
    for (const [f, rate, pan, swell] of [
      [4600, 118, -0.55, 0.09],
      [5900, 152, 0.6, 0.13],
    ] as const) {
      const n = this.noiseSrc()
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = 4
      // 发声膜的快速振动：方波调幅
      const am = ctx.createGain()
      am.gain.value = 0.5
      const lfo = ctx.createOscillator()
      lfo.type = 'square'
      lfo.frequency.value = rate
      const lfoG = ctx.createGain()
      lfoG.gain.value = 0.5
      lfo.connect(lfoG).connect(am.gain)
      // 一阵强一阵弱
      const sw = ctx.createGain()
      sw.gain.value = 0.6
      const slow = ctx.createOscillator()
      slow.frequency.value = swell
      const slowG = ctx.createGain()
      slowG.gain.value = 0.4
      slow.connect(slowG).connect(sw.gain)
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      n.connect(bp).connect(am).connect(sw).connect(p).connect(master)
      n.start(ctx.currentTime, Math.random() * 1.8)
      lfo.start()
      slow.start()
      nodes.push(n, lfo, slow)
    }
    this.cicadas = {
      level: master,
      stop: () => {
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3)
        nodes.forEach(s => s.stop(ctx.currentTime + 2))
      },
    }
  }

  /** 蝉鸣音量；0 表示突然全部停下 */
  setCicadas(level: number, sudden = false) {
    if (!this.ctx || !this.cicadas) return
    const g = this.cicadas.level.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setTargetAtTime(Math.max(0.0001, level), t, sudden ? 0.015 : 1.2)
  }

  stopCicadas() {
    this.cicadas?.stop()
    this.cicadas = null
  }

  stopAll() {
    this.room?.stop()
    this.room = null
    this.stopHum()
    this.stopCicadas()
    this.setDrone(0)
  }
}

export const audio = new AudioEngine()
