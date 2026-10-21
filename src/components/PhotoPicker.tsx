import { useEffect, useRef, useState } from 'react'
import { prepareImage, validateImageFile } from '../lib/image'

interface Picked {
  file: File
  preview: string
}

/** Sélection de fichiers avec aperçu avant publication, validation du format et de la taille. */
export function PhotoPicker({
  multiple = false,
  onPublish,
  label = 'Publier',
}: {
  multiple?: boolean
  onPublish: (images: Blob[]) => Promise<void>
  label?: string
}) {
  const [picked, setPicked] = useState<Picked[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.preview)), [picked])

  const choose = (files: FileList | null) => {
    if (!files) return
    const next: Picked[] = []
    const problems: string[] = []
    for (const file of Array.from(files)) {
      const problem = validateImageFile(file)
      if (problem) problems.push(`${file.name} : ${problem}`)
      else next.push({ file, preview: URL.createObjectURL(file) })
    }
    setError(problems.join(' '))
    setPicked(multiple ? next : next.slice(0, 1))
  }

  const publish = async () => {
    setBusy(true)
    setError('')
    try {
      const blobs: Blob[] = []
      for (const p of picked) blobs.push(await prepareImage(p.file))
      await onPublish(blobs)
      setPicked([])
      if (input.current) input.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi des photos a échoué.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="field"
        onChange={(e) => choose(e.target.files)}
        aria-label="Choisir des photos"
      />
      <p className="text-xs text-[#5d6e67]">JPG, PNG ou WebP — 8 Mo maximum par photo. Les images sont optimisées avant l'envoi.</p>
      {picked.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            {picked.map((p) => (
              <img key={p.preview} src={p.preview} alt={`Aperçu ${p.file.name}`} className="h-24 w-32 object-cover rounded-lg border border-gold/60" />
            ))}
          </div>
          <button type="button" className="btn-gold" onClick={publish} disabled={busy}>
            {busy ? 'Publication…' : `${label} (${picked.length})`}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  )
}
