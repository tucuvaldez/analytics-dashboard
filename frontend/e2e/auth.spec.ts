import { expect, test } from '@playwright/test'
import { PASSWORD, registerUser, uniqueEmail } from './helpers'

test.describe('Autenticación', () => {
  test('redirige a /login si no hay sesión', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  })

  test('registro exitoso lleva a dashboards y muestra el email', async ({ page }) => {
    const email = await registerUser(page)
    await expect(page.getByTestId('user-email')).toHaveText(email)
    await expect(page.getByText('Todavía no tenés dashboards')).toBeVisible()
  })

  test('contraseña débil muestra el error de validación del backend', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Email').fill(uniqueEmail())
    await page.getByLabel('Contraseña').fill('abcdefgh') // sin mayúscula ni número
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByRole('alert')).toContainText('Validation failed')
    await expect(page.getByText(/must contain an uppercase letter/)).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('email duplicado devuelve conflicto', async ({ page, context }) => {
    const email = await registerUser(page)
    await context.clearCookies()
    await page.goto('/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña').fill(PASSWORD)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByRole('alert')).toContainText('already registered')
  })

  test('login con credenciales incorrectas muestra error genérico', async ({ page }) => {
    const email = await registerUser(page)
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña').fill('Incorrecta1')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
  })

  test('logout y login de nuevo', async ({ page }) => {
    const email = await registerUser(page)
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Contraseña').fill(PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible()
  })
})

test.describe('Sesión y tokens', () => {
  test('la sesión sobrevive a un reload (refresh por cookie) y muere tras logout', async ({ page }) => {
    const email = await registerUser(page)

    await page.reload()
    await expect(page.getByTestId('user-email')).toHaveText(email)

    await page.getByRole('button', { name: 'Salir' }).click()
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('el refresh token es httpOnly y JavaScript no puede leerlo', async ({ page, context }) => {
    await registerUser(page)

    const cookies = await context.cookies()
    const refresh = cookies.find((c) => c.name === 'refresh_token')
    expect(refresh, 'cookie refresh_token presente').toBeDefined()
    expect(refresh?.httpOnly).toBe(true)
    expect(refresh?.sameSite).toBe('Strict')
    expect(refresh?.path).toBe('/auth')

    const visibleToJs = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    }))
    expect(visibleToJs.cookie).not.toContain('refresh_token')
    expect(visibleToJs.local).not.toMatch(/token/i)
    expect(visibleToJs.session).not.toMatch(/token/i)
  })

  test('access token vencido: el cliente renueva por cookie y reintenta sin cerrar sesión', async ({ page }) => {
    await registerUser(page)

    // Simula que el access token expiró: la primera lectura de dashboards responde 401.
    let rejected = false
    await page.route('**/dashboards?**', async (route) => {
      if (!rejected) {
        rejected = true
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'AUTHENTICATION_ERROR', message: 'Access token expired' } }),
        })
      } else {
        await route.continue()
      }
    })

    let refreshes = 0
    page.on('response', (r) => {
      if (r.url().endsWith('/auth/refresh') && r.status() === 200) refreshes++
    })
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible()
    await expect(page.getByText('Todavía no tenés dashboards')).toBeVisible()
    expect(rejected).toBe(true)
    // 1st refresh restores the session on load, 2nd is triggered by the 401 and the request is retried.
    expect(refreshes).toBe(2)
  })
})
