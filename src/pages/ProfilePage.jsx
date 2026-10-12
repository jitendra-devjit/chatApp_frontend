import React, { useCallback, useContext, useRef, useState,} from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CalendarBlank, Camera, Check, CircleNotch, EnvelopeSimple, Eye, Trash, X } from '@phosphor-icons/react'
import { AuthContext } from'../context/AuthContext';
import { cropToSquare, formatJoined, IMAGE_TYPES, MAX_BIO_LENGTH } from '../lib/utils';
import { AppearanceOptions } from '../components/AppearanceMenu';
import Avatar from '../components/Avatar';
import ImageLightbox from '../components/ImageLightbox';

// the original can be big, it is cropped and shrunk before upload
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024

const spring = { type: 'spring', stiffness: 440, damping: 36 }

const inputClass = `w-full px-4 rounded-2xl bg-raised border border-line text-[15px] font-medium text-ink placeholder:text-faint placeholder:font-normal
  transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong
  focus:border-[color-mix(in_oklab,var(--a1)_70%,transparent)] focus:bg-transparent focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--a1)_16%,transparent)]`

const actionClass = 'inline-flex items-center gap-2 h-10 px-4 rounded-full bg-raised border border-line text-sm font-semibold transition-colors hover:bg-hover'

// Shows a freshly picked photo the way others will see it, before it is used
const PhotoPreview = ({ photo, name, onUse, onPickAnother, onCancel }) => (
  <motion.div role='dialog' aria-modal='true' aria-label='Preview photo' onClick={onCancel}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className='fixed inset-0 z-50 grid place-items-center p-4 bg-overlay backdrop-blur-md'>
    <motion.div onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 10 }} transition={spring}
      className='w-full max-w-sm p-6 rounded-[32px] bg-panel-solid border border-line-strong shadow-2xl text-center'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-extrabold tracking-tight'>Preview photo</h2>
        <button type='button' aria-label='Cancel' onClick={onCancel} className='grid place-items-center w-9 h-9 rounded-full text-muted hover:bg-hover hover:text-ink'>
          <X size={18} weight='bold' />
        </button>
      </div>

      <Avatar user={{ fullName: name }} src={photo} size='2xl' ring className='mx-auto mt-6 scale-110' />

      <p className='mt-8 text-xs font-bold uppercase tracking-wider text-faint'>How it looks in chats</p>
      <div className='mt-2 flex items-center gap-3 p-3 rounded-2xl bg-raised border border-line text-left'>
        <Avatar user={{ fullName: name }} src={photo} online />
        <div className='min-w-0'>
          <p className='truncate font-bold'>{name || 'You'}</p>
          <p className='truncate text-[13px] text-muted'>Hey! This is my new photo 👋</p>
        </div>
      </div>

      <div className='mt-6 grid grid-cols-2 gap-2.5'>
        <button type='button' onClick={onPickAnother} className='h-12 rounded-2xl bg-raised border border-line text-sm font-bold hover:bg-hover transition-colors'>
          Choose another
        </button>
        <motion.button type='button' onClick={onUse} whileTap={{ scale: 0.97 }} autoFocus
          className='flex items-center justify-center gap-2 h-12 rounded-2xl grad glow text-white text-sm font-bold'>
          <Check size={17} weight='bold' /> Use photo
        </motion.button>
      </div>
    </motion.div>
  </motion.div>
)

const ProfilePage = () => {

  const {authUser, updateProfile} = useContext(AuthContext);
  const navigate = useNavigate();
  const[name, setName] = useState(authUser.fullName)
  const [bio, setBio] = useState(authUser.bio || "")
  // undefined: photo untouched, "": remove it, data URL: new photo to upload
  const [newPhoto, setNewPhoto] = useState(undefined)
  const [previewPhoto, setPreviewPhoto] = useState(null) // picked photo waiting to be confirmed
  const [isViewingPhoto, setIsViewingPhoto] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileRef = useRef(null)

  const currentPhoto = newPhoto === undefined ? authUser.profilePic : newPhoto
  const previewUser = { ...authUser, fullName: name, profilePic: currentPhoto }

  const closeViewer = useCallback(() => setIsViewingPhoto(false), [])

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Choose a PNG, JPG, WEBP or GIF image")
      return
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      toast.error("Image must be smaller than 12 MB")
      return
    }
    try {
      setPreviewPhoto(await cropToSquare(file))
    } catch (error) {
      toast.error(error.message)
    }
  }

  const hasChanges = newPhoto !== undefined || name.trim() !== authUser.fullName || bio.trim() !== (authUser.bio || "")

  const handleSubmit = async (e)=> {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true)
    const body = {fullName: name.trim(), bio: bio.trim()}
    if (newPhoto !== undefined) body.profilePic = newPhoto

    const saved = await updateProfile(body);
    if (saved) navigate('/');
    else setIsSaving(false)
  }

  return (
    <div className='h-dvh overflow-y-auto'>
      <div className='max-w-2xl mx-auto px-4 py-6 sm:py-10'>
        <div className='flex items-center gap-3'>
          <motion.button type='button' onClick={()=>navigate('/')} whileTap={{ scale: 0.92 }} aria-label='Back to chats'
            className='glass grid place-items-center w-11 h-11 rounded-full text-ink'>
            <ArrowLeft size={20} weight='bold' />
          </motion.button>
          <h1 className='text-2xl font-extrabold tracking-tight'>Your profile</h1>
        </div>

        <form onSubmit={handleSubmit} className='glass mt-6 rounded-[32px] overflow-hidden'>
          {/* cover in the accent colours */}
          <div className='relative h-36 grad overflow-hidden'>
            <div className='absolute -top-10 -right-6 w-48 h-48 rounded-full bg-white/20 blur-2xl' />
            <div className='absolute -bottom-16 left-10 w-56 h-56 rounded-full bg-black/20 blur-2xl' />
          </div>

          <div className='px-5 sm:px-8 pb-8'>
            <div className='flex flex-wrap items-end justify-between gap-4 -mt-[72px]'>
              <div className='relative'>
                <motion.button type='button' onClick={() => setIsViewingPhoto(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  aria-label='View profile photo' className='block rounded-full'>
                  <Avatar user={previewUser} size='2xl' ring />
                </motion.button>
                <motion.button type='button' onClick={() => fileRef.current?.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  aria-label='Change photo' title='Change photo'
                  className='absolute bottom-1 right-1 grid place-items-center w-11 h-11 rounded-full grad glow text-white border-4 border-[var(--panel-solid)]'>
                  <Camera size={19} weight='fill' />
                </motion.button>
                <input ref={fileRef} onChange={handleImageChange} type="file" id='avatar' accept='image/png,image/jpeg,image/webp,image/gif' hidden/>
              </div>

              <div className='flex flex-wrap gap-2 pb-2'>
                <button type='button' onClick={() => setIsViewingPhoto(true)} className={actionClass}>
                  <Eye size={17} weight='duotone' /> View
                </button>
                <button type='button' onClick={() => fileRef.current?.click()} className={actionClass}>
                  <Camera size={17} weight='duotone' /> {currentPhoto ? 'Change' : 'Upload'}
                </button>
                {currentPhoto && (
                  <button type='button' onClick={() => setNewPhoto("")} className={`${actionClass} text-danger`}>
                    <Trash size={17} weight='duotone' /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className='mt-4'>
              <p className='text-2xl font-extrabold tracking-tight [overflow-wrap:anywhere]'>{name.trim() || authUser.fullName}</p>
              <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-muted'>
                <span className='flex items-center gap-1.5'><EnvelopeSimple size={15} weight='fill' /> {authUser.email}</span>
                {authUser.createdAt && (
                  <span className='flex items-center gap-1.5'><CalendarBlank size={15} weight='fill' /> Joined {formatJoined(authUser.createdAt)}</span>
                )}
              </div>
            </div>

            <div className='mt-7 flex flex-col gap-5'>
              <div>
                <label htmlFor='name' className='block mb-1.5 px-1 text-[13px] font-semibold text-muted'>Full name</label>
                <input id='name' onChange={(e)=>setName(e.target.value)} value={name}
                  type="text" autoComplete='name' placeholder='Your name' required minLength={2} maxLength={50}
                  className={`${inputClass} h-12`}/>
              </div>

              <div>
                <div className='flex items-baseline justify-between mb-1.5 px-1'>
                  <label htmlFor='bio' className='text-[13px] font-semibold text-muted'>Bio</label>
                  <span className='text-[11px] font-medium tabular-nums text-faint'>{bio.length}/{MAX_BIO_LENGTH}</span>
                </div>
                <textarea id='bio' onChange={(e)=>setBio(e.target.value)} value={bio}
                  placeholder='A line about you' maxLength={MAX_BIO_LENGTH} rows={3}
                  className={`${inputClass} py-3 resize-none`}></textarea>
              </div>

              <div className='p-5 rounded-3xl bg-raised border border-line'>
                <p className='mb-4 text-[15px] font-bold'>Appearance</p>
                <AppearanceOptions />
              </div>
            </div>

            <div className='mt-7 flex items-center justify-between gap-3'>
              <p className={`text-[13px] font-semibold transition-opacity ${hasChanges ? 'opacity-100 text-accent-text' : 'opacity-0'}`}>
                Unsaved changes
              </p>
              <div className='flex gap-2.5 shrink-0'>
                <button type='button' onClick={()=>navigate('/')}
                  className='h-12 px-5 rounded-2xl text-sm font-bold text-muted hover:text-ink hover:bg-hover transition-colors'>
                  Cancel
                </button>
                <motion.button type='submit' disabled={isSaving || !hasChanges} whileTap={hasChanges ? { scale: 0.97 } : undefined}
                  className={`grid place-items-center h-12 min-w-32 px-6 rounded-2xl text-sm font-bold transition-colors ${hasChanges ? 'grad glow text-white' : 'bg-raised text-faint'}`}>
                  {isSaving ? <CircleNotch size={18} className='animate-spin' /> : 'Save changes'}
                </motion.button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {previewPhoto && (
          <PhotoPreview key='preview' photo={previewPhoto} name={name.trim()}
            onUse={() => { setNewPhoto(previewPhoto); setPreviewPhoto(null) }}
            onPickAnother={() => { setPreviewPhoto(null); fileRef.current?.click() }}
            onCancel={() => setPreviewPhoto(null)} />
        )}
        {isViewingPhoto && (
          <ImageLightbox key='viewer' src={currentPhoto || null} user={previewUser} title={name.trim() || authUser.fullName} onClose={closeViewer} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProfilePage;
