import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import { AuthContext } from '../context/AuthContext'
import { getErrorMessage } from '../lib/utils'
import {
  DownloadSimple, File as FileIcon, FileCsv, FileDoc, FilePdf, FilePpt, FileText, FileXls, FileZip, Microphone,
  MusicNotes, Pause, Play,
} from '@phosphor-icons/react'
import { downloadUrl, extensionOf, formatBytes, formatDuration, needsTemporaryLink, posterUrl, thumbnailUrl, viewUrl } from '../lib/upload'

// ---------- photos and videos ----------

const MediaTile = ({ item, className = '', overlayCount, onOpen, onLoad, single }) => {
  const poster = item.type === 'video' ? posterUrl(item.url) : null
  // a lone picture keeps its own shape, pictures in a grid are cropped to fill their cell
  const fit = single ? 'max-w-full max-h-80 min-h-24 min-w-24' : 'w-full h-full'
  const ratio = single && item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined

  return (
    <button type='button' onClick={(e) => { e.stopPropagation(); onOpen() }}
      aria-label={item.type === 'video' ? 'Play video' : 'Open image'}
      className={`group/tile relative block overflow-hidden bg-raised ${className}`}>
      {item.type === 'image' ? (
        <img src={thumbnailUrl(item.url)} alt="Shared image" onLoad={onLoad} style={ratio}
          className={`block object-cover transition-transform duration-300 group-hover/tile:scale-[1.03] ${fit}`} />
      ) : poster ? (
        <img src={poster} alt="Shared video" onLoad={onLoad} style={ratio}
          className={`block object-cover ${fit}`} />
      ) : (
        <video src={item.url} preload='metadata' muted playsInline onLoadedMetadata={onLoad}
          className={`block object-cover bg-black ${fit}`} />
      )}

      {item.type === 'video' && !overlayCount && (
        <>
          <span className='absolute inset-0 grid place-items-center bg-black/15'>
            <span className='grid place-items-center w-12 h-12 rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover/tile:scale-110'>
              <Play size={20} weight='fill' />
            </span>
          </span>
          {item.duration > 0 && (
            <span className='absolute bottom-2 left-2 px-1.5 h-5 grid place-items-center rounded-md bg-black/60 text-white text-[11px] font-semibold tabular-nums'>
              {formatDuration(item.duration)}
            </span>
          )}
        </>
      )}
      {overlayCount > 0 && (
        <span className='absolute inset-0 grid place-items-center bg-black/60 text-white text-2xl font-extrabold'>+{overlayCount}</span>
      )}
    </button>
  )
}

// One picture is shown whole. Two to four make a tidy grid, more than four end in a "+N" tile
export const MediaGrid = ({ items, corners = '', onOpen, onLoad }) => {
  const shown = items.slice(0, 4)
  const hidden = items.length - shown.length

  if (items.length === 1) {
    return <MediaTile item={items[0]} single onOpen={() => onOpen(0)} onLoad={onLoad} className={`rounded-[22px] ${corners} border border-line`} />
  }

  return (
    <div data-media-grid className={`grid grid-cols-2 gap-[3px] w-72 max-w-full overflow-hidden rounded-[22px] ${corners} border border-line`}>
      {shown.map((item, index) => (
        <MediaTile key={item.url} item={item} onOpen={() => onOpen(index)} onLoad={onLoad}
          overlayCount={index === 3 ? hidden : 0}
          // three pictures: the first one runs across the top
          className={items.length === 3 && index === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'} />
      ))}
    </div>
  )
}

// ---------- voice notes and other sound ----------

// only one recording plays at a time
let playingAudio = null

const SPEEDS = [1, 1.5, 2]
const FALLBACK_BARS = 40

// bars for a sound file that came without a waveform: steady, slightly uneven
const fallbackWaveform = (seed = '') => {
  let hash = 7
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return Array.from({ length: FALLBACK_BARS }, (_, index) => 30 + ((hash >> (index % 24)) & 7) * 8 + (index % 3) * 6)
}

export const VoicePlayer = ({ attachment, isOwn, corners = '' }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0 to 1
  const [duration, setDuration] = useState(attachment.duration || 0)
  const [speed, setSpeed] = useState(1)

  const isVoice = Array.isArray(attachment.waveform) && attachment.waveform.length > 0
  const bars = useMemo(() => (isVoice ? attachment.waveform : fallbackWaveform(attachment.url)), [isVoice, attachment.waveform, attachment.url])

  useEffect(() => () => {
    if (playingAudio === audioRef.current) playingAudio = null
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (audio.paused) {
      if (playingAudio && playingAudio !== audio) playingAudio.pause()
      playingAudio = audio
      audio.playbackRate = speed
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    audioRef.current.playbackRate = next
  }

  // a click on the waveform jumps there
  const seek = (e) => {
    const audio = audioRef.current
    const total = audio.duration && Number.isFinite(audio.duration) ? audio.duration : duration
    if (!total) return
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    audio.currentTime = ratio * total
    setProgress(ratio)
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration
    if (total) setProgress(Math.min(1, audio.currentTime / total))
  }

  const played = isOwn ? 'bg-white' : 'bg-[var(--accent-text)]'
  const unplayed = isOwn ? 'bg-white/40' : 'bg-[color-mix(in_oklab,var(--ink)_25%,transparent)]'

  return (
    <div data-voice className={`flex items-center gap-3 w-72 max-w-full pl-2 pr-3.5 py-2 rounded-[22px] ${corners}
      ${isOwn ? 'grad text-white shadow-lg shadow-[color-mix(in_oklab,var(--a2)_35%,transparent)]' : 'bg-bubble text-ink border border-line'}`}>
      <audio ref={audioRef} src={attachment.url} preload='metadata'
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setProgress(0) }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration) }} />

      <motion.button type='button' onClick={(e) => { e.stopPropagation(); toggle() }} whileTap={{ scale: 0.9 }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={`grid place-items-center w-10 h-10 shrink-0 rounded-full ${isOwn ? 'bg-white/25' : 'grad text-white'}`}>
        {isPlaying ? <Pause size={18} weight='fill' /> : <Play size={18} weight='fill' className='ml-0.5' />}
      </motion.button>

      <div className='min-w-0 flex-1'>
        <div role='slider' aria-label='Position' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
          onClick={(e) => { e.stopPropagation(); seek(e) }} className='flex items-center gap-[2px] h-8 cursor-pointer'>
          {bars.map((height, index) => (
            <span key={index} style={{ height: `${Math.max(12, height)}%` }}
              className={`flex-1 min-w-[2px] rounded-full transition-colors ${index / bars.length < progress ? played : unplayed}`} />
          ))}
        </div>
        <div className={`flex items-center justify-between text-[11px] font-semibold tabular-nums ${isOwn ? 'text-white/80' : 'text-muted'}`}>
          <span className='flex items-center gap-1'>
            {isVoice ? <Microphone size={12} weight='fill' /> : <MusicNotes size={12} weight='fill' />}
            {formatDuration(isPlaying || progress > 0 ? progress * duration : duration)}
          </span>
          <button type='button' onClick={(e) => { e.stopPropagation(); cycleSpeed() }} aria-label={`Speed ${speed}x`}
            className={`px-1.5 rounded-md ${isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-raised hover:bg-hover'}`}>
            {speed}×
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- documents ----------

const FILE_ICONS = {
  pdf: [FilePdf, '#ff5b5b'],
  doc: [FileDoc, '#4c8dff'], docx: [FileDoc, '#4c8dff'],
  xls: [FileXls, '#2fbf71'], xlsx: [FileXls, '#2fbf71'], csv: [FileCsv, '#2fbf71'],
  ppt: [FilePpt, '#ff8a3d'], pptx: [FilePpt, '#ff8a3d'],
  zip: [FileZip, '#c59b3f'],
  txt: [FileText, '#9aa0b4'],
}

// `messageId` and `index` say which file of which message this is, needed for files that
// only open with a link from the server
export const FileCard = ({ attachment, messageId, index, isOwn = false, corners = '', compact = false }) => {
  const { axios } = useContext(AuthContext)
  const extension = extensionOf(attachment.name || attachment.url)
  const [Icon, color] = FILE_ICONS[extension] || [FileIcon, '#9aa0b4']
  const details = [extension.toUpperCase(), formatBytes(attachment.size)].filter(Boolean).join(' · ')
  const name = attachment.name || 'Document'
  const viaServer = Boolean(messageId) && needsTemporaryLink(attachment.url, extension)

  // Opens or downloads a file that needs a link from the server first
  const withTemporaryLink = (download) => async (e) => {
    e.stopPropagation()
    if (!viaServer) return
    e.preventDefault()
    // The new tab is opened right now, while this still counts as the user's click:
    // after waiting for the server a browser would block it as a pop-up
    const tab = download ? null : window.open('', '_blank')
    try {
      const { data } = await axios.get(`/api/messages/${messageId}/files/${index}/link`, { params: download ? { download: 1 } : undefined })
      if (tab) {
        tab.opener = null
        tab.location.replace(data.url)
      } else {
        // a download link does not leave the page
        window.location.assign(data.url)
      }
    } catch (error) {
      tab?.close()
      toast.error(getErrorMessage(error))
    }
  }
  const opensAsDownload = extension === 'zip'

  return (
    <div data-file className={`group/file flex items-center gap-1 max-w-full ${compact ? 'w-full p-2 rounded-2xl' : `w-72 p-2.5 rounded-[22px] ${corners}`}
        ${isOwn ? 'grad text-white shadow-lg shadow-[color-mix(in_oklab,var(--a2)_35%,transparent)]' : 'bg-bubble text-ink border border-line hover:border-line-strong'}`}>
      {/* a click on the card opens the document in a new tab */}
      <a data-file-open href={viewUrl(attachment.url, extension)} target='_blank' rel='noopener noreferrer' title={`Open ${name}`}
        onClick={withTemporaryLink(opensAsDownload)} className='flex items-center gap-3 min-w-0 flex-1'>
        <span className={`grid place-items-center w-11 h-11 shrink-0 rounded-2xl ${isOwn ? 'bg-white/20' : 'bg-raised'}`}
          style={isOwn ? undefined : { color }}>
          <Icon size={24} weight='duotone' />
        </span>
        <span className='min-w-0 flex-1 leading-tight'>
          <span className='block truncate text-sm font-bold'>{name}</span>
          <span className={`block mt-0.5 text-[11px] font-semibold ${isOwn ? 'text-white/75' : 'text-muted'}`}>{details}</span>
        </span>
      </a>
      <a data-file-download href={downloadUrl(attachment.url)} download={attachment.name} aria-label={`Download ${name}`} title='Download'
        onClick={withTemporaryLink(true)}
        className={`grid place-items-center w-9 h-9 shrink-0 rounded-full transition-colors ${isOwn ? 'bg-white/20 hover:bg-white/35' : 'bg-raised hover:bg-hover'}`}>
        <DownloadSimple size={16} weight='bold' />
      </a>
    </div>
  )
}
