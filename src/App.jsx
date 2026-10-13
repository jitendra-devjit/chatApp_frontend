import React, { lazy, Suspense, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { motion } from 'motion/react'
import {Toaster} from "react-hot-toast"
import { AuthContext } from './context/AuthContext.jsx'
import Aurora from './components/Aurora.jsx'
import CallOverlay from './components/CallOverlay.jsx'
import { LogoMark } from './components/Logo.jsx'

// each page is its own download, so the login screen does not wait for the whole chat app
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))

// the free server sleeps when nobody uses it, waking it up takes a while
const SLOW_START_MS = 4000

// The logo breathing in the middle of the screen. After a few seconds it explains the wait
const Loader = ({ explain = false }) => {
  const [isSlow, setIsSlow] = useState(false)
  useEffect(() => {
    if (!explain) return
    const timer = setTimeout(() => setIsSlow(true), SLOW_START_MS)
    return () => clearTimeout(timer)
  }, [explain])

  return (
    <div className='h-app grid place-items-center' role='status' aria-label='Loading'>
      <div className='text-center'>
        <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} className='w-fit mx-auto'>
          <LogoMark className='w-14 h-14' />
        </motion.div>
        {isSlow && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className='mt-6 px-8 text-sm font-medium text-muted'>
            Waking the server up, this can take up to a minute…
          </motion.p>
        )}
      </div>
    </div>
  )
}

const toastOptions = {
  duration: 3500,
  style: {
    background: 'var(--panel-solid)',
    color: 'var(--ink)',
    border: '1px solid var(--line-strong)',
    borderRadius: '18px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 20px 50px -16px rgba(0,0,0,0.55)',
  },
  success: { iconTheme: { primary: 'var(--online)', secondary: '#fff' } },
  error: { iconTheme: { primary: 'var(--danger)', secondary: '#fff' } },
}

// every page fades and rises in when it is opened
const Page = ({ children }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}>
    {children}
  </motion.div>
)

const App = () => {
  const {authUser, isCheckingAuth} = useContext(AuthContext)

  // wait for the saved session before deciding between chat and login
  if (isCheckingAuth) {
    return (
      <>
        <Aurora />
        <Loader explain />
      </>
    )
  }

  return (
    <>
      <Aurora />
      <Toaster position='bottom-center' containerStyle={{ bottom: 104 }} toastOptions={toastOptions}/>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path='/' element={authUser ? <Page><HomePage /></Page> : <Navigate to="/login" replace/>} />
          <Route path='/login' element={!authUser ? <Page><LoginPage /></Page> : <Navigate to="/" replace/>} />
          <Route path='/profile' element={authUser ? <Page><ProfilePage /></Page> : <Navigate to="/login" replace/>} />
          <Route path='*' element={<Navigate to="/" replace/>} />
        </Routes>
      </Suspense>
      {/* a call stays on screen whichever page is open */}
      <CallOverlay />
    </>
  )
}

export default App
