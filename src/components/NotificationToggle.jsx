import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { BellRinging, BellSlash } from '@phosphor-icons/react'
import { canNotify, isNotifyEnabled, playMessageSound, requestNotificationPermission, setNotifyEnabled } from '../lib/notify'
import IconButton from './IconButton'

// Bell that switches the message sound and system notifications on or off
const NotificationToggle = () => {
  const [enabled, setEnabled] = useState(isNotifyEnabled)

  const toggle = async () => {
    const next = !enabled
    setEnabled(next)
    setNotifyEnabled(next)
    if (!next) {
      toast('Notifications muted', { icon: '🔕' })
      return
    }
    playMessageSound()
    const allowed = await requestNotificationPermission()
    if (allowed) toast.success('Notifications on')
    else if (canNotify() && Notification.permission === 'denied') toast('Sound is on. Allow notifications in your browser settings to get alerts too.', { icon: '🔔' })
    else toast.success('Sound on')
  }

  return (
    <IconButton label={enabled ? 'Mute notifications' : 'Turn on notifications'} aria-pressed={enabled} onClick={toggle}>
      {enabled ? <BellRinging size={22} weight='duotone' /> : <BellSlash size={22} weight='duotone' />}
    </IconButton>
  )
}

export default NotificationToggle
