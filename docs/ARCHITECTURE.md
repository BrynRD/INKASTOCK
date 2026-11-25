# Arquitectura

## Capas

- `src/app`: Route Handlers y páginas del App Router.
- `src/proxy.ts`: filtro de sesión optimista en el borde (Proxy de Next.js 16; antes middleware).
- `src/lib/supabase`: clientes browser (`client.ts`), servidor (`server.ts`) y de proxy (`proxy.ts`) con `@supabase/ssr`.
- `src/lib/auth`: DAL (`dal.ts`), guardia de API (`api.ts`) y constantes RBAC (`permissions.ts`).
- `src/services`: reglas de negocio (inventario, alertas, transferencias, reposiciones, chatbot, visión, PDF, correo, Telegram, OpenRPA y reportes).
- `src/lib`: cliente Prisma, respuestas de API, validaciones Zod, lógica pura de inventario.
- `src/components/auth`: navegación filtrada por rol, menú de usuario, `SessionGuard` y formulario de login.
- `src/components`: componentes React reutilizables.
- `prisma/`: esquema, configuración y seed.

## Flujo de una petición

1. El proxy ejecuta `updateSession()`: `getClaims()` de Supabase renueva la sesión y propaga las cookies `sb-*`; después redirige a `/login` (páginas) o responde `401` (API) si no hay cookie. Es una comprobación optimista: no consulta la base de datos.
2. En páginas, `SessionGuard`/`requireUser(roles)` vuelven a verificar la sesión en servidor a través de la DAL y redirigen a `/login` o `/dashboard/forbidden` según corresponda.
3. En la API, `withApiAuth(roles, handler)` usa la misma DAL, responde `401`/`403` y entrega el usuario (incluido `user.id`) al handler.
4. La DAL (`getAuthUser`, memoizada con `cache`) valida `supabase.auth.getClaims()`, busca el usuario en Prisma por `supabaseAuthId` o email, respeta `active`, vincula el UUID en el primer login y devuelve un DTO mínimo; nunca expone tokens al cliente.
5. La UI llama a un Route Handler con datos validados por Zod; el handler delega en un servicio.
6. El servicio usa transacciones de Prisma cuando la operación es crítica.
7. La respuesta se normaliza con `successResponse` o `errorResponse`.

## Autenticación y RBAC

- **Identidad y sesión**: Supabase Auth. Login en `/login` mediante `signInWithPassword`, callback de código en `/auth/callback`, cierre de sesión en `POST /api/auth/logout`.
- **Fuente de verdad de roles**: Prisma. `User.role` (`ADMIN`, `SUPERVISOR`, `INVENTORY_MANAGER`), `User.active` y `User.supabaseAuthId` único. Las constantes de `permissions.ts` y `NAV_ROLES` derivan del enum `UserRole` generado por Prisma; Supabase no almacena roles de negocio.
- **Doble comprobación**: el proxy solo decide redirecciones rápidas; la autoridad son la DAL y `withApiAuth` cerca de los datos. `withApiAuth(undefined, …)` exige únicamente sesión válida.
- **OpenRPA**: autenticación de máquina con `OPENRPA_API_KEY` en el header `Authorization`, independiente de la sesión y excluida del proxy.
- **Power Automate**: autenticación de máquina con `POWER_AUTOMATE_API_KEY` en el header `Authorization`, independiente de la sesión y de OpenRPA, y excluida del proxy.
- **Cache Components**: la lectura de sesión ocurre en tiempo de petición; los componentes que usan la DAL están tras `<Suspense>` y las páginas con base de datos usan `connection()`.

## Decisiones

- El stock se calcula sumando lotes vigentes; no existe columna de stock total.
- Las salidas usan FEFO y `updateMany` condicional para evitar carreras.
- Las recepciones y movimientos se ejecutan en transacciones interactivas.
- Las alertas usan `fingerprint` único para evitar duplicados.
- Las páginas con base de datos usan `<Suspense>` + `connection()` porque `cacheComponents` está habilitado.
- Las claves de API y la service role de Supabase solo existen en servidor; el código actual no usa la service role.
