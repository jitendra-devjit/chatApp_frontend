import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import {Toaster} from "react-hot-toast"
import { AuthContext } from './context/AuthContext.jsx'
import { useContext } from 'react'
import { LogoMark } from './components/Logo.jsx'

const toastOptions = {
  duration: 3500,
  style: {
    background: 'var(--raised)',
    color: 'var(--ink)',
    border: '1px solid var(--line-strong)',
    borderRadius: '14px',
    padding: '10px 14px',
    fontSize: '14px',
    boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)',
  },
  success: { iconTheme: { primary: 'var(--accent)', secondary: 'var(--accent-ink)' } },
  error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--raised)' } },
}

const App = () => {
  const {authUser, isCheckingAuth} = useContext(AuthContext)

  // wait for the saved session before deciding between chat and login
  if (isCheckingAuth) {
    return (
      <div className='h-dvh grid place-items-center bg-canvas' role='status' aria-label='Loading'>
        <LogoMark className='w-10 h-10 animate-pulse' />
      </div>
    )
  }

  return (
    <>
      <Toaster position='top-center' toastOptions={toastOptions}/>
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to="/login"/>} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/"/>} />
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to="/login"/>} />
        <Route path='*' element={<Navigate to="/"/>} />
      </Routes>
    </>
  )
}

export default App
