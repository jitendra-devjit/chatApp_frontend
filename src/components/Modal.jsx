import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { useBackButton } from '../lib/backButton'

const spring = { type: 'spring', stiffness: 460, damping: 36 }

// Dimmed backdrop with a card in the middle, drawn on top of the whole page.
// It is rendered into <body>, because the glass panels would otherwise trap it inside themselves.
// Render inside <AnimatePresence>
const Modal = ({ label, role = 'dialog', onClose, className = 'max-w-md', children }) => {
  // the back button of a phone closes the dialog
  useBackButton(true, onClose)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <motion.div role={role} aria-modal='true' aria-label={label} onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 grid place-items-center p-4 bg-overlay md:backdrop-blur-md'>
      <motion.div onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={spring}
        className={`w-full max-h-[calc(100dvh-2rem)] flex flex-col rounded-[30px] bg-panel-solid border border-line-strong shadow-2xl ${className}`}>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  )
}

export const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className='flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0'>
    <div className='min-w-0'>
      <h2 className='text-xl font-extrabold tracking-tight'>{title}</h2>
      {subtitle && <p className='mt-1 text-sm text-muted'>{subtitle}</p>}
    </div>
    <button type='button' aria-label='Close' onClick={onClose}
      className='grid place-items-center w-9 h-9 shrink-0 -mr-1.5 rounded-full text-muted hover:bg-hover hover:text-ink'>
      <X size={18} weight='bold' />
    </button>
  </div>
)

// "Are you sure" question with a cancel and a confirm button
export const ConfirmDialog = ({ icon, title, text, confirmLabel, danger = false, onConfirm, onCancel }) => (
  <Modal label={title} role='alertdialog' onClose={onCancel} className='max-w-xs'>
    <div className='p-6 text-center'>
      <div className={`grid place-items-center w-14 h-14 mx-auto rounded-full ${danger ? 'bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] text-danger' : 'grad-soft text-accent-text'}`}>
        {icon}
      </div>
      <h2 className='mt-4 text-lg font-extrabold tracking-tight'>{title}</h2>
      <p className='mt-1.5 text-sm text-muted'>{text}</p>
      <div className='mt-6 grid grid-cols-2 gap-2.5'>
        <button type='button' onClick={onCancel} className='h-11 rounded-2xl bg-raised border border-line text-sm font-bold hover:bg-hover transition-colors'>
          Cancel
        </button>
        <button type='button' onClick={onConfirm} autoFocus
          className={`h-11 rounded-2xl text-white text-sm font-bold hover:brightness-110 transition ${danger ? 'bg-danger' : 'grad glow'}`}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
)

export default Modal
