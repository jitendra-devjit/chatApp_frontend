import React from 'react'

// Three dots bouncing one after another
const TypingDots = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden='true'>
    {[0, 1, 2].map((dot) => (
      <span key={dot} style={{ animationDelay: `${dot * 0.16}s` }}
        className='w-1.5 h-1.5 rounded-full bg-current animate-typing' />
    ))}
  </span>
)

export default TypingDots
