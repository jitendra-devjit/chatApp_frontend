import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Archive, BellSimple, BellSlash, CalendarBlank, Crown, DotsThree, Images, PencilSimple, PushPin, PushPinSlash,
  Quotes, SignOut, UserMinus, UserPlus, UsersThree, X,
} from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext';
import { AuthContext } from '../context/AuthContext';
import { formatJoined, formatLastSeen } from '../lib/utils';
import Avatar from './Avatar';
import { AddMembersModal, EditGroupModal } from './GroupModals';
import IconButton from './IconButton';
import { ConfirmDialog } from './Modal';

const menuItemClass = 'flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-hover'

const Section = ({ icon, title, count, action, children }) => (
  <div className='p-4 rounded-3xl bg-raised border border-line'>
    <div className='flex items-center justify-between text-muted'>
      <p className='flex items-center gap-2 text-xs font-bold uppercase tracking-wider'>
        {icon} {title} {count !== undefined && <span className='tabular-nums text-faint'>{count}</span>}
      </p>
      {action}
    </div>
    <div className='mt-3'>{children}</div>
  </div>
)

// one of the three round buttons under the name: pin, mute, archive
const QuickAction = ({ icon, label, active, onClick }) => (
  <motion.button type='button' onClick={onClick} whileTap={{ scale: 0.94 }} aria-pressed={active}
    className={`flex flex-col items-center gap-1.5 flex-1 py-2.5 rounded-2xl border text-xs font-bold transition-colors
      ${active ? 'grad-soft border-line-strong text-accent-text' : 'bg-raised border-line text-muted hover:text-ink hover:bg-hover'}`}>
    {icon}
    {label}
  </motion.button>
)

// Details of the open chat: a person's profile, or a group with its members.
// A column on wide screens, a drawer on smaller ones. Render inside <AnimatePresence>
const RightSidebar = ({ onClose, onOpenImage }) => {

  const { selectedChat, messages, chatPrefs, setChatPref, removeGroupMember, setGroupMemberRole } = useContext(ChatContext)

  const { authUser, onlineUsers } = useContext(AuthContext);

  const [dialog, setDialog] = useState(null); // 'add' | 'edit' | 'leave' | { remove: member }
  const [memberMenu, setMemberMenu] = useState(null); // id of the member whose menu is open

  //Get all the images from the messages, newest first
  const msgImages = useMemo(
    () => messages.filter(msg => msg.image).map(msg => ({ id: msg._id, url: msg.image })).reverse(),
    [messages]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      // only the drawer closes on Escape, the wide-screen column stays
      if (e.key === 'Escape' && !dialog && !window.matchMedia('(min-width: 80rem)').matches) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, dialog]);

  // a member menu closes on a click elsewhere and on Escape
  useEffect(() => {
    if (!memberMenu) return;
    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-member-menu]')) setMemberMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMemberMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [memberMenu]);

  if (!selectedChat) return null;

  const chatId = selectedChat._id;
  const isGroup = Boolean(selectedChat.isGroup);
  const isOnline = !isGroup && onlineUsers.includes(chatId);
  const joined = formatJoined(selectedChat.createdAt);

  // me first, then admins, then everybody else by name
  const members = isGroup
    ? [...selectedChat.members].sort((a, b) =>
        (b.user._id === authUser._id) - (a.user._id === authUser._id) ||
        (b.role === 'admin') - (a.role === 'admin') ||
        a.user.fullName.localeCompare(b.user.fullName))
    : [];
  const amAdmin = members.some((member) => member.user._id === authUser._id && member.role === 'admin');

  const isPinned = chatPrefs.pinned.has(chatId);
  const isMuted = chatPrefs.muted.has(chatId);
  const isArchived = chatPrefs.archived.has(chatId);

  const closeDialog = () => setDialog(null);

  const changeRole = (member, role) => () => {
    setMemberMenu(null);
    setGroupMemberRole(chatId, member.user._id, role);
  };

  const confirmRemove = async () => {
    const userId = dialog.remove.user._id;
    closeDialog();
    await removeGroupMember(chatId, userId);
  };

  const confirmLeave = async () => {
    closeDialog();
    await removeGroupMember(chatId, authUser._id);
  };

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className='fixed inset-0 z-30 bg-overlay backdrop-blur-sm xl:hidden' />
      <motion.aside aria-label={`${isGroup ? 'Group' : 'Profile of'} ${selectedChat.fullName}`}
        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className='glass fixed inset-y-0 right-0 z-40 w-[min(360px,100%)] flex flex-col min-h-0 overflow-hidden
          max-xl:rounded-l-[28px] max-xl:bg-panel-solid xl:static xl:z-auto xl:w-[340px] xl:shrink-0 xl:rounded-[28px]'>
        {/* accent glow behind the avatar */}
        <div className='pointer-events-none absolute inset-x-0 top-0 h-44 grad opacity-25 [mask-image:linear-gradient(black,transparent)]' />

        <div className='relative flex items-center justify-between h-16 px-4 shrink-0'>
          <span className='pl-2 text-[15px] font-bold'>{isGroup ? 'Group info' : 'Profile'}</span>
          <div className='flex'>
            {isGroup && amAdmin && (
              <IconButton label='Edit group' onClick={() => setDialog('edit')}>
                <PencilSimple size={19} weight='duotone' />
              </IconButton>
            )}
            <IconButton label='Close details' onClick={onClose}>
              <X size={19} weight='bold' />
            </IconButton>
          </div>
        </div>

        <div className='relative flex-1 min-h-0 overflow-y-auto px-4 pb-4'>
          <div className='flex flex-col items-center pt-2 pb-5 text-center'>
            <motion.button type='button' whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => onOpenImage({ src: selectedChat.profilePic || null, user: selectedChat, title: selectedChat.fullName })}
              aria-label='View photo' className='rounded-full'>
              <Avatar user={selectedChat} size='xl' ring online={isOnline} />
            </motion.button>
            <h2 className='mt-4 text-[22px] font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere]'>
              {selectedChat.fullName}
            </h2>
            <p className={`mt-1 text-sm font-semibold ${isOnline ? 'text-online' : 'text-faint'}`}>
              {isGroup ? `Group · ${members.length} members` : isOnline ? 'Online' : formatLastSeen(selectedChat.lastSeen)}
            </p>
          </div>

          <div className='flex gap-2 mb-3'>
            <QuickAction label={isPinned ? 'Pinned' : 'Pin'} active={isPinned} onClick={() => setChatPref(chatId, { pinned: !isPinned })}
              icon={isPinned ? <PushPinSlash size={20} weight='duotone' /> : <PushPin size={20} weight='duotone' />} />
            <QuickAction label={isMuted ? 'Muted' : 'Mute'} active={isMuted} onClick={() => setChatPref(chatId, { muted: !isMuted })}
              icon={isMuted ? <BellSlash size={20} weight='duotone' /> : <BellSimple size={20} weight='duotone' />} />
            <QuickAction label={isArchived ? 'Archived' : 'Archive'} active={isArchived} onClick={() => setChatPref(chatId, { archived: !isArchived })}
              icon={<Archive size={20} weight='duotone' />} />
          </div>

          <div className='flex flex-col gap-3'>
            {selectedChat.bio && (
              <Section icon={<Quotes size={15} weight='fill' />} title={isGroup ? 'Description' : 'About'}>
                <p className='text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]'>{selectedChat.bio}</p>
              </Section>
            )}

            {isGroup && (
              <Section icon={<UsersThree size={15} weight='fill' />} title='Members' count={members.length}
                action={amAdmin && (
                  <button type='button' onClick={() => setDialog('add')}
                    className='flex items-center gap-1.5 h-7 px-2.5 -my-1 rounded-full grad-soft text-xs font-bold text-accent-text hover:brightness-110'>
                    <UserPlus size={14} weight='bold' /> Add
                  </button>
                )}>
                <ul className='-mx-1.5'>
                  {members.map((member) => {
                    const { user } = member;
                    const isMe = user._id === authUser._id;
                    const isMenuOpen = memberMenu === user._id;
                    return (
                      <li key={user._id} data-member={user.fullName} className={`relative flex items-center gap-3 px-1.5 py-1.5 rounded-2xl ${isMenuOpen ? 'z-20 bg-hover' : ''}`}>
                        <Avatar user={user} size='sm' online={!isMe && onlineUsers.includes(user._id)} />
                        <div className='min-w-0 flex-1 leading-tight'>
                          <p className='truncate text-sm font-semibold'>{isMe ? 'You' : user.fullName}</p>
                          {user.bio && <p className='truncate text-xs text-muted'>{user.bio}</p>}
                        </div>
                        {member.role === 'admin' && (
                          <span data-admin className='flex items-center gap-1 h-5 px-2 shrink-0 rounded-full grad-soft text-[10px] font-bold uppercase tracking-wide text-accent-text'>
                            <Crown size={11} weight='fill' /> Admin
                          </span>
                        )}
                        {amAdmin && !isMe && (
                          <div data-member-menu className='relative shrink-0'>
                            <button type='button' aria-label={`Options for ${user.fullName}`} aria-expanded={isMenuOpen}
                              onClick={() => setMemberMenu(isMenuOpen ? null : user._id)}
                              className='grid place-items-center w-7 h-7 rounded-full text-muted hover:bg-hover hover:text-ink'>
                              <DotsThree size={20} weight='bold' />
                            </button>
                            <AnimatePresence>
                              {isMenuOpen && (
                                <motion.div role='menu' initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
                                  transition={{ type: 'spring', stiffness: 560, damping: 32 }}
                                  className='absolute right-0 top-full mt-1 z-30 w-48 p-1.5 origin-top-right rounded-2xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40'>
                                  {member.role === 'admin' ? (
                                    <button type='button' role='menuitem' onClick={changeRole(member, 'member')} className={menuItemClass}>
                                      <Crown size={17} weight='duotone' /> Remove as admin
                                    </button>
                                  ) : (
                                    <button type='button' role='menuitem' onClick={changeRole(member, 'admin')} className={menuItemClass}>
                                      <Crown size={17} weight='duotone' /> Make admin
                                    </button>
                                  )}
                                  <button type='button' role='menuitem' onClick={() => { setMemberMenu(null); setDialog({ remove: member }) }} className={`${menuItemClass} text-danger`}>
                                    <UserMinus size={17} weight='duotone' /> Remove from group
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            <Section icon={<Images size={15} weight='fill' />} title='Shared media' count={msgImages.length}>
              {msgImages.length === 0 ? (
                <p className='text-sm text-muted'>Photos sent in this chat will show up here.</p>
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

            {isGroup && (
              <button type='button' onClick={() => setDialog('leave')}
                className='flex items-center justify-center gap-2 h-12 rounded-2xl border border-line text-sm font-bold text-danger transition-colors hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]'>
                <SignOut size={18} weight='duotone' /> Leave group
              </button>
            )}

            {joined && (
              <p className='flex items-center justify-center gap-2 pt-2 text-xs font-medium text-faint'>
                <CalendarBlank size={14} weight='fill' /> {isGroup ? 'Created' : 'Joined'} {joined}
              </p>
            )}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {dialog === 'add' && <AddMembersModal key='add' group={selectedChat} onClose={closeDialog} />}
        {dialog === 'edit' && <EditGroupModal key='edit' group={selectedChat} onClose={closeDialog} />}
        {dialog === 'leave' && (
          <ConfirmDialog key='leave' danger icon={<SignOut size={26} weight='duotone' />}
            title={`Leave ${selectedChat.fullName}?`} text='You will stop getting its messages. An admin can add you back later.'
            confirmLabel='Leave' onConfirm={confirmLeave} onCancel={closeDialog} />
        )}
        {dialog?.remove && (
          <ConfirmDialog key='remove' danger icon={<UserMinus size={26} weight='duotone' />}
            title={`Remove ${dialog.remove.user.fullName.split(' ')[0]}?`} text='They will no longer see new messages in this group.'
            confirmLabel='Remove' onConfirm={confirmRemove} onCancel={closeDialog} />
        )}
      </AnimatePresence>
    </>
  )
}

export default RightSidebar
