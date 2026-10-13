import React, { useRef } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { ArrowBendUpLeft, Check, Checks, Copy, DotsThree, Image as ImageIcon, Microphone, Paperclip, PencilSimple, Prohibit, Smiley, Trash, VideoCamera } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { describeAttachments, EDIT_WINDOW_MS, formatMessageTime, getNameColor, isEmojiOnly, QUICK_REACTIONS } from '../lib/utils'
import { FileCard, MediaGrid, VoicePlayer } from './Attachments'
import Avatar from './Avatar'

const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };
const popSpring = { type: 'spring', stiffness: 560, damping: 30 };

const ATTACHMENT_ICONS = { image: ImageIcon, video: VideoCamera, audio: Microphone, file: Paperclip };

// how far a message has to be dragged to the right to answer it, and how long a hold opens the sheet
const SWIPE_REPLY_PX = 56;
const LONG_PRESS_MS = 420;

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
// 'react' or 'more'.
// With `isTouch` there is no hover: a tap or a hold on the message calls `onOpenSheet(msg)`
// (see MessageSheet) and a swipe to the right answers it.
// In a group, `sender` is given for other people's messages: their name and picture are shown.
// `getName(userId)` gives the first name to show for the author of a quoted message
const MessageBubble = ({
  msg, isOwn, isGroupStart, isGroupEnd, isNewDay, isFresh, isHighlighted, seen,
  myId, sender, getName, openMenu, setOpenMenu, isTouch, onOpenSheet,
  onReply, onEdit, onDelete, onReact, onOpenImage, onJumpTo, onImageLoad,
}) => {
  const isDeleted = Boolean(msg.deletedAt);
  // the files of the message by how they are shown. A picture sent the old way counts as a photo
  const attachments = isDeleted ? [] : msg.attachments || [];
  const media = [
    ...(msg.image && !isDeleted ? [{ type: 'image', url: msg.image }] : []),
    ...attachments.filter((file) => file.type === 'image' || file.type === 'video'),
  ];
  const sounds = attachments.filter((file) => file.type === 'audio');
  const documents = attachments.filter((file) => file.type === 'file');
  const hasFiles = media.length + sounds.length + documents.length > 0;
  const emojiOnly = !isDeleted && !hasFiles && !msg.replyTo && isEmojiOnly(msg.text);
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

  // ---------- touch ----------
  const canTouch = isTouch && !isDeleted;
  const swipeX = useMotionValue(0);
  const swipeHint = useTransform(swipeX, [8, SWIPE_REPLY_PX], [0, 1]);
  const wasSwiped = useRef(false);
  const holdTimer = useRef(null);
  const wasHeld = useRef(false);

  // a tap on the message itself opens the sheet. Pictures, players, links and quotes keep their own tap
  const handleBubbleTap = (e) => {
    if (!canTouch || wasSwiped.current || wasHeld.current) return;
    if (e.target.closest('button, a, audio, video, input')) return;
    onOpenSheet(msg);
  };

  // holding a finger on it opens the sheet too, also on a picture
  const startHold = () => {
    if (!canTouch) return;
    wasHeld.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      wasHeld.current = true;
      navigator.vibrate?.(12);
      onOpenSheet(msg);
    }, LONG_PRESS_MS);
  };
  const cancelHold = () => clearTimeout(holdTimer.current);

  const handleSwipeEnd = (e, info) => {
    // the finger lifting must not count as a tap
    setTimeout(() => { wasSwiped.current = false }, 80);
    if (info.offset.x > SWIPE_REPLY_PX) {
      navigator.vibrate?.(10);
      onReply(msg);
    }
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
  const quoted = msg.replyTo && !msg.replyTo.deletedAt ? describeAttachments(msg.replyTo) : null;
  const QuotedIcon = quoted && ATTACHMENT_ICONS[quoted.type];
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
      <motion.div
        drag={canTouch ? 'x' : false} dragDirectionLock dragSnapToOrigin dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.4 }}
        style={{ x: swipeX }}
        onDragStart={() => { wasSwiped.current = true; cancelHold() }} onDragEnd={handleSwipeEnd}
        className={`relative flex items-center gap-1 w-full ${isOwn ? 'flex-row-reverse' : ''}`}>
        {canTouch && (
          // slides in from the left edge while the message is dragged
          <motion.span aria-hidden='true' style={{ opacity: swipeHint, scale: swipeHint }}
            className='absolute -left-11 top-1/2 -mt-4 grid place-items-center w-8 h-8 rounded-full bg-raised border border-line text-accent-text'>
            <ArrowBendUpLeft size={16} weight='bold' />
          </motion.span>
        )}
        {sender && (
          <div className='w-7 shrink-0 self-end mr-1'>{isGroupEnd && <Avatar user={sender} size='xs' />}</div>
        )}
        <div onClick={handleBubbleTap} onTouchStart={startHold} onTouchMove={cancelHold} onTouchEnd={cancelHold} onTouchCancel={cancelHold}
          onContextMenu={(e) => { if (canTouch) e.preventDefault() }}
          className={`flex flex-col gap-[3px] min-w-0 max-w-[82%] sm:max-w-[66%] rounded-[24px] transition-shadow duration-500 ${isOwn ? 'items-end' : 'items-start'} ${isHighlighted ? 'shadow-[0_0_0_3px_var(--accent-text)]' : ''} ${canTouch ? 'select-none [-webkit-touch-callout:none]' : ''}`}>
          {media.length > 0 && (
            <MediaGrid items={media} corners={corners} onLoad={onImageLoad} onOpen={(index) => onOpenImage(media, index)} />
          )}
          {sounds.map((file) => <VoicePlayer key={file.url} attachment={file} isOwn={isOwn} corners={corners} />)}
          {documents.map((file) => <FileCard key={file.url} attachment={file} isOwn={isOwn} corners={corners} />)}

          {isDeleted ? (
            <p data-deleted className={`flex items-center gap-2 px-4 py-2.5 rounded-[22px] ${corners} border border-dashed border-line-strong text-sm italic text-muted`}>
              <Prohibit size={16} /> {isOwn ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : emojiOnly ? (
            <p data-emoji-only className='text-[46px] leading-tight py-1'>{msg.text}</p>
          ) : (msg.text || msg.replyTo) && (
            <div data-bubble className={`max-w-full min-w-0 px-4 py-2.5 rounded-[22px] ${corners} text-[15px] leading-[1.4]
              ${isOwn ? 'grad text-white shadow-lg shadow-[color-mix(in_oklab,var(--a2)_35%,transparent)]' : 'bg-bubble text-ink border border-line'}`}>
              {msg.replyTo && (
                <button type='button' data-quote onClick={(e) => { e.stopPropagation(); onJumpTo(msg.replyTo._id) }}
                  className={`flex items-center gap-2 w-full min-w-0 sm:min-w-40 mb-1.5 px-2.5 py-1.5 rounded-xl border-l-[3px] text-left text-[13px] leading-snug
                    ${isOwn ? 'bg-white/20 border-white/80' : 'bg-raised border-accent-text'}`}>
                  <span className='min-w-0 flex-1'>
                    <span className={`block font-bold ${isOwn ? 'text-white' : 'text-accent-text'}`}>{replyAuthor}</span>
                    <span className={`block truncate ${isOwn ? 'text-white/85' : 'text-muted'}`}>
                      {msg.replyTo.deletedAt ? 'Deleted message' : (
                        <>{QuotedIcon && <QuotedIcon size={13} weight='fill' className='inline -mt-0.5 mr-1' />}{msg.replyTo.text || quoted?.label || 'Message'}</>
                      )}
                    </span>
                  </span>
                  {quoted?.thumbnail && <img src={quoted.thumbnail} alt="" className='w-9 h-9 shrink-0 rounded-lg object-cover' />}
                </button>
              )}
              {msg.text && <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{msg.text}</p>}
            </div>
          )}
        </div>

        {/* ---- actions: shown on hover. Touch screens get the sheet instead ---- */}
        {!isDeleted && !isTouch && (
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
      </motion.div>

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

// A chat redraws for many reasons that do not touch a message: somebody is typing, another chat
// got a message, a menu opened elsewhere. A message is only drawn again when what it shows changed.
// The functions it is given are new on every render of the chat but do the same thing, so they are
// left out of the comparison.
const SHOWN = ['msg', 'isOwn', 'isGroupStart', 'isGroupEnd', 'isNewDay', 'isHighlighted', 'seen', 'myId', 'isTouch'];
const sameSender = (a, b) => a === b || Boolean(a && b && a._id === b._id && a.fullName === b.fullName && a.profilePic === b.profilePic);
// only the popover of this very message matters to it
const ownMenu = (props) => (props.openMenu?.id === props.msg._id ? props.openMenu : null);
const showsTheSame = (prev, next) =>
  SHOWN.every((name) => prev[name] === next[name]) && sameSender(prev.sender, next.sender) && ownMenu(prev) === ownMenu(next);

export default React.memo(MessageBubble, showsTheSame)
