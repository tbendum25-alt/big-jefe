/** Règles communes aux comptes de l'administration (formulaires, mode démo ; le serveur applique les mêmes). */
export const MIN_PASSWORD = 10

export function checkEmail(email: string): string | null {
  const e = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? null : 'Adresse e-mail invalide.'
}

export function checkPassword(password: string): string | null {
  return password.length >= MIN_PASSWORD ? null : `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`
}

/** Mot de passe temporaire lisible (sans caractères ambigus), tiré du générateur aléatoire sécurisé du navigateur. */
export function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
