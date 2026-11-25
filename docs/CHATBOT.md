# Chatbot

## Interfaz

Componente flotante en el dashboard y página `/dashboard/chatbot`. Envía mensajes a `POST /api/chat` y permite adjuntar una imagen JPG/PNG/WEBP para identificarla.

## Intenciones

El servicio `src/services/chatbot.service.ts` clasifica consultas relacionadas con:

- Stock disponible por producto/sucursal.
- Productos con stock bajo o agotados.
- Próximos vencimientos y productos vencidos.
- Solicitudes de reposición.
- Alertas pendientes.

Las respuestas se construyen con datos persistidos en PostgreSQL, nunca con arrays hardcodeados.

## Proveedor LLM

Variables: `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`, `GROQ_TIMEOUT_MS`.

El chatbot usa Groq Chat Completions con `openai/gpt-oss-20b` por defecto. Los modelos `llama-3.1-8b-instant` y `llama-3.3-70b-versatile` ya no están disponibles para planes free/developer. Si Groq no está configurado o falla, se usa un fallback determinista basado en las intenciones; no se requiere un proveedor local.

La API key debe configurarse solo en `.env`, nunca en código, logs ni respuestas.

## Visión

`POST /api/chat/identify-product` recibe `file` y opcionalmente `branchId`. Usa `GROQ_VISION_MODEL`, valida MIME/tamaño y devuelve candidatos de `Product` con score, SKU, nombre y presentación. No modifica inventario.

## Agente de investigación

`POST /api/chat/investigate` usa `GROQ_AGENT_MODEL` (por defecto `openai/gpt-oss-20b`) y `GROQ_MAX_STEPS`. Las herramientas son de solo lectura: stock, lotes, configuración, transferencias y reposiciones. El agente puede recomendar una transferencia o reposición, pero no ejecutarla, no escribe SQL libre y no descuenta stock. La creación requiere confirmación humana desde la UI.

## Persistencia

Los mensajes pueden almacenarse en `ChatMessage` cuando se asocian a un usuario autenticado. En el MVP de demostración la conversación funciona sin sesión.
