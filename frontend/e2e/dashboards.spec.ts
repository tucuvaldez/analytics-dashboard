import { expect, test } from '@playwright/test'
import { addDataPoint, createDashboard, registerUser } from './helpers'

test.describe('Dashboards', () => {
  test('crear, editar y eliminar un dashboard', async ({ page }) => {
    await registerUser(page)
    await createDashboard(page, 'Ventas', { description: 'Ventas mensuales' })

    await expect(page.getByText('Ventas mensuales')).toBeVisible()
    await expect(page.getByText('Privado')).toBeVisible()

    // Editar
    await page.getByRole('button', { name: 'Editar Ventas' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar dashboard' })
    await dialog.getByLabel('Nombre').fill('Ventas 2026')
    await dialog.getByLabel(/Público/).check()
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('link', { name: 'Ventas 2026' })).toBeVisible()
    await expect(page.getByText('Público', { exact: true })).toBeVisible()

    // Eliminar (con confirmación)
    await page.getByRole('button', { name: 'Eliminar Ventas 2026' }).click()
    await page.getByRole('dialog', { name: 'Eliminar dashboard' }).getByRole('button', { name: 'Eliminar' }).click()
    await expect(page.getByRole('link', { name: 'Ventas 2026' })).toHaveCount(0)
    await expect(page.getByText('Todavía no tenés dashboards')).toBeVisible()
  })

  test('nombre vacío no se puede guardar', async ({ page }) => {
    await registerUser(page)
    await page.getByRole('button', { name: 'Nuevo dashboard' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo dashboard' })
    await dialog.getByLabel('Nombre').fill('   ')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Validation failed')
    await expect(dialog.getByText('name is required')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()
  })

  test('detalle: agregar datos actualiza gráfico, resumen y tabla', async ({ page }) => {
    await registerUser(page)
    await createDashboard(page, 'Tráfico')
    await page.getByRole('link', { name: 'Tráfico' }).click()

    await expect(page.getByText('Este dashboard todavía no tiene datos')).toBeVisible()

    await addDataPoint(page, 'Visitas', 100, '2026-03-01T10:00')
    await addDataPoint(page, 'Visitas', 300, '2026-03-02T10:00')
    await addDataPoint(page, 'Compras', 20, '2026-03-02T11:00')

    // Resumen: 3 puntos, máximo 300
    await expect(page.getByText('Puntos totales').locator('..')).toContainText('3')
    await expect(page.getByText('Máximo').locator('..')).toContainText('300')

    // Gráfico con leyenda de 2 series (Visitas, Compras)
    const chart = page.getByRole('figure', { name: /Gráfico de evolución/ })
    await expect(chart.locator('.recharts-line')).toHaveCount(2)
    await expect(chart.getByText('Visitas')).toBeVisible()
    await expect(chart.getByText('Compras')).toBeVisible()

    // Tabla (vista alternativa accesible a los mismos datos)
    const rows = page.getByRole('table').locator('tbody tr')
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toContainText('Compras') // el más reciente primero
  })

  test('detalle: valor inválido muestra error de validación', async ({ page }) => {
    await registerUser(page)
    await createDashboard(page, 'Errores')
    await page.getByRole('link', { name: 'Errores' }).click()
    await page.getByLabel('Etiqueta').fill('   ')
    await page.getByLabel('Valor').fill('5')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText('label is required')).toBeVisible()
  })

  test('eliminar desde el detalle vuelve a la lista', async ({ page }) => {
    await registerUser(page)
    await createDashboard(page, 'Temporal')
    await page.getByRole('link', { name: 'Temporal' }).click()
    await expect(page.getByRole('heading', { name: 'Temporal' })).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await page.getByRole('dialog', { name: 'Eliminar dashboard' }).getByRole('button', { name: 'Eliminar' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Todavía no tenés dashboards')).toBeVisible()
  })
})

test.describe('Visibilidad entre usuarios', () => {
  test('un dashboard público se ve (sin poder editarlo) y uno privado da 404', async ({ page, browser }) => {
    // Usuario A crea uno público y uno privado
    await registerUser(page)
    await createDashboard(page, 'Público de A', { isPublic: true })
    await createDashboard(page, 'Privado de A')
    await page.getByRole('link', { name: 'Privado de A' }).click()
    const privateUrl = page.url()

    // Usuario B, en otro contexto (otras cookies)
    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    await registerUser(pageB)

    await pageB.getByRole('tab', { name: 'Públicos' }).click()
    await expect(pageB.getByRole('link', { name: 'Público de A' })).toBeVisible()
    await expect(pageB.getByRole('link', { name: 'Privado de A' })).toHaveCount(0)

    await pageB.getByRole('link', { name: 'Público de A' }).click()
    await expect(pageB.getByRole('heading', { name: /Público de A/ })).toBeVisible()
    await expect(pageB.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
    await expect(pageB.getByRole('button', { name: 'Eliminar', exact: true })).toHaveCount(0)
    await expect(pageB.getByRole('button', { name: 'Agregar', exact: true })).toHaveCount(0)

    await pageB.goto(privateUrl)
    await expect(pageB.getByText('Dashboard no encontrado')).toBeVisible()
    await ctxB.close()
  })
})
