import { afterEach, describe, expect, it } from 'vitest'
import {
  errorResponse,
  isOpenRpaAuthorized,
  isPowerAutomateAuthorized,
  successResponse,
} from '@/lib/api-utils'

describe('respuestas de API', () => {
  it('devuelve el formato de éxito', async () => {
    const response = successResponse({ total: 2 })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { total: 2 },
      message: 'Operación realizada correctamente',
    })
  })

  it('devuelve el formato de error', async () => {
    const response = errorResponse(401, 'UNAUTHORIZED', 'No autorizado')

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
    })
  })
})

describe('autenticación de OpenRPA', () => {
  afterEach(() => {
    delete process.env.OPENRPA_API_KEY
  })

  it('rechaza peticiones cuando no hay API key configurada', () => {
    const request = new Request('http://localhost/api/integrations/openrpa/critical-alerts', {
      headers: { authorization: 'Bearer ' },
    })

    expect(isOpenRpaAuthorized(request)).toBe(false)
  })

  it('acepta el token configurado', () => {
    process.env.OPENRPA_API_KEY = 'clave-demo'
    const request = new Request('http://localhost/api/integrations/openrpa/critical-alerts', {
      headers: { authorization: 'Bearer clave-demo' },
    })

    expect(isOpenRpaAuthorized(request)).toBe(true)
  })
})

describe('autenticación de Power Automate', () => {
  afterEach(() => {
    delete process.env.POWER_AUTOMATE_API_KEY
    delete process.env.OPENRPA_API_KEY
  })

  it('rechaza peticiones cuando no hay API key configurada', () => {
    const request = new Request('http://localhost/api/integrations/power-automate/reports', {
      headers: { authorization: 'Bearer ' },
    })

    expect(isPowerAutomateAuthorized(request)).toBe(false)
  })

  it('acepta el token configurado', () => {
    process.env.POWER_AUTOMATE_API_KEY = 'pa-demo'
    const request = new Request('http://localhost/api/integrations/power-automate/reports', {
      headers: { authorization: 'Bearer pa-demo' },
    })

    expect(isPowerAutomateAuthorized(request)).toBe(true)
  })

  it('no acepta la clave de OpenRPA', () => {
    process.env.OPENRPA_API_KEY = 'openrpa-demo'
    const request = new Request('http://localhost/api/integrations/power-automate/reports', {
      headers: { authorization: 'Bearer openrpa-demo' },
    })

    expect(isPowerAutomateAuthorized(request)).toBe(false)
  })
})
