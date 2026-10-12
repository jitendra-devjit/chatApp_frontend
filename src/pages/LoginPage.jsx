import React, { useContext, useState } from 'react'
import { ArrowRight, CircleNotch, Eye, EyeSlash, Moon, Sun } from '@phosphor-icons/react'
import { AuthContext } from '../context/AuthContext'
import { ThemeContext } from '../context/ThemeContext'
import { MAX_BIO_LENGTH } from '../lib/utils'
import IconButton from '../components/IconButton'
import Logo from '../components/Logo'

const inputClass = `w-full h-11 px-3.5 rounded-xl bg-raised border border-line text-[15px] text-ink placeholder:text-faint
  transition-colors hover:border-line-strong focus:border-accent-text`

const Field = ({ label, hint, htmlFor, children }) => (
  <div>
    <div className='flex items-baseline justify-between mb-1.5'>
      <label htmlFor={htmlFor} className='text-[13px] font-medium text-muted'>{label}</label>
      {hint && <span className='font-mono text-[11px] text-faint'>{hint}</span>}
    </div>
    {children}
  </div>
)

// the little conversation on the left side of the page
const PREVIEW_MESSAGES = [
  { own: false, text: 'Are we still on for Saturday?', className: '-rotate-2' },
  { own: true, text: 'Obviously. I already told everyone 😄', className: 'rotate-1 translate-x-3' },
  { own: false, text: 'Perfect. Bring the good speakers.', className: '-rotate-1 -translate-x-2' },
]

const LoginPage = () => {

  const [currState, setCurrState] = useState("Login")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [bio, setBio] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {login} = useContext(AuthContext)
  const {theme, toggleTheme} = useContext(ThemeContext)

  const isSignup = currState === "Sign up"

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
    <div className='h-dvh overflow-y-auto grid lg:grid-cols-[1.1fr_1fr] bg-canvas'>
      {/* -------------------left------------------ */}

      <section className='relative hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-surface border-r border-line overflow-hidden dot-grid'>
        <Logo />

        <div>
          <div className='flex flex-col gap-2.5 max-w-sm mb-14' aria-hidden='true'>
            {PREVIEW_MESSAGES.map(({ own, text, className }) => (
              <p key={text} className={`w-fit max-w-[85%] px-4 py-2.5 rounded-[22px] text-[15px] shadow-xl shadow-black/10 ${className}
                ${own ? 'self-end rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-raised border border-line text-ink'}`}>
                {text}
              </p>
            ))}
          </div>

          <h1 className='font-serif text-[clamp(3.25rem,5.2vw,5.5rem)] leading-[0.98] tracking-[-0.02em]'>
            Where your people<br />
            <span className='italic'>actually talk.</span>
          </h1>
          <p className='mt-6 max-w-md text-lg text-muted'>
            Messages that land the moment you send them. Photos, presence and nothing that gets in the way.
          </p>
        </div>

        <p className='label-mono text-faint'>Realtime messaging · Photo sharing · Live presence</p>
      </section>

      {/* -------------------right------------------ */}

      <section className='relative flex flex-col min-h-full'>
        <div className='flex items-center justify-between h-16 px-5 sm:px-8 shrink-0'>
          <Logo className='lg:invisible' />
          <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </div>

        <form onSubmit={onSubmitHandler} className='w-full max-w-[380px] m-auto px-5 sm:px-0 py-10'>
          <h2 className='font-serif text-[44px] leading-none tracking-tight'>
            {isSignup ? <>Join the <span className='italic'>conversation.</span></> : <>Welcome <span className='italic'>back.</span></>}
          </h2>
          <p className='mt-3 text-muted'>
            {isSignup ? 'It takes less than a minute.' : 'Log in to see what you missed.'}
          </p>

          <div className='mt-9 flex flex-col gap-4'>
            {isSignup && (
              <Field label='Full name' htmlFor='fullName'>
                <input id='fullName' onChange={(e)=>setFullName(e.target.value)} value={fullName}
                  type="text" autoComplete='name' className={inputClass} placeholder='Jitendra Devatwal'
                  required minLength={2} maxLength={50} autoFocus/>
              </Field>
            )}

            <Field label='Email' htmlFor='email'>
              <input id='email' onChange={(e)=>setEmail(e.target.value)} value={email}
                type="email" autoComplete='email' placeholder='you@example.com' required className={inputClass}/>
            </Field>

            <Field label='Password' htmlFor='password' hint={isSignup ? 'min. 6 characters' : undefined}>
              <div className='relative'>
                <input id='password' onChange={(e)=>setPassword(e.target.value)} value={password}
                  type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder='••••••••' required minLength={isSignup ? 6 : undefined} maxLength={72}
                  className={`${inputClass} pr-11`}/>
                <button type='button' onClick={()=>setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className='absolute right-1 top-1 grid place-items-center w-9 h-9 rounded-lg text-faint hover:text-ink'>
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {isSignup && (
              <Field label='Bio' htmlFor='bio' hint={bio ? `${bio.length}/${MAX_BIO_LENGTH}` : 'optional'}>
                <textarea id='bio' onChange={(e)=> setBio(e.target.value)} value={bio}
                  rows={2} maxLength={MAX_BIO_LENGTH} className={`${inputClass} h-auto py-2.5 resize-none`}
                  placeholder='A line about you'></textarea>
              </Field>
            )}
          </div>

          <button type='submit' disabled={isSubmitting}
            className='group mt-7 flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-accent text-accent-ink font-semibold
              transition-all duration-150 hover:brightness-105 active:scale-[0.99] disabled:opacity-70'>
            {isSubmitting ? <CircleNotch size={18} className='animate-spin' /> : (
              <>
                {isSignup ? "Create account" : "Log in"}
                <ArrowRight size={16} weight='bold' className='transition-transform group-hover:translate-x-0.5' />
              </>
            )}
          </button>

          <p className='mt-6 text-sm text-muted'>
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <button type='button' onClick={()=>setCurrState(isSignup ? "Login" : "Sign up")}
              className='font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent-text'>
              {isSignup ? 'Log in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}

export default LoginPage
