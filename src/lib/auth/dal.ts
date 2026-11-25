import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export type AuthUser = {
  id: string
  authId: string
  name: string
  email: string
  role: UserRole
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    return null
  }

  const authId = data.claims.sub
  const email = typeof data.claims.email === 'string' ? data.claims.email.toLowerCase() : ''

  const dbUser = await prisma.user.findFirst({
    where: email
      ? { OR: [{ supabaseAuthId: authId }, { email }] }
      : { supabaseAuthId: authId },
  })

  if (!dbUser || !dbUser.active) {
    return null
  }

  if (!dbUser.supabaseAuthId) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { supabaseAuthId: authId },
    })
  }

  return {
    id: dbUser.id,
    authId,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
  }
})

export async function requireUser(roles?: UserRole[]): Promise<AuthUser> {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  if (roles && !roles.includes(user.role)) {
    redirect('/dashboard/forbidden')
  }

  return user
}
