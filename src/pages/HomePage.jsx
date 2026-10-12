import React,{ useCallback, useContext, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import NavRail from '../components/NavRail'
import Sidebar from '../components/Sidebar'
import ChatContainer from '../components/ChatContainer'
import RightSidebar from '../components/RightSidebar'
import ImageLightbox from '../components/ImageLightbox'
import { ChatContext } from '../context/ChatContext'

const isWideScreen = () => window.matchMedia('(min-width: 80rem)').matches;

const HomePage = () => {

    const {selectedUser} = useContext(ChatContext);

    // the details column starts open only where there is room for it
    const [isDetailsOpen, setIsDetailsOpen] = useState(isWideScreen);
    const [lightbox, setLightbox] = useState(null); // { src, user, title } of the picture being viewed

    const closeDetails = useCallback(() => setIsDetailsOpen(false), []);
    const closeLightbox = useCallback(() => setLightbox(null), []);

    const showDetails = Boolean(selectedUser) && isDetailsOpen;

    return (
    <main className='h-dvh flex md:gap-3 md:p-3'>
        <NavRail />
        <Sidebar />
        <ChatContainer
          isDetailsOpen={showDetails}
          onToggleDetails={() => setIsDetailsOpen((open) => !open)}
          onOpenImage={setLightbox}
        />
        <AnimatePresence>
          {showDetails && <RightSidebar key='details' onClose={closeDetails} onOpenImage={setLightbox} />}
        </AnimatePresence>
        <AnimatePresence>
          {lightbox && <ImageLightbox key='lightbox' {...lightbox} onClose={closeLightbox} />}
        </AnimatePresence>
    </main>
  )
}

export default HomePage
