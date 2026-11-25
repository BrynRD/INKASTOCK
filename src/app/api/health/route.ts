import { checkHealth } from '@/services/automation.service'

export async function GET() {
  const data = await checkHealth()
  return Response.json(data, { status: 200 })
}
