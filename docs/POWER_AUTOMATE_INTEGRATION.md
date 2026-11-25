# Integración con Power Automate

Integración máquina-a-máquina propia de Power Automate. Usa su propia API key, independiente de la sesión de Supabase y de `OPENRPA_API_KEY`.

## Autenticación

Configura `POWER_AUTOMATE_API_KEY` en el servidor. Cada petición debe enviar:

```http
Authorization: Bearer <POWER_AUTOMATE_API_KEY>
```

Si la variable no existe, todos los endpoints responden `401`. La clave de OpenRPA **no** sirve aquí y viceversa.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/integrations/power-automate/reports?format=pdf\|csv\|both` | Reporte completo (alertas + transferencias + reposiciones). Devuelve el archivo en base64. |
| GET | `/api/integrations/power-automate/critical-alerts?branchId=&limit=` | Alertas críticas con stock real. |
| GET | `/api/integrations/power-automate/transfers/pending?status=` | Transferencias pendientes. |
| GET | `/api/integrations/power-automate/replenishments/authorized?status=` | Reposiciones autorizadas. |
| GET | `/api/integrations/power-automate/documents/[type]/[id]` | PDF de una operación (`type`: `TRANSFER` o `REPLENISHMENT`, en MAYÚSCULAS). |
| POST | `/api/integrations/power-automate/executions/start` | Registrar inicio de ejecución. |
| POST | `/api/integrations/power-automate/executions/finish` | Registrar fin de ejecución. |
| GET | `/api/integrations/power-automate/executions` | Historial de ejecuciones. |

## Respuesta de `/reports`

`format=both` (por defecto) devuelve PDF y CSV en la misma llamada:

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-11-24T19:00:00.000Z",
    "counts": { "alerts": 3, "transfers": 2, "replenishments": 1 },
    "pdf": {
      "fileName": "InkaStock_Report_20261124_1900.pdf",
      "contentType": "application/pdf",
      "base64": "JVBERi0xLjQK..."
    },
    "csv": {
      "fileName": "InkaStock_Report_20261124_1900.csv",
      "contentType": "text/csv; charset=utf-8",
      "base64": "SW5rYVN0b2Nr..."
    }
  },
  "message": "Operación realizada correctamente"
}
```

El CSV tiene tres secciones: `## ALERTAS CRITICAS`, `## TRANSFERENCIAS PENDIENTES` y `## REPOSICIONES AUTORIZADAS`. El PDF las muestra como tablas.

## Origen de `POWER_AUTOMATE_API_KEY`

No la emite Microsoft. Es un **secreto compartido** que se genera localmente, por ejemplo:

```bash
openssl rand -hex 24
```

El valor se guarda en `.env` como `POWER_AUTOMATE_API_KEY` y se replica en el flujo (header `Authorization`). Ambos deben ser idénticos. Para rotarla: genera otra cadena, actualiza `.env`, reinicia el servidor y actualiza el flujo.

## Flujo `InkaStock_Report` (correo Outlook con PDF + CSV)

> Power Automate (nube) **no puede llamar `http://localhost`**. Necesitas una URL pública (despliegue o túnel tipo `cloudflared`/`ngrok`). Usaremos `BASE_URL` para esa URL.

### Opción simple: dos flujos (recomendada para empezar)

Power Automate permite un solo trigger por flujo. Para tener ejecución programada y manual, lo más simple es crear **dos flujos** con las mismas acciones:

- **Programado**: *Scheduled cloud flow* con trigger *Recurrence*.
- **Manual**: *Instant cloud flow* con trigger *Manually trigger a flow*.

Ambos ejecutan los pasos 1–6 de abajo. Si prefieres no duplicar, crea un **flujo hijo** en una solución y dos padres que lo invoquen con *Run a Child Flow* (requiere que ambos estén en la misma solución).

### Paso a paso en la interfaz

**0. Prueba primero la API** (opcional, con Postman/curl) usando tu URL pública:

```bash
curl -H "Authorization: Bearer <POWER_AUTOMATE_API_KEY>" \
  "https://TU-DOMINIO/api/integrations/power-automate/reports?format=csv"
```

Si responde `200`, el flujo funcionará.

**1. Crear el flujo** → *Create* → *Scheduled cloud flow* (o *Instant cloud flow* para el manual) → nombre `InkaStock_Report`.

**2. Inicializar variables** (*Initialize variable*):

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `BaseUrl` | String | `https://TU-DOMINIO` (sin `/` final) |
| `ExecutionId` | String | `guid()` |
| `ApiKey` | String | tu `POWER_AUTOMATE_API_KEY` (o usa un secreto de la solución) |

**3. Registrar inicio** (*HTTP*):

- Método: `POST`
- URI: `@{variables('BaseUrl')}/api/integrations/power-automate/executions/start`
- Headers:
  - `Authorization`: `Bearer @{variables('ApiKey')}`
  - `Content-Type`: `application/json`
- Body:
  ```json
  {
    "executionId": "@{variables('ExecutionId')}",
    "workflowName": "InkaStock_Report_PA"
  }
  ```

**4. Descargar el reporte** (*HTTP*):

- Método: `GET`
- URI: `@{variables('BaseUrl')}/api/integrations/power-automate/reports?format=both`
- Header: `Authorization`: `Bearer @{variables('ApiKey')}`

**5. Parsear la respuesta** (*Data Operation → Parse JSON*), renombra la acción a `Parse_JSON`:

- *Content*: `Body` (salida dinámica del paso 4)
- *Schema*:
  ```json
  {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "message": { "type": "string" },
      "data": {
        "type": "object",
        "properties": {
          "generatedAt": { "type": "string" },
          "counts": {
            "type": "object",
            "properties": {
              "alerts": { "type": "integer" },
              "transfers": { "type": "integer" },
              "replenishments": { "type": "integer" }
            }
          },
          "pdf": {
            "type": "object",
            "properties": {
              "fileName": { "type": "string" },
              "contentType": { "type": "string" },
              "base64": { "type": "string" }
            }
          },
          "csv": {
            "type": "object",
            "properties": {
              "fileName": { "type": "string" },
              "contentType": { "type": "string" },
              "base64": { "type": "string" }
            }
          }
        }
      }
    }
  }
  ```

**6. Enviar el correo** (*Office 365 Outlook → Send an email (V2)*):

- *To*: destinatarios
- *Subject*: `InkaStock Report @{formatDateTime(utcNow(), 'yyyy-MM-dd HH:mm')}`
- *Body*:
  ```
  Alertas críticas: @{body('Parse_JSON')?['data']?['counts']?['alerts']}
  Transferencias pendientes: @{body('Parse_JSON')?['data']?['counts']?['transfers']}
  Reposiciones autorizadas: @{body('Parse_JSON')?['data']?['counts']?['replenishments']}
  Generado: @{body('Parse_JSON')?['data']?['generatedAt']}
  ```
- *Show advanced options → Attachments*:
  - *Name*: `@{body('Parse_JSON')?['data']?['pdf']?['fileName']}`
  - *Content*: `@{base64ToBinary(body('Parse_JSON')?['data']?['pdf']?['base64'])}`
  - Añade otro adjunto:
  - *Name*: `@{body('Parse_JSON')?['data']?['csv']?['fileName']}`
  - *Content*: `@{base64ToBinary(body('Parse_JSON')?['data']?['csv']?['base64'])}`

**7. Registrar fin** (*HTTP*):

- Método: `POST`
- URI: `@{variables('BaseUrl')}/api/integrations/power-automate/executions/finish`
- Headers: `Authorization: Bearer @{variables('ApiKey')}` y `Content-Type: application/json`
- Body:
  ```json
  {
    "executionId": "@{variables('ExecutionId')}",
    "status": "SUCCESS",
    "alertsFound": @{int(body('Parse_JSON')?['data']?['counts']?['alerts'])},
    "details": {
      "alerts": @{int(body('Parse_JSON')?['data']?['counts']?['alerts'])},
      "transfers": @{int(body('Parse_JSON')?['data']?['counts']?['transfers'])},
      "replenishments": @{int(body('Parse_JSON')?['data']?['counts']?['replenishments'])}
    }
  }
  ```

**8. Manejo de errores**: en los pasos 3–7 usa *Settings → Configure run after* y agrega una rama *has failed*. En esa rama envía un correo de error y, solo si el paso 3 (start) tuvo éxito, llama a `executions/finish` con `"status": "FAILED"`.

> El `executionId` de `finish` debe ser el mismo del `start`; si no, la API responde `404 EXECUTION_NOT_FOUND`.

## Notas

- `GET /api/reports` sigue siendo para la app (sesión `ADMIN`/`SUPERVISOR`) y no se usa desde Power Automate.
- Los límites son 100 registros por sección, igual que los endpoints de OpenRPA.
- El PDF usa solo caracteres ASCII en su capa de texto (los acentos se normalizan) para evitar errores de codificación de `pdf-lib`.
