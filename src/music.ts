import { audioContext } from './sound'

/* =========================================================================
   MÚSICA AMBIENTE EM CHIPTUNE (sintetizada, sem arquivos de áudio)
   Cada faixa tem acordes, baixo, arpejo, melodia e bateria em 16 passos por compasso.
   ========================================================================= */
export type TrackId = 'menu' | 'office' | 'team' | 'servers' | 'lounge'

type Step = number | null
interface Track {
  bpm: number
  chords: number[][] // notas MIDI de cada compasso
  bass: Step[] // índice da nota do acorde (uma oitava abaixo)
  arp: Step[] // índice da nota do acorde (uma oitava acima)
  lead?: Step[][] // melodia em notas MIDI, um compasso por linha
  kick: string
  snare: string
  hat: string
  waves: { bass: OscillatorType; arp: OscillatorType; lead: OscillatorType }
  volume: number
  swing?: number
  ambience?: 'office'
}

const _ = null
const TRACKS: Record<TrackId, Track> = {
  // Tela inicial: lo-fi noturno, calmo
  menu: {
    bpm: 78,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: [0, _, _, _, _, _, _, _, 0, _, _, _, 2, _, _, _],
    arp: [0, _, 2, _, 3, _, 2, _, 1, _, 3, _, 2, _, 1, _],
    lead: [
      [76, _, _, _, 74, _, 72, _, _, _, _, _, 69, _, _, _],
      [71, _, _, _, _, _, 72, _, 74, _, _, _, _, _, _, _],
      [72, _, _, _, 69, _, _, _, 65, _, _, _, 67, _, _, _],
      [64, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    ],
    kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    waves: { bass: 'triangle', arp: 'triangle', lead: 'sine' }, volume: 0.9, swing: 0.12,
  },
  // Escritório: ambiente calmo de trabalho (piano elétrico, com teclados e telefone ao fundo)
  office: {
    bpm: 84,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    bass: [0, _, _, _, _, _, _, _, 0, _, _, _, _, _, 2, _],
    arp: [0, _, _, 2, _, _, 1, _, _, 3, _, _, 2, _, _, _],
    lead: [
      [_, _, _, _, 76, _, _, _, 74, _, _, _, 72, _, _, _],
      [_, _, _, _, _, _, _, _, 71, _, 72, _, 76, _, _, _],
      [_, _, _, _, 72, _, _, _, 69, _, _, _, _, _, _, _],
      [_, _, _, _, 74, _, 71, _, _, _, _, _, _, _, _, _],
    ],
    kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.',
    waves: { bass: 'triangle', arp: 'sine', lead: 'sine' }, volume: 0.85, swing: 0.1, ambience: 'office',
  },
  // Sala de descanso: bossa relaxada
  lounge: {
    bpm: 90,
    chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]],
    bass: [0, _, _, 2, _, _, 0, _, 2, _, _, 0, _, _, 2, _],
    arp: [_, 0, _, 2, 1, _, 3, _, _, 0, _, 2, 1, _, 3, _],
    lead: [
      [74, _, _, 72, _, _, 69, _, _, _, _, _, _, _, _, _],
      [71, _, _, 72, _, _, 74, _, 77, _, _, _, _, _, _, _],
      [76, _, _, 74, _, _, 72, _, 71, _, _, _, _, _, _, _],
      [69, _, _, _, _, _, 72, _, _, _, 76, _, _, _, _, _],
    ],
    kick: 'x..x....x..x....', snare: '..x..x....x..x..', hat: 'x.x.x.x.x.x.x.x.',
    waves: { bass: 'triangle', arp: 'triangle', lead: 'sine' }, volume: 0.75, swing: 0.15,
  },
  // 2º andar: jazz de elevador com baixo caminhando
  team: {
    bpm: 96,
    chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]],
    bass: [0, _, _, _, 1, _, _, _, 2, _, _, _, 3, _, _, _],
    arp: [_, _, 0, _, _, _, 2, _, _, _, 1, _, _, _, 3, _],
    lead: [
      [77, _, _, 76, 74, _, _, _, 72, _, _, _, _, _, _, _],
      [71, _, _, 72, 74, _, 77, _, 76, _, _, _, _, _, _, _],
      [76, _, _, _, 79, _, _, 76, 72, _, _, _, 71, _, _, _],
      [73, _, _, _, _, _, 76, _, 79, _, 77, _, 76, _, _, _],
    ],
    kick: 'x.......x.......', snare: '........x.......', hat: 'x..x..x.x..x..x.',
    waves: { bass: 'triangle', arp: 'sine', lead: 'triangle' }, volume: 0.9, swing: 0.2,
  },
  // Andar de servidores: eletrônica pulsante
  servers: {
    bpm: 124,
    chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [52, 55, 59]],
    bass: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 2, _],
    arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
    lead: [
      [_, _, _, _, _, _, _, _, 71, _, 74, _, 76, _, _, _],
      [_, _, _, _, _, _, _, _, 72, _, 71, _, 67, _, _, _],
      [_, _, _, _, _, _, _, _, 74, _, 76, _, 78, _, _, _],
      [79, _, _, _, 76, _, _, _, 71, _, _, _, _, _, _, _],
    ],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xx',
    waves: { bass: 'sawtooth', arp: 'square', lead: 'square' }, volume: 0.6,
  },
}

const MASTER = 0.05

let current: TrackId | null = null
let timer: number | null = null
let master: GainNode | null = null
let nextTime = 0
let step = 0

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function tone(ctx: AudioContext, out: AudioNode, midi: number, at: number, length: number, type: OscillatorType, level: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq(midi), at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.linearRampToValueAtTime(level, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

let noiseBuffer: AudioBuffer | null = null
function drum(ctx: AudioContext, out: AudioNode, kind: 'kick' | 'snare' | 'hat', at: number, level: number) {
  if (kind === 'kick') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(140, at)
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12)
    gain.gain.setValueAtTime(level * 1.4, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + 0.18)
    return
  }
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const noise = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  noise.buffer = noiseBuffer
  filter.type = kind === 'hat' ? 'highpass' : 'bandpass'
  filter.frequency.value = kind === 'hat' ? 7000 : 1800
  const length = kind === 'hat' ? 0.04 : 0.12
  gain.gain.setValueAtTime(kind === 'hat' ? level * 0.35 : level * 0.6, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  noise.connect(filter).connect(gain).connect(out)
  noise.start(at)
  noise.stop(at + length + 0.02)
}

/* Sons de escritório ao fundo: alguém digitando e, de vez em quando, um telefone */
function officeAmbience(ctx: AudioContext, out: AudioNode, s: number, bar: number, at: number, sixteenth: number) {
  if (bar % 2 === 0 && s >= 4 && s < 12 && Math.random() < 0.55) {
    for (let k = 0; k < 2; k++) drum(ctx, out, 'hat', at + k * sixteenth * 0.5 + Math.random() * 0.03, 0.18)
  }
  if (bar % 8 === 5 && (s === 0 || s === 2 || s === 8 || s === 10)) {
    tone(ctx, out, 88, at, sixteenth * 1.6, 'sine', 0.05)
    tone(ctx, out, 84, at + sixteenth * 0.8, sixteenth * 1.4, 'sine', 0.05)
  }
}

function schedule(ctx: AudioContext, track: Track, out: AudioNode, index: number, at: number) {
  const sixteenth = 60 / track.bpm / 4
  const s = index % 16
  const bar = Math.floor(index / 16)
  const chord = track.chords[bar % track.chords.length]
  const time = at + (s % 2 && track.swing ? sixteenth * track.swing : 0)
  const v = track.volume
  const bass = track.bass[s]
  if (bass !== null) tone(ctx, out, chord[bass % chord.length] - 24, time, sixteenth * 2.6, track.waves.bass, 0.55 * v)
  const arp = track.arp[s]
  if (arp !== null) tone(ctx, out, chord[arp % chord.length] + 12, time, sixteenth * 1.4, track.waves.arp, 0.16 * v)
  const lead = track.lead?.[bar % track.lead.length]?.[s]
  if (lead !== null && lead !== undefined) tone(ctx, out, lead, time, sixteenth * 3.5, track.waves.lead, 0.22 * v)
  if (track.kick[s] === 'x') drum(ctx, out, 'kick', time, 0.5 * v)
  if (track.snare[s] === 'x') drum(ctx, out, 'snare', time, 0.35 * v)
  if (track.hat[s] === 'x') drum(ctx, out, 'hat', time, 0.3 * v)
  if (track.ambience === 'office') officeAmbience(ctx, out, s, bar, time, sixteenth)
}

export function stopMusic() {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  const ctx = audioContext()
  if (ctx && master) {
    const old = master
    old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15)
    window.setTimeout(() => old.disconnect(), 800)
  }
  master = null
  current = null
}

/** Toca a faixa do lugar onde o jogador está (troca com um fade curto) */
export function playMusic(id: TrackId) {
  if (current === id && timer !== null) return
  stopMusic()
  const ctx = audioContext()
  if (!ctx) return
  const track = TRACKS[id]
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = id === 'servers' ? 3200 : 2400
  master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.setTargetAtTime(MASTER, ctx.currentTime + 0.05, 0.4)
  master.connect(filter).connect(ctx.destination)
  current = id
  step = 0
  nextTime = ctx.currentTime + 0.1
  const out = master
  // Agenda as notas um pouco à frente para o tempo não "tropeçar"
  timer = window.setInterval(() => {
    if (ctx.state !== 'running') { nextTime = ctx.currentTime + 0.1; return }
    while (nextTime < ctx.currentTime + 0.25) {
      schedule(ctx, track, out, step, nextTime)
      nextTime += 60 / track.bpm / 4
      step++
    }
  }, 60)
}

/** Navegadores só liberam áudio depois de um clique ou tecla */
export function unlockAudioOnGesture() {
  const unlock = () => {
    const ctx = audioContext()
    if (ctx?.state === 'suspended') void ctx.resume()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  return () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
}
