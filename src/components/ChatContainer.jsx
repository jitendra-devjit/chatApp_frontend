import React, { useContext, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, CircleNotch, SidebarSimple } from '@phosphor-icons/react'
import { formatDayLabel, formatMessageTime, isEmojiOnly, isSameDay } from '../lib/utils'
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import Avatar from './Avatar';
import IconButton from './IconButton';
import { LogoMark } from './Logo';
import MessageComposer from './MessageComposer';

// messages from one person less than this apart are shown as one block
const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 140;
const LOAD_OLDER_PX = 120;
const FRESH_MESSAGE_MS = 4000;

const isGroupedWith = (a, b) =>
  a && b && a.senderId === b.senderId && isSameDay(a.createdAt, b.createdAt) &&
  Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS;

const MessageSkeleton = () => (
  <div className='flex flex-col gap-3 py-6' aria-hidden='true'>
    {[['start', 'w-48'], ['start', 'w-64'], ['end', 'w-56'], ['start', 'w-40'], ['end', 'w-72'], ['end', 'w-36']].map(([side, width], index) => (
      <div key={index} className={`skeleton h-10 rounded-[20px] ${width} ${side === 'end' ? 'self-end' : 'self-start'}`} />
    ))}
  </div>
)

const ChatContainer = ({ onToggleDetails, isDetailsOpen, onOpenImage }) => {
  const { messages, hasMore, isLoadingMessages, isLoadingOlder, loadOlderMessages, selectedUser, selectUser, sendMessage } = useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef(null);
  // what the list looked like after the previous render, to decide how to scroll now
  const snapshot = useRef({ chatId: null, firstId: null, lastId: null, height: 0 });

  const selectedId = selectedUser?._id;

  const scrollToBottom = (behavior = 'auto') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = snapshot.current;
    const firstId = messages[0]?._id ?? null;
    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?._id ?? null;

    if (prev.chatId !== selectedId || prev.lastId === null) {
      // a chat was opened: start at the newest message
      el.scrollTop = el.scrollHeight;
      setIsAtBottom(true);
    } else if (firstId !== prev.firstId && lastId === prev.lastId) {
      // older messages were added on top: keep what the user was reading in place
      el.scrollTop += el.scrollHeight - prev.height;
    } else if (lastId !== prev.lastId) {
      const wasNearBottom = prev.height - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      if (lastMessage?.senderId === authUser._id || wasNearBottom) scrollToBottom('smooth');
    }

    snapshot.current = { chatId: selectedId, firstId, lastId, height: el.scrollHeight };
  }, [messages, selectedId, authUser._id]);

  const handleScroll = () => {
    const el = scrollRef.current;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
    if (el.scrollTop < LOAD_OLDER_PX) loadOlderMessages();
  };

  // a picture that finishes loading makes the list taller, stay at the bottom if we were there
  const handleImageLoad = () => {
    if (isAtBottom) scrollToBottom();
  };

  if (!selectedUser) {
    return (
      <section className='relative h-full grid place-items-center bg-canvas dot-grid max-md:hidden'>
        <div className='max-w-md px-8 text-center'>
          <LogoMark className='w-12 h-12 mx-auto -rotate-6' />
          <h2 className='mt-7 font-serif text-[44px] leading-[1.05] tracking-tight'>
            Pick up where<br /><span className='italic'>you left off.</span>
          </h2>
          <p className='mt-4 text-muted'>
            Choose someone on the left to open the conversation, or press{' '}
            <kbd className='font-mono text-xs text-ink border border-line-strong rounded-md px-1.5 py-0.5'>/</kbd> to search.
          </p>
        </div>
      </section>
    );
  }

  const isOnline = onlineUsers.includes(selectedId);
  const firstName = selectedUser.fullName.split(' ')[0];

  return (
    <section className='relative flex flex-col h-full min-h-0 min-w-0 bg-canvas'>
      {/* ---------------- header ---------------- */}
      <header className='flex items-center gap-3 h-16 px-3 sm:px-5 shrink-0 border-b border-line bg-canvas'>
        <IconButton label='Back to conversations' onClick={() => selectUser(null)} className='md:hidden -ml-1'>
          <ArrowLeft size={20} />
        </IconButton>
        <button type='button' onClick={onToggleDetails} aria-label={`About ${selectedUser.fullName}`}
          className='flex items-center gap-3 flex-1 min-w-0 text-left rounded-xl'>
          <Avatar user={selectedUser} />
          <div className='min-w-0 leading-tight'>
            <p className='truncate font-semibold text-[15px]'>{selectedUser.fullName}</p>
            <p className={`flex items-center gap-1.5 text-xs ${isOnline ? 'text-accent-text' : 'text-faint'}`}>
              {isOnline && <span className='w-1.5 h-1.5 rounded-full bg-accent' />}
              {isOnline ? 'Active now' : 'Offline'}
            </p>
          </div>
        </button>
        <IconButton label={isDetailsOpen ? 'Hide details' : 'Show details'} active={isDetailsOpen} onClick={onToggleDetails}>
          <SidebarSimple size={20} mirrored />
        </IconButton>
      </header>

      {/* ---------------- chat body ---------------- */}
      <div ref={scrollRef} onScroll={handleScroll} className='flex-1 min-h-0 overflow-y-auto dot-grid'>
        <div className='flex flex-col min-h-full max-w-3xl mx-auto px-3 sm:px-6 py-4'>
          {isLoadingMessages ? <MessageSkeleton /> : messages.length === 0 ? (
            <div className='m-auto py-10 text-center'>
              <Avatar user={selectedUser} size='lg' className='w-fit mx-auto' />
              <p className='mt-5 font-serif text-3xl tracking-tight'>Say hello to <span className='italic'>{firstName}.</span></p>
              <p className='mt-2 text-sm text-muted'>This is the very beginning of your conversation.</p>
            </div>
          ) : (
            <>
              <div className='mt-auto' />
              {hasMore ? (
                <div className='h-10 grid place-items-center text-faint'>
                  {isLoadingOlder && <CircleNotch size={18} className='animate-spin' />}
                </div>
              ) : (
                <p className='label-mono py-4 text-center text-faint'>Start of conversation</p>
              )}

              {messages.map((msg, index) => {
                const prev = messages[index - 1];
                const next = messages[index + 1];
                const isOwn = msg.senderId === authUser._id;
                const isNewDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);
                const isGroupStart = !isGroupedWith(prev, msg);
                const isGroupEnd = !isGroupedWith(msg, next);
                const isFresh = Date.now() - new Date(msg.createdAt).getTime() < FRESH_MESSAGE_MS;
                const emojiOnly = !msg.image && isEmojiOnly(msg.text);

                // the side a bubble hangs from is tighter, so a block reads as one shape
                const corners = isOwn
                  ? `rounded-br-md ${isGroupStart ? '' : 'rounded-tr-md'}`
                  : `rounded-bl-md ${isGroupStart ? '' : 'rounded-tl-md'}`;

                return (
                  <React.Fragment key={msg._id}>
                    {isNewDay && (
                      <div className='flex items-center gap-4 py-5' role='separator'>
                        <span className='flex-1 h-px bg-line' />
                        <span className='label-mono text-faint'>{formatDayLabel(msg.createdAt)}</span>
                        <span className='flex-1 h-px bg-line' />
                      </div>
                    )}
                    <div className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${isOwn ? 'self-end items-end' : 'self-start items-start'} ${isGroupStart && !isNewDay ? 'mt-3' : 'mt-[3px]'} ${isFresh ? 'animate-message-in' : ''}`}>
                      {msg.image && (
                        <button type='button' onClick={() => onOpenImage(msg.image)} aria-label='Open image'
                          className={`block overflow-hidden rounded-[20px] ${corners} border border-line bg-raised`}>
                          <img src={msg.image} alt="Shared image" onLoad={handleImageLoad}
                            className='block max-w-full max-h-80 min-h-24 min-w-24 object-cover transition-transform duration-300 hover:scale-[1.02]' />
                        </button>
                      )}
                      {msg.text && (emojiOnly ? (
                        <p className='text-[44px] leading-tight py-1'>{msg.text}</p>
                      ) : (
                        <p className={`px-3.5 py-2 rounded-[20px] ${corners} text-[15px] leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere] ${msg.image ? 'mt-[3px]' : ''}
                          ${isOwn ? 'bg-accent text-accent-ink' : 'bg-raised text-ink border border-line'}`}>
                          {msg.text}
                        </p>
                      ))}
                      {isGroupEnd && (
                        <time className='mt-1 px-1 font-mono text-[10.5px] text-faint'>{formatMessageTime(msg.createdAt)}</time>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      </div>

      {!isAtBottom && (
        <button type='button' aria-label='Jump to latest message' onClick={() => scrollToBottom('smooth')}
          className='absolute left-1/2 -translate-x-1/2 bottom-28 z-10 grid place-items-center w-9 h-9 rounded-full bg-raised border border-line-strong text-ink shadow-lg shadow-black/30 animate-pop-in hover:bg-hover'>
          <ArrowDown size={16} weight='bold' />
        </button>
      )}

      {/* ---------------- bottom area ---------------- */}
      <MessageComposer key={selectedId} recipientName={firstName} onSend={sendMessage} />
    </section>
  );
}

export default ChatContainer;
