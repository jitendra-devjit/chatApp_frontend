import React, { useState } from 'react'
import { getAvatarColor, getInitials } from '../lib/utils'

const SIZES = {
  sm: 'w-8 h-8 text-[11px] rounded-[10px]',
  md: 'w-11 h-11 text-sm rounded-[14px]',
  lg: 'w-24 h-24 text-3xl rounded-[30px]',
  xl: 'w-32 h-32 text-4xl rounded-[38px]',
}

// Profile picture, or the person's initials on their own colour when there is none
const Avatar = ({ user, src, size = 'md', online = false, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState(null)
  const name = user?.fullName || ''
  const image = src ?? user?.profilePic
  const showImage = image && failedSrc !== image

  return (
    <div className={`relative shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={image}
          alt=""
          onError={() => setFailedSrc(image)}
          className={`${SIZES[size]} object-cover bg-raised`}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{ backgroundColor: getAvatarColor(name) }}
          className={`${SIZES[size]} grid place-items-center font-semibold tracking-tight text-[#191917] select-none`}
        >
          {getInitials(name)}
        </div>
      )}
      {online && (
        <span className='absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent ring-[2.5px] ring-surface' />
      )}
    </div>
  )
}

export default Avatar
