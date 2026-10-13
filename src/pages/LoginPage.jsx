import React, { useContext, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Checks, CircleNotch, EnvelopeSimple, Eye, EyeSlash, Images, Lightning, LockKey, Palette, PencilSimpleLine, User } from '@phosphor-icons/react'
import { AuthContext } from '../context/AuthContext'
import { MAX_BIO_LENGTH } from '../lib/utils'
import AppearanceMenu from '../components/AppearanceMenu'
import Avatar from '../components/Avatar'
import Logo from '../components/Logo'
import TypingDots from '../components/TypingDots'

const spring = { type: 'spring', stiffness: 460, damping: 36 }

// ---------- left side: a conversation that plays by itself ----------

const DEMO_FRIEND = { fullName: 'Aarav Mehta' }
const DEMO_SCRIPT = [
  { own: false, text: 'Movie tonight? 🍿' },
  { own: true, text: 'Yes! Booking the tickets now' },
  { own: false, text: 'Get the corner seats 😄' },
  { own: true, text: 'Done. 9 pm show, see you there ✨' },
]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const LiveDemo = () => {
  const [count, setCount] = useState(0) // how many messages of the script are on screen
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    let cancelled = false
    const play = async () => {
      while (!cancelled) {
        setCount(0)
        await wait(600)
        for (let i = 0; i < DEMO_SCRIPT.length && !cancelled; i++) {
          if (DEMO_SCRIPT[i].own) {
            await wait(1100)
          } else {
            setIsTyping(true)
            await wait(1400)
            if (cancelled) return
            setIsTyping(false)
          }
          if (cancelled) return
          setCount(i + 1)
          await wait(450)
        }
        await wait(3800)
      }
    }
    play()
    return () => {
      cancelled = true
    }
  }, [])

  const isSeen = count === DEMO_SCRIPT.length

  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ ...spring, delay: 0.15 }}
      aria-hidden='true' className='glass w-full max-w-[380px] rounded-[32px] overflow-hidden'>
      <div className='flex items-center gap-3 px-5 h-[68px] border-b border-line'>
        <Avatar user={DEMO_FRIEND} size='sm' online />
        <div className='leading-tight'>
          <p className='text-sm font-bold'>{DEMO_FRIEND.fullName}</p>
          <p className={`text-xs font-medium ${isTyping ? 'text-accent-text' : 'text-online'}`}>{isTyping ? 'typing…' : 'Online'}</p>
        </div>
      </div>
      <div className='flex flex-col justify-end gap-1.5 h-[226px] px-4 py-4'>
        <AnimatePresence initial={false}>
          {DEMO_SCRIPT.slice(0, count).map(({ own, text }) => (
            <motion.p key={text} layout
              initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={spring}
              className={`w-fit max-w-[80%] px-4 py-2 rounded-[20px] text-sm ${own ? 'self-end origin-bottom-right rounded-br-md grad text-white' : 'origin-bottom-left rounded-bl-md bg-bubble border border-line'}`}>
              {text}
            </motion.p>
          ))}
          {isTyping && (
            <motion.div key='typing' layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              className='w-fit origin-bottom-left px-4 h-9 flex items-center rounded-[20px] rounded-bl-md bg-bubble border border-line text-muted'>
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
        <p className={`self-end flex items-center gap-1 pr-1 text-[11px] font-medium transition-opacity duration-300 ${isSeen ? 'opacity-100 text-accent-text' : 'opacity-0'}`}>
          <Checks size={14} weight='bold' /> Seen
        </p>
      </div>
    </motion.div>
  )
}

const FEATURES = [
  [Lightning, 'Instant delivery'],
  [Checks, 'Read receipts'],
  [Images, 'Photo sharing'],
  [Palette, 'Colour themes'],
]

// ---------- right side: the form ----------

const Field = ({ id, label, hint, icon: Icon, children }) => (
  <div>
    <div className='flex items-baseline justify-between mb-1.5 px-1'>
      <label htmlFor={id} className='text-[13px] font-semibold text-muted'>{label}</label>
      {hint && <span className='text-[11px] font-medium tabular-nums text-faint'>{hint}</span>}
    </div>
    <div className='group relative'>
      <Icon size={18} weight='duotone' className='pointer-events-none absolute left-4 top-[15px] text-faint transition-colors group-focus-within:text-accent-text' />
      {children}
    </div>
  </div>
)

const inputClass = `w-full h-12 pl-11 pr-4 rounded-2xl bg-raised border border-line text-[15px] font-medium text-ink placeholder:text-faint placeholder:font-normal
  transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong
  focus:border-[color-mix(in_oklab,var(--a1)_70%,transparent)] focus:bg-transparent focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--a1)_16%,transparent)]`

const STRENGTH = [
  { label: 'Too short', color: 'var(--danger)' },
  { label: 'Weak', color: '#ff9f43' },
  { label: 'Okay', color: '#ffd43b' },
  { label: 'Good', color: '#51cf66' },
  { label: 'Strong', color: 'var(--online)' },
]

// 0 (too short) to 4 (strong)
const getPasswordStrength = (password) => {
  if (password.length < 6) return 0
  let score = 1
  if (password.length >= 10) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  return score
}

const LoginPage = () => {

  const [currState, setCurrState] = useState("Login")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [bio, setBio] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {login} = useContext(AuthContext)

  const isSignup = currState === "Sign up"
  const strength = getPasswordStrength(password)

  const onSubmitHandler = async (event)=>{
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true)
    const success = isSignup
      ? await login('signup', {fullName, email, password, bio})
      : await login('login', {email, password})
    // on success this page is replaced by the chat, so only a failure needs the button back
    if (!success) setIsSubmitting(false)
  }

  return (
    <div className='h-app overflow-y-auto'>
      <div className='min-h-full max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center gap-10 px-5 sm:px-8 py-6'>
        {/* -------------------left------------------ */}

        <section className='hidden lg:flex flex-col gap-8 py-4'>
          <Logo />
          <div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}
              className='text-[clamp(2.5rem,4vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.035em]'>
              Talk to your people,<br /><span className='grad-text'>in real time.</span>
            </motion.h1>
            <p className='mt-4 max-w-md text-[17px] text-muted'>
              Messages that land the instant you hit send. See who is online, who is typing and when your message was read.
            </p>
          </div>

          <LiveDemo />

          <ul className='flex flex-wrap gap-2'>
            {FEATURES.map(([Icon, label], index) => (
              <motion.li key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 + index * 0.07 }}
                className='flex items-center gap-2 h-9 px-3.5 rounded-full bg-raised border border-line text-[13px] font-semibold text-muted'>
                <Icon size={16} weight='fill' className='text-accent-text' /> {label}
              </motion.li>
            ))}
          </ul>
        </section>

        {/* -------------------right------------------ */}

        <section className='w-full max-w-[440px] mx-auto'>
          <div className='relative z-20 flex items-center justify-between mb-6 lg:fixed lg:top-5 lg:right-6 lg:mb-0'>
            <Logo className='lg:hidden' />
            <AppearanceMenu placement='below' />
          </div>

          <motion.form onSubmit={onSubmitHandler} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}
            className='glass p-6 sm:p-8 rounded-[32px]'>
            <motion.div>
              <h2 className='text-[30px] font-extrabold leading-tight tracking-tight'>
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className='mt-1.5 text-muted'>
                {isSignup ? 'It takes less than a minute.' : 'Log in to see what you missed.'}
              </p>
            </motion.div>

            <motion.div role='tablist' aria-label='Log in or sign up' className='relative grid grid-cols-2 mt-6 p-1 rounded-2xl bg-raised'>
              {['Login', 'Sign up'].map((state) => (
                <button key={state} type='button' role='tab' aria-selected={currState === state} onClick={()=>setCurrState(state)}
                  className={`relative z-10 h-10 rounded-xl text-sm font-bold transition-colors ${currState === state ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                  {currState === state && (
                    <motion.span layoutId='auth-tab' transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      className='absolute inset-0 -z-10 rounded-xl bg-panel-solid border border-line shadow-sm' />
                  )}
                  {state === 'Login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </motion.div>

            <div className='mt-6 flex flex-col gap-4'>
              <AnimatePresence initial={false}>
                {isSignup && (
                  <motion.div key='name' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring}
                    className='overflow-hidden -m-1 p-1'>
                    <Field id='fullName' label='Full name' icon={User}>
                      <input id='fullName' onChange={(e)=>setFullName(e.target.value)} value={fullName}
                        type="text" autoComplete='name' className={inputClass} placeholder='Your name'
                        required minLength={2} maxLength={50}/>
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div>
                <Field id='email' label='Email' icon={EnvelopeSimple}>
                  <input id='email' onChange={(e)=>setEmail(e.target.value)} value={email}
                    type="email" autoComplete='email' placeholder='you@example.com' required className={inputClass}/>
                </Field>
              </motion.div>

              <motion.div>
                <Field id='password' label='Password' icon={LockKey}>
                  <input id='password' onChange={(e)=>setPassword(e.target.value)} value={password}
                    type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'}
                    placeholder={isSignup ? 'At least 6 characters' : 'Your password'} required minLength={isSignup ? 6 : undefined} maxLength={72}
                    className={`${inputClass} pr-12`}/>
                  <button type='button' onClick={()=>setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className='absolute right-1.5 top-1.5 grid place-items-center w-9 h-9 rounded-xl text-faint hover:text-ink hover:bg-hover transition-colors'>
                    {showPassword ? <EyeSlash size={19} weight='duotone' /> : <Eye size={19} weight='duotone' />}
                  </button>
                </Field>
              </motion.div>

              <AnimatePresence initial={false}>
                {isSignup && password && (
                  <motion.div key='strength' data-strength initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring}
                    className='overflow-hidden -mt-2'>
                    <div className='flex items-center gap-3 px-1'>
                      <div className='flex-1 grid grid-cols-4 gap-1.5'>
                        {[1, 2, 3, 4].map((step) => (
                          <span key={step} className='h-1.5 rounded-full bg-raised overflow-hidden'>
                            <motion.span className='block h-full rounded-full' initial={false}
                              animate={{ width: strength >= step ? '100%' : '0%', backgroundColor: STRENGTH[strength].color }} transition={{ duration: 0.25 }} />
                          </span>
                        ))}
                      </div>
                      <span className='w-16 text-right text-[11px] font-bold' style={{ color: STRENGTH[strength].color }}>{STRENGTH[strength].label}</span>
                    </div>
                  </motion.div>
                )}
                {isSignup && (
                  <motion.div key='bio' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring}
                    className='overflow-hidden -m-1 p-1'>
                    <Field id='bio' label='Bio' hint={bio ? `${bio.length}/${MAX_BIO_LENGTH}` : 'optional'} icon={PencilSimpleLine}>
                      <textarea id='bio' onChange={(e)=> setBio(e.target.value)} value={bio}
                        rows={2} maxLength={MAX_BIO_LENGTH} className={`${inputClass} h-auto py-3 resize-none`}
                        placeholder='A line about you'></textarea>
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button type='submit' disabled={isSubmitting} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
              className='group relative mt-7 flex items-center justify-center gap-2 w-full h-[52px] rounded-2xl grad glow overflow-hidden text-white text-base font-bold disabled:opacity-75'>
              <span aria-hidden='true' className='absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-md animate-shine' />
              {isSubmitting ? <CircleNotch size={20} className='animate-spin' /> : (
                <span className='relative flex items-center gap-2'>
                  {isSignup ? "Create account" : "Log in"}
                  <ArrowRight size={18} weight='bold' className='transition-transform group-hover:translate-x-1' />
                </span>
              )}
            </motion.button>

            <motion.p className='mt-6 text-center text-sm text-muted'>
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <button type='button' onClick={()=>setCurrState(isSignup ? "Login" : "Sign up")}
                className='font-bold text-accent-text hover:underline underline-offset-4'>
                {isSignup ? 'Log in' : 'Create an account'}
              </button>
            </motion.p>
          </motion.form>
        </section>
      </div>
    </div>
  )
}

export default LoginPage
