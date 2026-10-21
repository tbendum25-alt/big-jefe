import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { whatsappLink } from '../lib/format'
import { useSettings } from '../lib/hooks'

const links = [
  { to: '/', label: 'Accueil' },
  { to: '/chambres', label: 'Chambres' },
  { to: '/restaurant', label: 'Restaurant' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
]

function Navbar() {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  const { pathname } = useLocation()
  const home = pathname === '/'

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => setOpen(false), [pathname])

  const background = solid || !home || open ? 'bg-emerald-night/95 backdrop-blur shadow-lg' : 'bg-transparent'

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${background}`}>
      <nav className="mx-auto max-w-7xl px-5 h-[72px] flex items-center justify-between" aria-label="Navigation principale">
        <Link to="/" className="font-display text-3xl font-bold tracking-wider text-gold">
          {settings.name}
        </Link>
        <ul className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `text-sm tracking-wide transition-colors hover:text-gold ${isActive ? 'text-gold' : 'text-ivory'}`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
          <li>
            <Link to="/ma-reservation" className="text-sm text-ivory hover:text-gold">
              Ma réservation
            </Link>
          </li>
          <li>
            <Link to="/admin" className="text-xs text-ivory/70 hover:text-gold border border-white/25 rounded-full px-3 py-1.5">
              Espace propriétaire
            </Link>
          </li>
          <li>
            <Link to="/chambres" className="btn-gold !py-2 !px-5 text-sm">
              Réserver
            </Link>
          </li>
        </ul>
        <button
          className="md:hidden text-gold p-2"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="md:hidden overflow-hidden px-5 pb-5 flex flex-col gap-1 bg-emerald-night/95"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {[...links, { to: '/ma-reservation', label: 'Ma réservation' }, { to: '/admin', label: 'Espace propriétaire' }].map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) => `block py-3 text-lg font-display ${isActive ? 'text-gold' : 'text-ivory'}`}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-2">
              <Link to="/chambres" className="btn-gold w-full">
                Réserver une chambre
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  )
}

function Footer() {
  const { settings } = useSettings()
  return (
    <footer className="bg-emerald-night text-ivory/80 mt-24">
      <div className="mx-auto max-w-7xl px-5 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <p className="font-display text-3xl text-gold font-bold tracking-wider">{settings.name}</p>
          <p className="mt-3 text-sm">{settings.tagline}</p>
        </div>
        <div className="text-sm space-y-1.5">
          <p className="text-gold font-semibold mb-2">Contact</p>
          <p>{settings.address}</p>
          <p>{settings.city}</p>
          <p>
            <a className="hover:text-gold" href={`tel:${settings.phone.replace(/\s/g, '')}`}>
              {settings.phone}
            </a>
          </p>
          <p>
            <a className="hover:text-gold" href={`mailto:${settings.email}`}>
              {settings.email}
            </a>
          </p>
        </div>
        <div className="text-sm space-y-1.5">
          <p className="text-gold font-semibold mb-2">Horaires</p>
          <p>{settings.reception_hours}</p>
          <p>Restaurant : {settings.restaurant_hours}</p>
          <Link to="/admin" className="inline-block pt-3 text-ivory/40 hover:text-gold text-xs">
            Espace propriétaire
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-ivory/50">
        © {new Date().getFullYear()} {settings.name}. Tous droits réservés.
      </div>
    </footer>
  )
}

function WhatsAppButton() {
  const { settings } = useSettings()
  // Le bouton n'apparaît qu'après confirmation du numéro international par le propriétaire (Paramètres).
  if (!settings.whatsapp.replace(/\D/g, '')) return null
  return (
    <a
      href={whatsappLink(settings.whatsapp, `Bonjour ${settings.name}, je souhaite un renseignement.`)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
      aria-label="Nous écrire sur WhatsApp"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.1.9.9-3.02-.2-.31a8.2 8.2 0 1 1 6.9 3.76Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.3-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.54.12.16 1.73 2.64 4.2 3.7.58.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    </a>
  )
}

export function Layout() {
  const location = useLocation()
  const reduce = useReducedMotion()
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          className="flex-1"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
