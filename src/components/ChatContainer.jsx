import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowLeft, CircleNotch, Info, Lightning, Trash } from '@phosphor-icons/react'
import { formatDayLabel, formatLastSeen, isSameDay } from '../lib/utils'
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import Avatar from './Avatar';
import IconButton from './IconButton';
import { LogoMark } from './Logo';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import TypingDots from './TypingDots';

// messages from one person less than this apart are shown as one block
const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 140;
const LOAD_OLDER_PX = 120;
const FRESH_MESSAGE_MS = 4000;
const HIGHLIGHT_MS = 1600;

const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };

const isGroupedWith = (a, b) =>
  a && b && a.senderId === b.senderId && isSameDay(a.createdAt, b.createdAt) &&
  Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS;

const MessageSkeleton = () => (
  <div className='flex flex-col gap-3 py-6' aria-hidden='true'>
    {[['start', 'w-48'], ['start', 'w-64'], ['end', 'w-56'], ['start', 'w-40'], ['end', 'w-72'], ['end', 'w-36']].map(([side, width], index) => (
      <div key={index} className={`skeleton h-10 rounded-[22px] ${width} ${side === 'end' ? 'self-end' : 'self-start'}`} />
    ))}
  </div>
)

const EmptyState = () => (
  <section className='glass relative flex-1 min-w-0 grid place-items-center md:rounded-[28px] overflow-hidden max-md:hidden'>
    <div className='max-w-md px-8 text-center'>
      <div className='relative w-28 h-28 mx-auto'>
        <div className='absolute inset-0 rounded-full grad opacity-40 blur-2xl' />
        <motion.div animate={{ y: [0, -10, 0], rotate: [-4, 4, -4] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className='relative grid place-items-center w-full h-full'>
          <LogoMark className='w-24 h-24 drop-shadow-2xl' />
        </motion.div>
      </div>
      <h2 className='mt-8 text-[34px] font-extrabold leading-[1.1] tracking-tight'>
        Your conversations<br /><span className='grad-text'>live here.</span>
      </h2>
      <p className='mt-4 text-muted'>
        Pick someone on the left to start talking, or press{' '}
        <kbd className='text-xs font-bold text-ink border border-line-strong rounded-md px-1.5 py-0.5'>/</kbd> to search.
      </p>
      <p className='mt-8 inline-flex items-center gap-2 px-3.5 h-8 rounded-full bg-raised text-xs font-medium text-muted'>
        <Lightning size={14} weight='fill' className='text-accent-text' /> Messages are delivered in real time
      </p>
    </div>
  </section>
)

const DeleteDialog = ({ onConfirm, onCancel }) => (
  <motion.div role='alertdialog' aria-modal='true' aria-label='Delete message' onClick={onCancel}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className='fixed inset-0 z-50 grid place-items-center p-4 bg-overlay backdrop-blur-sm'>
    <motion.div onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={bubbleSpring}
      className='w-full max-w-xs p-6 rounded-[28px] bg-panel-solid border border-line-strong shadow-2xl text-center'>
      <div className='grid place-items-center w-14 h-14 mx-auto rounded-full bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] text-danger'>
        <Trash size={26} weight='duotone' />
      </div>
      <h2 className='mt-4 text-lg font-extrabold tracking-tight'>Delete this message?</h2>
      <p className='mt-1.5 text-sm text-muted'>It will be removed for both of you. This cannot be undone.</p>
      <div className='mt-6 grid grid-cols-2 gap-2.5'>
        <button type='button' onClick={onCancel} className='h-11 rounded-2xl bg-raised border border-line text-sm font-bold hover:bg-hover transition-colors'>
          Cancel
        </button>
        <button type='button' onClick={onConfirm} autoFocus className='h-11 rounded-2xl bg-danger text-white text-sm font-bold hover:brightness-110 transition'>
          Delete
        </button>
      </div>
    </motion.div>
  </motion.div>
)

const ChatContainer = ({ onToggleDetails, isDetailsOpen, onOpenImage }) => {
  const {
    messages, hasMore, isLoadingMessages, isLoadingOlder, loadOlderMessages, selectedUser, selectUser,
    sendMessage, editMessage, deleteMessage, reactToMessage, sendTyping, typingUsers,
  } = useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null); // message being answered
  const [editingMessage, setEditingMessage] = useState(null); // message whose text is in the composer
  const [deleteTarget, setDeleteTarget] = useState(null); // message waiting for "are you sure"
  const [openMenu, setOpenMenu] = useState(null); // { id, type, below } of the open message popover
  const [highlightId, setHighlightId] = useState(null); // quoted message the user jumped to
  const scrollRef = useRef(null);
  // what the list looked like after the previous render, to decide how to scroll now
  const snapshot = useRef({ chatId: null, firstId: null, lastId: null, height: 0 });

  const selectedId = selectedUser?._id;
  const isTyping = Boolean(selectedId && typingUsers[selectedId]);

  // nothing from the previous chat carries over
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setDeleteTarget(null);
    setOpenMenu(null);
  }, [selectedId]);

  // a message popover closes on a click elsewhere, on Escape and when the list scrolls
  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-menu-root]') && !e.target.closest(`[data-message="${openMenu.id}"]`)) setOpenMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

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

  // the typing bubble appears below the last message, keep it in view
  const isAtBottomRef = useRef(isAtBottom);
  isAtBottomRef.current = isAtBottom;
  useEffect(() => {
    if (isTyping && isAtBottomRef.current) scrollToBottom('smooth');
  }, [isTyping]);

  const handleScroll = () => {
    const el = scrollRef.current;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
    if (el.scrollTop < LOAD_OLDER_PX) loadOlderMessages();
    if (openMenu) setOpenMenu(null);
  };

  // a picture that finishes loading makes the list taller, stay at the bottom if we were there
  const handleImageLoad = () => {
    if (isAtBottom) scrollToBottom();
  };

  if (!selectedUser) return <EmptyState />;

  const isOnline = onlineUsers.includes(selectedId);
  const firstName = selectedUser.fullName.split(' ')[0];

  // scroll to the message a reply quotes and flash it
  const jumpToMessage = (messageId) => {
    const target = document.getElementById(`msg-${messageId}`);
    if (!target) {
      // it is further back than what is loaded
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), HIGHLIGHT_MS);
  };

  const startReply = (message) => {
    setEditingMessage(null);
    setReplyingTo(message);
  };

  const startEdit = (message) => {
    setReplyingTo(null);
    setEditingMessage(message);
  };

  // the composer calls this for a new message and for a finished edit
  const handleSend = async (payload) => {
    if (editingMessage) {
      const saved = payload.text === editingMessage.text || await editMessage(editingMessage._id, payload.text);
      if (saved) setEditingMessage(null);
      return saved;
    }
    const sent = await sendMessage(replyingTo ? { ...payload, replyTo: replyingTo._id } : payload);
    if (sent) setReplyingTo(null);
    return sent;
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (editingMessage?._id === target._id) setEditingMessage(null);
    if (replyingTo?._id === target._id) setReplyingTo(null);
    await deleteMessage(target._id);
  };

  return (
    <section className='glass relative flex-1 flex flex-col min-h-0 min-w-0 md:rounded-[28px] overflow-hidden max-md:border-0'>
      {/* ---------------- header ---------------- */}
      <header className='flex items-center gap-2 h-[72px] px-3 sm:px-5 shrink-0 border-b border-line'>
        <IconButton label='Back to conversations' onClick={() => selectUser(null)} className='md:hidden -ml-1'>
          <ArrowLeft size={22} weight='bold' />
        </IconButton>
        <button type='button' onClick={onToggleDetails} aria-label={`About ${selectedUser.fullName}`}
          className='flex items-center gap-3 flex-1 min-w-0 py-1 pr-3 text-left rounded-2xl'>
          <Avatar user={selectedUser} online={isOnline} />
          <div className='min-w-0 leading-tight'>
            <p className='truncate font-bold text-base'>{selectedUser.fullName}</p>
            <p data-status className={`mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-medium ${isTyping ? 'text-accent-text' : isOnline ? 'text-online' : 'text-faint'}`}>
              {isTyping ? <>typing <TypingDots /></> : isOnline ? 'Online' : formatLastSeen(selectedUser.lastSeen)}
            </p>
          </div>
        </button>
        <IconButton label={isDetailsOpen ? 'Hide details' : 'Show details'} active={isDetailsOpen} onClick={onToggleDetails}>
          <Info size={23} weight={isDetailsOpen ? 'fill' : 'duotone'} />
        </IconButton>
      </header>

      {/* ---------------- chat body ---------------- */}
      <div ref={scrollRef} onScroll={handleScroll} data-scroller className='flex-1 min-h-0 overflow-y-auto'>
        <div className='flex flex-col min-h-full max-w-3xl mx-auto px-3 sm:px-6 py-4'>
          {isLoadingMessages ? <MessageSkeleton /> : messages.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className='m-auto py-10 text-center'>
              <Avatar user={selectedUser} size='xl' ring className='mx-auto' />
              <p className='mt-6 text-2xl font-extrabold tracking-tight'>Say hello to <span className='grad-text'>{firstName}</span> 👋</p>
              <p className='mt-2 text-sm text-muted'>This is the very beginning of your conversation.</p>
            </motion.div>
          ) : (
            <>
              <div className='mt-auto' />
              {hasMore ? (
                <div className='h-10 grid place-items-center text-faint'>
                  {isLoadingOlder && <CircleNotch size={18} className='animate-spin' />}
                </div>
              ) : (
                <p data-start className='py-4 text-center text-xs font-medium text-faint'>This is the start of your conversation</p>
              )}

              {messages.map((msg, index) => {
                const prev = messages[index - 1];
                const next = messages[index + 1];
                const isNewDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);

                return (
                  <React.Fragment key={msg._id}>
                    {isNewDay && (
                      <div className='flex justify-center py-4' role='separator'>
                        <span className='px-3 h-7 grid place-items-center rounded-full bg-raised border border-line text-[11px] font-semibold text-muted'>
                          {formatDayLabel(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      msg={msg}
                      isOwn={msg.senderId === authUser._id}
                      isNewDay={isNewDay}
                      isGroupStart={!isGroupedWith(prev, msg)}
                      isGroupEnd={!isGroupedWith(msg, next)}
                      isFresh={Date.now() - new Date(msg.createdAt).getTime() < FRESH_MESSAGE_MS}
                      isHighlighted={highlightId === msg._id}
                      myId={authUser._id}
                      otherName={firstName}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onReply={startReply}
                      onEdit={startEdit}
                      onDelete={setDeleteTarget}
                      onReact={(message, emoji) => reactToMessage(message._id, emoji)}
                      onOpenImage={(src) => onOpenImage({ src, title: msg.senderId === authUser._id ? 'You' : selectedUser.fullName })}
                      onJumpTo={jumpToMessage}
                      onImageLoad={handleImageLoad}
                    />
                  </React.Fragment>
                );
              })}

              <AnimatePresence>
                {isTyping && (
                  <motion.div key='typing' data-typing
                    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    transition={bubbleSpring}
                    className='self-start origin-bottom-left mt-3 px-4 h-10 flex items-center rounded-[22px] rounded-bl-md bg-bubble border border-line text-muted'>
                    <TypingDots />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {!isAtBottom && (
          <motion.button type='button' aria-label='Jump to latest message' onClick={() => scrollToBottom('smooth')}
            initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            className='absolute right-5 bottom-24 z-10 grid place-items-center w-10 h-10 rounded-full bg-panel-solid border border-line-strong text-ink shadow-xl shadow-black/30'>
            <ArrowDown size={17} weight='bold' />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ---------------- bottom area ---------------- */}
      <MessageComposer key={selectedId} recipientName={firstName} onSend={handleSend}
        onTyping={(isTypingNow) => sendTyping(selectedId, isTypingNow)}
        replyingTo={replyingTo && { ...replyingTo, authorName: replyingTo.senderId === authUser._id ? 'yourself' : firstName }}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)} />

      <AnimatePresence>
        {deleteTarget && <DeleteDialog key='delete' onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
      </AnimatePresence>
    </section>
  );
}

export default ChatContainer;
