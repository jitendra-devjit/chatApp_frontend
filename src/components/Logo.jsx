import React from 'react'
import { APP_NAME } from '../lib/utils'

export const LogoMark = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="var(--accent)" />
    <path d="M9 12h14M9 17.5h8.5" stroke="var(--accent-ink)" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="22" cy="17.5" r="1.6" fill="var(--accent-ink)" />
  </svg>
)

const Logo = ({ className = '' }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <LogoMark className='w-7 h-7' />
    <span className='font-serif italic text-[26px] leading-none tracking-tight text-ink'>
      {APP_NAME.toLowerCase()}
    </span>
  </div>
)

export default Logo
