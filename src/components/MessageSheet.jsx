import React from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { ArrowBendUpLeft, Copy, PencilSimple, Trash } from '@phosphor-icons/react'
import { describeAttachments, EDIT_WINDOW_MS, QUICK_REACTIONS } from '../lib/utils'
import { useBackButton } from '../lib/backButton'

const spring = { type: 'spring', stiffness: 460, damping: 40 }
const itemClass = 'flex items-center gap-3.5 w-full h-[52px] px-4 rounded-2xl text-[15px] font-semibold text-left active:bg-hover'

// What can be done with a message, on a phone: a sheet that slides up from the bottom after a tap
// or a long press on the message. It closes on a tap outside, a swipe down or the back button.
// Render inside <AnimatePresence>
const MessageSheet = ({ msg, myId, isOwn, authorName, onClose, onReply, onEdit, onDelete, onReact, onCopy }) => {
  useBackButton(true, onClose)

  const canEdit = isOwn && Boolean(msg.text) && Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS
  const myReaction = msg.reactions?.find((reaction) => reaction.userId === myId)?.emoji
  const summary = msg.text || describeAttachments(msg)?.label || 'Message'

  const run = (action) => () => {
    onClose()
    action()
  }

  return createPortal(
    <motion.div data-message-sheet onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className='fixed inset-0 z-50 flex items-end bg-overlay'>
      <motion.div role='dialog' aria-modal='true' aria-label='Message options' onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
        drag='y' dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(e, info) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose() }}
        className='w-full max-h-[85%] flex flex-col rounded-t-[30px] bg-panel-solid border-t border-line-strong shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
        <div className='grid place-items-center h-6 shrink-0' aria-hidden='true'>
          <span className='w-10 h-1 rounded-full bg-line-strong' />
        </div>

        {/* what the sheet is about */}
        <div className='mx-4 mb-3 px-3.5 py-2 rounded-2xl bg-raised border-l-[3px] border-accent-text text-[13px] leading-snug'>
          <p className='font-bold text-accent-text'>{authorName}</p>
          <p className='truncate text-muted'>{summary}</p>
        </div>

        <div className='flex justify-between px-4 pb-3'>
          {QUICK_REACTIONS.map((emoji, index) => (
            <motion.button key={emoji} type='button' aria-label={`React with ${emoji}`} data-sheet-reaction onClick={run(() => onReact(msg, emoji))}
              initial={{ opacity: 0, y: 14, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24, delay: 0.04 + index * 0.03 }} whileTap={{ scale: 0.8 }}
              className={`grid place-items-center w-12 h-12 rounded-full text-[26px] leading-none ${myReaction === emoji ? 'grad-soft border border-line-strong' : 'bg-raised'}`}>
              {emoji}
            </motion.button>
          ))}
        </div>

        <div className='px-2 overflow-y-auto'>
          <button type='button' data-sheet-action='reply' onClick={run(() => onReply(msg))} className={itemClass}>
            <ArrowBendUpLeft size={21} weight='bold' className='text-accent-text' /> Reply
          </button>
          {msg.text && (
            <button type='button' data-sheet-action='copy' onClick={run(() => onCopy(msg))} className={itemClass}>
              <Copy size={21} weight='duotone' className='text-accent-text' /> Copy text
            </button>
          )}
          {canEdit && (
            <button type='button' data-sheet-action='edit' onClick={run(() => onEdit(msg))} className={itemClass}>
              <PencilSimple size={21} weight='duotone' className='text-accent-text' /> Edit
            </button>
          )}
          {isOwn && (
            <button type='button' data-sheet-action='delete' onClick={run(() => onDelete(msg))} className={`${itemClass} text-danger`}>
              <Trash size={21} weight='duotone' /> Delete for everyone
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default MessageSheet
