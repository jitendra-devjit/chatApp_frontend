import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GearSix, Image as ImageIcon, MagnifyingGlass, Moon, SignOut, Sun, X } from '@phosphor-icons/react';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { ThemeContext } from '../context/ThemeContext';
import { formatListTime } from '../lib/utils';
import Avatar from './Avatar';
import IconButton from './IconButton';
import Logo from './Logo';

const isTypingTarget = (element) =>
  element instanceof HTMLElement &&
  (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);

const SkeletonRows = () => (
  <div className='px-2' aria-hidden='true'>
    {[72, 56, 64, 48, 60].map((width, index) => (
      <div key={index} className='flex items-center gap-3 px-3 py-2.5'>
        <div className='skeleton w-11 h-11 rounded-[14px]' />
        <div className='flex-1 space-y-2'>
          <div className='skeleton h-3 rounded-full' style={{ width: `${width}%` }} />
          <div className='skeleton h-2.5 rounded-full w-4/5 opacity-60' />
        </div>
      </div>
    ))}
  </div>
)

const Sidebar = () => {

  const {users, isLoadingUsers, selectedUser, selectUser, unseenMessages, lastMessages} = useContext(ChatContext);

  const {authUser, logout, onlineUsers} = useContext(AuthContext);

  const {theme, toggleTheme} = useContext(ThemeContext);

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

  const getPreview = (user) => {
    const last = lastMessages[user._id];
    if (!last) return <span className='italic'>{user.bio || 'Say hello'}</span>;
    const mine = last.senderId === authUser._id;
    return (
      <>
        {mine && <span className='text-faint'>You: </span>}
        {last.hasImage && <ImageIcon size={14} weight='fill' className='inline -mt-0.5 mr-1' />}
        {last.text || 'Photo'}
      </>
    );
  };

  return (
    <aside className={`flex flex-col h-full min-h-0 bg-surface border-r border-line ${selectedUser ? "max-md:hidden" : ''}`} >
        <div className='flex items-center justify-between h-16 px-5 shrink-0'>
            <Logo />
            <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
        </div>

        <div className='px-4 pb-3 shrink-0'>
            <div className='group flex items-center gap-2.5 h-10 px-3 rounded-xl bg-raised border border-line transition-colors focus-within:border-line-strong'>
              <MagnifyingGlass size={16} className='text-faint shrink-0'/>
              <input ref={searchRef} value={input} onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key === 'Escape'){ setInput(""); e.currentTarget.blur(); } }}
                type="text" aria-label='Search people' placeholder="Search people"
                className='flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-faint'/>
              {input ? (
                <button type='button' aria-label='Clear search' onClick={()=>{ setInput(""); searchRef.current?.focus(); }}
                  className='text-faint hover:text-ink'>
                  <X size={14} weight='bold' />
                </button>
              ) : (
                <kbd className='font-mono text-[11px] text-faint border border-line rounded-md px-1.5 py-px group-focus-within:hidden max-md:hidden'>/</kbd>
              )}
            </div>
        </div>

        <div className='flex items-center justify-between px-5 pt-2 pb-2 shrink-0 text-faint'>
          <span className='label-mono'>{query ? 'Results' : 'Messages'}</span>
          {!isLoadingUsers && <span className='label-mono'>{String(filteredUsers.length).padStart(2, '0')}</span>}
        </div>

        <div className='flex-1 min-h-0 overflow-y-auto pb-3'>
            {isLoadingUsers ? <SkeletonRows /> : filteredUsers.length === 0 ? (
              <p className='px-5 py-8 text-sm text-muted'>
                {query
                  ? <>Nobody called <span className='text-ink'>“{input.trim()}”</span> here.</>
                  : 'Nobody else has joined yet. Invite a friend to start talking.'}
              </p>
            ) : (
              <ul className='px-2'>
                {filteredUsers.map((user) => {
                  const isSelected = selectedUser?._id === user._id;
                  const unseen = unseenMessages[user._id] || 0;
                  const last = lastMessages[user._id];
                  return (
                    <li key={user._id}>
                      <button type='button' onClick={()=>selectUser(user)} aria-current={isSelected ? 'true' : undefined}
                        className={`relative flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-left transition-colors duration-150 ${isSelected ? 'bg-raised' : 'hover:bg-hover/60'}`}>
                        {isSelected && <span className='absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-accent' />}
                        <Avatar user={user} online={onlineUsers.includes(user._id)} />
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-baseline justify-between gap-2'>
                            <p className={`truncate text-[15px] ${unseen ? 'font-semibold' : 'font-medium'}`}>{user.fullName}</p>
                            {last && (
                              <time className={`shrink-0 font-mono text-[11px] ${unseen ? 'text-accent-text' : 'text-faint'}`}>
                                {formatListTime(last.createdAt)}
                              </time>
                            )}
                          </div>
                          <div className='flex items-center justify-between gap-2 mt-0.5'>
                            <p className={`truncate text-[13px] ${unseen ? 'text-ink' : 'text-muted'}`}>{getPreview(user)}</p>
                            {unseen > 0 && (
                              <span className='shrink-0 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-accent text-accent-ink font-mono text-[11px] font-semibold'>
                                {unseen > 99 ? '99+' : unseen}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>

        <div className='flex items-center gap-3 px-4 py-3 border-t border-line shrink-0'>
          <Avatar user={authUser} size='sm' />
          <div className='flex-1 min-w-0 leading-tight'>
            <p className='truncate text-sm font-medium'>{authUser.fullName}</p>
            <p className='truncate text-xs text-faint'>{authUser.email}</p>
          </div>
          <IconButton label='Edit profile' onClick={()=>navigate('/profile')}>
            <GearSix size={18} />
          </IconButton>
          <IconButton label='Log out' onClick={logout}>
            <SignOut size={18} />
          </IconButton>
        </div>
    </aside>
  )
}

export default Sidebar
