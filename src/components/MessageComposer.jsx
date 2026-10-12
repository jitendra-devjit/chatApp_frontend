import React, { lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowBendUpLeft, Check, CircleNotch, Image as ImageIcon, ImageSquare, PaperPlaneRight, PencilSimple, Smiley, X } from '@phosphor-icons/react'
import { ThemeContext } from '../context/ThemeContext'
import { fileToDataUrl, MAX_MESSAGE_LENGTH, validateImageFile } from '../lib/utils'
import IconButton from './IconButton'

// the picker is heavy, it is downloaded the first time it is opened
const EmojiPicker = lazy(() => import('emoji-picker-react'))

const MAX_TEXTAREA_HEIGHT = 160
// while typing, "typing" is re-sent this often and withdrawn after this much silence
const TYPING_RESEND_MS = 2000
const TYPING_IDLE_MS = 3000

// `replyingTo` (a message plus authorName) and `editingMessage` switch the box into reply or edit mode
const MessageComposer = ({ recipientName, onSend, onTyping, replyingTo, editingMessage, onCancelReply, onCancelEdit }) => {
  const { theme } = useContext(ThemeContext)

  const [text, setText] = useState("")
  const [image, setImage] = useState(null) // { file, url } of the picture waiting to be sent
  const [isSending, setIsSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const emojiRef = useRef(null)
  const lastTypingAt = useRef(0) // 0 means the other person was not told we are typing
  const idleTimer = useRef(null)
  const onTypingRef = useRef(onTyping)
  onTypingRef.current = onTyping

  const stopTyping = () => {
    clearTimeout(idleTimer.current)
    if (lastTypingAt.current) {
      lastTypingAt.current = 0
      onTypingRef.current(false)
    }
  }

  const signalTyping = (value) => {
    if (!value.trim()) {
      stopTyping()
      return
    }
    const now = Date.now()
    if (now - lastTypingAt.current > TYPING_RESEND_MS) {
      lastTypingAt.current = now
      onTypingRef.current(true)
    }
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS)
  }

  // leaving the chat withdraws "typing"
  useEffect(() => stopTyping, [])

  // focus the box when a chat opens, but not on phones where it would pop the keyboard
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus()
  }, [])

  // editing puts the old text in the box, leaving edit mode empties it again
  const editingId = editingMessage?._id
  const wasEditing = useRef(false)
  useEffect(() => {
    if (editingId) {
      setText(editingMessage.text || "")
      setImage(null)
      textareaRef.current?.focus()
    } else if (wasEditing.current) {
      setText("")
    }
    wasEditing.current = Boolean(editingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // answering a message moves the cursor to the box
  const replyingId = replyingTo?._id
  useEffect(() => {
    if (replyingId) textareaRef.current?.focus()
  }, [replyingId])

  // the box grows with its content up to a limit
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [text])

  // free the preview when it is replaced or the composer goes away
  useEffect(() => {
    if (!image) return
    return () => URL.revokeObjectURL(image.url)
  }, [image])

  useEffect(() => {
    if (!showEmoji) return
    const handlePointerDown = (e) => {
      if (!emojiRef.current?.contains(e.target)) setShowEmoji(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowEmoji(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showEmoji])

  const changeText = (value) => {
    setText(value)
    signalTyping(value)
  }

  const attachImage = (file) => {
    if (editingMessage) return // an edit only changes the text
    const error = validateImageFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setImage({ file, url: URL.createObjectURL(file) })
    textareaRef.current?.focus()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    e.target.value = "" // lets the same file be picked again
    if (file) attachImage(file)
  }

  // a screenshot pasted from the clipboard becomes an attachment
  const handlePaste = (e) => {
    const file = [...e.clipboardData.files].find((item) => item.type.startsWith('image/'))
    if (!file) return
    e.preventDefault()
    attachImage(file)
  }

  // put the emoji where the cursor is
  const onEmojiClick = (emojiData) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    changeText(text.slice(0, start) + emojiData.emoji + text.slice(end))
    requestAnimationFrame(() => {
      const caret = start + emojiData.emoji.length
      el?.setSelectionRange(caret, caret)
    })
  }

  const trimmed = text.trim()
  const isTooLong = trimmed.length > MAX_MESSAGE_LENGTH
  const canSend = (trimmed !== "" || (image && !editingMessage)) && !isSending && !isTooLong

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    stopTyping()
    try {
      const payload = {}
      if (trimmed) payload.text = trimmed
      if (image && !editingMessage) payload.image = await fileToDataUrl(image.file)

      // on failure the draft stays so nothing typed is lost
      const sent = await onSend(payload)
      if (sent) {
        setText("")
        setImage(null)
        setShowEmoji(false)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape' && !showEmoji) {
      if (editingMessage) onCancelEdit()
      else if (replyingTo) onCancelReply()
    }
  }

  // the strip above the box that says what is being answered or edited
  const context = editingMessage
    ? { icon: <PencilSimple size={18} weight='duotone' />, title: 'Editing message', message: editingMessage, onCancel: onCancelEdit, label: 'Cancel editing' }
    : replyingTo
      ? { icon: <ArrowBendUpLeft size={18} weight='bold' />, title: `Replying to ${replyingTo.authorName}`, message: replyingTo, onCancel: onCancelReply, label: 'Cancel reply' }
      : null

  return (
    <div className='relative shrink-0 px-3 pb-3 sm:px-4 sm:pb-4 pt-1'>
      <AnimatePresence>
        {showEmoji && (
          <motion.div ref={emojiRef}
            initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className='absolute bottom-full left-3 sm:left-4 mb-1 z-30 origin-bottom-left rounded-3xl overflow-hidden border border-line-strong shadow-2xl shadow-black/50'>
            <Suspense fallback={<div className='w-[330px] h-[390px] grid place-items-center bg-panel-solid text-faint'><CircleNotch size={22} className='animate-spin' /></div>}>
              <EmojiPicker onEmojiClick={onEmojiClick} theme={theme} width={330} height={390}
                lazyLoadEmojis previewConfig={{ showPreview: false }} skinTonesDisabled />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <div className='rounded-[26px] bg-raised border border-line transition-[border-color,box-shadow] duration-200 focus-within:border-[color-mix(in_oklab,var(--a1)_60%,transparent)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--a1)_14%,transparent)]'>
        <AnimatePresence initial={false}>
          {context && (
            <motion.div key='context' data-composer-context initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }} className='overflow-hidden'>
              <div className='flex items-center gap-3 mx-2 mt-2 pl-3 pr-1.5 py-1.5 rounded-2xl bg-raised border-l-[3px] border-accent-text'>
                <span className='text-accent-text shrink-0'>{context.icon}</span>
                <div className='min-w-0 flex-1 text-[13px] leading-snug'>
                  <p className='font-bold text-accent-text'>{context.title}</p>
                  <p className='truncate text-muted'>
                    {context.message.image && <ImageIcon size={13} weight='fill' className='inline -mt-0.5 mr-1' />}
                    {context.message.text || 'Photo'}
                  </p>
                </div>
                {context.message.image && <img src={context.message.image} alt="" className='w-9 h-9 shrink-0 rounded-lg object-cover' />}
                <button type='button' aria-label={context.label} onClick={context.onCancel}
                  className='grid place-items-center w-8 h-8 shrink-0 rounded-full text-muted hover:bg-hover hover:text-ink'>
                  <X size={15} weight='bold' />
                </button>
              </div>
            </motion.div>
          )}
          {image && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }} className='overflow-hidden'>
              <div className='px-3 pt-3'>
                <div className='relative inline-block'>
                  <img src={image.url} alt="Attachment preview" className='h-28 max-w-56 rounded-2xl object-cover border border-line' />
                  <button type='button' aria-label='Remove image' onClick={() => setImage(null)} disabled={isSending}
                    className='absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-ink text-canvas shadow-md hover:scale-110 transition-transform'>
                    <X size={12} weight='bold' />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className='flex items-end gap-0.5 p-1.5'>
          <input ref={fileRef} onChange={handleFileChange} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
          <IconButton label='Attach an image' onClick={() => fileRef.current?.click()} disabled={isSending || Boolean(editingMessage)}>
            <ImageSquare size={22} weight='duotone' />
          </IconButton>
          <IconButton label='Emoji' active={showEmoji} onClick={() => setShowEmoji(!showEmoji)}
            onPointerDown={(e) => e.stopPropagation()} className='max-sm:hidden'>
            <Smiley size={22} weight={showEmoji ? 'fill' : 'duotone'} />
          </IconButton>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => changeText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={stopTyping}
            rows={1}
            aria-label={`Message ${recipientName}`}
            placeholder={editingMessage ? 'Edit your message' : `Message ${recipientName}…`}
            className='flex-1 min-w-0 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-[1.35] text-ink placeholder:text-faint'
          />

          {trimmed.length > MAX_MESSAGE_LENGTH - 200 && (
            <span className={`self-center text-[11px] font-semibold tabular-nums px-1 ${isTooLong ? 'text-danger' : 'text-faint'}`}>
              {MAX_MESSAGE_LENGTH - trimmed.length}
            </span>
          )}

          <motion.button type='button' aria-label={editingMessage ? 'Save edit' : 'Send message'} onClick={handleSend} disabled={!canSend}
            whileTap={canSend ? { scale: 0.86 } : undefined} whileHover={canSend ? { scale: 1.06 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={`grid place-items-center w-10 h-10 shrink-0 rounded-full transition-colors duration-200 ${canSend || isSending ? 'grad glow text-white' : 'bg-hover text-faint'}`}>
            {isSending ? <CircleNotch size={19} className='animate-spin' /> : editingMessage ? <Check size={19} weight='bold' /> : <PaperPlaneRight size={19} weight='fill' />}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export default MessageComposer
