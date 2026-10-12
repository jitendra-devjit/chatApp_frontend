import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { motion } from 'motion/react'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import {Toaster} from "react-hot-toast"
import { AuthContext } from './context/AuthContext.jsx'
import { useContext } from 'react'
import Aurora from './components/Aurora.jsx'
import { LogoMark } from './components/Logo.jsx'

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
      <div className='h-dvh grid place-items-center' role='status' aria-label='Loading'>
        <Aurora />
        <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
          <LogoMark className='w-14 h-14' />
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <Aurora />
      <Toaster position='bottom-center' containerStyle={{ bottom: 104 }} toastOptions={toastOptions}/>
      <Routes>
        <Route path='/' element={authUser ? <Page><HomePage /></Page> : <Navigate to="/login"/>} />
        <Route path='/login' element={!authUser ? <Page><LoginPage /></Page> : <Navigate to="/"/>} />
        <Route path='/profile' element={authUser ? <Page><ProfilePage /></Page> : <Navigate to="/login"/>} />
        <Route path='*' element={<Navigate to="/"/>} />
      </Routes>
    </>
  )
}

export default App
