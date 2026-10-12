import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Checks, Image as ImageIcon, MagnifyingGlass, Prohibit, SignOut, X } from '@phosphor-icons/react';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { formatListTime } from '../lib/utils';
import AppearanceMenu from './AppearanceMenu';
import Avatar from './Avatar';
import IconButton from './IconButton';
import Logo from './Logo';
import NotificationToggle from './NotificationToggle';
import TypingDots from './TypingDots';

const isTypingTarget = (element) =>
  element instanceof HTMLElement &&
  (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);

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

  const {users, isLoadingUsers, selectedUser, selectUser, unseenMessages, lastMessages, typingUsers} = useContext(ChatContext);

  const {authUser, logout, onlineUsers} = useContext(AuthContext);

  const [input, setInput] = useState("");

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

  // newest conversation first, people never talked to after that by name
  const sortedUsers = useMemo(() => {
    const time = (user) => new Date(lastMessages[user._id]?.createdAt || 0).getTime();
    return [...users].sort((a, b) => time(b) - time(a) || a.fullName.localeCompare(b.fullName));
  }, [users, lastMessages]);

  const query = input.trim().toLowerCase();
  const filteredUsers = query
    ? sortedUsers.filter((user) => user.fullName?.toLowerCase().includes(query))
    : sortedUsers;

  const onlineCount = users.filter((user) => onlineUsers.includes(user._id)).length;

  const getPreview = (user) => {
    if (typingUsers[user._id]) {
      return <span className='inline-flex items-center gap-1.5 font-semibold text-accent-text'>typing <TypingDots /></span>;
    }
    const last = lastMessages[user._id];
    if (!last) return user.bio || 'Say hello 👋';
    const mine = last.senderId === authUser._id;
    if (last.deleted) {
      return <span className='italic'><Prohibit size={14} className='inline -mt-0.5 mr-1' />{mine ? 'You deleted this message' : 'This message was deleted'}</span>;
    }
    return (
      <>
        {mine && (last.seen
          ? <Checks size={16} weight='bold' className='inline -mt-0.5 mr-1 text-accent-text' />
          : <Check size={15} weight='bold' className='inline -mt-0.5 mr-1' />)}
        {last.hasImage && <ImageIcon size={15} weight='fill' className='inline -mt-0.5 mr-1' />}
        {last.text || 'Photo'}
      </>
    );
  };

  return (
    <aside className={`glass flex flex-col min-h-0 w-full md:w-[340px] md:shrink-0 md:rounded-[28px] max-md:border-0 ${selectedUser ? "max-md:hidden" : ''}`} >
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

        <div className='flex items-end justify-between px-5 pt-5 pb-4 shrink-0'>
            <div>
              <h1 className='text-[26px] font-extrabold tracking-tight leading-none'>Chats</h1>
              <p className='mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted'>
                <span className='w-1.5 h-1.5 rounded-full bg-online' />
                {onlineCount} online now
              </p>
            </div>
        </div>

        <div className='px-4 pb-3 shrink-0'>
            <div className='group flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-raised border border-transparent transition-colors focus-within:border-accent-text focus-within:bg-transparent'>
              <MagnifyingGlass size={17} weight='bold' className='text-faint shrink-0 transition-colors group-focus-within:text-accent-text'/>
              <input ref={searchRef} value={input} onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key === 'Escape'){ setInput(""); e.currentTarget.blur(); } }}
                type="text" aria-label='Search people' placeholder="Search people"
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

        <div className='flex-1 min-h-0 overflow-y-auto pb-3'>
            {isLoadingUsers ? <SkeletonRows /> : filteredUsers.length === 0 ? (
              <p className='px-6 py-8 text-sm text-muted'>
                {query
                  ? <>Nobody called <span className='font-semibold text-ink'>“{input.trim()}”</span> here.</>
                  : 'Nobody else has joined yet. Invite a friend to start talking.'}
              </p>
            ) : (
              <ul className='px-2'>
                {filteredUsers.map((user) => {
                  const isSelected = selectedUser?._id === user._id;
                  const unseen = unseenMessages[user._id] || 0;
                  const last = lastMessages[user._id];
                  return (
                    // `layout` slides a conversation to its new place when it jumps to the top
                    <motion.li key={user._id} layout='position' transition={{ type: 'spring', stiffness: 480, damping: 40 }}>
                      <button type='button' onClick={()=>selectUser(user)} aria-current={isSelected ? 'true' : undefined}
                        className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-[20px] text-left transition-colors duration-150 ${isSelected ? '' : 'hover:bg-raised'}`}>
                        {isSelected && (
                          <motion.span layoutId='active-chat' transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                            className='absolute inset-0 rounded-[20px] grad-soft border border-line-strong' />
                        )}
                        <Avatar user={user} online={onlineUsers.includes(user._id)} className='relative' />
                        <div className='relative flex-1 min-w-0'>
                          <div className='flex items-baseline justify-between gap-2'>
                            <p className={`truncate text-[15px] ${unseen ? 'font-bold' : 'font-semibold'}`}>{user.fullName}</p>
                            {last && (
                              <time className={`shrink-0 text-[11px] font-medium tabular-nums ${unseen ? 'text-accent-text' : 'text-faint'}`}>
                                {formatListTime(last.createdAt)}
                              </time>
                            )}
                          </div>
                          <div className='flex items-center justify-between gap-2 mt-0.5'>
                            <p className={`truncate text-[13px] ${unseen ? 'font-medium text-ink' : 'text-muted'}`}>{getPreview(user)}</p>
                            {unseen > 0 && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                                data-unread className='grad glow shrink-0 min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-white text-[11px] font-bold tabular-nums'>
                                {unseen > 99 ? '99+' : unseen}
                              </motion.span>
                            )}
                          </div>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
        </div>
    </aside>
  )
}

export default Sidebar
