/**
 * 全部用 Web Audio 实时合成，不依赖音频素材。
 * 所有声音都送进一个模拟空旷训练馆的混响，让最小的一声敲击也有回音。
 */
type Voice = { vol?: number; pan?: number; wet?: number }

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

  /** 乒：球拍敲在木头上，干脆、清亮 */
  ping(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const out = this.out({ wet: 0.7, ...v })

    const n = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2100
    bp.Q.value = 2.5
    const ng = ctx.createGain()
    this.env(ng, t, 0.9, 0.001, 0.05)
    n.connect(bp).connect(ng).connect(out)
    n.start(t)
    n.stop(t + 0.1)

    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(1350, t)
    o.frequency.exponentialRampToValueAtTime(820, t + 0.06)
    const og = ctx.createGain()
    this.env(og, t, 0.45, 0.001, 0.08)
    o.connect(og).connect(out)
    o.start(t)
    o.stop(t + 0.12)
  }

  /** 咚：从密闭木箱里面传出来的闷响 */
  thump(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.005
    const vol = v.vol ?? 1
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 520
    const out = this.out({ wet: 0.35, ...v, vol: 1 })
    muffle.connect(out)

    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(115, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.18)
    const og = ctx.createGain()
    this.env(og, t, 1.1 * vol, 0.004, 0.32)
    o.connect(og).connect(muffle)
    o.start(t)
    o.stop(t + 0.4)

    const n = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    const ng = ctx.createGain()
    this.env(ng, t, 0.8 * vol, 0.002, 0.14)
    n.connect(lp).connect(ng).connect(muffle)
    n.start(t)
    n.stop(t + 0.2)
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

  /** 老木门的吱呀声 */
  creak(v: Voice = {}) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.01
    const dur = 1.8
    const out = this.out({ wet: 0.7, vol: 0.35, ...v })
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t)
    for (let i = 1; i <= 12; i++) o.frequency.linearRampToValueAtTime(60 + Math.random() * 45, t + (dur * i) / 12)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(700, t)
    bp.frequency.linearRampToValueAtTime(1100, t + dur)
    bp.Q.value = 9
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(1, t + 0.25)
    g.gain.setValueAtTime(1, t + dur - 0.5)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    o.connect(bp).connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
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

  stopAll() {
    this.room?.stop()
    this.room = null
    this.stopHum()
    this.setDrone(0)
  }
}

export const audio = new AudioEngine()
