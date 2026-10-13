import React, { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import toast from 'react-hot-toast'
import {
  ArrowsInSimple, ArrowsOutSimple, CameraRotate, Ear, Microphone, MicrophoneSlash, MonitorArrowUp, Phone, PhoneDisconnect, PhoneX,
  SpeakerHigh, VideoCamera, VideoCameraSlash,
} from '@phosphor-icons/react'
import { CallContext, canShareScreen } from '../context/CallContext'
import { formatCallClock } from '../lib/utils'
import { isTouchDevice, useBackButton } from '../lib/backButton'
import Avatar from './Avatar'

const spring = { type: 'spring', stiffness: 420, damping: 32 };
const pop = { type: 'spring', stiffness: 520, damping: 26 };

// seconds since the call connected, ticking once a second
const useElapsed = (since) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!since) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
};

// ---------- loudspeaker or earpiece ----------
// A web page cannot switch a phone between its loudspeaker and its earpiece the way an app can.
// What some browsers offer (Chrome on Android and on a computer) is a list of sound outputs and
// a way to send one element's sound to one of them. Where that exists the button uses it.

const canRouteSound = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
const isEarpiece = (device) => /earpiece|receiver|handset/i.test(device?.label || '');
const isLoudspeaker = (device) => /speaker/i.test(device?.label || '') && !isEarpiece(device);

// the sound outputs of this device, read again whenever `refreshKey` changes or something is plugged in
const useSoundOutputs = (active, refreshKey) => {
  const [outputs, setOutputs] = useState([]);
  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!active || !devices?.enumerateDevices || !canRouteSound()) return setOutputs([]);
    let cancelled = false;
    const load = async () => {
      try {
        const all = await devices.enumerateDevices();
        // "communications" is Windows' second name for one of the others
        if (!cancelled) setOutputs(all.filter((device) => device.kind === 'audiooutput' && device.deviceId && device.deviceId !== 'communications'));
      } catch {
        // without the list the button explains that the browser decides
      }
    };
    load();
    devices.addEventListener?.('devicechange', load);
    return () => {
      cancelled = true;
      devices.removeEventListener?.('devicechange', load);
    };
  }, [active, refreshKey]);
  return outputs;
};

// A <video> (or <audio>) element that plays a MediaStream. `sinkId` picks the sound output
const StreamPlayer = ({ as: Tag = 'video', stream, sinkId, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (sinkId === undefined || !ref.current?.setSinkId) return;
    ref.current.setSinkId(sinkId).catch(() => {});
  }, [sinkId, stream]);
  useEffect(() => {
    const element = ref.current;
    if (!element || element.srcObject === stream) return;
    element.srcObject = stream;
    if (!stream) return;
    // Autoplay can be refused when the tap that started or answered the call was too long ago
    // (phones are strict about it). The next touch anywhere starts the sound then
    let retry = null;
    element.play?.().catch(() => {
      retry = () => element.play?.().catch(() => {});
      document.addEventListener('pointerdown', retry, { once: true });
    });
    return () => {
      if (retry) document.removeEventListener('pointerdown', retry);
    };
  }, [stream]);
  return <Tag ref={ref} autoPlay playsInline {...props} />;
};

// round button of the control bar. `off` is a switched off microphone or camera, `on` a running screen share
const ControlButton = ({ label, off = false, on = false, danger = false, className = '', children, ...props }) => (
  <motion.button type='button' aria-label={label} title={label} whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} transition={pop}
    className={`grid place-items-center w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-full transition-colors
      ${danger ? 'bg-danger text-white shadow-lg shadow-[color-mix(in_oklab,var(--danger)_45%,transparent)]'
        : on ? 'grad glow text-white'
        : off ? 'bg-ink text-canvas'
        : 'bg-raised border border-line text-ink hover:bg-hover'} ${className}`}
    {...props}>
    {children}
  </motion.button>
)

// the two big buttons of a ringing call, with their names underneath
const AnswerButton = ({ label, tone, pulse = false, children, ...props }) => (
  <div className='flex flex-col items-center gap-2.5'>
    <motion.button type='button' aria-label={label} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} transition={pop}
      className={`relative grid place-items-center w-[72px] h-[72px] rounded-full text-white shadow-xl ${tone}`} {...props}>
      {pulse && <span className={`absolute inset-0 rounded-full animate-ping-soft ${tone}`} />}
      <span className='relative'>{children}</span>
    </motion.button>
    <span className='text-sm font-semibold text-muted'>{label}</span>
  </div>
)

const statusOf = (call, elapsed) => {
  if (call.phase === 'incoming') return `Incoming ${call.kind === 'video' ? 'video' : 'voice'} call`;
  if (call.phase === 'calling') return call.id ? 'Ringing…' : 'Calling…';
  if (call.phase === 'connecting') return 'Connecting…';
  if (call.phase === 'reconnecting') return 'Reconnecting…';
  return formatCallClock(elapsed);
};

// The call screen. It covers the page while a call rings or runs, and shrinks to a small
// floating pill so the chat stays usable. Rendered into <body>, see Modal for why
const CallOverlay = () => {
  const {
    call, localVideo, remoteStream, isMinimized, setIsMinimized,
    acceptCall, declineCall, hangUp, toggleMic, toggleCamera, switchCamera, toggleScreenShare,
  } = useContext(CallContext);
  const elapsed = useElapsed(call?.connectedAt);

  // ---- where the other person's voice plays ----
  const outputs = useSoundOutputs(Boolean(call) && call.phase !== 'incoming', call?.phase);
  const [outputId, setOutputId] = useState(undefined); // undefined: wherever the browser plays it
  const callKey = call?.key;
  useEffect(() => setOutputId(undefined), [callKey]);

  const currentOutput = outputs.find((device) => device.deviceId === outputId) || outputs[0];
  const onEarpiece = isEarpiece(currentOutput);
  // phones get the button even where it can only explain itself, people look for it there
  const showSoundButton = outputs.length > 1 || isTouchDevice();

  const switchOutput = () => {
    if (outputs.length < 2) {
      return toast('This browser decides by itself where the call plays. Use the volume keys, or earphones for a private call', { icon: '🔈', duration: 6000 });
    }
    const loud = outputs.find(isLoudspeaker);
    const quiet = outputs.find(isEarpiece);
    // a phone: straight between loudspeaker and earpiece. Anything else: the next output in the list
    const next = loud && quiet
      ? (onEarpiece ? loud : quiet)
      : outputs[(outputs.indexOf(currentOutput) + 1) % outputs.length];
    setOutputId(next.deviceId);
    toast(isEarpiece(next) ? 'Earpiece' : next.label || 'Speaker', { icon: isEarpiece(next) ? '👂' : '🔊', duration: 2000 });
  };

  // "back" on a phone shrinks the call to the pill, it never hangs up
  useBackButton(Boolean(call) && !isMinimized && call.phase !== 'incoming', () => setIsMinimized(true));

  const isLive = call?.phase === 'connected' || call?.phase === 'reconnecting';
  const isIncoming = call?.phase === 'incoming';
  const showRemoteVideo = Boolean(call && isLive && call.remote.video && remoteStream?.getVideoTracks().length);
  const status = call ? statusOf(call, elapsed) : '';
  const firstName = call?.peer.fullName.split(' ')[0];

  return createPortal(
    <>
      {/* the other person's voice, playing whatever the screen looks like */}
      {call && <StreamPlayer as='audio' stream={remoteStream} sinkId={outputId} data-call-audio />}

      <AnimatePresence>
        {call && !isMinimized && (
          <motion.div key='call' role='dialog' aria-modal='true' aria-label={`Call with ${call.peer.fullName}`}
            data-call={call.direction} data-call-phase={call.phase} data-call-kind={call.kind}
            initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.25 }}
            className='fixed inset-0 z-[70] flex flex-col overflow-hidden bg-canvas'>
            {/* ---- backdrop: the accent colours drifting behind everything ---- */}
            <div className='absolute inset-0 pointer-events-none' aria-hidden='true'>
              <div className='absolute -top-1/4 -left-1/4 w-[70vmax] h-[70vmax] rounded-full grad opacity-35 blur-[120px] animate-drift-a max-md:animate-none' />
              <div className='absolute -bottom-1/3 -right-1/4 w-[60vmax] h-[60vmax] rounded-full grad opacity-25 blur-[140px] animate-drift-b max-md:animate-none' />
            </div>

            {/* ---- the other person's camera or screen ---- */}
            <AnimatePresence>
              {showRemoteVideo && (
                <motion.div key='remote' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='absolute inset-0 bg-black'>
                  <StreamPlayer stream={remoteStream} muted data-call-remote-video
                    className={`w-full h-full ${call.remote.screen ? 'object-contain' : 'object-cover'}`} />
                  <div className='absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent' />
                  <div className='absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/75 to-transparent' />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- top bar ---- */}
            <div className={`relative z-10 flex items-center gap-3 h-[72px] px-4 sm:px-6 shrink-0 box-content pt-[env(safe-area-inset-top)] ${showRemoteVideo ? 'text-white' : ''}`}>
              {!isIncoming && (
                <motion.button type='button' aria-label='Minimise call' title='Back to chat' whileTap={{ scale: 0.9 }} onClick={() => setIsMinimized(true)}
                  className='glass grid place-items-center w-11 h-11 rounded-full'>
                  <ArrowsInSimple size={20} weight='bold' />
                </motion.button>
              )}
              {showRemoteVideo && (
                <div className='min-w-0 leading-tight'>
                  <p className='truncate font-bold'>{call.peer.fullName}</p>
                  <p data-call-status className='text-[13px] font-medium tabular-nums text-white/75'>
                    {status}{call.remote.screen && ' · sharing their screen'}
                  </p>
                </div>
              )}
              {showRemoteVideo && !call.remote.audio && (
                <span className='ml-auto flex items-center gap-1.5 px-3 h-8 rounded-full bg-black/45 text-xs font-semibold'>
                  <MicrophoneSlash size={15} weight='fill' /> Muted
                </span>
              )}
            </div>

            {/* ---- middle: who the call is with, while there is no picture of them ---- */}
            <div className='relative z-10 flex-1 min-h-0 grid place-items-center px-6'>
              {!showRemoteVideo && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className='text-center'>
                  <div className='relative w-fit mx-auto'>
                    {!isLive && [0, 0.7, 1.4].map((delay) => (
                      <motion.span key={delay} aria-hidden='true' className='absolute inset-0 rounded-full grad'
                        initial={{ scale: 1, opacity: 0 }} animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
                        transition={{ duration: 2.1, delay, repeat: Infinity, ease: 'easeOut' }} />
                    ))}
                    <motion.div animate={isLive ? { scale: 1 } : { scale: [1, 1.04, 1] }} transition={{ duration: 2.1, repeat: isLive ? 0 : Infinity, ease: 'easeInOut' }}>
                      <Avatar user={call.peer} size='2xl' ring />
                    </motion.div>
                  </div>
                  <h2 className='mt-8 text-[32px] sm:text-4xl font-extrabold tracking-tight'>{call.peer.fullName}</h2>
                  <p data-call-status className={`mt-2 text-base font-semibold tabular-nums ${isLive ? 'grad-text' : 'text-muted'}`}>{status}</p>
                  {isLive && !call.remote.audio && (
                    <p className='mt-4 inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-raised text-xs font-semibold text-muted'>
                      <MicrophoneSlash size={15} weight='fill' /> {firstName} is muted
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            {/* ---- my own camera or the screen I share, it can be dragged out of the way ---- */}
            <AnimatePresence>
              {localVideo && (
                <motion.div key='self' drag dragMomentum={false} dragElastic={0.08} whileDrag={{ scale: 1.04 }}
                  initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}
                  className='absolute z-20 right-4 sm:right-6 bottom-32 sm:bottom-36 w-28 sm:w-56 aspect-[3/4] sm:aspect-video rounded-3xl overflow-hidden bg-black border border-line-strong shadow-2xl shadow-black/60 cursor-grab active:cursor-grabbing'>
                  {/* the front camera is shown like a mirror, the way people know their own face */}
                  <StreamPlayer stream={localVideo} muted data-call-local-video
                    className={`w-full h-full pointer-events-none ${call.sharing ? 'object-contain' : call.facing === 'environment' ? 'object-cover' : 'object-cover -scale-x-100'}`} />
                  {call.camOn && !call.sharing && isTouchDevice() && (
                    <button type='button' aria-label='Switch camera' data-call-flip onClick={switchCamera} onPointerDownCapture={(e) => e.stopPropagation()}
                      className='absolute right-1.5 bottom-1.5 grid place-items-center w-9 h-9 rounded-full bg-black/55 text-white'>
                      <CameraRotate size={18} weight='fill' />
                    </button>
                  )}
                  {call.sharing && (
                    <span className='absolute left-2 bottom-2 px-2 h-6 grid place-items-center rounded-full grad text-[11px] font-bold text-white'>Your screen</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- controls ---- */}
            <div className='relative z-10 flex justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-10 shrink-0'>
              {isIncoming ? (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className='flex flex-col items-center gap-6'>
                  <div className='flex items-start gap-14 sm:gap-20'>
                    <AnswerButton label='Decline' tone='bg-danger' data-call-decline onClick={declineCall}>
                      <PhoneX size={30} weight='fill' />
                    </AnswerButton>
                    <AnswerButton label='Accept' tone='bg-online' pulse data-call-accept onClick={() => acceptCall()}>
                      {call.kind === 'video' ? <VideoCamera size={30} weight='fill' /> : <Phone size={30} weight='fill' />}
                    </AnswerButton>
                  </div>
                  {call.kind === 'video' && (
                    <button type='button' onClick={() => acceptCall(false)}
                      className='glass flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold hover:text-accent-text transition-colors'>
                      <Microphone size={17} weight='fill' /> Answer without camera
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                  className='glass flex items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 rounded-full'>
                  <ControlButton label={call.micOn ? 'Mute' : 'Unmute'} off={!call.micOn} aria-pressed={!call.micOn} data-call-mic={call.micOn ? 'on' : 'off'} onClick={toggleMic}>
                    {call.micOn ? <Microphone size={24} weight='fill' /> : <MicrophoneSlash size={24} weight='fill' />}
                  </ControlButton>
                  <ControlButton label={call.camOn ? 'Turn camera off' : 'Turn camera on'} off={!call.camOn} aria-pressed={!call.camOn} data-call-camera={call.camOn ? 'on' : 'off'} onClick={toggleCamera}>
                    {call.camOn ? <VideoCamera size={24} weight='fill' /> : <VideoCameraSlash size={24} weight='fill' />}
                  </ControlButton>
                  {showSoundButton && (
                    <ControlButton label={onEarpiece ? 'Switch to speaker' : outputs.length > 1 ? 'Switch sound output' : 'Speaker'} off={onEarpiece}
                      data-call-speaker={onEarpiece ? 'earpiece' : 'speaker'} data-call-output={currentOutput?.label || ''} onClick={switchOutput}>
                      {onEarpiece ? <Ear size={24} weight='fill' /> : <SpeakerHigh size={24} weight='fill' />}
                    </ControlButton>
                  )}
                  {canShareScreen() && (
                    <ControlButton label={call.sharing ? 'Stop sharing' : 'Share screen'} on={call.sharing} aria-pressed={call.sharing} disabled={!isLive}
                      data-call-share={call.sharing ? 'on' : 'off'} onClick={toggleScreenShare} className='max-sm:hidden disabled:opacity-40'>
                      <MonitorArrowUp size={24} weight='fill' />
                    </ControlButton>
                  )}
                  <span className='w-px h-8 bg-line-strong' aria-hidden='true' />
                  <ControlButton label='End call' danger data-call-end onClick={() => hangUp()} className='!w-[72px] sm:!w-20'>
                    <PhoneDisconnect size={26} weight='fill' />
                  </ControlButton>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- minimised: a pill that floats over the app ---- */}
      <AnimatePresence>
        {call && isMinimized && (
          <div key='pill' className='fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-3 pointer-events-none'>
            <motion.div data-call-pill drag dragMomentum={false} dragElastic={0.08}
              initial={{ opacity: 0, y: -40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -40, scale: 0.9 }} transition={spring}
              className='pointer-events-auto grad glow p-[1.5px] rounded-full cursor-grab active:cursor-grabbing'>
              <div className='flex items-center gap-2 pl-1.5 pr-1.5 h-14 rounded-full bg-panel-solid'>
                <button type='button' onClick={() => setIsMinimized(false)} aria-label='Back to the call' className='flex items-center gap-2.5 pr-2 rounded-full text-left'>
                  <Avatar user={call.peer} size='sm' />
                  <span className='min-w-0 leading-tight'>
                    <span className='block max-w-32 truncate text-sm font-bold'>{call.peer.fullName}</span>
                    <span data-call-status className='block text-xs font-semibold tabular-nums text-accent-text'>{status}</span>
                  </span>
                </button>
                <motion.button type='button' whileTap={{ scale: 0.9 }} onClick={toggleMic} aria-label={call.micOn ? 'Mute' : 'Unmute'} title={call.micOn ? 'Mute' : 'Unmute'}
                  className={`grid place-items-center w-10 h-10 rounded-full transition-colors ${call.micOn ? 'bg-raised text-ink hover:bg-hover' : 'bg-ink text-canvas'}`}>
                  {call.micOn ? <Microphone size={18} weight='fill' /> : <MicrophoneSlash size={18} weight='fill' />}
                </motion.button>
                <motion.button type='button' whileTap={{ scale: 0.9 }} onClick={() => setIsMinimized(false)} aria-label='Open call' title='Open call'
                  className='grid place-items-center w-10 h-10 rounded-full bg-raised text-ink hover:bg-hover transition-colors'>
                  <ArrowsOutSimple size={18} weight='bold' />
                </motion.button>
                <motion.button type='button' whileTap={{ scale: 0.9 }} onClick={() => hangUp()} aria-label='End call' title='End call'
                  className='grid place-items-center w-10 h-10 rounded-full bg-danger text-white'>
                  <PhoneDisconnect size={18} weight='fill' />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}

export default CallOverlay
