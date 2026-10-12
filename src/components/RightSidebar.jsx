import React, { useContext, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { CalendarBlank, Images, Quotes, X } from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext';
import { AuthContext } from '../context/AuthContext';
import { formatJoined, formatLastSeen } from '../lib/utils';
import Avatar from './Avatar';
import IconButton from './IconButton';

const Section = ({ icon, title, count, children }) => (
  <div className='p-4 rounded-3xl bg-raised border border-line'>
    <div className='flex items-center justify-between text-muted'>
      <p className='flex items-center gap-2 text-xs font-bold uppercase tracking-wider'>{icon} {title}</p>
      {count !== undefined && <span className='text-xs font-bold tabular-nums'>{count}</span>}
    </div>
    <div className='mt-3'>{children}</div>
  </div>
)

// Profile of the person in the open chat. A column on wide screens, a drawer on smaller ones.
// Render inside <AnimatePresence>
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
  const joined = formatJoined(selectedUser.createdAt);

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className='fixed inset-0 z-30 bg-overlay backdrop-blur-sm xl:hidden' />
      <motion.aside aria-label={`Profile of ${selectedUser.fullName}`}
        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className='glass fixed inset-y-0 right-0 z-40 w-[min(360px,100%)] flex flex-col min-h-0 overflow-hidden
          max-xl:rounded-l-[28px] max-xl:bg-panel-solid xl:static xl:z-auto xl:w-[340px] xl:shrink-0 xl:rounded-[28px]'>
        {/* accent glow behind the avatar */}
        <div className='pointer-events-none absolute inset-x-0 top-0 h-44 grad opacity-25 [mask-image:linear-gradient(black,transparent)]' />

        <div className='relative flex items-center justify-between h-16 px-4 shrink-0'>
          <span className='pl-2 text-[15px] font-bold'>Profile</span>
          <IconButton label='Close details' onClick={onClose}>
            <X size={19} weight='bold' />
          </IconButton>
        </div>

        <div className='relative flex-1 min-h-0 overflow-y-auto px-4 pb-4'>
          <div className='flex flex-col items-center pt-2 pb-6 text-center'>
            <motion.button type='button' whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => onOpenImage({ src: selectedUser.profilePic || null, user: selectedUser, title: selectedUser.fullName })}
              aria-label='View profile photo' className='rounded-full'>
              <Avatar user={selectedUser} size='xl' ring online={isOnline} />
            </motion.button>
            <h2 className='mt-4 text-[22px] font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere]'>
              {selectedUser.fullName}
            </h2>
            <p className={`mt-1 text-sm font-semibold ${isOnline ? 'text-online' : 'text-faint'}`}>
              {isOnline ? 'Online' : formatLastSeen(selectedUser.lastSeen)}
            </p>
          </div>

          <div className='flex flex-col gap-3'>
            {selectedUser.bio && (
              <Section icon={<Quotes size={15} weight='fill' />} title='About'>
                <p className='text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]'>{selectedUser.bio}</p>
              </Section>
            )}

            <Section icon={<Images size={15} weight='fill' />} title='Shared media' count={msgImages.length}>
              {msgImages.length === 0 ? (
                <p className='text-sm text-muted'>Photos you send each other will show up here.</p>
              ) : (
                <div className='grid grid-cols-3 gap-1.5'>
                  {msgImages.map(({ id, url })=>(
                    <motion.button type='button' key={id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={()=> onOpenImage({ src: url, title: 'Shared media' })} aria-label='Open image'
                      className='aspect-square overflow-hidden rounded-2xl bg-raised border border-line'>
                      <img src={url} alt="" loading='lazy' className='w-full h-full object-cover'/>
                    </motion.button>
                  ))}
                </div>
              )}
            </Section>

            {joined && (
              <p className='flex items-center justify-center gap-2 pt-2 text-xs font-medium text-faint'>
                <CalendarBlank size={14} weight='fill' /> Joined {joined}
              </p>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  )
}

export default RightSidebar
