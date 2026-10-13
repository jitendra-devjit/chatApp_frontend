import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive, ArrowLeft, BellSlash, BellSimple, CaretDown, Check, Checks, Image as ImageIcon, MagnifyingGlass, Microphone,
  Paperclip, Phone, PhoneX, Prohibit, PushPin, PushPinSlash, SignOut, UsersThree, VideoCamera, X,
} from '@phosphor-icons/react';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { describeAttachment, describeCall, formatListTime } from '../lib/utils';
import AppearanceMenu from './AppearanceMenu';
import Avatar from './Avatar';
import { CreateGroupModal } from './GroupModals';
import IconButton from './IconButton';
import Logo from './Logo';
import NotificationToggle from './NotificationToggle';
import TypingDots from './TypingDots';

const TABS = [['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups']];

const ATTACHMENT_ICONS = { image: ImageIcon, video: VideoCamera, audio: Microphone, file: Paperclip };

const isTypingTarget = (element) =>
  element instanceof HTMLElement &&
  (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);

const menuItemClass = 'flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-hover'

const SkeletonRows = () => (
  <div className='px-2' aria-hidden='true'>
    {[72, 56, 64, 48, 60].map((width, index) => (
      <div key={index} className='flex items-center gap-3 px-3 py-2.5'>
        <div className='skeleton w-12 h-12 rounded-full' />
        <div className='flex-1 space-y-2'>
          <div className='skeleton h-3 rounded-full' style={{ width: `${width}%` }} />
          <div className='skeleton h-2.5 rounded-full w-4/5 opacity-60' />
        </div>
      </div>
    ))}
  </div>
)

const Sidebar = () => {

  const {chats, users, isLoadingChats, selectedChat, selectChat, unseenMessages, lastMessages, typing, chatPrefs, setChatPref} = useContext(ChatContext);

  const {authUser, logout, onlineUsers} = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [tab, setTab] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState(null); // { id, above } of the chat whose menu is open
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const searchRef = useRef(null);

  const navigate = useNavigate();

  // "/" jumps to the search box from anywhere
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // a chat menu closes on a click elsewhere and on Escape
  useEffect(() => {
    if (!menu) return;
    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-chat-menu]')) setMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu]);

  // pinned chats first, then the newest conversation, people never talked to after that by name
  const sortedChats = useMemo(() => {
    const time = (chat) => new Date(lastMessages[chat._id]?.createdAt || (chat.isGroup ? chat.createdAt : 0)).getTime();
    const pinned = (chat) => (chatPrefs.pinned.has(chat._id) ? 1 : 0);
    return [...chats].sort((a, b) => pinned(b) - pinned(a) || time(b) - time(a) || a.fullName.localeCompare(b.fullName));
  }, [chats, lastMessages, chatPrefs]);

  const archivedCount = sortedChats.filter((chat) => chatPrefs.archived.has(chat._id)).length;
  const isArchiveView = showArchived && archivedCount > 0;

  const query = input.trim().toLowerCase();
  const visibleChats = sortedChats.filter((chat) => {
    // a search looks through everything, archived chats included
    if (query) return chat.fullName?.toLowerCase().includes(query);
    if (chatPrefs.archived.has(chat._id) !== isArchiveView) return false;
    if (isArchiveView) return true;
    if (tab === 'unread') return unseenMessages[chat._id] > 0;
    if (tab === 'groups') return chat.isGroup;
    return true;
  });

  const onlineCount = users.filter((user) => onlineUsers.includes(user._id)).length;
  const unreadChats = sortedChats.filter((chat) => unseenMessages[chat._id] > 0 && !chatPrefs.archived.has(chat._id)).length;

  const firstNameOf = (chat, userId) => {
    if (userId === authUser._id) return 'You';
    const person = chat.members?.find((member) => member.user._id === userId)?.user || users.find((user) => user._id === userId);
    return person ? person.fullName.split(' ')[0] : 'Someone';
  };

  const getPreview = (chat) => {
    const typingIds = Object.keys(typing[chat._id] || {});
    if (typingIds.length > 0) {
      return (
        <span className='inline-flex items-center gap-1.5 font-semibold text-accent-text'>
          {chat.isGroup ? `${firstNameOf(chat, typingIds[0])} is typing` : 'typing'} <TypingDots />
        </span>
      );
    }
    const last = lastMessages[chat._id];
    if (!last) return chat.bio || (chat.isGroup ? 'No messages yet' : 'Say hello 👋');
    if (last.system) return <span className='italic'>{last.text}</span>;
    const mine = last.senderId === authUser._id;
    if (last.deleted) {
      return <span className='italic'><Prohibit size={14} className='inline -mt-0.5 mr-1' />{mine ? 'You deleted this message' : 'This message was deleted'}</span>;
    }
    if (last.call) {
      const { preview, isMissed } = describeCall(last.call, mine);
      const CallIcon = isMissed ? PhoneX : last.call.kind === 'video' ? VideoCamera : Phone;
      return <span className={isMissed ? 'text-danger' : ''}><CallIcon size={15} weight='fill' className='inline -mt-0.5 mr-1' />{preview}</span>;
    }
    // the files of the message: new style attachments, or a picture sent the old way
    const files = last.attachment ? describeAttachment(last.attachment) : last.hasImage ? { type: 'image', label: 'Photo' } : null;
    const FileKindIcon = files && ATTACHMENT_ICONS[files.type];
    return (
      <>
        {chat.isGroup
          ? <span className={mine ? '' : 'font-semibold'}>{firstNameOf(chat, last.senderId)}: </span>
          : mine && (last.seen
            ? <Checks size={16} weight='bold' className='inline -mt-0.5 mr-1 text-accent-text' />
            : <Check size={15} weight='bold' className='inline -mt-0.5 mr-1' />)}
        {FileKindIcon && <FileKindIcon size={15} weight='fill' className='inline -mt-0.5 mr-1' />}
        {last.text || files?.label || 'Message'}
      </>
    );
  };

  const openMenu = (chat) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    // near the bottom of the screen the menu opens upwards
    const above = e.currentTarget.getBoundingClientRect().bottom > window.innerHeight - 190;
    setMenu(menu?.id === chat._id ? null : { id: chat._id, above });
  };

  const togglePref = (chat, name) => async () => {
    setMenu(null);
    const next = !chatPrefs[name].has(chat._id);
    await setChatPref(chat._id, { [name]: next });
  };

  const emptyText = query
    ? <>Nothing called <span className='font-semibold text-ink'>“{input.trim()}”</span> here.</>
    : isArchiveView ? 'No archived chats.'
    : tab === 'unread' ? 'You are all caught up. No unread chats.'
    : tab === 'groups' ? 'You are not in a group yet. Create one with the button above.'
    : 'Nobody else has joined yet. Invite a friend to start talking.';

  return (
    <aside className={`glass flex flex-col min-h-0 w-full md:w-[340px] md:shrink-0 md:rounded-[28px] max-md:border-0 ${selectedChat ? "max-md:hidden" : 'max-md:animate-list-in'}`} >
        {/* phone header: brand and the actions that live in the rail on desktop */}
        <div className='md:hidden flex items-center justify-between px-4 pt-4'>
            <Logo />
            <div className='flex items-center gap-0.5'>
              <NotificationToggle />
              <AppearanceMenu placement='below' />
              <IconButton label='Log out' onClick={logout}>
                <SignOut size={22} weight='duotone' />
              </IconButton>
              <button type='button' onClick={()=>navigate('/profile')} aria-label='Your profile' className='ml-1 rounded-full'>
                <Avatar user={authUser} size='sm' ring />
              </button>
            </div>
        </div>

        <div className='flex items-center justify-between px-5 pt-5 pb-4 shrink-0'>
            {isArchiveView ? (
              <div className='flex items-center gap-2'>
                <IconButton label='Back to chats' onClick={() => setShowArchived(false)} className='-ml-2'>
                  <ArrowLeft size={20} weight='bold' />
                </IconButton>
                <h1 className='text-[22px] font-extrabold tracking-tight leading-none'>Archived</h1>
              </div>
            ) : (
              <div>
                <h1 className='text-[26px] font-extrabold tracking-tight leading-none'>Chats</h1>
                <p className='mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted'>
                  <span className='w-1.5 h-1.5 rounded-full bg-online' />
                  {onlineCount} online now
                </p>
              </div>
            )}
            <motion.button type='button' onClick={() => setIsCreatingGroup(true)} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
              aria-label='New group' title='New group'
              className='grid place-items-center w-11 h-11 rounded-full grad glow text-white'>
              <UsersThree size={21} weight='fill' />
            </motion.button>
        </div>

        <div className='px-4 pb-3 shrink-0'>
            <div className='group flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-raised border border-transparent transition-colors focus-within:border-accent-text focus-within:bg-transparent'>
              <MagnifyingGlass size={17} weight='bold' className='text-faint shrink-0 transition-colors group-focus-within:text-accent-text'/>
              <input ref={searchRef} value={input} onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key === 'Escape'){ setInput(""); e.currentTarget.blur(); } }}
                type="text" aria-label='Search chats' placeholder="Search people and groups"
                className='flex-1 min-w-0 bg-transparent text-sm font-medium text-ink placeholder:text-faint placeholder:font-normal'/>
              {input ? (
                <button type='button' aria-label='Clear search' onClick={()=>{ setInput(""); searchRef.current?.focus(); }}
                  className='grid place-items-center w-5 h-5 rounded-full bg-hover text-muted hover:text-ink'>
                  <X size={11} weight='bold' />
                </button>
              ) : (
                <kbd className='text-[11px] font-semibold text-faint border border-line rounded-md px-1.5 py-px group-focus-within:hidden max-md:hidden'>/</kbd>
              )}
            </div>
        </div>

        {!isArchiveView && !query && (
          <div role='tablist' aria-label='Filter chats' className='flex gap-1.5 px-4 pb-3 shrink-0'>
            {TABS.map(([id, name]) => (
              <button key={id} type='button' role='tab' aria-selected={tab === id} onClick={() => setTab(id)}
                className={`relative h-8 px-3.5 rounded-full text-[13px] font-bold transition-colors ${tab === id ? 'text-white' : 'bg-raised text-muted hover:text-ink'}`}>
                {tab === id && (
                  <motion.span layoutId='chat-tab' transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    className='absolute inset-0 rounded-full grad' />
                )}
                <span className='relative'>
                  {name}
                  {id === 'unread' && unreadChats > 0 && <span className='ml-1.5 tabular-nums opacity-80'>{unreadChats}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className='flex-1 min-h-0 overflow-y-auto pb-3'>
            {!isArchiveView && !query && tab === 'all' && archivedCount > 0 && (
              <button type='button' onClick={() => setShowArchived(true)}
                className='flex items-center gap-3 w-[calc(100%-1rem)] mx-2 mb-1 px-3 h-12 rounded-[20px] text-left text-sm font-semibold text-muted transition-colors hover:bg-raised hover:text-ink'>
                <span className='grid place-items-center w-12 shrink-0'><Archive size={20} weight='duotone' /></span>
                <span className='flex-1'>Archived</span>
                <span className='text-xs font-bold tabular-nums'>{archivedCount}</span>
              </button>
            )}

            {isLoadingChats ? <SkeletonRows /> : visibleChats.length === 0 ? (
              <p className='px-6 py-8 text-sm text-muted'>{emptyText}</p>
            ) : (
              <ul className='px-2'>
                {visibleChats.map((chat) => {
                  const isSelected = selectedChat?._id === chat._id;
                  const unseen = unseenMessages[chat._id] || 0;
                  const last = lastMessages[chat._id];
                  const isPinned = chatPrefs.pinned.has(chat._id);
                  const isMuted = chatPrefs.muted.has(chat._id);
                  const isArchived = chatPrefs.archived.has(chat._id);
                  const isMenuOpen = menu?.id === chat._id;
                  return (
                    // `layout` slides a conversation to its new place when it jumps to the top
                    <motion.li key={chat._id} layout='position' transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                      data-chat={chat.fullName} className={`group/row relative ${isMenuOpen ? 'z-20' : ''}`}>
                      <button type='button' onClick={()=>selectChat(chat)} onContextMenu={openMenu(chat)} aria-current={isSelected ? 'true' : undefined}
                        className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-[20px] text-left transition-colors duration-150 ${isSelected ? '' : 'hover:bg-raised'}`}>
                        {isSelected && (
                          <motion.span layoutId='active-chat' transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                            className='absolute inset-0 rounded-[20px] grad-soft border border-line-strong' />
                        )}
                        <Avatar user={chat} group={chat.isGroup} online={!chat.isGroup && onlineUsers.includes(chat._id)} className='relative' />
                        <div className='relative flex-1 min-w-0'>
                          <div className='flex items-baseline justify-between gap-2'>
                            <p className={`truncate text-[15px] ${unseen ? 'font-bold' : 'font-semibold'}`}>{chat.fullName}</p>
                            {last && (
                              <time className={`shrink-0 text-[11px] font-medium tabular-nums ${unseen && !isMuted ? 'text-accent-text' : 'text-faint'}`}>
                                {formatListTime(last.createdAt)}
                              </time>
                            )}
                          </div>
                          <div className='flex items-center justify-between gap-1.5 mt-0.5'>
                            <p className={`truncate text-[13px] ${unseen ? 'font-medium text-ink' : 'text-muted'}`}>{getPreview(chat)}</p>
                            <span className='flex items-center gap-1.5 shrink-0 text-faint'>
                              {isMuted && <BellSlash size={14} weight='fill' aria-label='Muted' data-muted />}
                              {isPinned && <PushPin size={14} weight='fill' aria-label='Pinned' data-pinned />}
                              {unseen > 0 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                                  data-unread className={`min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold tabular-nums ${isMuted ? 'bg-hover text-muted' : 'grad glow text-white'}`}>
                                  {unseen > 99 ? '99+' : unseen}
                                </motion.span>
                              )}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* pin, mute and archive: this button on hover, or a right click on the row */}
                      <div data-chat-menu className='absolute right-2 top-2'>
                        <button type='button' aria-label={`Options for ${chat.fullName}`} aria-expanded={isMenuOpen} onClick={openMenu(chat)}
                          className={`grid place-items-center w-7 h-7 rounded-full bg-panel-solid border border-line-strong text-muted shadow-md transition-opacity hover:text-ink
                            ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'}`}>
                          <CaretDown size={13} weight='bold' />
                        </button>
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div role='menu' aria-label={`Options for ${chat.fullName}`}
                              initial={{ opacity: 0, scale: 0.9, y: menu.above ? 6 : -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 560, damping: 32 }}
                              className={`absolute right-0 z-30 w-44 p-1.5 rounded-2xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40 ${menu.above ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'}`}>
                              <button type='button' role='menuitem' onClick={togglePref(chat, 'pinned')} className={menuItemClass}>
                                {isPinned ? <><PushPinSlash size={17} weight='duotone' /> Unpin</> : <><PushPin size={17} weight='duotone' /> Pin to top</>}
                              </button>
                              <button type='button' role='menuitem' onClick={togglePref(chat, 'muted')} className={menuItemClass}>
                                {isMuted ? <><BellSimple size={17} weight='duotone' /> Unmute</> : <><BellSlash size={17} weight='duotone' /> Mute</>}
                              </button>
                              <button type='button' role='menuitem' onClick={togglePref(chat, 'archived')} className={menuItemClass}>
                                <Archive size={17} weight='duotone' /> {isArchived ? 'Unarchive' : 'Archive'}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
        </div>

        <AnimatePresence>
          {isCreatingGroup && <CreateGroupModal key='create-group' onClose={() => setIsCreatingGroup(false)} />}
        </AnimatePresence>
    </aside>
  )
}

export default Sidebar
