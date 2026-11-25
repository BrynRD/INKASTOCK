# Integración con OpenRPA

## Autenticación

Configura `OPENRPA_API_KEY` en el servidor. Cada petición debe enviar:

```http
Authorization: Bearer <OPENRPA_API_KEY>
```

Si la variable no existe, todos los endpoints protegidos responden `401`, evitando aceptar tokens vacíos.

## Flujo `InkaStock_Monitoring`

1. `POST /api/integrations/openrpa/executions/start` con `executionId` y `workflowName`.
2. `GET /api/integrations/openrpa/critical-alerts` con filtros opcionales `branchId` y `limit`.
3. Generar el CSV localmente con la respuesta JSON.
4. `POST /api/integrations/openrpa/executions/finish` con `executionId`, `status`, `alertsFound` y `details`.
5. Consultar el historial en `/api/integrations/openrpa/executions`.

## Ejemplo de alerta crítica

```json
{
  "id": "00000000-0000-4000-8000-000000000701",
  "type": "OUT_OF_STOCK",
  "priority": "CRITICAL",
  "product": "Paracetamol 500 mg",
  "sku": "MED-0001",
  "branch": "Sucursal Centro",
  "stock": 0,
  "minimumStock": 50,
  "message": "Producto sin stock disponible"
}
```

`stock` y `minimumStock` se calculan desde PostgreSQL, no se hardcodean.

## Reportes

`GET /api/reports` genera un CSV de alertas críticas pendientes con stock real. OpenRPA puede consumir directamente el CSV o construir el suyo desde el JSON de alertas.

## Operaciones asistidas

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/integrations/openrpa/transfers/pending` | Transferencias pendientes de confirmación/despacho. |
| GET | `/api/integrations/openrpa/replenishments/authorized` | Reposiciones autorizadas para ordenar. |
| GET | `/api/integrations/openrpa/documents/[type]/[id]` | Descargar el PDF (`type`: `transfer` o `replenishment`). |

Estos endpoints solo leen y devuelven JSON/PDF. La aprobación, recepción y cualquier cambio de stock siguen ocurriendo en InkaStock o mediante los endpoints autenticados de la app, no por API key de OpenRPA.

## Registro de ejecuciones

`AutomationLog` guarda `executionId`, `workflowName`, estado, cantidad de alertas y detalles. El dashboard de automatizaciones permite verificar el health check de la API antes de ejecutar el workflow.
