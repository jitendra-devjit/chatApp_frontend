import React, { useContext, useEffect, useMemo } from 'react'
import { X } from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext';
import { AuthContext } from '../context/AuthContext';
import Avatar from './Avatar';
import IconButton from './IconButton';

// Details of the person in the open chat. A column on wide screens, a drawer on smaller ones
const RightSidebar = ({ onClose, onOpenImage }) => {

  const { selectedUser, messages } = useContext(ChatContext)

  const { onlineUsers } = useContext(AuthContext);

  //Get all the images from the messages, newest first
  const msgImages = useMemo(
    () => messages.filter(msg => msg.image).map(msg => ({ id: msg._id, url: msg.image })).reverse(),
    [messages]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      // only the drawer closes on Escape, the wide-screen column stays
      if (e.key === 'Escape' && !window.matchMedia('(min-width: 80rem)').matches) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);

  return (
    <>
      <div onClick={onClose} className='fixed inset-0 z-30 bg-overlay animate-fade-in xl:hidden' />
      <aside aria-label={`About ${selectedUser.fullName}`}
        className='fixed inset-y-0 right-0 z-40 w-[min(340px,100%)] flex flex-col min-h-0 bg-surface border-l border-line
          max-xl:animate-fade-in max-xl:shadow-2xl xl:static xl:z-auto xl:w-auto'>
        <div className='flex items-center justify-between h-16 px-5 shrink-0 border-b border-line'>
          <span className='label-mono text-faint'>Details</span>
          <IconButton label='Close details' onClick={onClose} className='-mr-2'>
            <X size={18} />
          </IconButton>
        </div>

        <div className='flex-1 min-h-0 overflow-y-auto'>
          <div className='px-6 pt-8 pb-7'>
            <Avatar user={selectedUser} size='lg' />
            <h2 className='mt-5 font-serif text-[34px] leading-[1.05] tracking-tight [overflow-wrap:anywhere]'>
              {selectedUser.fullName}
            </h2>
            <p className={`mt-2 flex items-center gap-2 text-sm ${isOnline ? 'text-accent-text' : 'text-faint'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-accent' : 'bg-faint'}`} />
              {isOnline ? 'Active now' : 'Offline'}
            </p>
          </div>

          {selectedUser.bio && (
            <div className='px-6 py-5 border-t border-line'>
              <p className='label-mono text-faint'>Bio</p>
              <p className='mt-2 text-[15px] text-ink/90 whitespace-pre-wrap [overflow-wrap:anywhere]'>{selectedUser.bio}</p>
            </div>
          )}

          <div className='px-6 py-5 border-t border-line'>
            <div className='flex items-center justify-between text-faint'>
              <p className='label-mono'>Shared media</p>
              <p className='label-mono'>{String(msgImages.length).padStart(2, '0')}</p>
            </div>
            {msgImages.length === 0 ? (
              <p className='mt-3 text-sm text-muted'>Photos you send each other will show up here.</p>
            ) : (
              <div className='mt-3 grid grid-cols-3 gap-1.5'>
                {msgImages.map(({ id, url })=>(
                  <button type='button' key={id} onClick={()=> onOpenImage(url)} aria-label='Open image'
                    className='aspect-square overflow-hidden rounded-xl bg-raised border border-line'>
                    <img src={url} alt="" loading='lazy' className='w-full h-full object-cover transition-transform duration-300 hover:scale-105'/>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default RightSidebar
