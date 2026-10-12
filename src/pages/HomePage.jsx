import React,{ useCallback, useContext, useState } from 'react'
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
    const [lightboxImage, setLightboxImage] = useState(null);

    const closeDetails = useCallback(() => setIsDetailsOpen(false), []);
    const closeLightbox = useCallback(() => setLightboxImage(null), []);

    const showDetails = Boolean(selectedUser) && isDetailsOpen;

    return (
    <main className={`h-dvh grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] ${showDetails ? 'xl:grid-cols-[340px_minmax(0,1fr)_320px]' : ''}`}>
        <Sidebar />
        <ChatContainer
          isDetailsOpen={showDetails}
          onToggleDetails={() => setIsDetailsOpen((open) => !open)}
          onOpenImage={setLightboxImage}
        />
        {showDetails && <RightSidebar onClose={closeDetails} onOpenImage={setLightboxImage} />}
        {lightboxImage && <ImageLightbox src={lightboxImage} onClose={closeLightbox} />}
    </main>
  )
}

export default HomePage
