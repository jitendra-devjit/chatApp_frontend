import React, { lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowUp, CircleNotch, ImageSquare, Smiley, X } from '@phosphor-icons/react'
import { ThemeContext } from '../context/ThemeContext'
import { fileToDataUrl, MAX_MESSAGE_LENGTH, validateImageFile } from '../lib/utils'
import IconButton from './IconButton'

// the picker is heavy, it is downloaded the first time it is opened
const EmojiPicker = lazy(() => import('emoji-picker-react'))

const MAX_TEXTAREA_HEIGHT = 160

const MessageComposer = ({ recipientName, onSend }) => {
  const { theme } = useContext(ThemeContext)

  const [text, setText] = useState("")
  const [image, setImage] = useState(null) // { file, url } of the picture waiting to be sent
  const [isSending, setIsSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const emojiRef = useRef(null)

  // focus the box when a chat opens, but not on phones where it would pop the keyboard
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus()
  }, [])

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

  const attachImage = (file) => {
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
    setText(text.slice(0, start) + emojiData.emoji + text.slice(end))
    requestAnimationFrame(() => {
      const caret = start + emojiData.emoji.length
      el?.setSelectionRange(caret, caret)
    })
  }

  const trimmed = text.trim()
  const isTooLong = trimmed.length > MAX_MESSAGE_LENGTH
  const canSend = (trimmed !== "" || image) && !isSending && !isTooLong

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      const payload = {}
      if (trimmed) payload.text = trimmed
      if (image) payload.image = await fileToDataUrl(image.file)

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
    }
  }

  return (
    <div className='shrink-0 px-3 pb-3 sm:px-5 sm:pb-5 pt-1 bg-canvas'>
      <div className='relative rounded-[22px] bg-raised border border-line transition-colors focus-within:border-line-strong'>
        {showEmoji && (
          <div ref={emojiRef} className='absolute bottom-full left-0 mb-2 z-30 animate-pop-in rounded-2xl overflow-hidden border border-line-strong shadow-2xl shadow-black/40'>
            <Suspense fallback={<div className='w-[320px] h-[380px] grid place-items-center bg-raised text-faint'><CircleNotch size={20} className='animate-spin' /></div>}>
              <EmojiPicker onEmojiClick={onEmojiClick} theme={theme} width={320} height={380}
                lazyLoadEmojis previewConfig={{ showPreview: false }} skinTonesDisabled />
            </Suspense>
          </div>
        )}

        {image && (
          <div className='px-3 pt-3'>
            <div className='relative inline-block animate-pop-in'>
              <img src={image.url} alt="Attachment preview" className='h-24 max-w-52 rounded-xl object-cover border border-line' />
              <button type='button' aria-label='Remove image' onClick={() => setImage(null)} disabled={isSending}
                className='absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-ink text-canvas shadow-md hover:scale-110 transition-transform'>
                <X size={12} weight='bold' />
              </button>
            </div>
          </div>
        )}

        <div className='flex items-end gap-1 p-1.5'>
          <input ref={fileRef} onChange={handleFileChange} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
          <IconButton label='Attach an image' onClick={() => fileRef.current?.click()} disabled={isSending}>
            <ImageSquare size={20} />
          </IconButton>
          <IconButton label='Emoji' active={showEmoji} onClick={() => setShowEmoji(!showEmoji)}
            onPointerDown={(e) => e.stopPropagation()} className='max-sm:hidden'>
            <Smiley size={20} />
          </IconButton>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            aria-label={`Message ${recipientName}`}
            placeholder={`Message ${recipientName}`}
            className='flex-1 min-w-0 resize-none bg-transparent px-2 py-2 text-[15px] leading-[1.4] text-ink placeholder:text-faint'
          />

          {trimmed.length > MAX_MESSAGE_LENGTH - 200 && (
            <span className={`self-center font-mono text-[11px] px-1 ${isTooLong ? 'text-danger' : 'text-faint'}`}>
              {MAX_MESSAGE_LENGTH - trimmed.length}
            </span>
          )}

          <button type='button' aria-label='Send message' onClick={handleSend} disabled={!canSend}
            className='grid place-items-center w-9 h-9 shrink-0 rounded-full bg-accent text-accent-ink transition-all duration-150
              hover:scale-105 active:scale-95 disabled:bg-hover disabled:text-faint disabled:scale-100'>
            {isSending ? <CircleNotch size={18} className='animate-spin' /> : <ArrowUp size={18} weight='bold' />}
          </button>
        </div>
      </div>
      <p className='mt-2 text-center text-[11px] text-faint max-md:hidden'>
        <kbd className='font-mono'>Enter</kbd> to send · <kbd className='font-mono'>Shift + Enter</kbd> for a new line
      </p>
    </div>
  )
}

export default MessageComposer
