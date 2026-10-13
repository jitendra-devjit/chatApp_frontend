import React from 'react'
import { motion } from 'motion/react'
import { PhoneIncoming, PhoneOutgoing, PhoneX, VideoCamera } from '@phosphor-icons/react'
import { describeCall, formatMessageTime } from '../lib/utils'

const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };

// A finished call between the messages of a chat: "Video call · 5 min", "Missed voice call".
// A click calls the person back the same way
const CallBubble = ({ msg, isOwn, disabled, onCallBack }) => {
  const { title, detail, isMissed } = describeCall(msg.call, isOwn);
  const wasAnswered = msg.call.status === 'completed';
  const Icon = !wasAnswered ? PhoneX : msg.call.kind === 'video' ? VideoCamera : isOwn ? PhoneOutgoing : PhoneIncoming;

  return (
    <motion.div
      id={`msg-${msg._id}`}
      data-message={msg._id}
      data-call-log={msg.call.status}
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={bubbleSpring}
      className={`flex w-full mt-3 ${isOwn ? 'justify-end origin-bottom-right' : 'justify-start origin-bottom-left'}`}>
      <motion.button type='button' onClick={onCallBack} disabled={disabled} whileTap={{ scale: 0.97 }}
        aria-label={`${title}, ${detail}. Call back`} title='Call back'
        className='flex items-center gap-3 min-w-52 pl-2.5 pr-5 py-2.5 rounded-[22px] bg-bubble border border-line text-left transition-colors hover:bg-hover disabled:hover:bg-bubble'>
        <span className={`grid place-items-center w-11 h-11 shrink-0 rounded-full ${isMissed ? 'bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] text-danger' : wasAnswered ? 'grad text-white glow' : 'grad-soft text-accent-text'}`}>
          <Icon size={21} weight='fill' />
        </span>
        <span className='min-w-0 leading-tight'>
          <span className={`block text-[15px] font-bold ${isMissed ? 'text-danger' : ''}`}>{title}</span>
          <span className='mt-0.5 block text-xs font-medium tabular-nums text-muted'>
            {detail} · <time>{formatMessageTime(msg.createdAt)}</time>
          </span>
        </span>
      </motion.button>
    </motion.div>
  )
}

export default CallBubble
