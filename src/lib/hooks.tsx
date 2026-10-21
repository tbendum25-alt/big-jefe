import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './index'
import { defaultSettings } from './demoData'
import type { HotelSettings } from './types'

interface SettingsCtx {
  settings: HotelSettings
  reload: () => Promise<void>
}

const Ctx = createContext<SettingsCtx>({ settings: defaultSettings, reload: async () => undefined })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<HotelSettings>(defaultSettings)
  const reload = useCallback(async () => {
    try {
      setSettings(await api.getSettings())
    } catch {
      /* on garde les valeurs par défaut si la base est momentanément indisponible */
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => {
    document.title = `${settings.name} — Hôtel de luxe`
  }, [settings.name])
  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Charge des données asynchrones avec états de chargement et d'erreur. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload: () => setTick((t) => t + 1) }
}
