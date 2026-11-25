import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { UserRole } from '../src/generated/prisma/enums'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const useAdmin = Boolean(serviceRoleKey && !serviceRoleKey.includes('your-service-role-key'))
const demoPassword = process.env.AUTH_DEMO_PASSWORD

if (!supabaseUrl || (!useAdmin && !publishableKey)) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o la clave pública de Supabase')
}

if (!demoPassword || demoPassword.length < 6) {
  throw new Error('AUTH_DEMO_PASSWORD debe tener al menos 6 caracteres')
}

const authOptions = { auth: { autoRefreshToken: false, persistSession: false } }
const adminClient = useAdmin
  ? createClient(supabaseUrl!, serviceRoleKey!, authOptions)
  : null
const publicClient = createClient(supabaseUrl!, (publishableKey ?? serviceRoleKey)!, authOptions)

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const users = [
  { email: 'admin@inka.dev', name: 'Administrador', role: UserRole.ADMIN },
  { email: 'sup@inka.dev', name: 'Supervisor', role: UserRole.SUPERVISOR },
  { email: 'inv@inka.dev', name: 'Gestor de Inventario', role: UserRole.INVENTORY_MANAGER },
]

async function createAuthUserSql(email: string, name: string) {
  const authId = randomUUID()
  const now = new Date()
  const appMetadata = JSON.stringify({ provider: 'email', providers: ['email'] })
  const userMetadata = JSON.stringify({
    sub: authId,
    name,
    email,
    email_verified: true,
    phone_verified: false,
  })

  await prisma.$executeRaw`DELETE FROM auth.users WHERE email = ${email}`

  await prisma.$executeRaw`
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
      email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
      phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
      email_change_token_current, email_change_confirm_status, banned_until,
      reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
    )
    VALUES (
      ${authId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated', 'authenticated', ${email},
      extensions.crypt(${demoPassword}, extensions.gen_salt('bf', 10)), ${now},
      '', ${now}, '', null, '', '', null, null,
      ${appMetadata}::jsonb, ${userMetadata}::jsonb, null, ${now}, ${now},
      null, null, '', '', null, '', 0, null, '', null, false, null, false
    )
  `

  await prisma.$executeRaw`
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    )
    VALUES (${authId}, ${authId}::uuid, ${userMetadata}::jsonb, 'email', ${now}, ${now})
  `

  return authId
}

async function getAuthId(email: string, name: string) {
  const dbUser = await prisma.user.findUnique({ where: { email } })
  if (!dbUser) {
    throw new Error(`No existe ${email} en Prisma; ejecuta npm run prisma:seed`)
  }

  if (dbUser.supabaseAuthId) {
    return { authId: await createAuthUserSql(email, name), linked: true }
  }

  if (adminClient) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: demoPassword!,
      email_confirm: true,
      user_metadata: { name },
    })

    if (data.user?.id) {
      return { authId: data.user.id, linked: false }
    }

    const { data: listed, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) {
      throw listError
    }

    const existingId = listed.users.find((candidate) => candidate.email === email)?.id
    if (existingId) {
      return { authId: existingId, linked: false }
    }

    throw error ?? new Error(`No se pudo crear ${email} en Supabase Auth`)
  }

  return { authId: await createAuthUserSql(email, name), linked: false }
}

async function main() {
  const pendingConfirmation: string[] = []

  for (const user of users) {
    const { authId, linked } = await getAuthId(user.email, user.name)

    await prisma.user.update({
      where: { email: user.email },
      data: {
        supabaseAuthId: authId,
        name: user.name,
        role: user.role,
        active: true,
      },
    })

    if (!linked) {
      const { error } = await publicClient.auth.signInWithPassword({
        email: user.email,
        password: demoPassword!,
      })

      if (error?.message.toLowerCase().includes('confirm')) {
        pendingConfirmation.push(user.email)
      }
    }
  }

  console.log(`Usuarios Auth sincronizados: ${users.length}`)

  if (pendingConfirmation.length > 0) {
    console.log(`Confirmación de email pendiente: ${pendingConfirmation.join(', ')}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
