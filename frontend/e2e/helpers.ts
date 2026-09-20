import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Secret123'

export const uniqueEmail = (prefix = 'e2e') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

/** Registers a brand-new user through the UI and waits for the dashboards screen. */
export async function registerUser(page: Page, email = uniqueEmail()) {
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible()
  return email
}

export async function createDashboard(page: Page, name: string, opts: { description?: string; isPublic?: boolean } = {}) {
  await page.getByRole('button', { name: 'Nuevo dashboard' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo dashboard' })
  await dialog.getByLabel('Nombre').fill(name)
  if (opts.description) await dialog.getByLabel(/Descripción/).fill(opts.description)
  if (opts.isPublic) await dialog.getByLabel(/Público/).check()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name })).toBeVisible()
}

export async function addDataPoint(page: Page, label: string, value: number, timestamp?: string) {
  await page.getByLabel('Etiqueta').fill(label)
  await page.getByLabel('Valor').fill(String(value))
  if (timestamp) await page.getByLabel(/Fecha/).fill(timestamp)
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  // Form clears the value field once the API accepted the point.
  await expect(page.getByLabel('Valor')).toHaveValue('')
}
