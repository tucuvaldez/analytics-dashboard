const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? '—' : number.format(n))
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => date.format(new Date(iso))
