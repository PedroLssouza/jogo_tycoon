import { useId } from 'react'
import type { CSSProperties } from 'react'
import { isWoman } from './employees'
import type { Contract, Employee } from './types'

const ART = '/art/scenes'
const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` })

/* Vapor, usado em canecas e na cafeteira */
function Steam({ x, y, size = 4 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#e8ecff">
      {[0, 1, 2].map(i => (
        <rect key={i} className="px-steam" x={(i % 2) * size - size / 2} y={0} width={size} height={size} style={delay(i * 0.8)} />
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- MENU */
const MENU_STARS = [[358, 126], [385, 113], [407, 98], [473, 76], [486, 68], [422, 161]]
const MENU_WINDOWS = [[378, 191], [392, 191], [378, 206], [467, 175], [479, 175], [467, 206], [479, 206], [532, 147], [532, 171], [546, 171], [532, 188]]
const MENU_CODE = [[0, 62], [0, 30], [0, 84], [0, 46], [0, 70], [0, 28]]

export function MenuScene() {
  const id = useId()
  return (
    <svg className="px-scene" viewBox="0 0 555 478" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Pessoa programando à noite">
      <defs>
        <clipPath id={`${id}head`}><path d="M118 184H250V226H234V288H128V250H118Z" /></clipPath>
        <clipPath id={`${id}hand`}><path d="M254 325H298V350H280L254 360Z" /></clipPath>
        <clipPath id={`${id}vine`}><path d="M6 100H92V262H6Z" /></clipPath>
        <linearGradient id={`${id}light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd58a" stopOpacity=".16" /><stop offset="1" stopColor="#ffd58a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <image href={`${ART}/menu-scene.png`} width="555" height="478" />

      {MENU_STARS.map(([x, y], i) => <rect key={i} className="px-twinkle" x={x} y={y} width="5" height="5" fill="#fff" style={delay(i * 0.55)} />)}
      {MENU_WINDOWS.map(([x, y], i) => <rect key={i} className="px-window" x={x} y={y} width="8" height="11" fill="#131c52" style={delay(i * 1.7)} />)}
      <rect className="px-shooting" x="520" y="20" width="26" height="3" fill="#dfe6ff" />

      <g transform="translate(268 238)">
        <rect width="118" height="66" fill="#1a2270" />
        {MENU_CODE.map(([x, w], i) => (
          <g key={i}>
            <rect x={6} y={6 + i * 10} width="7" height="4" fill="#6a63f5" />
            <rect className="px-type" x={x + 20} y={6 + i * 10} width={w} height="4" fill={i % 3 === 2 ? '#e3e4ff' : '#8b86ff'} style={delay(i * 0.55)} />
          </g>
        ))}
        <rect className="px-cursor" x="108" y="56" width="5" height="7" fill="#63e8ff" />
      </g>

      <g className="px-bob" clipPath={`url(#${id}head)`}><image href={`${ART}/menu-scene.png`} width="555" height="478" /></g>
      <g className="px-tap" clipPath={`url(#${id}hand)`}><image href={`${ART}/menu-scene.png`} width="555" height="478" /></g>
      <g className="px-sway" clipPath={`url(#${id}vine)`}><image href={`${ART}/menu-scene.png`} width="555" height="478" /></g>
      <Steam x={383} y={314} />
      <path className="px-lamp" d="M214 92H302L352 300H150Z" fill={`url(#${id}light)`} />
    </svg>
  )
}

/* ----------------------------------------------------------- ESCRITÓRIO */
const WOMAN_DESK = { w: 182, h: 136, screen: [78, 4], head: [3, -2], hand: [-2, -6] }
const WOMAN_DESKS = ['desk-white', 'desk-woman-pink', 'desk-woman-yellow'].map(img => ({ img, ...WOMAN_DESK }))
const MAN_DESKS = [
  { img: 'desk-green', w: 190, h: 144, screen: [84, 9], head: [0, 0], hand: [0, 0] },
  { img: 'desk-blue', w: 180, h: 138, screen: [80, 8], head: [2, 0], hand: [-1, -5] },
]
/* Canto superior esquerdo de cada estação, do fundo para a frente */
const SLOTS = [
  [470, 176], [618, 228], [316, 232], [470, 296], [762, 284], [618, 352], [186, 308], [346, 358],
]
/* Ordem em que as vagas são ocupadas */
const FILL_ORDER = [3, 0, 1, 2, 5, 4, 7, 6]
const FIREFLIES = [[40, 150], [150, 60], [230, 40], [20, 430], [120, 440], [900, 160], [1060, 190], [1150, 220], [1180, 380], [1120, 480]]

/* Vasos de onde o bichinho sai: contorno, ponto de partida e vez no ciclo */
const POTS = [
  { path: 'M295 211L300 208H320L325 211V221L324 232L320 238L313 241H304L298 237L295 228Z', x: 298, y: 217, turn: 0 },
  { path: 'M429 148L434 144H457L462 148V157L460 168L456 175L451 178H440L434 174L430 164Z', x: 432, y: 155, turn: 1 },
  { path: 'M153 283L158 279H176L181 283V292L180 301L175 307H160L155 302L153 292Z', x: 155, y: 284, turn: 2 },
]
export const CRITTER = ['..#######..', '..#######..', '..#o###o#..', '###########', '###########', '..#######..']

function Critter({ scale = 2.3 }: { scale?: number }) {
  return (
    <g className="px-critter-body" transform={`scale(${scale})`} shapeRendering="crispEdges">
      {CRITTER.flatMap((row, y) => [...row].map((cell, x) => cell !== '.' && (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.05" height="1.05" fill={cell === 'o' ? '#1b1230' : '#d97757'} />
      )))}
      {[2, 4, 6, 8].map((x, i) => <rect key={x} className={i % 2 ? 'px-leg odd' : 'px-leg'} x={x} y="6" width="1" height="2" fill="#c2613f" />)}
    </g>
  )
}

function Station({ employee, index }: { employee: Employee; index: number }) {
  const id = useId()
  const desks = isWoman(employee.name) ? WOMAN_DESKS : MAN_DESKS
  const desk = desks[index % desks.length]
  const working = employee.state === 'working'
  const tired = employee.energy < 30
  const burnout = employee.state === 'burnout'
  const image = <image href={`${ART}/${desk.img}.png`} width={desk.w} height={desk.h} />
  return (
    <g className={working ? 'px-station working' : 'px-station'}>
      <defs>
        <clipPath id={`${id}head`}><path transform={`translate(${desk.head[0]} ${desk.head[1]})`} d="M23 4H67V29H61V43L36 45L23 35Z" /></clipPath>
        <clipPath id={`${id}hand`}><path transform={`translate(${desk.hand[0]} ${desk.hand[1]})`} d="M62 62L89 56V66L76 72H62Z" /></clipPath>
      </defs>
      <ellipse cx="98" cy="112" rx="88" ry="28" fill="#2b2866" opacity=".28" />
      {image}
      <g transform={`translate(${desk.screen[0]} ${desk.screen[1]}) skewY(20.4)`}>
        <rect x="3" y="3" width="39" height="25" fill="#0b1f49" />
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} className="px-type" x={6 + (i % 2) * 4} y={6 + i * 4.2} width={[26, 18, 22, 28, 14][i]} height="2"
            fill={['#63e8ff', '#4cf17c', '#c084fc', '#63e8ff', '#ffc75a'][i]} style={delay(i * 0.5 + index * 0.35)} />
        ))}
      </g>
      <g className="px-bob" clipPath={`url(#${id}head)`} style={delay(index * -0.4)}>{image}</g>
      <g className="px-tap" clipPath={`url(#${id}hand)`}>{image}</g>
      <g transform="translate(95 146)">
        <rect x="-38" y="-11" width="76" height="16" rx="2" fill="#0a0d2c" opacity=".88" />
        <text className="px-name" y="1" textAnchor="middle">{employee.name.split(' ')[0]}</text>
      </g>
      <g className="px-emote" transform="translate(44 -8)">
        <text className="px-emote-glyph" textAnchor="middle">{burnout ? '🔥' : tired ? '😩' : working ? '💡' : '💤'}</text>
      </g>
    </g>
  )
}

/* Decoração que chega com cada ampliação do escritório */
const ARCADE = [
  '.kkkkkkkkkk.',
  'kppppppppppk',
  'kpkkkkkkkkpk',
  'kpkccccccdpk',
  'kpkcyccccdpk',
  'kpkccccrcdpk',
  'kpkddddddkpk',
  'kpkkkkkkkkpk',
  'kpppppppppk.',
  'kpprpppyppk.',
  'kppppppppk..',
  'kpppppppppk.',
  'kpppppppppk.',
  'kpppppppppk.',
  'kkkkkkkkkkk.',
]
const BEANBAG = ['..kkkkkk..', '.kbbbbbbk.', 'kbbBbbbbbk', 'kbbbbbbbbk', 'kbbbbbbBbk', '.kkkkkkkk.']
const DECOR_COLORS: Record<string, string> = { k: '#0a0d2c', p: '#6b2fd0', c: '#63e8ff', d: '#2a3690', y: '#ffc75a', r: '#ff5277', b: '#d97757', B: '#ffb08f' }

function OfficeDecor({ level, layer }: { level: number; layer: 'back' | 'front' }) {
  if (layer === 'back') {
    return (
      <g>
        {level >= 2 && <g transform="translate(1085 214) skewY(21)"><text className="px-neon" fontSize="17">&lt;CODE/&gt;</text></g>}
        {level >= 3 && (
          <>
            <path className="px-rgb-strip" d="M470 140L1170 410" stroke="#ff5277" strokeWidth="4" />
            <g transform="translate(470 120) skewY(21)"><text className="px-neon gold" fontSize="15">★ SEDE TECH ★</text></g>
          </>
        )}
      </g>
    )
  }
  return (
    <g shapeRendering="crispEdges">
      {level >= 2 && (
        <>
          <g transform="translate(930 362) scale(3)"><Bitmap rows={ARCADE} colors={DECOR_COLORS} /><rect className="px-cursor" x="4" y="4" width="4" height="1" fill="#4cf17c" /></g>
        </>
      )}
      {level >= 3 && (
        <>
          <g transform="translate(510 438) scale(3)"><Bitmap rows={BEANBAG} colors={DECOR_COLORS} /></g>
          <g transform="translate(560 452) scale(3)"><Bitmap rows={BEANBAG} colors={{ ...DECOR_COLORS, b: '#4c8dff', B: '#9cc0ff' }} /></g>
        </>
      )}
    </g>
  )
}

/* O tutor sai do elevador, toma um café no balcão e volta (tamanho de gente) */
function TutorWalker() {
  const id = useId()
  return (
    <g className="px-walker" shapeRendering="crispEdges">
      <defs><clipPath id={`${id}head`}><rect width="24" height="20.5" /></clipPath></defs>
      <g className="px-walker-flip">
        <g transform="translate(-15 -66) scale(1.27)">
          {/* pernas: andando ou paradas */}
          <g className="px-legs-walk">
            <rect className="px-step" x="5" y="37" width="5" height="13" fill="#1b1b24" /><rect className="px-step" x="4" y="49" width="7" height="3" fill="#0a0a12" />
            <rect className="px-step odd" x="14" y="37" width="5" height="13" fill="#1b1b24" /><rect className="px-step odd" x="13" y="49" width="7" height="3" fill="#0a0a12" />
          </g>
          <g className="px-legs-stand">
            <rect x="6" y="37" width="5" height="13" fill="#1b1b24" /><rect x="5" y="49" width="7" height="3" fill="#0a0a12" />
            <rect x="13" y="37" width="5" height="13" fill="#1b1b24" /><rect x="12" y="49" width="7" height="3" fill="#0a0a12" />
          </g>
          {/* tronco de terno, camisa e gravata */}
          <rect x="3" y="19" width="18" height="19" fill="#0a0a1e" />
          <rect x="4" y="20" width="16" height="17" fill="#2a2a36" />
          <path d="M9 20H15L12 27Z" fill="#f0f0f6" />
          <rect x="11" y="21" width="2" height="11" fill="#8c1c2c" />
          <rect x="16" y="24" width="2" height="2" fill="#ffffff" />
          {/* braço esquerdo */}
          <rect x="0" y="20" width="4" height="15" fill="#2a2a36" /><rect x="0" y="35" width="4" height="3" fill="#e2b08e" />
          {/* cabeça (retrato do tutor) */}
          <image href={`${ART}/tutor.png`} width="24" height="28" clipPath={`url(#${id}head)`} style={{ imageRendering: 'pixelated' }} />
          {/* braço direito com a xícara: gira até a boca para tomar o café */}
          <g transform="translate(21.5 21.5)">
            <g className="px-sip">
              <rect x="-1.5" y="-1" width="4" height="15" fill="#2a2a36" />
              <rect x="-1.5" y="14" width="4" height="3" fill="#e2b08e" />
              <g className="px-cup">
                <rect x="-3" y="11" width="6" height="6" fill="#f4f0ea" /><rect x="3" y="12" width="2" height="3" fill="#f4f0ea" />
                <rect x="-2" y="11" width="4" height="1" fill="#6b3a1e" />
                <rect className="px-steam" x="-1" y="7" width="2" height="2" fill="#e8ecff" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

/* Porta do elevador sobre a porta do escritório: clique para trocar de andar */
function ElevatorDoor({ floor, onClick }: { floor: number; onClick?: () => void }) {
  return (
    <g className={onClick ? 'px-lift clickable' : 'px-lift'} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} aria-label="Elevador"
      onClick={onClick} onKeyDown={event => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick() } }}>
      <g transform="translate(1073 255) skewY(21.6)" shapeRendering="crispEdges">
        <rect x="0" y="0" width="58" height="122" fill="#2b3157" />
        <rect x="5" y="8" width="48" height="112" fill="#0d1030" />
        <rect className="px-lift-left" x="5" y="8" width="24" height="112" fill="#9aa3c0" />
        <rect className="px-lift-right" x="29" y="8" width="24" height="112" fill="#8891b0" />
        <rect className="px-lift-left" x="27" y="8" width="2" height="112" fill="#5a6290" />
        <rect className="px-lift-left" x="8" y="12" width="2" height="104" fill="#c9d0ff" opacity=".6" />
        <rect x="14" y="-14" width="30" height="12" fill="#0a0d2c" />
        <text x="29" y="-4.5" className="px-lift-num" textAnchor="middle">▲{floor}</text>
        <rect x="56" y="58" width="6" height="14" fill="#0a0d2c" />
        <rect className="px-lift-btn" x="57.5" y="61" width="3" height="3" fill="#ffc75a" />
      </g>
      {onClick && <text x="1102" y="438" className="px-lift-hint" textAnchor="middle">ELEVADOR</text>}
    </g>
  )
}

export function OfficeScene({ employees, onHire, desks = SLOTS.length, level = 1, floor = 1, walker = true, onElevator, offset = 0 }: { employees: Employee[]; onHire: () => void; desks?: number; level?: number; floor?: number; walker?: boolean; onElevator?: () => void; offset?: number }) {
  const id = useId()
  const staffed = employees.slice(0, SLOTS.length).map((employee, index) => ({ employee, index, slot: FILL_ORDER[index] }))
  const vacancy = staffed.length < Math.min(desks, SLOTS.length) ? FILL_ORDER[staffed.length] : undefined
  return (
    <svg className="px-scene" viewBox="0 0 1198 565" preserveAspectRatio="xMaxYMid slice" aria-label="Escritório">
      <defs>
        <clipPath id={`${id}glass`}><path d="M76 183L462 0V55L76 232Z" /></clipPath>
        <clipPath id={`${id}glass2`}><path d="M860 466L1080 356V450L970 505H860Z" /></clipPath>
      </defs>
      <image href={`${ART}/office-empty.png`} width="1198" height="565" />

      <g clipPath={`url(#${id}glass)`}><path className="px-glint" d="M0 0H30L-70 320H-100Z" fill="#fff" opacity=".28" /></g>
      <g clipPath={`url(#${id}glass2)`}><path className="px-glint late" d="M820 300H845L760 560H735Z" fill="#fff" opacity=".28" /></g>
      <path className="px-sign" d="M548 62L748 126V219L548 148Z" fill="#b06bff" />
      {[[789, 162], [825, 184], [846, 192], [807, 193], [843, 224]].map(([x, y], i) => (
        <rect key={i} className="px-note" x={x - 6} y={y - 6} width="12" height="12" fill={['#4cf17c', '#ff9142', '#ffc75a', '#63e8ff', '#ff5277'][i]} style={delay(i * 1.3)} />
      ))}
      {[0, 1, 2].map(i => <circle key={i} className="px-bubble" cx={914 + i * 6} cy="264" r="2" fill="#fff" style={delay(i * 0.9)} />)}
      <rect className="px-cursor" x="972" y="268" width="4" height="3" fill="#4cf17c" />
      <Steam x={1008} y={290} />
      <Steam x={1038} y={294} />
      {FIREFLIES.map(([x, y], i) => <rect key={i} className="px-firefly" x={x} y={y} width="4" height="4" fill="#d8ff7a" style={delay(i * 0.7)} />)}

      {POTS.map(pot => (
        <g key={pot.turn}>
          <clipPath id={`${id}pot${pot.turn}`}><path d={pot.path} /></clipPath>
          <g transform={`translate(${pot.x} ${pot.y})`}>
            <g className="px-critter" style={delay(pot.turn * 9)}><Critter /></g>
          </g>
          <image href={`${ART}/office-empty.png`} width="1198" height="565" clipPath={`url(#${id}pot${pot.turn})`} />
        </g>
      ))}

      <OfficeDecor level={level} layer="back" />

      {[...staffed].sort((a, b) => SLOTS[a.slot][1] - SLOTS[b.slot][1]).map(({ employee, index, slot }) => (
        <g key={employee.id} transform={`translate(${SLOTS[slot][0]} ${SLOTS[slot][1]}) scale(.82)`}>
          <Station employee={employee} index={index + offset} />
        </g>
      ))}

      <OfficeDecor level={level} layer="front" />
      <ElevatorDoor floor={floor} onClick={onElevator} />
      {walker && <TutorWalker />}

      {vacancy !== undefined && (
        <g className="px-vacancy" transform={`translate(${SLOTS[vacancy][0] + 76} ${SLOTS[vacancy][1] + 74})`} role="button" tabIndex={0} aria-label="Contratar funcionário"
          onClick={onHire} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onHire() } }}>
          <path d="M0 -34L80 0L0 34L-80 0Z" />
          <text y="6" textAnchor="middle">+ CONTRATAR</text>
        </g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------- CONTRATOS */
const BUILDINGS: Record<NonNullable<Contract['buildingType']>, { hue: number; badge: string }> = {
  retail: { hue: 0, badge: '🛒' },
  delivery: { hue: 110, badge: '🛵' },
  ead: { hue: 45, badge: '🎓' },
  fintech: { hue: -70, badge: '💳' },
  health: { hue: -110, badge: '🏥' },
}
const LIT_WINDOWS = [[140, 128, 20, 34], [96, 168, 18, 28], [190, 126, 22, 36], [232, 104, 20, 36], [190, 178, 18, 34], [214, 168, 16, 34]]

export function BuildingScene({ type = 'retail' }: { type?: Contract['buildingType'] }) {
  const id = useId()
  const { hue, badge } = BUILDINGS[type]
  return (
    <svg className="px-scene" viewBox="0 18 320 320" preserveAspectRatio="xMidYMid slice">
      <defs><clipPath id={id}><path d="M78 76L175 40L266 74V262L175 308L72 262L50 214L78 200Z" /></clipPath></defs>
      <image href={`${ART}/building.png`} width="320" height="355" />
      <g className="px-cloud" fill="#c5d8ff" opacity=".85">
        <rect x="-60" y="34" width="44" height="9" /><rect x="-50" y="27" width="24" height="8" />
      </g>
      <g clipPath={`url(#${id})`}>
        <image href={`${ART}/building.png`} width="320" height="355" style={hue ? { filter: `hue-rotate(${hue}deg)` } : undefined} />
        {LIT_WINDOWS.map(([x, y, w, h], i) => <rect key={i} className="px-window" x={x} y={y} width={w} height={h} fill="#2c2a6e" style={delay(i * 1.9)} />)}
      </g>
      <g className="px-badge"><rect x="222" y="262" width="80" height="66" rx="6" fill="#0a0d2c" /><text x="262" y="310" fontSize="44" textAnchor="middle">{badge}</text></g>
    </svg>
  )
}

/* ------------------------------------------------------------- FUNDAÇÃO */
export function FoundingScene({ hue }: { hue: number }) {
  const id = useId()
  return (
    <svg className="px-scene" viewBox="0 0 320 355" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <clipPath id={`${id}b`}><path d="M78 76L175 40L266 74V262L175 308L72 262L50 214L78 200Z" /></clipPath>
        <clipPath id={`${id}h`}><rect width="78" height="60" /></clipPath>
      </defs>
      <image href={`${ART}/building.png`} width="320" height="355" />
      <g className="px-cloud" fill="#c5d8ff" opacity=".85">
        <rect x="-60" y="34" width="44" height="9" /><rect x="-50" y="27" width="24" height="8" />
      </g>
      <g clipPath={`url(#${id}b)`}>
        <image href={`${ART}/building.png`} width="320" height="355" style={{ filter: `hue-rotate(${hue}deg)` }} />
        {LIT_WINDOWS.map(([x, y, w, h], i) => <rect key={i} className="px-window" x={x} y={y} width={w} height={h} fill="#2c2a6e" style={delay(i * 1.9)} />)}
      </g>
      <g transform="translate(22 238) scale(1.35)">
        <image href={`${ART}/founder.png`} width="78" height="87" />
        <g className="px-bob" clipPath={`url(#${id}h)`}><image href={`${ART}/founder.png`} width="78" height="87" /></g>
        <g className="px-eyes" fill="#f0b48c"><rect x="33" y="32" width="9" height="11" /><rect x="51" y="32" width="9" height="11" /></g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------- VITÓRIA */
export function VictoryScene() {
  const id = useId()
  return (
    <svg className="px-scene" viewBox="0 0 359 161" role="img" aria-label="Pessoa comemorando a entrega">
      <defs><clipPath id={`${id}rays`}><path d="M240 2H325V82H276L262 50H240Z" /></clipPath></defs>
      <image href={`${ART}/victory.png`} width="359" height="161" />
      <g className="px-rays" clipPath={`url(#${id}rays)`}><image href={`${ART}/victory.png`} width="359" height="161" /></g>
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} className="px-confetti" x={(i * 47) % 355} y="-8" width="5" height="5" fill={['#ffc75a', '#4cf17c', '#ff5277', '#63e8ff', '#c084fc'][i % 5]} style={delay(i * 0.27)} />
      ))}
    </svg>
  )
}

/* -------------------------------------------------------------- RETRATOS */
const FACES = 4

export function Portrait({ name, index, color }: { name: string; index: number; color: string }) {
  // Índice negativo: quem trabalha é o coringa Claude
  if (index < 0) {
    return <span className="px-portrait claude" aria-hidden="true"><svg viewBox="-1 -2 13 13"><Critter scale={1} /></svg></span>
  }
  return (
    <span className="px-portrait" style={{ background: color }} aria-hidden="true">
      <img src={`${ART}/${isWoman(name) ? 'woman' : 'face'}-${(index % FACES) + 1}.png`} alt="" style={delay(index * -0.5)} />
    </span>
  )
}

export function ClaudeIcon() {
  return <svg className="px-icon claude" viewBox="-1 -1 13 10" aria-hidden="true"><Critter scale={1} /></svg>
}

/* ---------------------------------------------------------------- MOEDA */
export function SpinningCoin() {
  return <span className="px-coin" aria-hidden="true" style={{ backgroundImage: `url(${ART}/coin.png)` }} />
}

/* ---------------------------------------------------------------- ÍCONES */
const ICON_COLORS: Record<string, string> = {
  k: '#0a0d2c', w: '#ffffff', s: '#f7c49a', h: '#4a2a1e', H: '#2b2f6b', c: '#63e8ff', g: '#4cf17c',
  y: '#ffc75a', o: '#c97a1c', p: '#f4e3bd', r: '#ff5277', b: '#7c86d8', d: '#3f478f',
}
const ICONS = {
  people: [
    '................',
    '...kkkk.........',
    '..khhhhk..kkkk..',
    '..khhhhk.kHHHHk.',
    '..khsssk.kHHHHk.',
    '..kssssk.kHsssk.',
    '...kssk..kssssk.',
    '..kkkkkk..kssk..',
    '.kggggggkkkkkkk.',
    'kggggggggkccccck',
    'kggggggggkccccck',
    'kgkggggkgkccckck',
    'kgkggggkgkccckck',
    'kkkkkkkkkkkkkkkk',
  ],
  contract: [
    '..kkkkkkkkkk....',
    '.kppppppppppk...',
    '.kpkkkkkkkppkk..',
    '.kpppppppppppk..',
    '.kpkkkkkkkkppk..',
    '.kpppppppppppk..',
    '.kpkkkkkppppkkk.',
    '.kpppppppppkrrrk',
    '.kpkkkkkkpkrryrk',
    '.kpppppppkrryyrk',
    '.kpdkdkdppkrrrk.',
    '.kppppppppkkrkk.',
    '.kkkkkkkkkkrkrk.',
    '...........k.k..',
  ],
  gpu: [
    '................',
    '.kkkkkkkkkkkkkk.',
    'bkdddddddddddddk',
    'bkdkkkkddkkkkddk',
    'bkdkcckddkcckdgk',
    'bkkcwwckkcwwckdk',
    'bkkcwwckkcwwckgk',
    'bkdkcckddkcckddk',
    'bkdkkkkddkkkkdgk',
    'bkdddddddddddddk',
    '.kkkkkkkkkkkkkk.',
    '..kyykyykyykyk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  office: [
    '...kkkkkkkkkk...',
    '..kbbbbbbbbbbk..',
    '..kbyybyybyybk..',
    '..kbyybyybyybk..',
    '..kbbbbbbbbbbk..',
    '..kbyybyybyybk..',
    '..kbyybyybyybk..',
    '..kbbbbbbbbbbk..',
    '..kbyybyybyybk..',
    '..kbyybyybyybk..',
    '..kbbbbbbbbbbk..',
    '..kbbbkookbbbk..',
    '..kbbbkookbbbk..',
    'kkkkkkkkkkkkkkkk',
  ],
}

export function PixelIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="px-icon" viewBox="0 0 16 14" shapeRendering="crispEdges" aria-hidden="true">
      {ICONS[name].flatMap((row, y) => [...row].map((cell, x) => cell !== '.' && (
        <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={ICON_COLORS[cell]} />
      )))}
    </svg>
  )
}

/* ------------------------------------------------------- PLACA DE VÍDEO */
const GPU_COLORS: Record<string, string> = {
  k: '#0a0d2c', d: '#2f3446', D: '#4a5068', s: '#c0c4d0', g: '#2e8b57', y: '#ffc75a', f: '#1a1d2a', F: '#9aa0bc', c: '#63e8ff',
}
const GPU_BODY = [
  'kk......................',
  'skkkkkkkkkkkkkkkkkkkkkkk',
  'skDDDDDDDDDDDDDDDDDDDDDk',
  'skddddddddddddddddddddDk',
  'skddddddddddddddddddddDk',
  'skddddddddddddddddddddDk',
  'skddddddddddddddddddddDk',
  'skddddddddddddddddddddDk',
  'skddddddddddddddddddddDk',
  'skkkkkkkkkkkkkkkkkkkkkkk',
  'sk.ggggggggggggggggggggk',
  'kk...kykykykykykykykk...',
]
const FAN_A = ['..kkk..', '.kfffk.', 'kfFfFfk', 'kffcffk', 'kfFfFfk', '.kfffk.', '..kkk..']
const FAN_B = ['..kkk..', '.kfFfk.', 'kffFffk', 'kFFcFFk', 'kffFffk', '.kfFfk.', '..kkk..']

function Bitmap({ rows, colors, x = 0, y = 0 }: { rows: string[]; colors: Record<string, string>; x?: number; y?: number }) {
  return <>{rows.flatMap((row, j) => [...row].map((cell, i) => cell !== '.' && (
    <rect key={`${i}-${j}`} x={x + i} y={y + j} width="1.02" height="1.02" fill={colors[cell]} />
  )))}</>
}

/** Placa de vídeo em pixel art (24 x 12), com ventoinhas girando e faixa RGB */
export function GpuArt() {
  return (
    <g className="px-gpu-art">
      <Bitmap rows={GPU_BODY} colors={GPU_COLORS} />
      <rect className="px-rgb" x="3" y="2" width="19" height="1" fill="#ff5277" />
      {[4, 13].map(x => (
        <g key={x}>
          <g className="px-fan-a"><Bitmap rows={FAN_A} colors={GPU_COLORS} x={x} y={2.5} /></g>
          <g className="px-fan-b"><Bitmap rows={FAN_B} colors={GPU_COLORS} x={x} y={2.5} /></g>
        </g>
      ))}
      <rect x="20" y="4" width="1" height="4" fill="#4cf17c" className="px-led" />
    </g>
  )
}

export function GpuIcon() {
  return <svg className="px-gpu" viewBox="-0.5 -0.5 25 13" shapeRendering="crispEdges" aria-hidden="true"><GpuArt /></svg>
}

/* ----------------------------------------------------------------- TUTOR */
export type TutorAct = 'idle' | 'see' | 'gulp' | 'chew' | 'burp'

/* Onomatopeias de cada ato: texto e posição (centro) */
const TUTOR_LINES: Record<Exclude<TutorAct, 'idle'>, Array<[string, number, number]>> = {
  see: [['!!', 3, -1]],
  gulp: [['NHAC!', 12, -3]],
  chew: [['CRUNCH', 7, -3], ['CROC', 25, 5], ['NHOM', -1, 7]],
  burp: [['*arroto*', 12, -3], ['+TURBO', 12, 26]],
}

/* Bocas desenhadas por cima da original (x 9 a 14, a partir da linha 14) */
const MOUTH_COLORS: Record<string, string> = { k: '#1a0a0e', r: '#5a1420', w: '#f4f0ea', t: '#d9536a' }
const MOUTHS = {
  smile: ['k....k', '.kwwk.', '..kk..'],
  open: ['.kkkk.', 'kwwwwk', 'krrrrk', 'krrrrk', 'krttrk', '.kkkk.'],
  chewOpen: ['......', 'kwwwwk', 'krttrk', '.kkkk.'],
  chewShut: ['k....k', '.kkkk.'],
  burp: ['......', '..kk..', '.krrk.', '.krrk.', '..kk..'],
}

function Mouth({ shape, className }: { shape: keyof typeof MOUTHS; className?: string }) {
  return <g className={className}><Bitmap rows={MOUTHS[shape]} colors={MOUTH_COLORS} x={9} y={14} /></g>
}

export function TutorScene({ act }: { act: TutorAct }) {
  const tutor = <image href={`${ART}/tutor.png`} width="24" height="28" style={{ imageRendering: 'pixelated' }} />
  return (
    <svg className={`px-tutor act-${act}`} viewBox="-6 -9 36 38" shapeRendering="crispEdges" role="img" aria-label="Tutor">
      <g className="px-tutor-head">
        {tutor}
        {act === 'see' && <Mouth shape="smile" />}
        {act === 'gulp' && <Mouth shape="open" />}
        {act === 'chew' && <><Mouth shape="chewOpen" className="px-chew-a" /><Mouth shape="chewShut" className="px-chew-b" /></>}
        {act === 'burp' && <Mouth shape="burp" />}
        <g className="px-tutor-blink" fill="#e2b08e"><rect x="8" y="10" width="2" height="1" /><rect x="14" y="10" width="2" height="1" /></g>
        <g className="px-eyes-star" fill="#ffc75a">
          <rect x="8" y="9" width="2" height="3" /><rect x="7" y="10" width="4" height="1" />
          <rect x="14" y="9" width="2" height="3" /><rect x="13" y="10" width="4" height="1" />
        </g>
        <g className="px-eyes-happy">
          <rect x="7" y="9.5" width="4" height="2" fill="#e2b08e" /><rect x="13" y="9.5" width="4" height="2" fill="#e2b08e" />
          <rect x="7" y="11" width="1" height="1" fill="#1e1a1c" /><rect x="8" y="10" width="2" height="1" fill="#1e1a1c" /><rect x="10" y="11" width="1" height="1" fill="#1e1a1c" />
          <rect x="13" y="11" width="1" height="1" fill="#1e1a1c" /><rect x="14" y="10" width="2" height="1" fill="#1e1a1c" /><rect x="16" y="11" width="1" height="1" fill="#1e1a1c" />
        </g>
        <g className="px-eyes-rgb"><rect x="8" y="10" width="2" height="1" /><rect x="14" y="10" width="2" height="1" /></g>
        <g className="px-cheeks" fill="#2a2224"><rect x="3" y="12" width="2" height="5" /><rect x="19" y="12" width="2" height="5" /></g>
      </g>

      <g className="px-snack"><GpuArt /></g>

      {act === 'chew' && Array.from({ length: 10 }, (_, i) => (
        <rect key={i} className="px-chip" x={11 + (i % 3)} y="16" width="1" height="1" fill={['#63e8ff', '#ffc75a', '#4cf17c', '#9aa0bc', '#ff5277'][i % 5]}
          style={{ animationDelay: `${i * 0.11}s`, '--dx': `${(i % 2 ? 1 : -1) * (4 + (i % 4) * 3)}px` } as CSSProperties} />
      ))}
      {act === 'burp' && [0, 1, 2, 3, 4].map(i => <rect key={i} className="px-puff" x={10 + i} y={14 - (i % 2)} width="1.5" height="1.5" fill="#c9d0ff" style={{ ...delay(i * 0.1), '--dx': `${(i - 2) * 3}px` } as CSSProperties} />)}

      {act !== 'idle' && TUTOR_LINES[act].map(([line, x, y], i) => (
        <text key={`${act}-${line}`} className={`px-pop pop-${i}`} x={x} y={y} textAnchor="middle" style={delay(i * 0.35)}>{line}</text>
      ))}
    </svg>
  )
}

/* -------------------------------------------------- ANDAR DE SERVIDORES */
export interface RackView { client: string | null; daysLeft: number }

export function ServerRoom({ racks, onElevator }: { racks: RackView[]; onElevator: () => void }) {
  return (
    <svg className="px-scene px-servers" viewBox="0 0 1198 565" preserveAspectRatio="xMidYMid meet" aria-label="Sala de servidores" shapeRendering="crispEdges">
      <rect width="1198" height="565" fill="#0b0f2c" />
      <rect y="0" width="1198" height="300" fill="#141a44" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 104} y="0" width="6" height="300" fill="#10153a" />)}
      <rect y="40" width="1198" height="10" fill="#2a3070" /><rect y="62" width="1198" height="6" fill="#ffc75a" opacity=".5" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${40 + i * 125} 50 Q ${70 + i * 125} 95 ${100 + i * 125} 50`} stroke="#4cf17c" strokeWidth="3" fill="none" opacity=".55" />)}
      <rect y="300" width="1198" height="265" fill="#0d1238" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} y={300 + i * 28} width="1198" height="2" fill="#1a2058" />)}
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={i * 90} y="300" width="2" height="265" fill="#1a2058" />)}
      <rect className="px-cold" x="20" y="470" width="1020" height="30" fill="#63e8ff" opacity=".08" />
      <text x="530" y="30" className="px-neon" textAnchor="middle" fontSize="20">◆ DATA CENTER ◆</text>

      {racks.map((rack, i) => {
        const x = 30 + i * 125
        const rented = Boolean(rack.client)
        return (
          <g key={i} transform={`translate(${x} 130)`}>
            <rect x="100" y="8" width="12" height="330" fill="#070a22" />
            <rect x="0" y="0" width="100" height="340" fill="#0a0d2c" />
            <rect x="5" y="5" width="90" height="330" fill={rented ? '#1d2566' : '#151a3e'} />
            {Array.from({ length: 11 }, (_, j) => (
              <g key={j} transform={`translate(10 ${14 + j * 28})`}>
                <rect width="80" height="22" fill="#0b0f2c" />
                <rect x="4" y="9" width="44" height="4" fill="#2a3070" />
                <rect className={rented ? 'px-led' : ''} x="56" y="8" width="5" height="5" fill={rented ? ['#4cf17c', '#63e8ff', '#ffc75a'][(i + j) % 3] : '#3a2030'} style={{ animationDelay: `${((i * 7 + j * 3) % 10) / 10}s` }} />
                <rect className={rented ? 'px-led' : ''} x="66" y="8" width="5" height="5" fill={rented ? '#4cf17c' : '#3a2030'} style={{ animationDelay: `${((i * 3 + j * 5) % 10) / 10 + .3}s` }} />
              </g>
            ))}
            <rect x="0" y="-34" width="100" height="26" fill={rented ? '#4cf17c' : '#2a3070'} />
            <text x="50" y="-16" textAnchor="middle" className="px-rack-label" fill={rented ? '#06200e' : '#c9d0ff'}>{rented ? rack.client : 'LIVRE'}</text>
            {rented && <text x="50" y="358" textAnchor="middle" className="px-rack-days">{rack.daysLeft}d</text>}
          </g>
        )
      })}

      <g className="px-lift clickable" role="button" tabIndex={0} aria-label="Elevador" onClick={onElevator}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onElevator() } }}>
        <rect x="1052" y="130" width="120" height="340" fill="#2b3157" />
        <rect x="1062" y="150" width="100" height="320" fill="#0d1030" />
        <rect className="px-lift-left" x="1062" y="150" width="50" height="320" fill="#9aa3c0" />
        <rect className="px-lift-right" x="1112" y="150" width="50" height="320" fill="#8891b0" />
        <rect x="1086" y="100" width="52" height="24" fill="#0a0d2c" />
        <text x="1112" y="118" className="px-lift-num big" textAnchor="middle">▲3</text>
        <text x="1112" y="500" className="px-lift-hint" textAnchor="middle">ELEVADOR</text>
      </g>
    </svg>
  )
}

/* ------------------------------------------- SALA DE JOGOS E DESCANSO */
export interface Lounger { employee: Employee; index: number }

/* Lugares da sala: [x, y, pose] — sentado no sofá/pufe ou de pé jogando */
const LOUNGE_SPOTS: Array<[number, number, 'sit' | 'stand']> = [
  [300, 372, 'sit'], [380, 372, 'sit'], [460, 372, 'sit'],
  [640, 420, 'stand'], [862, 420, 'stand'], [1020, 418, 'stand'],
  [150, 450, 'sit'], [560, 470, 'sit'],
]

function Resting({ person, x, y, pose }: { person: Lounger; x: number; y: number; pose: 'sit' | 'stand' }) {
  const { employee, index } = person
  const face = `${ART}/${isWoman(employee.name) ? 'woman' : 'face'}-${(index % 4) + 1}.png`
  const burnout = employee.state === 'burnout'
  return (
    <g transform={`translate(${x} ${y})`} className="px-lounger" style={delay(index * -0.7)}>
      {pose === 'stand'
        ? <><rect x="-14" y="44" width="11" height="40" fill="#1b2340" /><rect x="3" y="44" width="11" height="40" fill="#1b2340" /></>
        : <><rect x="-20" y="44" width="40" height="12" fill="#1b2340" /><rect x="10" y="44" width="11" height="30" fill="#1b2340" /></>}
      <g className="px-lounger-body">
        <image href={face} x="-29" y="-24" width="58" height="68" style={{ imageRendering: 'pixelated' }} />
      </g>
      <rect x="-38" y="-30" width="76" height="14" fill="#0a0d2c" opacity=".85" />
      <text y="-19" textAnchor="middle" className="px-name">{employee.name.split(' ')[0]}</text>
      <text x="30" y="-28" className="px-emote-glyph">{burnout ? '🔥' : pose === 'stand' ? '🎮' : employee.energy < 40 ? '💤' : '☕'}</text>
    </g>
  )
}

export function LoungeScene({ people, psychologist, built }: { people: Lounger[]; psychologist: boolean; built: boolean }) {
  return (
    <svg className={built ? 'px-scene px-lounge' : 'px-scene px-lounge closed'} viewBox="0 0 1198 565" preserveAspectRatio="xMidYMid slice" aria-label="Sala de jogos e descanso" shapeRendering="crispEdges">
      {/* parede e piso de madeira */}
      <rect width="1198" height="340" fill="#3a2f6e" />
      <rect y="300" width="1198" height="40" fill="#2f2560" />
      {Array.from({ length: 30 }, (_, i) => <rect key={i} x={i * 40} y="0" width="2" height="300" fill="#43377c" />)}
      <rect y="340" width="1198" height="225" fill="#8a5a3c" />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} y={340 + i * 28} width="1198" height="3" fill="#6e452e" />)}
      {Array.from({ length: 24 }, (_, i) => <rect key={i} x={(i * 97 + (i % 2) * 48) % 1198} y={340 + (i % 8) * 28} width="3" height="28" fill="#6e452e" />)}
      <rect x="120" y="440" width="560" height="110" fill="#5c3f8a" opacity=".55" />

      {/* janela com céu */}
      <g transform="translate(60 60)">
        <rect width="200" height="150" fill="#0a0d2c" />
        <rect x="6" y="6" width="188" height="138" fill="#5fb6ff" />
        <g className="px-cloud" fill="#ffffff"><rect x="20" y="40" width="44" height="12" /><rect x="30" y="30" width="24" height="10" /></g>
        <rect x="6" y="110" width="188" height="34" fill="#3a8a4a" />
        <rect x="97" y="6" width="6" height="138" fill="#0a0d2c" /><rect x="6" y="72" width="188" height="6" fill="#0a0d2c" />
      </g>

      {/* letreiro neon */}
      <text x="600" y="78" textAnchor="middle" className="px-neon big">RELAX ✦ PLAY</text>

      {/* TV com pong */}
      <g transform="translate(300 120)">
        <rect width="220" height="130" fill="#0a0d2c" />
        <rect x="8" y="8" width="204" height="114" fill="#0b1638" />
        <rect className="px-pong-l" x="20" y="50" width="6" height="26" fill="#4cf17c" />
        <rect className="px-pong-r" x="194" y="40" width="6" height="26" fill="#63e8ff" />
        <rect className="px-pong-ball" x="40" y="60" width="6" height="6" fill="#ffffff" />
        <rect x="108" y="14" width="4" height="102" fill="#2a3070" />
        <rect x="100" y="130" width="20" height="16" fill="#0a0d2c" /><rect x="70" y="146" width="80" height="6" fill="#0a0d2c" />
      </g>

      {/* sofá */}
      <g transform="translate(240 330)">
        <rect x="0" y="0" width="300" height="56" fill="#0a0d2c" />
        <rect x="6" y="6" width="288" height="44" fill="#d9536a" />
        <rect x="-16" y="40" width="332" height="56" fill="#0a0d2c" />
        <rect x="-10" y="46" width="320" height="44" fill="#b83a52" />
        {[0, 1, 2].map(i => <rect key={i} x={10 + i * 96} y="50" width="88" height="6" fill="#e2788a" />)}
        <rect x="-10" y="96" width="12" height="12" fill="#0a0d2c" /><rect x="298" y="96" width="12" height="12" fill="#0a0d2c" />
      </g>
      {/* mesinha de centro com pipoca */}
      <rect x="320" y="470" width="140" height="14" fill="#5c3a22" /><rect x="330" y="484" width="10" height="24" fill="#3a2414" /><rect x="440" y="484" width="10" height="24" fill="#3a2414" />
      <rect x="370" y="450" width="30" height="22" fill="#ff5277" /><rect x="372" y="444" width="26" height="8" fill="#fff3c4" />

      {/* mesa de pingue-pongue */}
      <g transform="translate(680 410)">
        <rect width="180" height="16" fill="#0a0d2c" />
        <rect x="3" y="3" width="174" height="10" fill="#2e8b57" />
        <rect x="88" y="-18" width="4" height="20" fill="#f4f0ea" />
        <rect x="14" y="16" width="8" height="46" fill="#0a0d2c" /><rect x="158" y="16" width="8" height="46" fill="#0a0d2c" />
        <rect className="px-pingpong" x="20" y="-14" width="6" height="6" fill="#ffffff" />
      </g>

      {/* fliperama e pufes */}
      <g transform="translate(990 250) scale(5)"><Bitmap rows={ARCADE} colors={DECOR_COLORS} /><rect className="px-cursor" x="4" y="4" width="4" height="1" fill="#4cf17c" /></g>
      <g transform="translate(100 470) scale(5)"><Bitmap rows={BEANBAG} colors={DECOR_COLORS} /></g>
      <g transform="translate(510 490) scale(5)"><Bitmap rows={BEANBAG} colors={{ ...DECOR_COLORS, b: '#4c8dff', B: '#9cc0ff' }} /></g>

      {/* plantas */}
      {[[20, 300], [1150, 300]].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect x="4" y="30" width="28" height="30" fill="#f4f0ea" />
          <rect x="0" y="0" width="12" height="30" fill="#2e8b57" /><rect x="12" y="-10" width="12" height="40" fill="#3fbf5f" /><rect x="24" y="4" width="12" height="26" fill="#2e8b57" />
        </g>
      ))}

      {/* canto da psicóloga */}
      <g transform="translate(860 150)">
        <rect width="140" height="90" fill="#0a0d2c" /><rect x="5" y="5" width="130" height="80" fill="#14b8a6" />
        <text x="70" y="40" textAnchor="middle" className="px-sign-text">🧠 PSICÓLOGA</text>
        <text x="70" y="66" textAnchor="middle" className="px-sign-text small">{psychologist ? 'Dra. Helena' : 'vaga aberta'}</text>
      </g>
      <g transform="translate(870 300)">
        <rect x="0" y="0" width="70" height="60" fill="#0a0d2c" /><rect x="5" y="5" width="60" height="50" fill="#6b2fd0" />
        <rect x="-8" y="40" width="86" height="34" fill="#0a0d2c" /><rect x="-3" y="45" width="76" height="24" fill="#8a4ae8" />
        {psychologist && (
          <g transform="translate(35 2)">
            <image href={`${ART}/woman-1.png`} x="-29" y="-20" width="58" height="68" style={{ imageRendering: 'pixelated' }} />
            <rect x="18" y="26" width="16" height="20" fill="#f4f0ea" /><rect x="20" y="30" width="12" height="2" fill="#2a3070" /><rect x="20" y="35" width="12" height="2" fill="#2a3070" />
          </g>
        )}
      </g>

      {built && people.slice(0, LOUNGE_SPOTS.length).map((person, i) => {
        const [x, y, pose] = LOUNGE_SPOTS[i]
        return <Resting key={person.employee.id} person={person} x={x} y={y} pose={pose} />
      })}

      {!built && (
        <g>
          <rect width="1198" height="565" fill="#0a0d2c" opacity=".55" />
          {Array.from({ length: 14 }, (_, i) => <rect key={i} x={i * 90} y="250" width="45" height="24" fill="#ffc75a" transform={`skewX(-30)`} />)}
          {Array.from({ length: 14 }, (_, i) => <rect key={i} x={45 + i * 90} y="250" width="45" height="24" fill="#0a0d2c" transform={`skewX(-30)`} />)}
        </g>
      )}
    </svg>
  )
}
