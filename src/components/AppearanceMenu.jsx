import React, { useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Moon, Palette, Sun } from '@phosphor-icons/react'
import { ThemeContext } from '../context/ThemeContext'
import { ACCENTS } from '../lib/utils'
import IconButton from './IconButton'

// Theme and accent colour choices, shown inline (profile page) or inside AppearanceMenu
export const AppearanceOptions = () => {
  const { theme, setTheme, accent, setAccent } = useContext(ThemeContext)

  return (
    <div className='flex flex-col gap-4'>
      <div>
        <p className='mb-2 text-xs font-semibold text-muted'>Mode</p>
        <div className='relative grid grid-cols-2 p-1 rounded-2xl bg-raised'>
          {[['dark', 'Dark', Moon], ['light', 'Light', Sun]].map(([id, name, Icon]) => (
            <button key={id} type='button' onClick={() => setTheme(id)} aria-pressed={theme === id}
              className={`relative z-10 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-semibold transition-colors ${theme === id ? 'text-ink' : 'text-muted hover:text-ink'}`}>
              {theme === id && (
                <motion.span layoutId='mode-pill' transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  className='absolute inset-0 -z-10 rounded-xl bg-panel-solid border border-line shadow-sm' />
              )}
              <Icon size={16} weight='fill' /> {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className='mb-2 text-xs font-semibold text-muted'>Colour</p>
        <div className='flex gap-2.5'>
          {ACCENTS.map(({ id, name, colors }) => (
            <motion.button key={id} type='button' onClick={() => setAccent(id)} whileTap={{ scale: 0.88 }} whileHover={{ y: -2 }}
              aria-label={`${name} colour`} aria-pressed={accent === id} title={name}
              style={{ backgroundImage: `linear-gradient(135deg, ${colors.join(', ')})` }}
              className={`grid place-items-center w-9 h-9 rounded-full text-white ring-offset-2 ring-offset-[var(--panel-solid)] ${accent === id ? 'ring-2 ring-ink' : ''}`}>
              {accent === id && <Check size={16} weight='bold' />}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Palette button that opens the appearance choices in a popover.
// `placement` says where the popover opens relative to the button
const AppearanceMenu = ({ placement = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e) => {
      if (!ref.current?.contains(e.target)) setIsOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const position = placement === 'right' ? 'left-full bottom-0 ml-3 origin-bottom-left' : 'right-0 top-full mt-2 origin-top-right'

  return (
    <div ref={ref} className='relative'>
      <IconButton label='Appearance' active={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <Palette size={22} weight={isOpen ? 'fill' : 'duotone'} />
      </IconButton>
      <AnimatePresence>
        {isOpen && (
          <motion.div role='dialog' aria-label='Appearance'
            initial={{ opacity: 0, scale: 0.92, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 4 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className={`absolute z-50 w-64 p-4 rounded-3xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40 ${position}`}>
            <p className='mb-3 text-[15px] font-bold'>Appearance</p>
            <AppearanceOptions />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AppearanceMenu
