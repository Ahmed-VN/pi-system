'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string | null
  }
}

export default function Header({ user }: HeaderProps) {
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const roleColors: Record<string, string> = {
    PI: 'bg-blue-100 text-blue-700',
    CO_PI: 'bg-purple-100 text-purple-700',
    JRF: 'bg-green-100 text-green-700',
    ADMIN: 'bg-red-100 text-red-700',
  }

  const roleColor = roleColors[user?.role || ''] || 'bg-gray-100 text-gray-700'

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Welcome back, {user?.name?.split(' ')[0]}!
        </h2>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${roleColor}`}>
          {user?.role?.replace('_', '-')}
        </span>
        <div className="flex items-center gap-2">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-blue-600 text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-800">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-gray-600"
        >
          Sign Out
        </Button>
      </div>
    </header>
  )
}