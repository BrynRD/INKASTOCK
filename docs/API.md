# API REST

## Autenticación

Todos los endpoints de la app, salvo las excepciones indicadas, requieren una sesión válida de **Supabase Auth** en la cookie `sb-<project-ref>-auth-token`. No se acepta un token en el header `Authorization` para la API de la app.

El access control se aplica en dos niveles:

1. `src/proxy.ts` devuelve `401` de forma optimista si no hay cookie de sesión (antes de llegar al handler).
2. `withApiAuth(roles, handler)` valida la identidad y el rol contra la DAL/Prisma en el Route Handler.

| Situación | Respuesta |
| --- | --- |
| Sin sesión, sesión inválida o usuario Prisma inactivo/no vinculado | `401 UNAUTHORIZED` |
| Sesión válida con rol no permitido | `403 FORBIDDEN` |

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Acceso denegado" } }
```

Leyenda de la columna **Roles**: **Todos** = cualquier usuario autenticado y activo; **Admin** = `ADMIN_ONLY`; **Inv** = `INVENTORY_WRITE_ROLES` (`ADMIN`, `INVENTORY_MANAGER`); **Aprob** = `APPROVAL_ROLES` (`ADMIN`, `SUPERVISOR`); **Report** = `REPORT_ROLES` (`ADMIN`, `SUPERVISOR`). La matriz completa de páginas y endpoints está en `docs/AUTH.md`.

## Formato

Éxito:

```json
{ "success": true, "data": {}, "message": "Operación realizada correctamente" }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Los datos enviados no son válidos" } }
```

Códigos: 200, 201, 400, 401, 403, 404, 409, 500.

## Endpoints autenticados de la app

| Método | Ruta | Roles | Descripción |
| --- | --- | --- | --- |
| GET | `/api/products` | Todos | Listar productos. |
| POST | `/api/products` | Admin | Crear producto. |
| GET | `/api/products/[id]` | Todos | Detalle. |
| PUT | `/api/products/[id]` | Admin | Actualizar. |
| DELETE | `/api/products/[id]` | Admin | Desactivar. |
| GET | `/api/branches` | Todos | Listar sucursales. |
| POST | `/api/branches` | Admin | Crear sucursal. |
| GET | `/api/branches/[id]` | Todos | Detalle. |
| PUT | `/api/branches/[id]` | Admin | Actualizar. |
| DELETE | `/api/branches/[id]` | Admin | Desactivar. |
| GET | `/api/inventory/lots` | Todos | Listar lotes. |
| POST | `/api/inventory/lots` | Inv | Crear lote. |
| GET | `/api/inventory/movements` | Todos | Listar movimientos. |
| POST | `/api/inventory/movements` | Inv | Registrar entradas, salidas y ajustes. |
| GET | `/api/alerts` | Todos | Listar alertas. |
| GET | `/api/alerts/[id]` | Todos | Detalle. |
| PUT | `/api/alerts/[id]` | Todos | Cambiar estado. |
| POST | `/api/alerts/detect` | Admin | Ejecutar detección automática. |
| GET | `/api/replenishments` | Todos | Listar reposiciones. |
| POST | `/api/replenishments` | Inv | Crear reposición; devuelve `replenishment` y `suggestion`. |
| GET | `/api/replenishments/[id]` | Todos | Detalle con items y lotes. |
| POST | `/api/replenishments/[id]/authorize` | Aprob | Autorizar y pasar a `REQUESTED`. |
| POST, PUT | `/api/replenishments/[id]/approve` | Aprob | Aprobar. |
| POST, PUT | `/api/replenishments/[id]/reject` | Aprob | Rechazar. |
| POST, PUT | `/api/replenishments/[id]/receive` | Inv | Recibir items con lote/vencimiento. |
| GET | `/api/transfers` | Todos | Listar transferencias. |
| POST | `/api/transfers` | Inv | Crear propuesta de transferencia. |
| POST | `/api/transfers/recommend` | Todos | Recomendar origen/cantidad. |
| GET | `/api/transfers/[id]` | Todos | Detalle. |
| POST | `/api/transfers/[id]/authorize` | Aprob | Autorizar. |
| POST | `/api/transfers/[id]/origin-confirm` | Inv | Confirmar stock del origen. |
| POST | `/api/transfers/[id]/dispatch` | Inv | Despachar y reservar lotes FEFO. |
| POST | `/api/transfers/[id]/receive` | Inv | Recepción total o parcial. |
| POST | `/api/transfers/[id]/reject` | Inv | Rechazar. |
| POST | `/api/chat` | Todos | Chat básico. |
| POST | `/api/chat/investigate` | Todos | Agente de solo lectura y recomendación. |
| POST | `/api/chat/identify-product` | Todos | Identificar producto desde imagen. |
| GET | `/api/documents/transfers/[id]` | Todos | Descargar PDF privado de transferencia. |
| GET | `/api/documents/replenishments/[id]` | Todos | Descargar PDF privado de reposición. |
| POST | `/api/telegram/link-code` | Todos | Generar código de vinculación. |
| POST | `/api/telegram/setup` | Admin | Registrar webhook de Telegram. |
| GET | `/api/reports` | Report | Descargar CSV de alertas críticas pendientes. |

### Registrar salida

```json
{
  "productId": "00000000-0000-4000-8000-000000000201",
  "branchId": "00000000-0000-4000-8000-000000000101",
  "type": "EXIT",
  "quantity": 10
}
```

Una nueva entrada requiere `lotId` o `lotNumber` + `expirationDate`.

## Endpoints públicos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado de la aplicación (monitorización). |
| POST | `/api/auth/logout` | Cierra la sesión de Supabase y redirige con `303` a `/login`. |
| POST | `/api/telegram/webhook` | Webhook de Telegram; se autentica con `X-Telegram-Bot-Api-Secret-Token`. |

`GET /auth/callback?code=…` (fuera de `/api`) también es público: intercambia el código por una sesión de Supabase y redirige a `next` si es seguro.

## Endpoints de OpenRPA

Siguen usando **API key**, no la sesión de Supabase: `Authorization: Bearer <OPENRPA_API_KEY>`. Están excluidos del filtro de cookies del proxy. Si falta la variable o el header, responden `401`; ese 401 no indica un problema de Supabase.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/integrations/openrpa/critical-alerts` | Alertas críticas con stock real. |
| GET | `/api/integrations/openrpa/executions` | Historial de ejecuciones. |
| POST | `/api/integrations/openrpa/executions/start` | Registrar inicio. |
| POST | `/api/integrations/openrpa/executions/finish` | Registrar fin. |
| GET | `/api/integrations/openrpa/transfers/pending` | Transferencias pendientes de origen/despacho. |
| GET | `/api/integrations/openrpa/replenishments/authorized` | Reposiciones autorizadas. |
| GET | `/api/integrations/openrpa/documents/[type]/[id]` | Descargar PDF para adjuntar en el flujo. |

`GET /api/reports` no forma parte de esta integración: requiere sesión con rol `ADMIN` o `SUPERVISOR`. OpenRPA debe construir su CSV desde el JSON de `critical-alerts`.

## Endpoints de Power Automate

Integración independiente con su propia API key: `Authorization: Bearer <POWER_AUTOMATE_API_KEY>`. La clave de OpenRPA no sirve aquí y viceversa. Están excluidos del filtro de cookies del proxy.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/integrations/power-automate/reports?format=pdf\|csv\|both` | Reporte completo (alertas + transferencias + reposiciones) en base64. |
| GET | `/api/integrations/power-automate/critical-alerts` | Alertas críticas con stock real. |
| GET | `/api/integrations/power-automate/transfers/pending` | Transferencias pendientes. |
| GET | `/api/integrations/power-automate/replenishments/authorized` | Reposiciones autorizadas. |
| GET | `/api/integrations/power-automate/documents/[type]/[id]` | PDF de una operación (`TRANSFER`/`REPLENISHMENT`). |
| POST | `/api/integrations/power-automate/executions/start` | Registrar inicio. |
| POST | `/api/integrations/power-automate/executions/finish` | Registrar fin. |
| GET | `/api/integrations/power-automate/executions` | Historial de ejecuciones. |

Consulta `docs/POWER_AUTOMATE_INTEGRATION.md` para el flujo de correo con PDF y CSV.
