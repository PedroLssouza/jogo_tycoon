import { useEffect, useState } from 'react'
import { PixelModal } from './PixelModal'
import { BuildingScene, SpinningCoin, VictoryScene } from './PixelScenes'
import { ACHIEVEMENTS, eventById, FLOORS, SALE_PRICE, SALE_REVENUE_GOAL, statsOf } from './progression'
import { sfx } from './sound'
import type { GameState } from './types'
import { formatMoney } from './utils'

/* ------------------------------------------------------------ EVENTOS */
export function EventModal({ state, onChoose }: { state: GameState; onChoose: (option: number) => void }) {
  const event = eventById(state.pendingEvent)
  if (!event) return null
  return (
    <PixelModal className="setup-modal event-modal" title="Aconteceu algo!" subtitle={`Dia ${state.day}`} onClose={() => onChoose(event.options.length - 1)}>
      <div className="ev-card">
        <span className="ev-icon" aria-hidden="true">{event.icon}</span>
        <div>
          <h3>{event.title}</h3>
          <p>{event.text}</p>
        </div>
      </div>
      <div className="ev-options">
        {event.options.map((option, i) => {
          const allowed = !option.can || option.can(state)
          return (
            <button key={option.label} className={i === 0 ? 'mission-accept' : 'mission-negotiate'} disabled={!allowed} onClick={() => onChoose(i)}>
              <b>{option.label}</b>
              <small>{allowed ? option.hint : 'Caixa insuficiente'}</small>
            </button>
          )
        })}
      </div>
    </PixelModal>
  )
}

/* ------------------------------------------------ DIÁRIO E CONQUISTAS */
export function DiaryModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const owned = new Set(state.achievements ?? [])
  return (
    <PixelModal className="setup-modal diary-modal" title="Diário da empresa" subtitle={`${owned.size} de ${ACHIEVEMENTS.length} conquistas`} onClose={onClose} wide>
      <div className="diary-grid">
        <section className="fin-panel">
          <h3>Conquistas</h3>
          <div className="ach-grid">
            {ACHIEVEMENTS.map(a => (
              <div key={a.id} className={owned.has(a.id) ? 'ach on' : 'ach'} title={a.text}>
                <span aria-hidden="true">{owned.has(a.id) ? a.icon : '🔒'}</span>
                <b>{a.title}</b>
                <small>{a.text}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="fin-panel diary-log">
          <h3>Linha do tempo</h3>
          <ol>
            {state.gameLog.slice(0, 40).map((entry, i) => (
              <li key={`${entry.day}-${i}`}><i>Dia {entry.day}</i>{entry.message}</li>
            ))}
          </ol>
        </section>
      </div>
    </PixelModal>
  )
}

/* ------------------------------------------------- PROPOSTA DE COMPRA */
export function SaleModal({ state, onSell, onLater }: { state: GameState; onSell: () => void; onLater: () => void }) {
  return (
    <PixelModal className="setup-modal sale-modal" title="Proposta de compra!" subtitle={`Faturamento de ${formatMoney(state.revenue)} chamou atenção`} onClose={onLater}>
      <div className="sale-hero">
        <SpinningCoin />
        <div>
          <small>A MegaHolding Tech quer comprar a</small>
          <b>{state.company}</b>
          <strong>{formatMoney(SALE_PRICE)}</strong>
        </div>
      </div>
      <p className="sale-text">Vendendo, você encerra a partida como fundador milionário. Pode também recusar por enquanto e continuar jogando: a proposta fica disponível no escritório.</p>
      <div className="ev-options">
        <button className="mission-accept" onClick={onSell}><b>🚀 Vender a empresa</b><small>Fim de jogo com vitória</small></button>
        <button className="mission-negotiate" onClick={onLater}><b>Ainda não</b><small>Continuar crescendo</small></button>
      </div>
    </PixelModal>
  )
}

/* -------------------------------------------------------- FIM DE JOGO */
export function EndingScreen({ state, onRestart, onMenu }: { state: GameState; onRestart: () => void; onMenu: () => void }) {
  const sold = state.ended?.kind === 'sold'
  const stats = statsOf(state)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const rows: Array<[string, string]> = [
    ['📅 Dias de jogo', String(state.ended?.day ?? state.day)],
    ['💰 Faturamento', formatMoney(state.revenue)],
    ['📦 Contratos entregues', String(stats.contractsDone)],
    ['💎 Entregas perfeitas', String(stats.perfect)],
    ['🍽 Placas para o tutor', String(stats.gpusEaten)],
    ['👾 Malwares derrotados', String(stats.malwareWins)],
    ['🏅 Conquistas', `${state.achievements?.length ?? 0}/${ACHIEVEMENTS.length}`],
  ]
  return (
    <section className={`game-office game-ending ${sold ? 'won' : 'lost'}`} aria-label="Fim de jogo">
      <div className="end-stage">
        <div className="end-art">
          {sold ? <VictoryScene /> : <BuildingScene type="retail" />}
          {sold && Array.from({ length: 24 }, (_, i) => (
            <i key={i} className="end-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.3}s`, background: ['#ffc75a', '#4cf17c', '#ff5277', '#63e8ff', '#a855f7'][i % 5] }} />
          ))}
          {!sold && Array.from({ length: 30 }, (_, i) => <i key={i} className="end-rain" style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i % 10) * 0.12}s` }} />)}
        </div>
        <div className="end-text">
          <small>{sold ? 'FIM DE JOGO · VITÓRIA' : 'FIM DE JOGO'}</small>
          <h1>{sold ? `${state.company} foi vendida!` : `${state.company} faliu`}</h1>
          <p>{sold
            ? `${state.founderName || 'Você'} vendeu a empresa por ${formatMoney(SALE_PRICE)} depois de faturar mais de ${formatMoney(SALE_REVENUE_GOAL)}. Parabéns, agora é hora de comprar uma ilha (e muitas placas de vídeo).`
            : 'O caixa ficou no vermelho por tempo demais e os credores fecharam as portas. Da próxima vez, de olho no custo diário e no empréstimo.'}</p>
          <dl className="end-stats">
            {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <div className="ev-options">
            <button className="mission-accept" onClick={onRestart}><b>▶ Nova partida</b><small>Fundar outra empresa</small></button>
            <button className="mission-negotiate" onClick={onMenu}><b>Menu principal</b><small>Voltar ao início</small></button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- ELEVADOR */
export type FloorId = 'office' | 'team' | 'servers'

export function ElevatorModal({ state, current, onRide, onBuy, onClose }: {
  state: GameState
  current: FloorId
  onRide: (floor: FloorId) => void
  onBuy: (floor: 'team' | 'servers') => void
  onClose: () => void
}) {
  const [riding, setRiding] = useState<FloorId | null>(null)
  const floors: Array<{ id: FloorId; number: number; name: string; text: string; owned: boolean; price?: number }> = [
    { id: 'servers', number: 3, name: 'Servidores', text: `${FLOORS.servers.racks} racks para alugar a clientes`, owned: Boolean(state.floors?.servers), price: FLOORS.servers.price },
    { id: 'team', number: 2, name: 'Equipe', text: `+${FLOORS.team.desks} mesas para contratar mais gente`, owned: Boolean(state.floors?.team), price: FLOORS.team.price },
    { id: 'office', number: 1, name: 'Escritório', text: 'Sala principal da empresa', owned: true },
  ]
  const target = floors.find(floor => floor.id === riding)

  function ride(floor: FloorId) {
    if (floor === current || riding) return
    setRiding(floor)
    sfx('click')
    window.setTimeout(() => { sfx('coin'); onRide(floor) }, 1300)
  }

  return (
    <PixelModal className="setup-modal elevator-modal" title="Elevador" subtitle={state.company} onClose={onClose}>
      <div className={riding ? 'lift-cabin riding' : 'lift-cabin'}>
        <div className="lift-display" aria-live="polite">
          <span>{riding ? (floors.findIndex(f => f.id === riding) < floors.findIndex(f => f.id === current) ? '▲' : '▼') : '■'}</span>
          <b>{riding ? target?.number : floors.find(f => f.id === current)?.number}</b>
          <small>{riding ? `Indo para ${target?.name}…` : 'Escolha o andar'}</small>
        </div>
        <div className="lift-buttons">
          {floors.map(floor => (
            <div key={floor.id} className={`lift-floor ${floor.id === current ? 'here' : ''} ${floor.owned ? '' : 'locked'}`}>
              <button className="lift-key" disabled={!floor.owned || floor.id === current || Boolean(riding)} onClick={() => ride(floor.id)} aria-label={`Ir para o ${floor.number}º andar`}>
                {floor.number}
              </button>
              <div className="lift-info">
                <b>{floor.number}º · {floor.name}{floor.id === current ? ' (você está aqui)' : ''}</b>
                <small>{floor.text}</small>
              </div>
              {!floor.owned && floor.price !== undefined && (
                <button className="mission-accept lift-buy" disabled={state.balance < floor.price} onClick={() => onBuy(floor.id as 'team' | 'servers')}>
                  {state.balance < floor.price ? `${formatMoney(floor.price)}` : `Comprar · ${formatMoney(floor.price)}`}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="lift-doors" aria-hidden="true"><i /><i /></div>
      </div>
    </PixelModal>
  )
}
