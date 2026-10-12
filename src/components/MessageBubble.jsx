import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowBendUpLeft, Check, Checks, Copy, DotsThree, Image as ImageIcon, PencilSimple, Prohibit, Smiley, Trash } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { EDIT_WINDOW_MS, formatMessageTime, getNameColor, isEmojiOnly, QUICK_REACTIONS } from '../lib/utils'
import Avatar from './Avatar'

const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
const popSpring = { type: 'spring', stiffness: 560, damping: 30 };

const actionClass = 'grid place-items-center w-8 h-8 rounded-full text-muted transition-colors hover:bg-hover hover:text-ink'
const menuItemClass = 'flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-sm font-semibold text-left transition-colors hover:bg-hover'

// [{ emoji, count, mine }] in the order the emoji first appeared
const groupReactions = (reactions = [], myId) => {
  const groups = new Map();
  for (const { emoji, userId } of reactions) {
    const group = groups.get(emoji) || { emoji, count: 0, mine: false };
    group.count += 1;
    if (userId === myId) group.mine = true;
    groups.set(emoji, group);
  }
  return [...groups.values()];
};

// One message with its quote, reactions, time and the actions that appear on hover (or on tap on a phone).
// `openMenu` is { id, type, below } of the popover that is open anywhere in the list, type is
// 'actions' (phone tap), 'react' or 'more'.
// In a group, `sender` is given for other people's messages: their name and picture are shown.
// `getName(userId)` gives the first name to show for the author of a quoted message
const MessageBubble = ({
  msg, isOwn, isGroupStart, isGroupEnd, isNewDay, isFresh, isHighlighted, seen,
  myId, sender, getName, openMenu, setOpenMenu,
  onReply, onEdit, onDelete, onReact, onOpenImage, onJumpTo, onImageLoad,
}) => {
  const isDeleted = Boolean(msg.deletedAt);
  const emojiOnly = !isDeleted && !msg.image && !msg.replyTo && isEmojiOnly(msg.text);
  const canEdit = isOwn && !isDeleted && Boolean(msg.text) && Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS;
  const menu = openMenu?.id === msg._id ? openMenu : null;
  const reactions = groupReactions(msg.reactions, myId);

  // the side a bubble hangs from is tighter, so a block reads as one shape
  const corners = isOwn
    ? `${isGroupStart ? '' : 'rounded-tr-lg'} ${isGroupEnd ? 'rounded-br-md' : 'rounded-br-lg'}`
    : `${isGroupStart ? '' : 'rounded-tl-lg'} ${isGroupEnd ? 'rounded-bl-md' : 'rounded-bl-lg'}`;

  // a popover opens upwards, unless the message is too close to the top of the screen
  const toggleMenu = (type) => (e) => {
    const below = e.currentTarget.getBoundingClientRect().top < 260;
    setOpenMenu(menu?.type === type ? null : { id: msg._id, type, below });
  };

  // phones have no hover: a tap on the bubble shows the actions
  const handleBubbleTap = () => {
    if (isDeleted || !window.matchMedia('(hover: none)').matches) return;
    setOpenMenu(menu ? null : { id: msg._id, type: 'actions' });
  };

  const run = (action) => () => {
    setOpenMenu(null);
    action();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const popoverSide = `${menu?.below ? 'top-full mt-1' : 'bottom-full mb-1'} ${isOwn ? 'right-0' : 'left-0'}`;
  const popoverOrigin = `${menu?.below ? 'origin-top' : 'origin-bottom'}${isOwn ? '-right' : '-left'}`;

  const replyAuthor = msg.replyTo && (msg.replyTo.senderId === myId ? 'You' : getName(msg.replyTo.senderId));
  // other people's messages in a group leave room on the left for the sender's picture
  const indent = sender ? 'ml-9' : '';

  return (
    <motion.div
      id={`msg-${msg._id}`}
      data-message={msg._id}
      initial={isFresh ? { opacity: 0, y: 14, scale: 0.94 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={bubbleSpring}
      className={`group/msg flex flex-col w-full ${isOwn ? 'items-end origin-bottom-right' : 'items-start origin-bottom-left'} ${isGroupStart && !isNewDay ? 'mt-3' : 'mt-[3px]'} ${menu ? 'relative z-20' : ''}`}>
      {sender && isGroupStart && (
        <p data-sender className='ml-10 mb-0.5 text-xs font-bold' style={{ color: getNameColor(sender.fullName) }}>{sender.fullName}</p>
      )}
      <div className={`flex items-center gap-1 w-full ${isOwn ? 'flex-row-reverse' : ''}`}>
        {sender && (
          <div className='w-7 shrink-0 self-end mr-1'>{isGroupEnd && <Avatar user={sender} size='xs' />}</div>
        )}
        <div onClick={handleBubbleTap}
          className={`flex flex-col min-w-0 max-w-[80%] sm:max-w-[66%] rounded-[24px] transition-shadow duration-500 ${isOwn ? 'items-end' : 'items-start'} ${isHighlighted ? 'shadow-[0_0_0_3px_var(--accent-text)]' : ''}`}>
          {msg.image && !isDeleted && (
            <button type='button' onClick={(e) => { e.stopPropagation(); onOpenImage(msg.image) }} aria-label='Open image'
              className={`block overflow-hidden rounded-[22px] ${corners} border border-line bg-raised`}>
              <img src={msg.image} alt="Shared image" onLoad={onImageLoad}
                className='block max-w-full max-h-80 min-h-24 min-w-24 object-cover transition-transform duration-300 hover:scale-[1.03]' />
            </button>
          )}

          {isDeleted ? (
            <p data-deleted className={`flex items-center gap-2 px-4 py-2.5 rounded-[22px] ${corners} border border-dashed border-line-strong text-sm italic text-muted`}>
              <Prohibit size={16} /> {isOwn ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : emojiOnly ? (
            <p data-emoji-only className='text-[46px] leading-tight py-1'>{msg.text}</p>
          ) : (msg.text || msg.replyTo) && (
            <div data-bubble className={`px-4 py-2.5 rounded-[22px] ${corners} text-[15px] leading-[1.4] ${msg.image ? 'mt-[3px]' : ''}
              ${isOwn ? 'grad text-white shadow-lg shadow-[color-mix(in_oklab,var(--a2)_35%,transparent)]' : 'bg-bubble text-ink border border-line'}`}>
              {msg.replyTo && (
                <button type='button' data-quote onClick={(e) => { e.stopPropagation(); onJumpTo(msg.replyTo._id) }}
                  className={`flex items-center gap-2 w-full min-w-40 mb-1.5 px-2.5 py-1.5 rounded-xl border-l-[3px] text-left text-[13px] leading-snug
                    ${isOwn ? 'bg-white/20 border-white/80' : 'bg-raised border-accent-text'}`}>
                  <span className='min-w-0 flex-1'>
                    <span className={`block font-bold ${isOwn ? 'text-white' : 'text-accent-text'}`}>{replyAuthor}</span>
                    <span className={`block truncate ${isOwn ? 'text-white/85' : 'text-muted'}`}>
                      {msg.replyTo.deletedAt ? 'Deleted message' : (
                        <>{msg.replyTo.image && <ImageIcon size={13} weight='fill' className='inline -mt-0.5 mr-1' />}{msg.replyTo.text || 'Photo'}</>
                      )}
                    </span>
                  </span>
                  {msg.replyTo.image && !msg.replyTo.deletedAt && (
                    <img src={msg.replyTo.image} alt="" className='w-9 h-9 shrink-0 rounded-lg object-cover' />
                  )}
                </button>
              )}
              {msg.text && <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{msg.text}</p>}
            </div>
          )}
        </div>

        {/* ---- actions: shown on hover, or after a tap on a phone ---- */}
        {!isDeleted && (
          <div data-menu-root className={`relative flex items-center shrink-0 transition-opacity duration-150 ${isOwn ? 'flex-row-reverse' : ''}
            ${menu ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto'}`}>
            <button type='button' aria-label='React' title='React' onClick={toggleMenu('react')} className={actionClass}>
              <Smiley size={19} weight={menu?.type === 'react' ? 'fill' : 'regular'} />
            </button>
            <button type='button' aria-label='Reply' title='Reply' onClick={run(() => onReply(msg))} className={actionClass}>
              <ArrowBendUpLeft size={18} weight='bold' />
            </button>
            <button type='button' aria-label='More' title='More' onClick={toggleMenu('more')} className={actionClass}>
              <DotsThree size={22} weight='bold' />
            </button>

            <AnimatePresence>
              {menu?.type === 'react' && (
                <motion.div key='react' role='menu' aria-label='Reactions'
                  initial={{ opacity: 0, scale: 0.7, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={popSpring}
                  className={`absolute z-30 flex gap-0.5 p-1.5 rounded-full bg-panel-solid border border-line-strong shadow-2xl shadow-black/40 ${popoverSide} ${popoverOrigin}`}>
                  {QUICK_REACTIONS.map((emoji, index) => (
                    <motion.button key={emoji} type='button' role='menuitem' aria-label={`React with ${emoji}`}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...popSpring, delay: index * 0.025 }}
                      whileHover={{ scale: 1.3, y: -3 }} whileTap={{ scale: 0.9 }}
                      onClick={run(() => onReact(msg, emoji))}
                      className='grid place-items-center w-9 h-9 rounded-full text-[22px] leading-none'>
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
              {menu?.type === 'more' && (
                <motion.div key='more' role='menu' aria-label='Message options'
                  initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={popSpring}
                  className={`absolute z-30 w-44 p-1.5 rounded-2xl bg-panel-solid border border-line-strong shadow-2xl shadow-black/40 ${popoverSide} ${popoverOrigin}`}>
                  {msg.text && (
                    <button type='button' role='menuitem' onClick={run(copyText)} className={menuItemClass}>
                      <Copy size={17} weight='duotone' /> Copy text
                    </button>
                  )}
                  {canEdit && (
                    <button type='button' role='menuitem' onClick={run(() => onEdit(msg))} className={menuItemClass}>
                      <PencilSimple size={17} weight='duotone' /> Edit
                    </button>
                  )}
                  {isOwn && (
                    <button type='button' role='menuitem' onClick={run(() => onDelete(msg))} className={`${menuItemClass} text-danger`}>
                      <Trash size={17} weight='duotone' /> Delete for everyone
                    </button>
                  )}
                  {!msg.text && !isOwn && <p className='px-3 py-2 text-sm text-muted'>No options</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {reactions.length > 0 && (
        <div className={`relative z-10 flex flex-wrap gap-1 -mt-1.5 px-2 ${indent} ${isOwn ? 'justify-end' : ''}`}>
          {reactions.map(({ emoji, count, mine }) => (
            <motion.button key={emoji} type='button' data-reaction onClick={() => onReact(msg, emoji)}
              initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.85 }} transition={popSpring}
              aria-label={`${emoji} ${count}${mine ? ', you reacted' : ''}`} aria-pressed={mine}
              className={`flex items-center gap-1 h-6 px-1.5 rounded-full bg-panel-solid border text-[13px] leading-none shadow-sm ${mine ? 'border-accent-text' : 'border-line-strong'}`}>
              {emoji}
              {count > 1 && <span className='text-[11px] font-bold tabular-nums text-muted'>{count}</span>}
            </motion.button>
          ))}
        </div>
      )}

      {isGroupEnd && (
        <span className={`mt-1 px-1.5 flex items-center gap-1 text-[11px] font-medium tabular-nums text-faint ${indent}`}>
          {msg.editedAt && !isDeleted && <span data-edited>edited ·</span>}
          <time>{formatMessageTime(msg.createdAt)}</time>
          {isOwn && !isDeleted && (seen
            ? <Checks size={15} weight='bold' className='text-accent-text' data-seen aria-label='Seen' />
            : <Check size={14} weight='bold' aria-label='Sent' />)}
        </span>
      )}
    </motion.div>
  )
}

export default MessageBubble
