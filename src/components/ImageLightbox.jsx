import React, { useEffect } from 'react'
import { motion } from 'motion/react'
import { ArrowSquareOut, X } from '@phosphor-icons/react'
import Avatar from './Avatar'

const buttonClass = 'grid place-items-center w-11 h-11 rounded-full bg-white/10 border border-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/20'

// Full screen view of a picture, or of a person's avatar when `user` is given.
// Closes on Escape or a click outside the picture. Render inside <AnimatePresence>
const ImageLightbox = ({ src, user, title, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <motion.div role='dialog' aria-modal='true' aria-label={title || 'Image'} onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className='fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-xl'>
      <div className='flex items-center justify-between gap-3 p-4 shrink-0'>
        <p className='truncate pl-2 text-[15px] font-semibold text-white'>{title}</p>
        <div className='flex gap-2'>
          {/^https?:/.test(src || '') && (
            <a href={src} target='_blank' rel='noopener noreferrer' aria-label='Open original' title='Open original'
              onClick={(e) => e.stopPropagation()} className={buttonClass}>
              <ArrowSquareOut size={19} />
            </a>
          )}
          <button type='button' aria-label='Close' autoFocus onClick={onClose} className={buttonClass}>
            <X size={19} weight='bold' />
          </button>
        </div>
      </div>

      <div className='flex-1 min-h-0 grid place-items-center p-4 pb-12 sm:px-10'>
        <motion.div onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className='max-w-full max-h-full min-h-0 grid place-items-center'>
          {src ? (
            <img src={src} alt={title || ''} className={`max-w-full max-h-[calc(100dvh-9rem)] object-contain shadow-2xl ${user ? 'rounded-[36px]' : 'rounded-3xl'}`} />
          ) : (
            <Avatar user={user} size='2xl' className='scale-[1.6]' />
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default ImageLightbox
