import type { Actor } from '@/lib/actor'
import type { AuthUser } from '@/lib/auth/dal'

export function toActor(user: AuthUser): Actor {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  }
}
