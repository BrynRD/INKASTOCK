'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const next = searchParams.get('next') ?? '/dashboard'
  const redirectTo = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Correo</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border-2 border-[var(--line)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green)]/20 bg-[var(--sf)]"
          placeholder="admin@inka.dev"
        />
      </label>

      <label className="block relative">
        <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Contraseña</span>
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border-2 border-[var(--line)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green)]/20 bg-[var(--sf)] pr-10"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-10 text-xs text-[var(--mute)] hover:text-[var(--green)] transition-colors"
        >
          {showPassword ? 'Ocultar' : 'Mostrar'}
        </button>
      </label>

      {error ? (
        <p className="rounded-lg border-2 border-[var(--bad)] bg-[var(--bad)] px-4 py-3 text-sm text-[var(--ink)] font-medium">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--green)] text-white font-semibold text-sm px-4 py-3 shadow-[0_4px_0_var(--gd)] hover:bg-[var(--green)] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
