import React, { useContext, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Camera, Check, CircleNotch, MagnifyingGlass, UsersThree, X } from '@phosphor-icons/react'
import { ChatContext } from '../context/ChatContext'
import { cropToSquare, IMAGE_TYPES, MAX_BIO_LENGTH } from '../lib/utils'
import Avatar from './Avatar'
import Modal, { ModalHeader } from './Modal'

const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024

const inputClass = `w-full px-4 rounded-2xl bg-raised border border-line text-[15px] font-medium text-ink placeholder:text-faint placeholder:font-normal
  transition-[border-color,box-shadow,background-color] duration-200 hover:border-line-strong
  focus:border-[color-mix(in_oklab,var(--a1)_70%,transparent)] focus:bg-transparent focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--a1)_16%,transparent)]`

const primaryClass = 'flex items-center justify-center gap-2 h-12 px-6 rounded-2xl text-sm font-bold transition-colors'

const SubmitButton = ({ isBusy, disabled, children }) => (
  <motion.button type='submit' disabled={isBusy || disabled} whileTap={disabled ? undefined : { scale: 0.97 }}
    className={`${primaryClass} ${disabled ? 'bg-raised text-faint' : 'grad glow text-white'}`}>
    {isBusy ? <CircleNotch size={18} className='animate-spin' /> : children}
  </motion.button>
)

// Searchable list of people with a tick on the chosen ones
const PeoplePicker = ({ people, selectedIds, onToggle }) => {
  const [query, setQuery] = useState("")
  const term = query.trim().toLowerCase()
  const shown = term ? people.filter((user) => user.fullName.toLowerCase().includes(term)) : people
  const selected = people.filter((user) => selectedIds.includes(user._id))

  return (
    <div className='flex flex-col min-h-0'>
      {selected.length > 0 && (
        <div className='flex flex-wrap gap-1.5 px-6 pb-3'>
          {selected.map((user) => (
            <motion.button key={user._id} type='button' layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={() => onToggle(user._id)} aria-label={`Remove ${user.fullName}`}
              className='flex items-center gap-1.5 h-9 pl-1 pr-2.5 rounded-full grad-soft border border-line-strong text-[13px] font-semibold'>
              <Avatar user={user} size='xs' /> {user.fullName.split(' ')[0]} <X size={11} weight='bold' className='text-muted' />
            </motion.button>
          ))}
        </div>
      )}

      <div className='px-6 pb-2 shrink-0'>
        <div className='group flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-raised border border-transparent focus-within:border-accent-text'>
          <MagnifyingGlass size={17} weight='bold' className='text-faint shrink-0 group-focus-within:text-accent-text' />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type='text' aria-label='Search people' placeholder='Search people'
            className='flex-1 min-w-0 bg-transparent text-sm font-medium text-ink placeholder:text-faint placeholder:font-normal' />
        </div>
      </div>

      <ul className='flex-1 min-h-0 overflow-y-auto px-3 pb-2' role='listbox' aria-multiselectable='true'>
        {shown.length === 0 && <li className='px-3 py-6 text-center text-sm text-muted'>Nobody found.</li>}
        {shown.map((user) => {
          const isSelected = selectedIds.includes(user._id)
          return (
            <li key={user._id}>
              <button type='button' role='option' aria-selected={isSelected} onClick={() => onToggle(user._id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-2xl text-left transition-colors ${isSelected ? 'grad-soft' : 'hover:bg-raised'}`}>
                <Avatar user={user} size='sm' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[15px] font-semibold'>{user.fullName}</p>
                  {user.bio && <p className='truncate text-xs text-muted'>{user.bio}</p>}
                </div>
                <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-full border-2 transition-colors ${isSelected ? 'grad border-transparent text-white' : 'border-line-strong text-transparent'}`}>
                  <Check size={13} weight='bold' />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const toggleIn = (ids, id) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])

// Round picture with a camera button, for the group photo
const PhotoField = ({ name, photo, onChange }) => {
  const fileRef = useRef(null)

  const handleChange = async (e) => {
    const file = e.target.files[0]
    e.target.value = ""
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Choose a PNG, JPG, WEBP or GIF image")
    if (file.size > MAX_ORIGINAL_BYTES) return toast.error("Image must be smaller than 12 MB")
    try {
      onChange(await cropToSquare(file))
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <button type='button' onClick={() => fileRef.current?.click()} aria-label='Choose a group photo' className='relative shrink-0 rounded-full'>
      {photo || name.trim()
        ? <Avatar user={{ fullName: name }} src={photo || undefined} size='lg' />
        : <span className='grid place-items-center w-16 h-16 rounded-full bg-raised border border-dashed border-line-strong text-muted'><UsersThree size={26} weight='duotone' /></span>}
      <span className='absolute -bottom-0.5 -right-0.5 grid place-items-center w-7 h-7 rounded-full grad text-white border-[3px] border-[var(--panel-solid)]'>
        <Camera size={13} weight='fill' />
      </span>
      <input ref={fileRef} onChange={handleChange} type='file' accept='image/png,image/jpeg,image/webp,image/gif' hidden />
    </button>
  )
}

// ---------- create a group ----------

export const CreateGroupModal = ({ onClose }) => {
  const { users, createGroup } = useContext(ChatContext)
  const [name, setName] = useState("")
  const [photo, setPhoto] = useState(null)
  const [memberIds, setMemberIds] = useState([])
  const [isBusy, setIsBusy] = useState(false)

  const people = useMemo(() => [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)), [users])
  const canCreate = name.trim().length >= 2 && memberIds.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canCreate || isBusy) return
    setIsBusy(true)
    const body = { name: name.trim(), memberIds }
    if (photo) body.avatar = photo
    if (await createGroup(body)) onClose()
    else setIsBusy(false)
  }

  return (
    <Modal label='New group' onClose={onClose} className='max-w-md h-[640px]'>
      <form onSubmit={handleSubmit} className='flex flex-col min-h-0 flex-1'>
        <ModalHeader title='New group' subtitle='Name it, then choose who is in.' onClose={onClose} />

        <div className='flex items-center gap-4 px-6 pb-5 shrink-0'>
          <PhotoField name={name} photo={photo} onChange={setPhoto} />
          <input value={name} onChange={(e) => setName(e.target.value)} type='text' aria-label='Group name' placeholder='Group name'
            maxLength={50} autoFocus className={`${inputClass} h-12`} />
        </div>

        <p className='px-7 pb-2 text-xs font-bold uppercase tracking-wider text-faint shrink-0'>
          Members {memberIds.length > 0 && <span className='text-accent-text'>· {memberIds.length} selected</span>}
        </p>
        <PeoplePicker people={people} selectedIds={memberIds} onToggle={(id) => setMemberIds((ids) => toggleIn(ids, id))} />

        <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-line shrink-0'>
          <button type='button' onClick={onClose} className={`${primaryClass} text-muted hover:bg-hover hover:text-ink`}>Cancel</button>
          <SubmitButton isBusy={isBusy} disabled={!canCreate}>Create group</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

// ---------- add people to a group ----------

export const AddMembersModal = ({ group, onClose }) => {
  const { users, addGroupMembers } = useContext(ChatContext)
  const [memberIds, setMemberIds] = useState([])
  const [isBusy, setIsBusy] = useState(false)

  const people = useMemo(() => {
    const inGroup = new Set(group.members.map((member) => member.user._id))
    return users.filter((user) => !inGroup.has(user._id)).sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [users, group.members])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (memberIds.length === 0 || isBusy) return
    setIsBusy(true)
    if (await addGroupMembers(group._id, memberIds)) onClose()
    else setIsBusy(false)
  }

  return (
    <Modal label='Add members' onClose={onClose} className='max-w-md h-[560px]'>
      <form onSubmit={handleSubmit} className='flex flex-col min-h-0 flex-1'>
        <ModalHeader title='Add members' subtitle={`To ${group.fullName}`} onClose={onClose} />
        {people.length === 0
          ? <p className='flex-1 px-6 py-10 text-center text-sm text-muted'>Everybody is already in this group.</p>
          : <PeoplePicker people={people} selectedIds={memberIds} onToggle={(id) => setMemberIds((ids) => toggleIn(ids, id))} />}
        <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-line shrink-0'>
          <button type='button' onClick={onClose} className={`${primaryClass} text-muted hover:bg-hover hover:text-ink`}>Cancel</button>
          <SubmitButton isBusy={isBusy} disabled={memberIds.length === 0}>
            Add{memberIds.length > 0 ? ` ${memberIds.length}` : ''}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

// ---------- change name, description and photo ----------

export const EditGroupModal = ({ group, onClose }) => {
  const { updateGroup } = useContext(ChatContext)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || "")
  // undefined: photo untouched, "": remove it, data URL: new photo to upload
  const [newPhoto, setNewPhoto] = useState(undefined)
  const [isBusy, setIsBusy] = useState(false)

  const photo = newPhoto === undefined ? group.avatar : newPhoto
  const hasChanges = newPhoto !== undefined || name.trim() !== group.name || description.trim() !== (group.description || "")
  const canSave = hasChanges && name.trim().length >= 2

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSave || isBusy) return
    setIsBusy(true)
    const body = { name: name.trim(), description: description.trim() }
    if (newPhoto !== undefined) body.avatar = newPhoto
    if (await updateGroup(group._id, body)) onClose()
    else setIsBusy(false)
  }

  return (
    <Modal label='Edit group' onClose={onClose} className='max-w-md'>
      <form onSubmit={handleSubmit}>
        <ModalHeader title='Edit group' onClose={onClose} />
        <div className='flex flex-col gap-5 px-6 pb-2'>
          <div className='flex items-center gap-4'>
            <PhotoField name={name} photo={photo} onChange={setNewPhoto} />
            <div className='min-w-0 text-sm'>
              <p className='font-semibold'>Group photo</p>
              {photo
                ? <button type='button' onClick={() => setNewPhoto("")} className='mt-0.5 font-semibold text-danger hover:underline'>Remove photo</button>
                : <p className='text-muted'>Tap the picture to choose one.</p>}
            </div>
          </div>
          <div>
            <label htmlFor='group-name' className='block mb-1.5 px-1 text-[13px] font-semibold text-muted'>Name</label>
            <input id='group-name' value={name} onChange={(e) => setName(e.target.value)} type='text' maxLength={50} required minLength={2}
              className={`${inputClass} h-12`} />
          </div>
          <div>
            <div className='flex items-baseline justify-between mb-1.5 px-1'>
              <label htmlFor='group-description' className='text-[13px] font-semibold text-muted'>Description</label>
              <span className='text-[11px] font-medium tabular-nums text-faint'>{description.length}/{MAX_BIO_LENGTH}</span>
            </div>
            <textarea id='group-description' value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={MAX_BIO_LENGTH}
              placeholder='What is this group about?' className={`${inputClass} py-3 resize-none`} />
          </div>
        </div>
        <div className='flex justify-end gap-2.5 px-6 py-5'>
          <button type='button' onClick={onClose} className={`${primaryClass} text-muted hover:bg-hover hover:text-ink`}>Cancel</button>
          <SubmitButton isBusy={isBusy} disabled={!canSave}>Save</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}
