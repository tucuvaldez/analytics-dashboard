import { expect, test } from '@playwright/test'
import { addDataPoint, createDashboard, registerUser } from './helpers'

test('generar un reporte agregado y ver su detalle', async ({ page }) => {
  await registerUser(page)
  await createDashboard(page, 'Ingresos')
  await page.getByRole('link', { name: 'Ingresos' }).click()
  await addDataPoint(page, 'USD', 100, '2026-03-01T10:00')
  await addDataPoint(page, 'USD', 300, '2026-03-02T10:00')

  await page.getByRole('link', { name: 'Reportes' }).click()
  await expect(page.getByText('Todavía no generaste reportes')).toBeVisible()

  await page.getByLabel('Nombre').fill('Reporte marzo')
  await page.getByLabel('Dashboard').selectOption({ label: 'Ingresos' })
  await page.getByRole('button', { name: 'Generar' }).click()

  // El reporte recién creado se abre solo
  await expect(page.getByRole('button', { name: /Reporte marzo/ })).toBeVisible()
  const detail = page.getByTestId('report-detail')
  await expect(detail).toBeVisible()
  await expect(detail.getByText('Valor total').locator('..')).toContainText('400')
  await expect(detail.getByText('Puntos de datos').locator('..')).toContainText('2')

  const row = detail.getByRole('row', { name: /Ingresos/ })
  await expect(row).toContainText('400') // suma
  await expect(row).toContainText('200') // promedio
  await expect(row).toContainText('100') // mínimo
  await expect(row).toContainText('300') // máximo
})

test('rango de fechas invertido muestra el error del backend', async ({ page }) => {
  await registerUser(page)
  await page.getByRole('link', { name: 'Reportes' }).click()
  await page.getByLabel('Nombre').fill('Rango inválido')
  await page.getByLabel('Desde').fill('2026-05-01')
  await page.getByLabel('Hasta').fill('2026-01-01')
  await page.getByRole('button', { name: 'Generar' }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid date range')
})
