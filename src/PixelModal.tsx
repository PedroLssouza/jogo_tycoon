import type { ReactNode } from 'react'

export function PixelModal({ title, subtitle, children, onClose, wide = false, className = '' }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className={`pixel-modal ${wide ? 'wide' : ''} ${className}`}>
        <header>
          <span className="pixel-square" />
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
