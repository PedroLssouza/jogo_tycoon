/* Sons 8 bits sintetizados com Web Audio: nada de arquivos de áudio */
type Wave = OscillatorType | 'noise'
type Note = [freq: number, duration: number, type?: Wave, slideTo?: number]

const SOUNDS: Record<string, Note[]> = {
  click: [[660, 0.04, 'square']],
  day: [[440, 0.05, 'square'], [660, 0.07, 'square']],
  coin: [[988, 0.06, 'square'], [1319, 0.14, 'square']],
  chomp: [[180, 0.06, 'sawtooth', 90], [140, 0.06, 'sawtooth', 70], [180, 0.06, 'sawtooth', 90]],
  burp: [[120, 0.35, 'sawtooth', 60]],
  shoot: [[880, 0.08, 'square', 220]],
  hit: [[200, 0.12, 'noise']],
  hurt: [[300, 0.2, 'sawtooth', 80]],
  win: [[523, 0.1, 'square'], [659, 0.1, 'square'], [784, 0.1, 'square'], [1047, 0.3, 'square']],
  lose: [[392, 0.15, 'triangle'], [330, 0.15, 'triangle'], [262, 0.4, 'triangle']],
  achievement: [[784, 0.08, 'square'], [988, 0.08, 'square'], [1175, 0.08, 'square'], [1568, 0.25, 'square']],
  event: [[330, 0.08, 'triangle'], [440, 0.08, 'triangle'], [330, 0.12, 'triangle']],
  error: [[180, 0.15, 'square']],
}

let ctx: AudioContext | null = null

/** Contexto de áudio compartilhado (efeitos e música) */
export function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    return ctx
  } catch {
    return null
  }
}
export type Sound = keyof typeof SOUNDS

export function sfx(name: Sound) {
  const ctx = audioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    let at = ctx.currentTime
    for (const [freq, duration, type = 'square', slideTo] of SOUNDS[name]) {
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.07, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
      gain.connect(ctx.destination)
      if (type === 'noise') {
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        const noise = ctx.createBufferSource()
        noise.buffer = buffer
        noise.connect(gain)
        noise.start(at)
      } else {
        const osc = ctx.createOscillator()
        osc.type = type as OscillatorType
        osc.frequency.setValueAtTime(freq, at)
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration)
        osc.connect(gain)
        osc.start(at)
        osc.stop(at + duration)
      }
      at += duration
    }
  } catch {
    // Sem áudio disponível: o jogo segue em silêncio
  }
}
