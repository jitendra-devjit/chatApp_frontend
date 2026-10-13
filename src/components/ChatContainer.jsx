import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowLeft, CircleNotch, CloudArrowUp, Info, Lightning, MagnifyingGlass, Phone, Trash, VideoCamera } from '@phosphor-icons/react'
import { formatDayLabel, formatLastSeen, isSameDay } from '../lib/utils'
import { AuthContext } from '../context/AuthContext';
import { CallContext } from '../context/CallContext';
import { ChatContext } from '../context/ChatContext';
import Avatar from './Avatar';
import CallBubble from './CallBubble';
import ChatSearch from './ChatSearch';
import IconButton from './IconButton';
import { LogoMark } from './Logo';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import { ConfirmDialog } from './Modal';
import TypingDots from './TypingDots';

// messages from one person less than this apart are shown as one block
const GROUP_GAP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 140;
const LOAD_OLDER_PX = 120;
const FRESH_MESSAGE_MS = 4000;
const HIGHLIGHT_MS = 1600;

const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };

const isGroupedWith = (a, b) =>
  a && b && !a.system && !b.system && !a.call && !b.call && a.senderId === b.senderId && isSameDay(a.createdAt, b.createdAt) &&
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

const ChatContainer = ({ onToggleDetails, isDetailsOpen, onOpenImage }) => {
  const {
    messages, hasMore, isLoadingMessages, isLoadingOlder, loadOlderMessages, selectedChat, selectChat, users,
    sendMessage, editMessage, deleteMessage, reactToMessage, sendTyping, typing, jumpTarget,
  } = useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);
  const { call, startCall } = useContext(CallContext);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null); // message being answered
  const [editingMessage, setEditingMessage] = useState(null); // message whose text is in the composer
  const [deleteTarget, setDeleteTarget] = useState(null); // message waiting for "are you sure"
  const [openMenu, setOpenMenu] = useState(null); // { id, type, below } of the open message popover
  const [highlightId, setHighlightId] = useState(null); // message the user jumped to
  const [isSearching, setIsSearching] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  // drag events fire for every element the pointer crosses, this counts in and out
  const dragDepth = useRef(0);
  // what the list looked like after the previous render, to decide how to scroll now
  const snapshot = useRef({ chatId: null, firstId: null, lastId: null, height: 0 });

  const selectedId = selectedChat?._id;
  const isGroup = Boolean(selectedChat?.isGroup);
  const typingIds = Object.keys((selectedId && typing[selectedId]) || {});
  const isTyping = typingIds.length > 0;

  // nothing from the previous chat carries over
  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setDeleteTarget(null);
    setOpenMenu(null);
    setIsSearching(false);
  }, [selectedId]);

  // Ctrl+F (or Cmd+F) searches the open chat instead of the page
  useEffect(() => {
    if (!selectedId) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearching(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // scroll to a message and flash it. Returns false when it is not on screen
  const showMessage = (messageId) => {
    const target = document.getElementById(`msg-${messageId}`);
    if (!target) return false;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), HIGHLIGHT_MS);
    return true;
  };

  // a search result was opened: by now its message is loaded and drawn
  useEffect(() => {
    if (jumpTarget) showMessage(jumpTarget.id);
  }, [jumpTarget]);

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

  // ---------- files dragged onto the chat ----------
  const carriesFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const handleDragEnter = (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDraggingFiles(true);
  };
  const handleDragLeave = (e) => {
    if (!carriesFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDraggingFiles(false);
  };
  const handleDrop = (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFiles(false);
    composerRef.current?.addFiles([...e.dataTransfer.files]);
  };

  if (!selectedChat) return <EmptyState />;

  const isOnline = !isGroup && onlineUsers.includes(selectedId);
  const firstName = selectedChat.fullName.split(' ')[0];
  const members = isGroup ? selectedChat.members : [];
  const otherMembers = members.filter((member) => member.user._id !== authUser._id);

  // the person behind an id: a member of this group, the other person of this chat, or anybody known
  const findUser = (userId) => {
    if (userId === authUser._id) return authUser;
    if (!isGroup && userId === selectedId) return selectedChat;
    return members.find((member) => member.user._id === userId)?.user || users.find((user) => user._id === userId) || null;
  };
  const getName = (userId) => (userId === authUser._id ? 'You' : findUser(userId)?.fullName.split(' ')[0] || 'Someone');

  // one-to-one: the other person opened it. Group: every other member has read past it
  const isSeen = (message) =>
    isGroup
      ? otherMembers.length > 0 && otherMembers.every((member) => new Date(member.lastReadAt) >= new Date(message.createdAt))
      : Boolean(message.seen);

  const typingText = isGroup
    ? `${typingIds.slice(0, 2).map(getName).join(' and ')}${typingIds.length > 2 ? ' and others' : ''} ${typingIds.length > 1 ? 'are' : 'is'} typing`
    : 'typing';

  const onlineMembers = otherMembers.filter((member) => onlineUsers.includes(member.user._id)).length;
  const statusText = isGroup
    ? `${members.length} members${onlineMembers > 0 ? ` · ${onlineMembers} online` : ''}`
    : isOnline ? 'Online' : formatLastSeen(selectedChat.lastSeen);

  // a quote was clicked
  const jumpToMessage = (messageId) => {
    // it can be further back than what is loaded
    if (!showMessage(messageId)) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
    <section onDragEnter={handleDragEnter} onDragOver={(e) => carriesFiles(e) && e.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className='glass relative flex-1 flex flex-col min-h-0 min-w-0 md:rounded-[28px] overflow-hidden max-md:border-0'>
      <AnimatePresence>
        {isDraggingFiles && (
          <motion.div key='drop' data-drop-zone initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className='pointer-events-none absolute inset-2 z-40 grid place-items-center rounded-[22px] border-2 border-dashed border-accent-text bg-[color-mix(in_oklab,var(--canvas)_82%,transparent)] backdrop-blur-sm'>
            <div className='text-center'>
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className='grid place-items-center w-20 h-20 mx-auto rounded-full grad glow text-white'>
                <CloudArrowUp size={38} weight='fill' />
              </motion.div>
              <p className='mt-5 text-xl font-extrabold tracking-tight'>Drop to attach</p>
              <p className='mt-1 text-sm text-muted'>Photos, videos and documents, up to 10 at once</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ---------------- header ---------------- */}
      <header className='flex items-center gap-1 h-[72px] px-3 sm:px-5 shrink-0 border-b border-line'>
        <IconButton label='Back to conversations' onClick={() => selectChat(null)} className='md:hidden -ml-1'>
          <ArrowLeft size={22} weight='bold' />
        </IconButton>
        <button type='button' onClick={onToggleDetails} aria-label={`About ${selectedChat.fullName}`}
          className='flex items-center gap-3 flex-1 min-w-0 py-1 pr-3 text-left rounded-2xl'>
          <Avatar user={selectedChat} group={isGroup} online={isOnline} />
          <div className='min-w-0 leading-tight'>
            <p className='truncate font-bold text-base'>{selectedChat.fullName}</p>
            <p data-status className={`mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-medium ${isTyping ? 'text-accent-text' : isOnline ? 'text-online' : 'text-faint'}`}>
              {isTyping ? <>{typingText} <TypingDots /></> : statusText}
            </p>
          </div>
        </button>
        {!isGroup && (
          <>
            <IconButton label={`Voice call ${firstName}`} data-call-start='audio' disabled={Boolean(call)} onClick={() => startCall(selectedChat, 'audio')}>
              <Phone size={21} weight='duotone' />
            </IconButton>
            <IconButton label={`Video call ${firstName}`} data-call-start='video' disabled={Boolean(call)} onClick={() => startCall(selectedChat, 'video')}>
              <VideoCamera size={22} weight='duotone' />
            </IconButton>
          </>
        )}
        <IconButton label='Search in this chat' active={isSearching} onClick={() => setIsSearching(!isSearching)}>
          <MagnifyingGlass size={21} weight={isSearching ? 'bold' : 'regular'} />
        </IconButton>
        <IconButton label={isDetailsOpen ? 'Hide details' : 'Show details'} active={isDetailsOpen} onClick={onToggleDetails}>
          <Info size={23} weight={isDetailsOpen ? 'fill' : 'duotone'} />
        </IconButton>
      </header>

      <AnimatePresence>
        {isSearching && <ChatSearch key='search' getName={getName} onClose={() => setIsSearching(false)} />}
      </AnimatePresence>

      {/* ---------------- chat body ---------------- */}
      <div ref={scrollRef} onScroll={handleScroll} data-scroller className='flex-1 min-h-0 overflow-y-auto'>
        <div className='flex flex-col min-h-full max-w-3xl mx-auto px-3 sm:px-6 py-4'>
          {isLoadingMessages ? <MessageSkeleton /> : messages.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className='m-auto py-10 text-center'>
              <Avatar user={selectedChat} size='xl' ring className='mx-auto' />
              <p className='mt-6 text-2xl font-extrabold tracking-tight'>
                {isGroup ? <>Welcome to <span className='grad-text'>{selectedChat.fullName}</span></> : <>Say hello to <span className='grad-text'>{firstName}</span> 👋</>}
              </p>
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
                const isOwn = msg.senderId === authUser._id;
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
                    {msg.system ? (
                      // a line written by the server, like "Aarav added Sara"
                      <p data-system className='self-center max-w-[85%] my-2 px-3 py-1 rounded-full bg-raised text-center text-xs font-medium text-muted'>
                        {msg.text}
                      </p>
                    ) : msg.call ? (
                      <CallBubble msg={msg} isOwn={isOwn} disabled={Boolean(call)} onCallBack={() => startCall(selectedChat, msg.call.kind)} />
                    ) : (
                      <MessageBubble
                        msg={msg}
                        isOwn={isOwn}
                        isNewDay={isNewDay}
                        isGroupStart={!isGroupedWith(prev, msg)}
                        isGroupEnd={!isGroupedWith(msg, next)}
                        isFresh={Date.now() - new Date(msg.createdAt).getTime() < FRESH_MESSAGE_MS}
                        isHighlighted={highlightId === msg._id}
                        seen={isSeen(msg)}
                        myId={authUser._id}
                        sender={isGroup && !isOwn ? findUser(msg.senderId) || { fullName: 'Someone' } : null}
                        getName={getName}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onReply={startReply}
                        onEdit={startEdit}
                        onDelete={setDeleteTarget}
                        onReact={(message, emoji) => reactToMessage(message._id, emoji)}
                        onOpenImage={(items, index) => onOpenImage({ items, index, title: isOwn ? 'You' : findUser(msg.senderId)?.fullName })}
                        onJumpTo={jumpToMessage}
                        onImageLoad={handleImageLoad}
                      />
                    )}
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
      <MessageComposer key={selectedId} ref={composerRef} recipientName={isGroup ? selectedChat.fullName : firstName} onSend={handleSend}
        onTyping={(isTypingNow) => sendTyping(selectedChat, isTypingNow)}
        replyingTo={replyingTo && { ...replyingTo, authorName: replyingTo.senderId === authUser._id ? 'yourself' : getName(replyingTo.senderId) }}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)} />

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog key='delete' danger icon={<Trash size={26} weight='duotone' />}
            title='Delete this message?' text='It will be removed for everyone in this chat. This cannot be undone.'
            confirmLabel='Delete' onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}

export default ChatContainer;
