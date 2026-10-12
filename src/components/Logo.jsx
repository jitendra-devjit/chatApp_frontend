import React, { useId } from 'react'
import { APP_NAME } from '../lib/utils'

// Chat bubble on the accent gradient, follows the chosen accent colour
export const LogoMark = ({ className = 'w-9 h-9' }) => {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--a1)" />
          <stop offset=".55" stopColor="var(--a2)" />
          <stop offset="1" stopColor="var(--a3)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#${id})`} />
      <path d="M16 8.5c-4.7 0-8.5 3.2-8.5 7.2 0 2.2 1.2 4.2 3 5.500l-.7 3 3.4-1.700c.9.2 1.800.4 2.800.4 4.700 0 8.500-3.200 8.500-7.200s-3.800-7.200-8.500-7.200z" fill="#fff" />
      <circle cx="12.6" cy="15.8" r="1.25" fill="var(--a1)" />
      <circle cx="16" cy="15.8" r="1.25" fill="var(--a2)" />
      <circle cx="19.4" cy="15.8" r="1.25" fill="var(--a3)" />
    </svg>
  )
}

const Logo = ({ className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <LogoMark className='w-9 h-9' />
    <span className='text-[22px] font-extrabold tracking-tight text-ink'>{APP_NAME}</span>
  </div>
)

export default Logo
