import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Gallery } from '../components/Gallery'
import { CountUp, Loader, Photo, Reveal, SectionTitle } from '../components/ui'
import { api } from '../lib'
import { fcfa } from '../lib/format'
import { useAsync, useSettings } from '../lib/hooks'
import { todayIso } from '../lib/pricing'

function Hero() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '25%'])
  const rooms = useAsync(() => api.listRooms(), [])
  const heroPhoto = rooms.data?.flatMap((r) => r.photos).find((p) => p.is_main) ?? rooms.data?.flatMap((r) => r.photos)[0]

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams({ guests: String(guests) })
    if (checkIn) params.set('in', checkIn)
    if (checkOut) params.set('out', checkOut)
    navigate(`/chambres?${params.toString()}`)
  }

  return (
    <section ref={ref} className="relative min-h-[100svh] flex items-center overflow-hidden bg-emerald-night">
      <motion.div className="absolute inset-0 scale-110" style={{ y }}>
        <Photo
          src={heroPhoto?.url}
          alt={`Façade et intérieur de ${settings.name}`}
          className="h-full w-full"
          zoom={false}
          fallbackLabel=""
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-night/70 via-emerald-night/40 to-emerald-night/90" />
      <div className="relative mx-auto max-w-7xl w-full px-5 pt-28 pb-16 text-center">
        <motion.p
          className="text-xs md:text-sm tracking-[0.4em] uppercase text-gold"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {settings.city}
        </motion.p>
        <motion.h1
          className="mt-4 text-6xl md:text-8xl font-bold text-gold tracking-wider"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          {settings.name}
        </motion.h1>
        <motion.p
          className="mt-5 mx-auto max-w-xl text-lg md:text-xl text-ivory/90 font-display italic"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          {settings.tagline}
        </motion.p>
        <motion.div
          className="mt-8"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
        >
          <Link to="/chambres" className="btn-gold text-lg">
            Réserver une chambre
          </Link>
        </motion.div>

        <motion.form
          onSubmit={submit}
          className="mt-12 mx-auto max-w-4xl rounded-2xl bg-ivory/95 backdrop-blur p-4 md:p-5 grid gap-3 md:grid-cols-[1fr_1fr_8rem_auto] text-left shadow-2xl"
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55 }}
          aria-label="Rechercher une chambre"
        >
          <div>
            <label className="label" htmlFor="h-in">
              Arrivée
            </label>
            <input id="h-in" type="date" className="field" min={todayIso()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="h-out">
              Départ
            </label>
            <input id="h-out" type="date" className="field" min={checkIn || todayIso()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="h-guests">
              Personnes
            </label>
            <input id="h-guests" type="number" min={1} max={10} className="field" value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <button className="btn-dark self-end h-[46px]" type="submit">
            Rechercher
          </button>
        </motion.form>
      </div>
    </section>
  )
}

function Stats() {
  const rooms = useAsync(() => api.listRooms(), [])
  const menu = useAsync(() => api.listMenuItems(), [])
  const services = useAsync(() => api.listServices(), [])
  const items = [
    { n: rooms.data?.length ?? 0, label: 'Chambres et suites' },
    { n: menu.data?.length ?? 0, label: 'Plats au menu' },
    { n: services.data?.length ?? 0, label: 'Services à votre disposition' },
  ]
  return (
    <section className="bg-emerald-deep text-ivory">
      <div className="mx-auto max-w-5xl px-5 py-12 grid grid-cols-3 gap-4 text-center">
        {items.map((s) => (
          <div key={s.label}>
            <p className="font-display text-5xl md:text-6xl text-gold font-bold">
              <CountUp to={s.n} />
            </p>
            <p className="mt-1 text-xs md:text-sm uppercase tracking-widest text-ivory/80">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function About() {
  const { settings } = useSettings()
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center">
      <Reveal>
        <SectionTitle eyebrow="Bienvenue" title={`Un séjour d'exception chez ${settings.name}`} />
        <p className="text-lg leading-relaxed text-[#35463f]">
          Au cœur de {settings.city.split(',')[0]}, {settings.name} vous accueille dans un cadre élégant et chaleureux :
          des chambres soignées, une table généreuse et une équipe attentive à chaque détail de votre séjour.
        </p>
      </Reveal>
    </section>
  )
}

function FeaturedRooms() {
  const rooms = useAsync(() => api.listRooms(), [])
  const top = [...(rooms.data ?? [])].slice(0, 3)
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24">
      <SectionTitle eyebrow="Hébergement" title="Nos chambres et suites" />
      {rooms.loading ? (
        <Loader />
      ) : (
        <div className="grid gap-8 md:grid-cols-3">
          {top.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.1}>
              <Link to={`/chambres/${r.id}`} className="group card block overflow-hidden hover:shadow-xl transition-shadow">
                <Photo src={(r.photos.find((p) => p.is_main) ?? r.photos[0])?.url} alt={r.name} className="h-64" fallbackLabel={r.name} />
                <div className="p-5">
                  <h3 className="text-2xl font-semibold text-emerald-deep">{r.name}</h3>
                  <p className="mt-1 text-sm text-[#4b5d56] line-clamp-2">{r.description}</p>
                  <p className="mt-4 text-gold-dark font-semibold" style={{ color: '#8a6d12' }}>
                    {fcfa(r.price_per_night)} <span className="text-xs text-[#4b5d56] font-normal">/ nuit</span>
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
      <div className="text-center mt-10">
        <Link to="/chambres" className="btn-dark">
          Voir toutes les chambres
        </Link>
      </div>
    </section>
  )
}

function RestaurantTeaser() {
  const { settings } = useSettings()
  const menu = useAsync(() => api.listMenuItems(), [])
  const dishes = (menu.data ?? []).slice(0, 3)
  return (
    <section className="bg-emerald-night py-24">
      <div className="mx-auto max-w-7xl px-5">
        <SectionTitle eyebrow="Gastronomie" title="Le restaurant" light />
        <p className="text-center text-ivory/80 -mt-6 mb-12">{settings.restaurant_hours}</p>
        <div className="grid gap-6 md:grid-cols-3">
          {dishes.map((d, i) => (
            <Reveal key={d.id} delay={i * 0.1}>
              <div className="group rounded-2xl overflow-hidden bg-emerald-deep/60 border border-gold/20">
                <Photo src={d.photo_url} alt={d.name} className="h-52" fallbackLabel={d.name} />
                <div className="p-5 text-ivory">
                  <div className="flex justify-between gap-3">
                    <h3 className="text-2xl text-gold">{d.name}</h3>
                    <span className="text-sm whitespace-nowrap pt-2">{fcfa(d.price)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ivory/75">{d.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/restaurant" className="btn-outline">
            Découvrir le menu et commander
          </Link>
        </div>
      </div>
    </section>
  )
}

function ServicesTeaser() {
  const services = useAsync(() => api.listServices(), [])
  return (
    <section className="mx-auto max-w-5xl px-5 py-24">
      <SectionTitle eyebrow="Confort" title="Services et équipements" />
      <div className="grid gap-4 sm:grid-cols-2">
        {(services.data ?? []).slice(0, 6).map((s, i) => (
          <Reveal key={s.id} delay={i * 0.06}>
            <div className="card p-5 flex items-start gap-4">
              <span className="mt-1 h-2.5 w-2.5 rotate-45 bg-gold shrink-0" aria-hidden />
              <div>
                <h3 className="text-xl font-semibold text-emerald-deep">{s.name}</h3>
                <p className="text-sm text-[#4b5d56]">{s.description}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="text-center mt-8">
        <Link to="/services" className="btn-dark">
          Tous les services
        </Link>
      </div>
    </section>
  )
}

function PhotoGallery() {
  const rooms = useAsync(() => api.listRooms(), [])
  const photos = (rooms.data ?? []).flatMap((r) => r.photos)
  if (!photos.length) return null
  return (
    <section className="mx-auto max-w-5xl px-5 pb-24">
      <SectionTitle eyebrow="Galerie" title="L'hôtel en images" />
      <Gallery photos={photos} title="Galerie de l'hôtel" />
    </section>
  )
}

function Visit() {
  const { settings } = useSettings()
  return (
    <section className="mx-auto max-w-5xl px-5 pb-8 text-center">
      <SectionTitle eyebrow="Nous trouver" title="Venez nous rendre visite" />
      <p className="text-[#35463f]">{settings.address}</p>
      <p className="text-[#35463f]">{settings.reception_hours}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a className="btn-dark" href={`tel:${settings.phone.replace(/\s/g, '')}`}>
          Appeler {settings.phone}
        </a>
        <Link className="btn-dark" to="/contact">
          Nous écrire
        </Link>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <About />
      <FeaturedRooms />
      <RestaurantTeaser />
      <ServicesTeaser />
      <PhotoGallery />
      <Visit />
    </>
  )
}
