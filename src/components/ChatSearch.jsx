import React, { useContext, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CircleNotch, MagnifyingGlass, X } from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext'
import { formatListTime, getErrorMessage } from '../lib/utils'

const MIN_QUERY_LENGTH = 2
const TYPING_PAUSE_MS = 300

// the text of a result with the searched words marked
const Highlighted = ({ text, query }) => {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return text
  // long messages start a little before the match so it is not cut off
  const start = Math.max(0, index - 30)
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, index)}
      <mark className='rounded px-0.5 bg-[color-mix(in_oklab,var(--a1)_45%,transparent)] text-ink font-semibold'>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

// Search bar that drops down under the chat header. `getName(userId)` names the author of a result.
// Render inside <AnimatePresence>
const ChatSearch = ({ getName, onClose }) => {
  const { searchMessages, openAtMessage, selectedChat } = useContext(ChatContext)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(null) // null until the first search finished
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const term = query.trim()
  const chatId = selectedChat?._id

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // search a moment after the user stops typing, and drop answers that arrive late
  useEffect(() => {
    setError(null)
    if (term.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setIsSearching(false)
      return
    }
    let cancelled = false
    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const found = await searchMessages(term)
        if (!cancelled) setResults(found)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, TYPING_PAUSE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, chatId])

  const openResult = (message) => {
    openAtMessage(message)
    onClose()
  }

  return (
    <motion.div data-chat-search initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 440, damping: 38 }} className='relative z-20 shrink-0 border-b border-line'>
      <div className='flex items-center gap-2 px-3 sm:px-5 py-2.5'>
        <div className='group flex items-center gap-2.5 flex-1 h-10 px-4 rounded-2xl bg-raised border border-transparent focus-within:border-accent-text'>
          <MagnifyingGlass size={16} weight='bold' className='text-faint shrink-0 group-focus-within:text-accent-text' />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            type='text' aria-label='Search in this chat' placeholder='Search in this chat' maxLength={100}
            className='flex-1 min-w-0 bg-transparent text-sm font-medium text-ink placeholder:text-faint placeholder:font-normal' />
          {isSearching && <CircleNotch size={16} className='animate-spin text-faint' />}
        </div>
        <button type='button' aria-label='Close search' onClick={onClose}
          className='grid place-items-center w-9 h-9 shrink-0 rounded-full text-muted hover:bg-hover hover:text-ink'>
          <X size={17} weight='bold' />
        </button>
      </div>

      {(results || error) && (
        <div className='absolute inset-x-3 sm:inset-x-5 top-full -mt-1 max-h-80 overflow-y-auto rounded-2xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40'>
          {error ? (
            <p className='px-4 py-4 text-sm text-danger'>{error}</p>
          ) : results.length === 0 ? (
            <p className='px-4 py-4 text-sm text-muted'>No messages with <span className='font-semibold text-ink'>“{term}”</span>.</p>
          ) : (
            <ul className='p-1.5'>
              <li className='px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-faint'>
                {results.length} {results.length === 1 ? 'message' : 'messages'}
              </li>
              {results.map((message) => (
                <li key={message._id}>
                  <button type='button' data-search-result onClick={() => openResult(message)}
                    className='block w-full px-3 py-2 rounded-xl text-left transition-colors hover:bg-hover'>
                    <span className='flex items-baseline justify-between gap-3'>
                      <span className='text-[13px] font-bold text-accent-text'>{getName(message.senderId)}</span>
                      <time className='shrink-0 text-[11px] font-medium tabular-nums text-faint'>{formatListTime(message.createdAt)}</time>
                    </span>
                    <span className='block truncate text-sm text-muted'><Highlighted text={message.text} query={term} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default ChatSearch
