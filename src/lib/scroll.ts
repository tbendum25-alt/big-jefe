/** Fait défiler la page jusqu'au formulaire d'édition (id « admin-form ») une fois qu'il est affiché. */
export function scrollToForm() {
  setTimeout(() => document.getElementById('admin-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
}
