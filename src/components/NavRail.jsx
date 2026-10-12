import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChatsCircle, SignOut } from '@phosphor-icons/react'
import { AuthContext } from '../context/AuthContext'
import AppearanceMenu from './AppearanceMenu'
import Avatar from './Avatar'
import IconButton from './IconButton'
import { LogoMark } from './Logo'
import NotificationToggle from './NotificationToggle'

// Slim column of app level actions on the far left (desktop only)
const NavRail = () => {
  const { authUser, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  return (
    <nav aria-label='Main' className='glass relative z-30 max-md:hidden flex flex-col items-center gap-2 w-[72px] shrink-0 py-4 rounded-[28px]'>
      <LogoMark className='w-10 h-10' />

      <div className='mt-5 flex flex-col items-center gap-1'>
        <div className='relative grid place-items-center w-11 h-11 rounded-2xl grad-soft text-accent-text' aria-current='page' title='Chats'>
          <span className='absolute -left-[14px] h-6 w-1 rounded-full grad' />
          <ChatsCircle size={24} weight='fill' />
        </div>
      </div>

      <div className='mt-auto flex flex-col items-center gap-1'>
        <NotificationToggle />
        <AppearanceMenu placement='right' />
        <IconButton label='Log out' onClick={logout}>
          <SignOut size={22} weight='duotone' />
        </IconButton>
        <motion.button type='button' onClick={() => navigate('/profile')} aria-label='Your profile' title='Your profile'
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} className='mt-2 rounded-full'>
          <Avatar user={authUser} size='sm' ring />
        </motion.button>
      </div>
    </nav>
  )
}

export default NavRail
