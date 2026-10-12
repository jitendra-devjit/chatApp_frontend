import React, { lazy, Suspense, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowBendUpLeft, Check, CircleNotch, File as FileIcon, FileText, Images, Microphone, MusicNotes,
  PaperPlaneRight, PencilSimple, Plus, Smiley, Trash, VideoCamera, X,
} from '@phosphor-icons/react'
import { AuthContext } from '../context/AuthContext'
import { ThemeContext } from '../context/ThemeContext'
import { describeAttachments, getErrorMessage, MAX_MESSAGE_LENGTH } from '../lib/utils'
import { checkFile, DOCUMENT_ACCEPT, formatBytes, formatDuration, MAX_ATTACHMENTS, MEDIA_ACCEPT, uploadFile } from '../lib/upload'
import { canRecordVoice, MAX_RECORDING_SECONDS, useVoiceRecorder } from '../lib/useVoiceRecorder'
import IconButton from './IconButton'

// the picker is heavy, it is downloaded the first time it is opened
const EmojiPicker = lazy(() => import('emoji-picker-react'))

const MAX_TEXTAREA_HEIGHT = 160
// while typing, "typing" is re-sent this often and withdrawn after this much silence
const TYPING_RESEND_MS = 2000
const TYPING_IDLE_MS = 3000
const MIN_RECORDING_SECONDS = 1

const spring = { type: 'spring', stiffness: 420, damping: 36 }
const menuItemClass = 'flex items-center gap-3 w-full h-11 px-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-hover'

let nextFileId = 1

// One file waiting to be sent: a small preview with a remove button and, while it uploads, its progress
const PendingFile = ({ item, isSending, onRemove }) => {
  const { file, kind, previewUrl, progress } = item
  const Icon = kind === 'video' ? VideoCamera : kind === 'audio' ? MusicNotes : FileText

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring}
      data-pending-file className='relative shrink-0'>
      {kind === 'image' ? (
        <img src={previewUrl} alt="Attachment preview" className='h-24 w-24 rounded-2xl object-cover border border-line' />
      ) : kind === 'video' ? (
        <div className='relative h-24 w-24 rounded-2xl overflow-hidden border border-line bg-black'>
          <video src={previewUrl} muted preload='metadata' className='w-full h-full object-cover' />
          <span className='absolute bottom-1 left-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white'><VideoCamera size={13} weight='fill' /></span>
        </div>
      ) : (
        <div className='flex items-center gap-2.5 h-24 w-44 px-3 rounded-2xl border border-line bg-panel-solid'>
          <span className='grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-raised text-accent-text'><Icon size={22} weight='duotone' /></span>
          <span className='min-w-0 leading-tight'>
            <span className='block truncate text-[13px] font-bold'>{file.name}</span>
            <span className='block text-[11px] font-medium text-muted'>{formatBytes(file.size)}</span>
          </span>
        </div>
      )}

      {isSending ? (
        <span className='absolute inset-0 grid place-items-center rounded-2xl bg-black/55 text-white text-xs font-bold tabular-nums'>
          {progress >= 1 ? <Check size={20} weight='bold' /> : `${Math.round(progress * 100)}%`}
        </span>
      ) : (
        <button type='button' aria-label={`Remove ${file.name}`} onClick={onRemove}
          className='absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-ink text-canvas shadow-md hover:scale-110 transition-transform'>
          <X size={12} weight='bold' />
        </button>
      )}
    </motion.div>
  )
}

// The message box. `replyingTo` (a message plus authorName) and `editingMessage` switch it into reply or edit mode.
// `ref.current.addFiles(files)` attaches files from outside, used for drag and drop
const MessageComposer = ({ ref, recipientName, onSend, onTyping, replyingTo, editingMessage, onCancelReply, onCancelEdit }) => {
  const { theme } = useContext(ThemeContext)
  const { axios } = useContext(AuthContext)

  const [text, setText] = useState("")
  const [files, setFiles] = useState([]) // { id, file, kind, previewUrl, progress } waiting to be sent
  const [isSending, setIsSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showAttach, setShowAttach] = useState(false)

  const recorder = useVoiceRecorder()

  const textareaRef = useRef(null)
  const mediaInputRef = useRef(null)
  const documentInputRef = useRef(null)
  const emojiRef = useRef(null)
  const attachRef = useRef(null)
  const lastTypingAt = useRef(0) // 0 means the other person was not told we are typing
  const idleTimer = useRef(null)
  const onTypingRef = useRef(onTyping)
  onTypingRef.current = onTyping
  const filesRef = useRef(files)
  filesRef.current = files

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

  // leaving the chat withdraws "typing" and frees the previews
  useEffect(() => () => {
    stopTyping()
    filesRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
  }, [])

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
  }, [text, recorder.isRecording])

  // the emoji picker and the attach menu close on a click elsewhere and on Escape
  useEffect(() => {
    if (!showEmoji && !showAttach) return
    const handlePointerDown = (e) => {
      if (showEmoji && !emojiRef.current?.contains(e.target)) setShowEmoji(false)
      if (showAttach && !attachRef.current?.contains(e.target)) setShowAttach(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowEmoji(false)
        setShowAttach(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showEmoji, showAttach])

  const changeText = (value) => {
    setText(value)
    signalTyping(value)
  }

  // Adds files to the message. Files of a kind or size that cannot be sent are named in a toast
  const addFiles = (incoming) => {
    if (editingMessage) return // an edit only changes the text
    const accepted = []
    for (const file of incoming) {
      const { kind, error } = checkFile(file)
      if (error) {
        toast.error(error)
      } else if (filesRef.current.length + accepted.length >= MAX_ATTACHMENTS) {
        toast.error(`You can send up to ${MAX_ATTACHMENTS} files at once`)
        break
      } else {
        const previewUrl = kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null
        accepted.push({ id: nextFileId++, file, kind, previewUrl, progress: 0 })
      }
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted])
    textareaRef.current?.focus()
  }

  useImperativeHandle(ref, () => ({ addFiles }))

  const removeFile = (id) => {
    setFiles((prev) => {
      const item = prev.find((entry) => entry.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((entry) => entry.id !== id)
    })
  }

  const clearFiles = () => {
    filesRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
    setFiles([])
  }

  const handleFileChange = (e) => {
    const picked = [...e.target.files]
    e.target.value = "" // lets the same file be picked again
    addFiles(picked)
  }

  // pictures and files pasted from the clipboard become attachments
  const handlePaste = (e) => {
    const pasted = [...e.clipboardData.files]
    if (pasted.length === 0) return
    e.preventDefault()
    addFiles(pasted)
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
  const hasFiles = files.length > 0 && !editingMessage
  const canSend = (trimmed !== "" || hasFiles) && !isSending && !isTooLong
  // with nothing typed the send button is a microphone
  const showMic = !trimmed && !hasFiles && !editingMessage && canRecordVoice()

  const setProgress = (id, progress) =>
    setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, progress } : item)))

  const handleSend = async () => {
    if (!canSend) return
    setIsSending(true)
    stopTyping()
    try {
      const payload = {}
      if (trimmed) payload.text = trimmed
      if (hasFiles) {
        // every file goes to storage first, the message then only carries the receipts
        payload.attachments = await Promise.all(
          files.map((item) => uploadFile(axios, item.file, item.kind, (progress) => setProgress(item.id, progress)))
        )
      }

      // on failure the draft stays so nothing typed is lost
      const sent = await onSend(payload)
      if (sent) {
        setText("")
        clearFiles()
        setShowEmoji(false)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  // ---------- voice notes ----------

  const startRecording = async () => {
    try {
      await recorder.start()
    } catch (error) {
      toast.error(error.name === 'NotAllowedError' ? 'Allow the microphone in your browser to record a voice note' : 'Could not start the microphone')
    }
  }

  const sendRecording = async () => {
    if (isSending) return
    let recording
    try {
      recording = await recorder.stop()
    } catch {
      return
    }
    if (recording.duration < MIN_RECORDING_SECONDS) {
      toast('That was too short to send', { icon: '🎙️' })
      return
    }
    setIsSending(true)
    try {
      const attachment = await uploadFile(axios, recording.file, 'audio')
      await onSend({ attachments: [{ ...attachment, name: 'Voice message', duration: recording.duration, waveform: recording.waveform }] })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSending(false)
    }
  }

  // a recording cannot run forever, at the limit it is sent as it is
  const reachedLimit = recorder.isRecording && recorder.seconds >= MAX_RECORDING_SECONDS
  useEffect(() => {
    if (reachedLimit) sendRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedLimit])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape' && !showEmoji && !showAttach) {
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
  const contextSummary = context && describeAttachments(context.message)

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
              transition={spring} className='overflow-hidden'>
              <div className='flex items-center gap-3 mx-2 mt-2 pl-3 pr-1.5 py-1.5 rounded-2xl bg-raised border-l-[3px] border-accent-text'>
                <span className='text-accent-text shrink-0'>{context.icon}</span>
                <div className='min-w-0 flex-1 text-[13px] leading-snug'>
                  <p className='font-bold text-accent-text'>{context.title}</p>
                  <p className='truncate text-muted'>{context.message.text || contextSummary?.label || 'Message'}</p>
                </div>
                {contextSummary?.thumbnail && <img src={contextSummary.thumbnail} alt="" className='w-9 h-9 shrink-0 rounded-lg object-cover' />}
                <button type='button' aria-label={context.label} onClick={context.onCancel}
                  className='grid place-items-center w-8 h-8 shrink-0 rounded-full text-muted hover:bg-hover hover:text-ink'>
                  <X size={15} weight='bold' />
                </button>
              </div>
            </motion.div>
          )}
          {hasFiles && (
            <motion.div key='files' initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={spring} className='overflow-hidden'>
              <div className='flex gap-3 px-3 pt-4 pb-1 overflow-x-auto'>
                <AnimatePresence initial={false}>
                  {files.map((item) => (
                    <PendingFile key={item.id} item={item} isSending={isSending} onRemove={() => removeFile(item.id)} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {recorder.isRecording ? (
          // ---------- recording a voice note ----------
          <div data-recording className='flex items-center gap-2 p-1.5'>
            <IconButton label='Discard recording' onClick={recorder.cancel} disabled={isSending} className='text-danger hover:text-danger'>
              <Trash size={21} weight='duotone' />
            </IconButton>
            <span className='relative flex w-2.5 h-2.5 shrink-0'>
              <span className='absolute inset-0 rounded-full bg-danger animate-ping-soft' />
              <span className='relative w-2.5 h-2.5 rounded-full bg-danger' />
            </span>
            <span className='w-10 shrink-0 text-sm font-bold tabular-nums'>{formatDuration(recorder.seconds)}</span>
            <div className='flex items-center justify-end gap-[3px] flex-1 min-w-0 h-9 overflow-hidden' aria-hidden='true'>
              {recorder.levels.map((level, index) => (
                <span key={index} style={{ height: `${Math.max(10, Math.min(100, level * 320))}%` }} className='w-[3px] shrink-0 rounded-full grad' />
              ))}
            </div>
            <motion.button type='button' aria-label='Send voice message' onClick={sendRecording} disabled={isSending}
              whileTap={{ scale: 0.86 }} whileHover={{ scale: 1.06 }}
              className='grid place-items-center w-10 h-10 shrink-0 rounded-full grad glow text-white'>
              {isSending ? <CircleNotch size={19} className='animate-spin' /> : <PaperPlaneRight size={19} weight='fill' />}
            </motion.button>
          </div>
        ) : (
          <div className='flex items-end gap-0.5 p-1.5'>
            <input ref={mediaInputRef} data-media-input onChange={handleFileChange} type="file" accept={MEDIA_ACCEPT} multiple hidden />
            <input ref={documentInputRef} data-document-input onChange={handleFileChange} type="file" accept={DOCUMENT_ACCEPT} multiple hidden />

            <div ref={attachRef} className='relative'>
              <IconButton label='Attach' active={showAttach} disabled={isSending || Boolean(editingMessage)} onClick={() => setShowAttach(!showAttach)}>
                <motion.span animate={{ rotate: showAttach ? 45 : 0 }} transition={spring} className='grid place-items-center'>
                  <Plus size={22} weight='bold' />
                </motion.span>
              </IconButton>
              <AnimatePresence>
                {showAttach && (
                  <motion.div role='menu' aria-label='Attach'
                    initial={{ opacity: 0, y: 8, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}
                    className='absolute bottom-full left-0 mb-2 z-30 w-56 p-1.5 origin-bottom-left rounded-2xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40'>
                    <button type='button' role='menuitem' className={menuItemClass}
                      onClick={() => { setShowAttach(false); mediaInputRef.current?.click() }}>
                      <span className='grid place-items-center w-8 h-8 rounded-full bg-[#7c5cff]/20 text-[#9d85ff]'><Images size={18} weight='fill' /></span>
                      Photos & videos
                    </button>
                    <button type='button' role='menuitem' className={menuItemClass}
                      onClick={() => { setShowAttach(false); documentInputRef.current?.click() }}>
                      <span className='grid place-items-center w-8 h-8 rounded-full bg-[#2f7bff]/20 text-[#5b9bff]'><FileIcon size={18} weight='fill' /></span>
                      Document
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
              placeholder={editingMessage ? 'Edit your message' : hasFiles ? 'Add a caption…' : `Message ${recipientName}…`}
              className='flex-1 min-w-0 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-[1.35] text-ink placeholder:text-faint'
            />

            {trimmed.length > MAX_MESSAGE_LENGTH - 200 && (
              <span className={`self-center text-[11px] font-semibold tabular-nums px-1 ${isTooLong ? 'text-danger' : 'text-faint'}`}>
                {MAX_MESSAGE_LENGTH - trimmed.length}
              </span>
            )}

            {showMic ? (
              <motion.button type='button' aria-label='Record a voice message' onClick={startRecording} disabled={isSending}
                whileTap={{ scale: 0.86 }} whileHover={{ scale: 1.06 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className='grid place-items-center w-10 h-10 shrink-0 rounded-full bg-hover text-ink hover:text-accent-text transition-colors'>
                {isSending ? <CircleNotch size={19} className='animate-spin' /> : <Microphone size={20} weight='fill' />}
              </motion.button>
            ) : (
              <motion.button type='button' aria-label={editingMessage ? 'Save edit' : 'Send message'} onClick={handleSend} disabled={!canSend}
                whileTap={canSend ? { scale: 0.86 } : undefined} whileHover={canSend ? { scale: 1.06 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className={`grid place-items-center w-10 h-10 shrink-0 rounded-full transition-colors duration-200 ${canSend || isSending ? 'grad glow text-white' : 'bg-hover text-faint'}`}>
                {isSending ? <CircleNotch size={19} className='animate-spin' /> : editingMessage ? <Check size={19} weight='bold' /> : <PaperPlaneRight size={19} weight='fill' />}
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageComposer
