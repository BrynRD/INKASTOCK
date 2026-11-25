# Autenticación y autorización

## Resumen

- **Supabase Auth** (`@supabase/ssr`) gestiona la identidad (email/contraseña) y la sesión en cookies `sb-<project-ref>-auth-token`.
- **Prisma** es la fuente de verdad de la autorización: `User.role`, `User.active` y `User.supabaseAuthId` (único). Supabase no define los roles de negocio.
- `src/proxy.ts` hace comprobaciones **optimistas** de sesión; la decisión definitiva la toma el DAL (`src/lib/auth/dal.ts`) contra Supabase y Prisma.
- Un usuario debe existir en **Supabase Auth** (para entrar) y en **Prisma `User`** (para tener rol). El primer login vincula ambos por email.

## Flujo completo

1. **Alta**: el administrador crea el usuario en Supabase Dashboard → Authentication → Users. El seed de Prisma crea el registro con su rol.
2. **Login**: `/login` envía `signInWithPassword` con el cliente browser de `src/lib/supabase/client.ts`. Supabase devuelve la sesión y `@supabase/ssr` escribe las cookies. El formulario redirige al parámetro `next` validado (por defecto `/dashboard`).
3. **Proxy**: en cada petición a `/`, `/login`, `/dashboard/*` y `/api/*`, `src/proxy.ts` llama a `updateSession()` (`src/lib/supabase/proxy.ts`), que ejecuta `getClaims()` y propaga las cookies refrescadas. Después aplica reglas optimistas:
    - Sin cookie `sb-…-auth-token`: `/dashboard/*` → `/login?next=…`, `/` → `/login`, `/api/*` (excepto `/api/health`, `/api/auth/*`, `/api/telegram/webhook` y `/api/integrations/openrpa/*`) → `401 UNAUTHORIZED`.
   - Con sesión: `/login` → `/dashboard`, `/` → `/dashboard`.
4. **Callback**: `GET /auth/callback?code=…` intercambia el código por sesión con `exchangeCodeForSession()` (flujos con `code`, OAuth o magic link). `next` solo acepta rutas relativas que no empiecen por `//`; si falla el intercambio, redirige a `/login?error=auth`. El login por contraseña actual no pasa por esta ruta.
5. **DAL**: `getAuthUser()` (memoizado con `cache` para un render) ejecuta `supabase.auth.getClaims()`, toma `sub` y `email`, busca en Prisma por `supabaseAuthId` **o** email (comparación sin distinción de mayúsculas), exige `active = true`, guarda el UUID de Auth en `supabaseAuthId` si aún está vacío y devuelve un DTO `{ id, authId, name, email, role }`. `requireUser(roles?)` redirige a `/login` si no hay usuario y a `/dashboard/forbidden` si el rol no está permitido.
6. **API**: `withApiAuth(roles, handler)` en `src/lib/auth/api.ts` usa el DAL y responde `401 UNAUTHORIZED` sin usuario, `403 FORBIDDEN` con rol insuficiente; si pasa, entrega el usuario al handler (incluido `user.id`).
7. **Logout**: `POST /api/auth/logout` llama a `supabase.auth.signOut()` y devuelve `303` a `/login`. Es la única forma soportada de cerrar sesión.

Con `cacheComponents: true`, la lectura de la sesión ocurre en tiempo de petición: los componentes que llaman al DAL viven detrás de `<Suspense>` y las páginas con base de datos usan `connection()`. El proxy no consulta Prisma.

## Matriz de roles

Leyenda: **Todos** = cualquier usuario autenticado y activo; **Admin** = `ADMIN`; **Inv** = `INVENTORY_WRITE_ROLES` (`ADMIN`, `INVENTORY_MANAGER`); **Aprob** = `APPROVAL_ROLES` (`ADMIN`, `SUPERVISOR`); **Report** = `REPORT_ROLES` (`ADMIN`, `SUPERVISOR`).

### Páginas

| Ruta | Roles |
| --- | --- |
| `/login` | Pública (con sesión redirige a `/dashboard`). |
| `/` | Redirige a `/dashboard` o `/login` según la sesión. |
| `/dashboard/forbidden` | Cualquier usuario con sesión. |
| `/dashboard` | Todos |
| `/dashboard/products` | Todos (formulario y acciones de producto solo Admin). |
| `/dashboard/branches` | Admin |
| `/dashboard/inventory` | Todos |
| `/dashboard/inventory/lots` | Todos |
| `/dashboard/inventory/movements` | Todos (formulario de movimientos solo Inv). |
| `/dashboard/alerts` | Todos |
| `/dashboard/replenishments` | Todos (crear/recibir: Inv; autorizar/aprobar/rechazar: Aprob). |
| `/dashboard/transfers` | Todos (crear/confirmar/despachar/recibir: Inv; autorizar: Aprob). |
| `/dashboard/notifications` | Todos |
| `/dashboard/telegram` | Todos |
| `/dashboard/reports` | Report |
| `/dashboard/automations` | Admin |
| `/dashboard/chatbot` | Todos |
| `/dashboard/settings` | Admin |

Estas reglas se definen en `NAV_ROLES` (`src/lib/auth/permissions.ts`) y se aplican dos veces: el menú filtra enlaces y cada página usa `<SessionGuard roles={…}>`/`requireUser(roles)`. Ocultar un enlace nunca sustituye a la comprobación en servidor.

### Endpoints

| Método | Ruta | Roles |
| --- | --- | --- |
| GET | `/api/products` | Todos |
| POST | `/api/products` | Admin |
| GET | `/api/products/[id]` | Todos |
| PUT, DELETE | `/api/products/[id]` | Admin |
| GET | `/api/branches` | Todos |
| POST | `/api/branches` | Admin |
| GET | `/api/branches/[id]` | Todos |
| PUT, DELETE | `/api/branches/[id]` | Admin |
| GET | `/api/inventory/lots` | Todos |
| POST | `/api/inventory/lots` | Inv |
| GET | `/api/inventory/movements` | Todos |
| POST | `/api/inventory/movements` | Inv |
| GET | `/api/alerts` | Todos |
| GET, PUT | `/api/alerts/[id]` | Todos |
| POST | `/api/alerts/detect` | Admin |
| GET | `/api/replenishments` | Todos |
| POST | `/api/replenishments` | Inv |
| GET | `/api/replenishments/[id]` | Todos |
| POST | `/api/replenishments/[id]/authorize` | Aprob |
| POST, PUT | `/api/replenishments/[id]/approve` | Aprob |
| POST, PUT | `/api/replenishments/[id]/reject` | Aprob |
| POST, PUT | `/api/replenishments/[id]/receive` | Inv |
| GET | `/api/transfers` | Todos |
| POST | `/api/transfers` | Inv |
| POST | `/api/transfers/recommend` | Todos |
| GET | `/api/transfers/[id]` | Todos |
| POST | `/api/transfers/[id]/authorize` | Aprob |
| POST | `/api/transfers/[id]/origin-confirm` | Inv |
| POST | `/api/transfers/[id]/dispatch` | Inv |
| POST | `/api/transfers/[id]/receive` | Inv |
| POST | `/api/transfers/[id]/reject` | Inv |
| POST | `/api/chat` | Todos |
| POST | `/api/chat/investigate` | Todos |
| POST | `/api/chat/identify-product` | Todos |
| GET | `/api/documents/transfers/[id]` | Todos |
| GET | `/api/documents/replenishments/[id]` | Todos |
| POST | `/api/telegram/link-code` | Todos |
| POST | `/api/telegram/setup` | Admin |
| GET | `/api/reports` | Report |

Excepciones:

- `GET /api/health`: público (monitorización).
- `POST /api/auth/logout`: público; cierra la sesión si existe y redirige a `/login`.
- `GET /auth/callback`: público; requiere un `code` válido de Supabase.
- `POST /api/telegram/webhook`: público; exige `X-Telegram-Bot-Api-Secret-Token` igual a `TELEGRAM_WEBHOOK_SECRET`.
- `/api/integrations/openrpa/*`: no usan sesión de la app; exigen `Authorization: Bearer <OPENRPA_API_KEY>`. Un 401 aquí es de API key, no de Supabase.
- `/api/integrations/power-automate/*`: no usan sesión de la app; exigen `Authorization: Bearer <POWER_AUTOMATE_API_KEY>`. La clave de OpenRPA no es válida aquí.

Un `403` significa que la identidad es válida pero el rol de Prisma no aparece en la lista de la tabla. Un `401` significa que no hay sesión válida, que el usuario está inactivo o que no existe en Prisma.

## Crear usuarios en Supabase Dashboard

1. Ejecuta primero el seed (`npm run prisma:seed`) para que los tres registros de Prisma existan con su rol.
2. Entra en **Supabase Dashboard → Authentication → Users → Add user → Create new user**.
3. Repite para cada correo, con una contraseña propia y segura (no versionada):

   | Email | Rol en Prisma | Acceso |
   | --- | --- | --- |
   | `admin@inka.dev` | `ADMIN` | Todo, incluidas sucursales, automatizaciones y ajustes. |
   | `sup@inka.dev` | `SUPERVISOR` | Panel, operaciones, aprobaciones y reportes. |
   | `inv@inka.dev` | `INVENTORY_MANAGER` | Panel, inventario, movimientos y recepciones. |

4. Usa la contraseña demo `123456` y marca **Auto Confirm User** o desactiva la confirmación de email en **Authentication → Providers → Email**: los dominios `.dev` no reciben correos de verificación en este demo.
5. Opcionalmente copia el **UUID** del usuario de Auth para compararlo con `User.supabaseAuthId`.
6. En **Authentication → URL Configuration**, define `Site URL` (por ejemplo `http://localhost:3000`) y añade `http://localhost:3000/auth/callback` a **Redirect URLs** (y el equivalente de producción) si usas flujos con `code`.
7. Inicia sesión en `/login` con cada correo y contraseña. En ese primer login el DAL vincula el UUID de Auth al registro de Prisma por email.
8. Verifica la vinculación con `npm run prisma:studio` o en el SQL Editor de Supabase:

   ```sql
   select email, role, active, "supabaseAuthId" from "User" order by email;
   ```

No cambies el email de un usuario de Auth sin actualizar también `User.email`: la vinculación se hace por email la primera vez y después por UUID.

## Creación automática de usuarios Auth

También puedes crear los tres usuarios y sincronizar sus UUID desde la terminal:

1. Añade a `.env` (sin versionar):

   ```bash
   AUTH_DEMO_PASSWORD="123456"
   SUPABASE_SERVICE_ROLE_KEY="service-role-key-del-proyecto"
   ```

   La service role es opcional: con ella el script usa Admin API; sin ella crea los usuarios directamente en el schema `auth` usando `DATABASE_URL`, con email confirmado y sin enviar correos. Ambos modos sincronizan `supabaseAuthId` en Prisma.

2. Ejecuta:

   ```bash
   npm run prisma:seed
   npm run auth:users
   ```

3. El script reutiliza usuarios ya vinculados y actualiza `User.supabaseAuthId`, `name`, `role` y `active` en Prisma. Si tu proyecto exige confirmación de email y no usaste service role, desactívala en **Authentication → Providers → Email** o confirma los usuarios manualmente.

## Rotación de credenciales

- `.env` no se versiona. Nunca pongas la service role key en una variable `NEXT_PUBLIC_*`; este proyecto solo usa la service role en `npm run auth:users`, que se ejecuta en servidor.
- Si se compartió una contraseña demo, cámbiala en **Authentication → Users** para ese usuario.
- Rota `OPENRPA_API_KEY` en el servidor y actualiza a los clientes OpenRPA; el valor viejo deja de funcionar de inmediato.
- Rota `POWER_AUTOMATE_API_KEY` de forma independiente y actualiza el secreto en Power Automate; el valor viejo deja de funcionar de inmediato.
- Al rotar la contraseña de la base de datos, actualiza `DATABASE_URL` y `DIRECT_URL` juntos y reinicia la app.
- Las claves publishable/anon se gestionan en **Project Settings → API Keys**. Un cambio requiere actualizar `.env` y reconstruir el frontend porque `NEXT_PUBLIC_*` se inyecta en el build.
- Si sospechas de tokens comprometidos, revoca las sesiones activas desde **Authentication → Users** (sign out de todos los usuarios) y rota las claves de firma del proyecto; los usuarios tendrán que volver a iniciar sesión.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en `prisma/auth-users.ts`. Si existe en algún entorno y pudo filtrarse, rota esa key y elimínala donde no se necesite.

## Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `401 UNAUTHORIZED` en `/api/*` estando "logueado" | Falta la cookie `sb-…-auth-token` o expiró; el proxy corta antes del handler. | Inicia sesión de nuevo; revisa que la petición incluya cookies. |
| `401` con cookie presente | `getClaims()` falló, el proyecto está pausado o el usuario Prisma tiene `active = false`. | Revisa los logs de Supabase, el campo `active` y el estado del proyecto. |
| `403 FORBIDDEN` | El rol no está en la matriz. | Consulta la tabla anterior y corrige `User.role` en Prisma; el rol de Supabase no cuenta. |
| Usuario no vinculado | No se ejecutó el seed, el email difiere del de Auth o `supabaseAuthId` ya apunta a otra identidad. | Ejecuta `npm run prisma:seed`, iguala el email y revisa `supabaseAuthId` en Prisma Studio. El DAL nunca sobrescribe un UUID ya vinculado. |
| "Invalid login credentials" | Usuario inexistente en Supabase, contraseña errónea o email sin confirmar. | Crea el usuario en Auth, usa la contraseña correcta y activa Auto Confirm. |
| Bucle `/login` ↔ `/dashboard` | Cookies del navegador obsoletas o Site URL/Redirect URLs mal configuradas. | Borra las cookies del sitio y revisa la configuración de Auth en Supabase. |
| Errores de red de Supabase o login que siempre redirige | Proyecto Supabase pausado por inactividad (plan free) o URL/key equivocadas. | Reactiva el proyecto en el Dashboard, revisa `NEXT_PUBLIC_SUPABASE_URL` y la key, reinicia `next dev` o reconstruye. |
| `401` en `/api/integrations/openrpa/*` | Falta o es incorrecto el header `Authorization: Bearer …`. | Verifica `OPENRPA_API_KEY`; estos endpoints no aceptan la cookie de la app. |
| `401` en `/api/integrations/power-automate/*` | Falta o es incorrecto el header `Authorization: Bearer …`. | Verifica `POWER_AUTOMATE_API_KEY`; la clave de OpenRPA no sirve. |
| La app no arranca por variables Undefined | `NEXT_PUBLIC_SUPABASE_URL` o la key no están definidas. | Copia `.env.example` a `.env`, completa los valores y reinicia el servidor. |
