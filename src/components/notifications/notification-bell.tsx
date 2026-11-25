'use client'

import { useEffect, useState } from 'react'

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count')
        if (res.ok) {
          const json = await res.json()
          setCount(Number(json.data?.count ?? 0))
        }
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-[#D92732] px-2 py-0.5 text-xs font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}
