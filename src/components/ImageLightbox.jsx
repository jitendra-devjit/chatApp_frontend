import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowSquareOut, CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import Avatar from './Avatar'

const buttonClass = 'grid place-items-center w-11 h-11 rounded-full bg-white/10 border border-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/20'

// Full screen viewer. Three ways to use it:
//   items + index   a gallery of photos and videos with arrows ({ type, url } each)
//   src             one picture
//   user            a person's avatar (their picture, or their initials when they have none)
// Closes on Escape or a click outside the picture. Render inside <AnimatePresence>
const ImageLightbox = ({ items, index = 0, src, user, title, onClose }) => {
  const gallery = items || (src ? [{ type: 'image', url: src }] : [])
  const [current, setCurrent] = useState(Math.min(index, Math.max(0, gallery.length - 1)))
  const item = gallery[current]
  const hasMany = gallery.length > 1

  useEffect(() => {
    const count = gallery.length
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (count > 1 && e.key === 'ArrowRight') setCurrent((value) => (value + 1) % count)
      if (count > 1 && e.key === 'ArrowLeft') setCurrent((value) => (value - 1 + count) % count)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, gallery.length])

  const step = (by) => (e) => {
    e.stopPropagation()
    setCurrent((value) => (value + by + gallery.length) % gallery.length)
  }

  return (
    <motion.div role='dialog' aria-modal='true' aria-label={title || 'Image'} onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className='fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-xl'>
      <div className='flex items-center justify-between gap-3 p-4 shrink-0'>
        <p className='truncate pl-2 text-[15px] font-semibold text-white'>
          {title}
          {hasMany && <span data-gallery-count className='ml-3 font-medium tabular-nums text-white/60'>{current + 1} / {gallery.length}</span>}
        </p>
        <div className='flex gap-2'>
          {/^https?:/.test(item?.url || '') && (
            <a href={item.url} target='_blank' rel='noopener noreferrer' aria-label='Open original' title='Open original'
              onClick={(e) => e.stopPropagation()} className={buttonClass}>
              <ArrowSquareOut size={19} />
            </a>
          )}
          <button type='button' aria-label='Close' autoFocus onClick={onClose} className={buttonClass}>
            <X size={19} weight='bold' />
          </button>
        </div>
      </div>

      <div className='relative flex-1 min-h-0 grid place-items-center p-4 pb-12 sm:px-20'>
        {hasMany && (
          <>
            <button type='button' aria-label='Previous' onClick={step(-1)} className={`${buttonClass} absolute left-3 sm:left-5 z-10`}>
              <CaretLeft size={20} weight='bold' />
            </button>
            <button type='button' aria-label='Next' onClick={step(1)} className={`${buttonClass} absolute right-3 sm:right-5 z-10`}>
              <CaretRight size={20} weight='bold' />
            </button>
          </>
        )}

        <AnimatePresence mode='wait' initial={false}>
          <motion.div key={item?.url || 'avatar'} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className='max-w-full max-h-full min-h-0 grid place-items-center'>
            {!item ? (
              <Avatar user={user} size='2xl' className='scale-[1.6]' />
            ) : item.type === 'video' ? (
              <video src={item.url} controls autoPlay playsInline className='max-w-full max-h-[calc(100dvh-9rem)] rounded-3xl bg-black shadow-2xl' />
            ) : (
              <img src={item.url} alt={title || ''} className={`max-w-full max-h-[calc(100dvh-9rem)] object-contain shadow-2xl ${user ? 'rounded-[36px]' : 'rounded-3xl'}`} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default ImageLightbox
