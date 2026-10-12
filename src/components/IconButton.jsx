import React from 'react'
import { motion } from 'motion/react'

// Round button that holds a single icon. `label` is read by screen readers and shown on hover
const IconButton = ({ label, active = false, className = '', children, ...props }) => (
  <motion.button
    type='button'
    aria-label={label}
    title={label}
    whileTap={{ scale: 0.9 }}
    className={`grid place-items-center w-10 h-10 shrink-0 rounded-full transition-colors duration-150
      hover:bg-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent
      ${active ? 'bg-hover text-ink' : 'text-muted'} ${className}`}
    {...props}
  >
    {children}
  </motion.button>
)

export default IconButton
