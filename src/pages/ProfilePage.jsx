import React, { useContext, useEffect, useState,} from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, CircleNotch } from '@phosphor-icons/react'
import { AuthContext } from'../context/AuthContext';
import { fileToDataUrl, MAX_BIO_LENGTH, validateImageFile } from '../lib/utils';
import Avatar from '../components/Avatar';

const inputClass = `w-full px-3.5 rounded-xl bg-raised border border-line text-[15px] text-ink placeholder:text-faint
  transition-colors hover:border-line-strong focus:border-accent-text`

const ProfilePage = () => {

  const {authUser, updateProfile} = useContext(AuthContext);
  const [selectedImg, setSelectedImg] = useState(null) // { file, url } of a newly picked picture
  const navigate = useNavigate();
  const[name, setName] = useState(authUser.fullName)
  const [bio, setBio] = useState(authUser.bio || "")
  const [isSaving, setIsSaving] = useState(false)

  // free the preview when it is replaced or the page is left
  useEffect(() => {
    if (!selectedImg) return
    return () => URL.revokeObjectURL(selectedImg.url)
  }, [selectedImg])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setSelectedImg({ file, url: URL.createObjectURL(file) })
  }

  const hasChanges = selectedImg || name.trim() !== authUser.fullName || bio.trim() !== (authUser.bio || "")

  const handleSubmit = async (e)=> {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true)
    try {
      const body = {fullName: name.trim(), bio: bio.trim()}
      if(selectedImg) body.profilePic = await fileToDataUrl(selectedImg.file)

      const saved = await updateProfile(body);
      if (saved) navigate('/');
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='h-dvh overflow-y-auto bg-canvas dot-grid'>
      <div className='max-w-xl mx-auto px-5 py-8 sm:py-14'>
        <button type='button' onClick={()=>navigate('/')}
          className='inline-flex items-center gap-2 -ml-2 px-2 h-9 rounded-xl text-sm text-muted hover:text-ink hover:bg-hover transition-colors'>
          <ArrowLeft size={16} /> Back to chats
        </button>

        <h1 className='mt-8 font-serif text-[52px] leading-none tracking-tight'>
          Your <span className='italic'>profile.</span>
        </h1>
        <p className='mt-3 text-muted'>This is how other people see you.</p>

        <form onSubmit={handleSubmit} className='mt-10 flex flex-col gap-7 p-6 sm:p-8 rounded-[28px] bg-surface border border-line'>
          <div className='flex items-center gap-5'>
            <label htmlFor="avatar" className='group relative rounded-[30px]'>
              <input onChange={handleImageChange} type="file" id='avatar' accept='image/png,image/jpeg,image/webp' className='sr-only peer'/>
              <Avatar user={{ ...authUser, fullName: name }} src={selectedImg?.url} size='lg' />
              <span className='absolute inset-0 grid place-items-center rounded-[30px] bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 peer-focus-visible:opacity-100'>
                <Camera size={26} />
              </span>
            </label>
            <div>
              <label htmlFor="avatar" className='inline-flex items-center h-9 px-3.5 rounded-xl border border-line-strong text-sm font-medium hover:bg-hover transition-colors'>
                {authUser.profilePic || selectedImg ? 'Change photo' : 'Upload photo'}
              </label>
              <p className='mt-2 text-xs text-faint'>PNG, JPG or WEBP, up to 3 MB.</p>
            </div>
          </div>

          <div>
            <label htmlFor='name' className='block mb-1.5 text-[13px] font-medium text-muted'>Full name</label>
            <input id='name' onChange={(e)=>setName(e.target.value)} value={name}
              type="text" autoComplete='name' placeholder='Your name' required minLength={2} maxLength={50}
              className={`${inputClass} h-11`}/>
          </div>

          <div>
            <div className='flex items-baseline justify-between mb-1.5'>
              <label htmlFor='bio' className='text-[13px] font-medium text-muted'>Bio</label>
              <span className='font-mono text-[11px] text-faint'>{bio.length}/{MAX_BIO_LENGTH}</span>
            </div>
            <textarea id='bio' onChange={(e)=>setBio(e.target.value)} value={bio}
              placeholder='A line about you' maxLength={MAX_BIO_LENGTH} rows={3}
              className={`${inputClass} py-2.5 resize-none`}></textarea>
          </div>

          <div className='flex items-center justify-between gap-3 pt-1'>
            <p className='truncate text-xs text-faint'>Signed in as <span className='font-mono'>{authUser.email}</span></p>
            <div className='flex gap-2 shrink-0'>
              <button type='button' onClick={()=>navigate('/')}
                className='h-10 px-4 rounded-xl text-sm font-medium text-muted hover:text-ink hover:bg-hover transition-colors'>
                Cancel
              </button>
              <button type='submit' disabled={isSaving || !hasChanges}
                className='grid place-items-center h-10 min-w-24 px-5 rounded-xl bg-accent text-accent-ink text-sm font-semibold
                  transition-all hover:brightness-105 active:scale-[0.98] disabled:bg-hover disabled:text-faint'>
                {isSaving ? <CircleNotch size={16} className='animate-spin' /> : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage;
