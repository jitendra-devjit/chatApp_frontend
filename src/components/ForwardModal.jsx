import React, { useContext, useState } from 'react'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import { Check, CircleNotch, MagnifyingGlass, PaperPlaneRight } from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext'
import { describeAttachments } from '../lib/utils'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'

// the server takes this many chats in one go
const MAX_TARGETS = 5

// Pick the people and groups a message is sent on to. Render inside <AnimatePresence>
const ForwardModal = ({ msg, onClose }) => {
  const { chats, lastMessages, forwardMessage } = useContext(ChatContext)
  const [picked, setPicked] = useState([]) // chat ids
  const [query, setQuery] = useState('')
  const [isSending, setIsSending] = useState(false)

  // the chats talked in most recently come first
  const time = (chat) => new Date(lastMessages[chat._id]?.createdAt || 0).getTime()
  const term = query.trim().toLowerCase()
  const shown = [...chats].sort((a, b) => time(b) - time(a)).filter((chat) => !term || chat.fullName.toLowerCase().includes(term))

  const toggle = (chatId) => {
    if (picked.includes(chatId)) return setPicked(picked.filter((id) => id !== chatId))
    if (picked.length >= MAX_TARGETS) return toast(`You can forward to ${MAX_TARGETS} chats at once`, { icon: '✋' })
    setPicked([...picked, chatId])
  }

  const send = async () => {
    if (picked.length === 0 || isSending) return
    setIsSending(true)
    const sent = await forwardMessage(msg._id, chats.filter((chat) => picked.includes(chat._id)))
    setIsSending(false)
    if (sent) onClose()
  }

  return (
    <Modal label='Forward message' onClose={onClose} className='max-w-md h-[min(600px,calc(100dvh-2rem))]'>
      <ModalHeader title='Forward to' subtitle={picked.length > 0 ? `${picked.length} of ${MAX_TARGETS} chosen` : `Choose up to ${MAX_TARGETS} chats`} onClose={onClose} />

      {/* what is being sent on */}
      <div className='mx-6 mb-3 px-3.5 py-2 rounded-2xl bg-raised border-l-[3px] border-accent-text text-[13px] leading-snug shrink-0'>
        <p className='truncate text-muted'>{msg.text || describeAttachments(msg)?.label || 'Message'}</p>
      </div>

      <div className='px-6 pb-2 shrink-0'>
        <div className='flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-raised border border-transparent focus-within:border-accent-text'>
          <MagnifyingGlass size={17} weight='bold' className='text-faint shrink-0' />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type='text' aria-label='Search chats' placeholder='Search people and groups'
            className='flex-1 min-w-0 bg-transparent text-sm font-medium text-ink placeholder:text-faint placeholder:font-normal' />
        </div>
      </div>

      <ul className='flex-1 min-h-0 overflow-y-auto px-3 pb-2'>
        {shown.length === 0 && <li className='px-4 py-6 text-sm text-muted'>Nobody called “{query.trim()}” here.</li>}
        {shown.map((chat) => {
          const isPicked = picked.includes(chat._id)
          return (
            <li key={chat._id}>
              <button type='button' data-forward-target={chat.fullName} aria-pressed={isPicked} onClick={() => toggle(chat._id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-2xl text-left transition-colors ${isPicked ? 'grad-soft' : 'hover:bg-raised'}`}>
                <Avatar user={chat} group={chat.isGroup} size='sm' />
                <span className='flex-1 min-w-0 truncate text-[15px] font-semibold'>{chat.fullName}</span>
                <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-full border transition-colors ${isPicked ? 'grad border-transparent text-white' : 'border-line-strong text-transparent'}`}>
                  <Check size={13} weight='bold' />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className='p-4 shrink-0 border-t border-line'>
        <motion.button type='button' data-forward-send onClick={send} disabled={picked.length === 0 || isSending} whileTap={{ scale: 0.97 }}
          className='flex items-center justify-center gap-2 w-full h-12 rounded-2xl grad glow text-white text-[15px] font-bold disabled:opacity-40 disabled:shadow-none'>
          {isSending ? <CircleNotch size={19} className='animate-spin' /> : <PaperPlaneRight size={18} weight='fill' />}
          {picked.length > 1 ? `Forward to ${picked.length} chats` : 'Forward'}
        </motion.button>
      </div>
    </Modal>
  )
}

export default ForwardModal
