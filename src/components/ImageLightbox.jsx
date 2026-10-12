import React, { useEffect } from 'react'
import { ArrowSquareOut, X } from '@phosphor-icons/react'

// Full screen view of one picture. Closes on Escape or a click outside the picture
const ImageLightbox = ({ src, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div role='dialog' aria-modal='true' aria-label='Image' onClick={onClose}
      className='fixed inset-0 z-50 grid place-items-center p-4 sm:p-10 bg-overlay backdrop-blur-md animate-fade-in'>
      <div className='absolute top-4 right-4 flex gap-2'>
        {/^https?:/.test(src) && (
          <a href={src} target='_blank' rel='noopener noreferrer' aria-label='Open original' title='Open original'
            onClick={(e) => e.stopPropagation()}
            className='grid place-items-center w-10 h-10 rounded-full bg-raised border border-line-strong text-ink hover:bg-hover'>
            <ArrowSquareOut size={18} />
          </a>
        )}
        <button type='button' aria-label='Close' autoFocus onClick={onClose}
          className='grid place-items-center w-10 h-10 rounded-full bg-raised border border-line-strong text-ink hover:bg-hover'>
          <X size={18} />
        </button>
      </div>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()}
        className='max-w-full max-h-full rounded-2xl object-contain shadow-2xl animate-pop-in' />
    </div>
  )
}

export default ImageLightbox
