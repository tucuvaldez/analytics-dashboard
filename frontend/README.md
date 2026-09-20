# Analytics Dashboard — Frontend

React 19 + Vite + TypeScript + Tailwind CSS v4 + Recharts + React Router.

## Inicio rápido

```bash
# Backend y base de datos corriendo primero (ver ../backend/README.md): API en http://localhost:5001
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Ingresá con el usuario del seed (`admin@example.com` / `Admin1234!`) o registrá uno nuevo.

Si tu API no está en `http://localhost:5001`, definí `VITE_API_URL` (por ejemplo en `frontend/.env`): `VITE_API_URL=http://localhost:5000`. El origen del frontend debe estar en `CORS_ORIGIN` del backend (por defecto: `localhost:3000` y `localhost:5173`).

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/login`, `/register` | Autenticación (errores de validación del backend por campo) |
| `/` | Lista de dashboards (mis dashboards / públicos), crear, editar, eliminar, paginación |
| `/dashboards/:id` | Resumen, gráfico de líneas por etiqueta, alta de datos, tabla paginada |
| `/reports` | Generar reportes (todos los dashboards o uno, con rango de fechas) y ver el detalle con gráfico y tabla |

## Sesión y seguridad

- El **access token** vive solo en memoria (variable de módulo); no se guarda en `localStorage`.
- El **refresh token** es una cookie `httpOnly` que setea el backend: JavaScript no puede leerla.
- Al cargar la página se restaura la sesión con `POST /auth/refresh`. Si una request recibe `401`, el cliente (`src/lib/api.ts`) renueva por cookie y reintenta una vez; si falla, vuelve a `/login`.
- Los refresh tokens rotan y son de un solo uso, por eso las renovaciones se serializan (una sola en vuelo por pestaña, y `navigator.locks` entre pestañas) para no disparar la detección de robo del backend.

## Gráficos

Colores categóricos de una paleta validada (contraste, daltonismo), definidos como variables CSS con variante oscura (`src/index.css`). Hasta 4 series por gráfico, con leyenda, tooltip con todas las series y una tabla con los mismos datos debajo. Sigue automáticamente el modo claro/oscuro del sistema.

## Tests E2E (Playwright)

```bash
npx playwright install chromium     # solo la primera vez
npm run test:e2e                    # levanta backend (5001) y frontend (5173) si no están corriendo
npm run test:e2e:ui                 # modo interactivo
```

Requisitos: PostgreSQL corriendo y migraciones aplicadas (`docker compose up -d postgres` y `npx prisma migrate dev` en `backend/`). Cada test registra usuarios nuevos, así que no depende del seed. Para el backend de los tests se relajan los rate limits (solo en esa ejecución).

Cubren: redirección sin sesión, registro/login/logout, errores de validación, cookie `httpOnly`, renovación automática del access token, CRUD de dashboards, alta de datos con gráfico/tabla, visibilidad público/privado entre usuarios y generación de reportes.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Tests E2E |

## Estructura

```
src/
├── lib/         api.ts (cliente + refresh), types.ts, useFetch.ts, format.ts
├── auth/        AuthContext, AuthProvider
├── components/  Layout, RouteGuards, DashboardForm, ui (Modal, Pagination…)
├── charts/      TimeSeriesChart, ReportBars, series.ts
├── pages/       AuthPages, DashboardsPage, DashboardDetailPage, ReportsPage
└── App.tsx      rutas (las páginas con gráficos se cargan bajo demanda)
e2e/             specs de Playwright
```
