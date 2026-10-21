export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 8 * 1024 * 1024

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Format non accepté : utilisez JPG, PNG ou WebP.'
  if (file.size > MAX_BYTES) return 'Image trop lourde : 8 Mo maximum.'
  return null
}

/** Redimensionne (1600 px max) et convertit en WebP avant l'envoi : sites plus rapides sur mobile. */
export async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
  const problem = validateImageFile(file)
  if (problem) throw new Error(problem)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Impossible de traiter l'image sur cet appareil.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
  if (!blob) throw new Error("La conversion de l'image a échoué.")
  return blob
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Mode démonstration uniquement : le navigateur ne garde qu'environ 5 Mo de données.
 * On réduit donc davantage les images (1000 px) pour pouvoir en enregistrer beaucoup plus.
 */
export async function shrinkForDemo(blob: Blob, maxSide = 1000): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.75))
    return out && out.size < blob.size ? out : blob
  } catch {
    return blob
  }
}
