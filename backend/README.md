# Analytics Dashboard — Backend API

REST API con **Express + TypeScript + Prisma (PostgreSQL)**, autenticación JWT con refresh tokens rotativos, validación con Zod, errores tipados y rate limiting.

## Inicio rápido

```bash
# 1. Levantar PostgreSQL (desde la raíz del repo)
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env          # y cambiá los secretos (ver abajo)
npm install
npx prisma migrate dev        # aplica migraciones + genera el cliente Prisma
npm run seed                  # 1 admin + 2 dashboards con datos de prueba
npm run dev                   # http://localhost:5001
```

Verificación: `curl localhost:5001/health` → `{"status":"Backend OK"}`

Con Docker completo: `docker compose up --build` (el contenedor del backend ejecuta `prisma migrate deploy` al iniciar). Para sembrar datos: `docker compose exec backend npx tsx prisma/seed.ts`.

### Variables de entorno (`backend/.env`)

| Variable | Descripción | Default |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL (`localhost` en local, `postgres` en docker-compose) | — (requerida) |
| `JWT_SECRET` | Secreto del access token (≥ 32 chars) | — (requerida) |
| `JWT_REFRESH_SECRET` | Secreto del refresh token (≥ 32 chars, distinto al anterior) | — (requerida) |
| `JWT_ACCESS_EXPIRES_IN` | Vida del access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | Vida del refresh token | `7` |
| `BCRYPT_ROUNDS` | Costo de bcrypt | `12` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma | `http://localhost:3000,http://localhost:5173` |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | Requests por ventana (general / auth) | `100` / `10` |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit | `900000` (15 min) |

Generar un secreto: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
El servidor **no arranca** si faltan secretos o son cortos.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga (tsx watch) |
| `npm run build` / `npm start` | `prisma generate` + compilar TS / correr `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migrate` / `migrate:deploy` | Migraciones (dev / producción) |
| `npm run seed` | Datos de prueba (idempotente, se niega a correr con `NODE_ENV=production`) |

Credenciales del seed: **`admin@example.com` / `Admin1234!`** (solo desarrollo).

## Endpoints

Todas las respuestas exitosas son `{ "data": ... }` (las listas agregan `"meta": { page, limit, total, totalPages }`).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | — | Crear usuario (devuelve tokens) |
| POST | `/auth/login` | — | Login |
| POST | `/auth/refresh` | — | Rota el refresh token y devuelve un nuevo par |
| POST | `/auth/logout` | — | Revoca un refresh token (204) |
| GET | `/auth/me` | ✔ | Usuario actual |
| GET | `/dashboards?scope=mine\|public&page&limit` | ✔ | Listar dashboards |
| POST | `/dashboards` | ✔ | Crear dashboard |
| GET | `/dashboards/:id` | opcional | Ver (dueño, o cualquiera si `isPublic`) |
| PUT | `/dashboards/:id` | ✔ dueño | Actualizar (parcial: solo los campos enviados) |
| DELETE | `/dashboards/:id` | ✔ dueño | Eliminar (borra sus datapoints) → 204 |
| GET | `/dashboards/:id/datapoints?from&to&order&page&limit` | opcional | Listar datos |
| POST | `/dashboards/:id/datapoints` | ✔ dueño | Agregar un dato **o un array** (máx. 1000) |
| POST | `/reports` | ✔ | Generar reporte agregado (por dashboard y rango opcional) |
| GET | `/reports` | ✔ | Listar tus reportes |
| GET | `/reports/:id` | ✔ | Ver reporte completo |

## Ejemplos curl

```bash
API=http://localhost:5001

# --- Auth ---
curl -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"Secret123"}'

curl -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin1234!"}'

# Guardar tokens (requiere jq)
LOGIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin1234!"}')
TOKEN=$(echo "$LOGIN" | jq -r .data.accessToken)
REFRESH=$(echo "$LOGIN" | jq -r .data.refreshToken)

# Renovar (el refresh token anterior queda inválido)
curl -X POST $API/auth/refresh -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"

curl $API/auth/me -H "Authorization: Bearer $TOKEN"

# --- Dashboards ---
curl -X POST $API/dashboards -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Ventas","description":"Ventas mensuales","isPublic":false}'

curl "$API/dashboards?page=1&limit=10" -H "Authorization: Bearer $TOKEN"
curl "$API/dashboards?scope=public"    -H "Authorization: Bearer $TOKEN"

ID=<uuid-del-dashboard>
curl $API/dashboards/$ID -H "Authorization: Bearer $TOKEN"

curl -X PUT $API/dashboards/$ID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Ventas 2026","isPublic":true}'

curl -X DELETE $API/dashboards/$ID -H "Authorization: Bearer $TOKEN"

# --- Data points ---
curl -X POST $API/dashboards/$ID/datapoints -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"label":"Enero","value":1500.5}'

curl -X POST $API/dashboards/$ID/datapoints -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '[{"label":"Feb","value":2000,"timestamp":"2026-02-01T00:00:00Z"},{"label":"Mar","value":1000}]'

curl "$API/dashboards/$ID/datapoints?from=2026-01-01&to=2026-12-31&order=asc" -H "Authorization: Bearer $TOKEN"

# --- Reportes ---
curl -X POST $API/reports -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Reporte Q1","from":"2026-01-01","to":"2026-03-31"}'      # todos tus dashboards
curl -X POST $API/reports -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Solo ventas\",\"dashboardId\":\"$ID\"}"               # un dashboard

curl $API/reports -H "Authorization: Bearer $TOKEN"
curl $API/reports/<report-id> -H "Authorization: Bearer $TOKEN"
```

El campo `data` de un reporte contiene, por dashboard: `dataPoints`, `sum`, `avg`, `min`, `max`, más un `summary` global y el `period` consultado.

## Errores

Todos los errores tienen el mismo formato y **nunca exponen detalles internos** (stack traces, SQL, etc.; los errores inesperados se loguean solo en el servidor):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
             "details": [ { "field": "body.password", "message": "Password must contain a number" } ] } }
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query/params inválidos, JSON malformado |
| 401 | `AUTHENTICATION_ERROR` | Token ausente/inválido/expirado, credenciales incorrectas |
| 403 | `AUTHORIZATION_ERROR` | Intentar modificar un dashboard ajeno; `CORS_ERROR` para orígenes no permitidos |
| 404 | `NOT_FOUND` | No existe (los dashboards privados de otros usuarios también dan 404, para no revelar su existencia) |
| 409 | `CONFLICT` | Email ya registrado |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 1 MB |
| 429 | `RATE_LIMITED` | Demasiadas requests |
| 500 | `INTERNAL_ERROR` | Error inesperado (mensaje genérico) |

## Seguridad

- **Passwords**: bcryptjs (12 rounds), mínimo 8 caracteres con mayúscula, minúscula y número; nunca se devuelven en la API. El login responde igual si el email no existe o la contraseña es incorrecta y compara contra un hash dummy para igualar tiempos.
- **JWT**: access token corto (15 min) + refresh token (7 días) con secretos distintos en `.env`. Los refresh tokens se guardan **hasheados (sha256)** y **rotan** en cada uso; si se reutiliza uno ya usado se revocan todas las sesiones del usuario (detección de robo).
- **Helmet** para headers de seguridad, `x-powered-by` deshabilitado, **CORS** con lista blanca de orígenes, body limitado a 1 MB.
- **Rate limiting**: 100 req/15 min global y 10 req/15 min en `/auth/register|login|refresh` (configurable). `/health` queda fuera del límite.
- **Autorización**: cada recurso se filtra por dueño; los reportes solo agregan datos propios.

## Estructura

```
backend/
├── prisma/
│   ├── schema.prisma          # User, Dashboard, DataPoint, Report, RefreshToken
│   ├── migrations/            # SQL versionado
│   └── seed.ts
└── src/
    ├── config/env.ts          # variables de entorno validadas con Zod (fail-fast)
    ├── errors/AppError.ts     # errores tipados
    ├── middleware/            # auth, validate, errorHandler, rateLimiter
    ├── routes/                # auth, dashboards (+datapoints), reports
    ├── utils/                 # tokens JWT, paginación, asyncHandler
    ├── app.ts                 # configuración de Express
    └── index.ts               # arranque + graceful shutdown
```

## Notas

- `PUT /dashboards/:id` acepta actualizaciones parciales (al menos un campo).
- Además de lo pedido se agregaron `POST /auth/logout`, `GET /auth/me`, `GET /reports/:id`, un rol `USER|ADMIN` en `User` y la tabla `RefreshToken` (necesaria para rotar/revocar refresh tokens).
