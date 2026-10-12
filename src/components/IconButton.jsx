import React from 'react'

// Square button that holds a single icon. `label` is read by screen readers and shown on hover
const IconButton = ({ label, active = false, className = '', children, ...props }) => (
  <button
    type='button'
    aria-label={label}
    title={label}
    className={`grid place-items-center w-9 h-9 shrink-0 rounded-xl transition-colors duration-150
      hover:bg-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent
      ${active ? 'bg-hover text-ink' : 'text-muted'} ${className}`}
    {...props}
  >
    {children}
  </button>
)

export default IconButton
