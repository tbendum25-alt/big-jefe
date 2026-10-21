import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Apparition progressive au défilement (désactivée si l'utilisateur réduit les animations). */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionTitle({ eyebrow, title, light = false }: { eyebrow?: string; title: string; light?: boolean }) {
  return (
    <div className="text-center mb-12">
      {eyebrow && (
        <p className="text-xs tracking-[0.3em] uppercase text-gold font-semibold mb-3">{eyebrow}</p>
      )}
      <h2 className={`text-4xl md:text-5xl font-semibold ${light ? 'text-ivory' : 'text-emerald-deep'}`}>{title}</h2>
      <div className="gold-rule" />
    </div>
  )
}

/** Visuel d'attente élégant : s'affiche quand aucune photo réelle n'a été ajoutée ou si l'image ne charge pas. */
export function ArtPlaceholder({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-emerald-night via-emerald-deep to-emerald-night ${className}`}
      role="img"
      aria-label={label ? `Visuel d'attente — ${label}` : "Visuel d'attente"}
    >
      <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke="#D4AF37" strokeWidth="0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M100 ${118 - i * 12} L${100 - 10 - i * 11} 118 M100 ${118 - i * 12} L${110 + i * 11} 118`} />
          ))}
          <circle cx="100" cy="118" r="30" />
          <circle cx="100" cy="118" r="52" />
          <circle cx="100" cy="118" r="76" />
        </g>
      </svg>
      {label && (
        <span className="absolute inset-0 flex items-end p-4 text-gold font-display text-xl tracking-wide">{label}</span>
      )}
    </div>
  )
}

/** Image avec chargement différé, zoom doux et visuel de remplacement en cas d'échec. */
export function Photo({
  src,
  alt,
  className = '',
  zoom = true,
  fallbackLabel,
}: {
  src?: string
  alt: string
  className?: string
  zoom?: boolean
  fallbackLabel?: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) return <ArtPlaceholder label={fallbackLabel ?? alt} className={className} />
  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${zoom ? 'transition-transform duration-700 group-hover:scale-105' : ''}`}
      />
    </div>
  )
}

export function Loader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-emerald-deep" role="status">
      <span className="h-5 w-5 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-6 text-center text-red-800 border-red-200 bg-red-50" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn-dark mt-4" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-10 text-center text-[#4b5d56]">{children}</div>
}

/** Compteur animé : démarre quand il devient visible. */
export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? to : 0)
  useEffect(() => {
    if (!inView || reduce) return
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min((t - start) / 1400, 1)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduce, to])
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  )
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'paid' || status === 'confirmed' || status === 'served'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'cancelled' || status === 'failed' || status === 'refunded'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-900'
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
}
