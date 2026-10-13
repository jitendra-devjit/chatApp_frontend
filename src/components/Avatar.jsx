import React, { useState } from 'react'
import { UsersThree } from '@phosphor-icons/react'
import { getAvatarGradient, getInitials } from '../lib/utils'
import { thumbnailUrl } from '../lib/upload'

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-[15px]',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-28 h-28 text-4xl',
  '2xl': 'w-36 h-36 text-5xl',
}

// how wide a picture is asked for, twice the size on screen so it stays sharp on a phone
const PIXELS = { xs: 64, sm: 96, md: 128, lg: 160, xl: 320, '2xl': 480 }

const DOTS = {
  xs: 'w-2 h-2 ring-2',
  sm: 'w-2.5 h-2.5 ring-2',
  md: 'w-3.5 h-3.5 ring-[3px]',
  lg: 'w-4 h-4 ring-[3px]',
  xl: 'w-5 h-5 ring-4 bottom-1 right-1',
  '2xl': 'w-6 h-6 ring-4 bottom-1.5 right-1.5',
}

const BADGES = {
  xs: 'w-3 h-3 ring-1',
  sm: 'w-4 h-4 ring-2',
  md: 'w-5 h-5 ring-2',
  lg: 'w-6 h-6 ring-[3px]',
  xl: 'w-8 h-8 ring-4',
  '2xl': 'w-9 h-9 ring-4',
}

// Profile picture, or the person's initials on their own gradient when there is none.
// `ring` wraps it in the accent gradient, `online` adds the live dot, `group` a small people badge
const Avatar = ({ user, src, size = 'md', online = false, ring = false, group = false, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState(null)
  const name = user?.fullName || ''
  // a profile photo is uploaded at 640px, a list of them at that size is a lot to download
  const image = thumbnailUrl(src ?? user?.profilePic, PIXELS[size])
  const showImage = image && failedSrc !== image

  const face = showImage ? (
    <img
      src={image}
      alt=""
      loading='lazy'
      decoding='async'
      draggable={false}
      onError={() => setFailedSrc(image)}
      className={`${SIZES[size]} rounded-full object-cover bg-raised`}
    />
  ) : (
    <div
      aria-hidden="true"
      style={{ backgroundImage: getAvatarGradient(name) }}
      className={`${SIZES[size]} grid place-items-center rounded-full font-bold tracking-tight text-white select-none`}
    >
      {getInitials(name)}
    </div>
  )

  return (
    <div className={`relative shrink-0 w-fit ${className}`}>
      {ring ? (
        <div className='grad rounded-full p-[3px]'>
          <div className='rounded-full bg-panel-solid p-[3px]'>{face}</div>
        </div>
      ) : face}
      {group && (
        <span className={`absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full grad text-white ring-panel-solid ${BADGES[size]}`}>
          <UsersThree weight='fill' className='w-[62%] h-[62%]' />
        </span>
      )}
      {online && !group && (
        <span className={`absolute bottom-0 right-0 rounded-full bg-online ring-panel-solid ${DOTS[size]}`}>
          <span className='absolute inset-0 rounded-full bg-online animate-ping-soft' />
        </span>
      )}
    </div>
  )
}

export default Avatar
