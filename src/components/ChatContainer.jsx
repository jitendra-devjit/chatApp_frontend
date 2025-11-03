import React, { useContext, useEffect, useRef, useState } from 'react'
import assets from '../assets/assets'
import { formatMessageTime } from '../lib/utils'        
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';
import toast from "react-hot-toast";
import Picker from 'emoji-picker-react';

const ChatContainer = () => {
  const { messages, selectedUser, setSelectedUser, sendMessage, getMessages } = useContext(ChatContext);
  const { authUser, onlineUsers } = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false); 
  const [showEmoji, setShowEmoji] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const scrollEnd = useRef();

  // Send text message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (isSending) return;           
    if (input.trim() === "") return;

    setIsSending(true);
    try {
      await sendMessage({ text: input.trim() });
      setInput(""); 
      setShowEmoji(false);
    } finally {
      setIsSending(false);
    }
  };

  // Send image
  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (isSending) return;
    setIsSending(true);
    setLoadingImage(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await sendMessage({ image: reader.result });
      } finally {
        setIsSending(false);
        setLoadingImage(false);
        e.target.value = ""; 
      }
    };
    reader.readAsDataURL(file);
  };

  const onEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  }

  useEffect(() => {
    if (selectedUser) getMessages(selectedUser._id);
  }, [selectedUser]);

  useEffect(() => {
    if (scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return selectedUser ? (
    <div className="h-full overflow-hidden relative backdrop-blur-lg">
      {/* ---------------- header ---------------- */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img src={selectedUser?.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full" />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser?.fullName}
          {onlineUsers.includes(selectedUser?._id) && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
        </p>
        <img onClick={() => setSelectedUser(null)} src={assets.arrow_icon} alt="" className="md:hidden max-w-7" />
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>

      {/* ---------------- chat body ---------------- */}
      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-2 justify-end ${msg.senderId !== authUser?._id && "flex-row-reverse"}`}>
            {msg.image ? (
              <img src={msg.image} alt="" className="max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8" />
            ) : (
              <p className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-all bg-violet-500/30 text-white ${msg.senderId === authUser?._id ? "rounded-br-none" : "rounded-bl-none"}`}>
                {msg.text}
              </p>
            )}
            <div className="text-center text-xs">
              <img src={msg.senderId === authUser._id ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon} alt="" className="w-7 rounded-full" />
              <p className="text-gray-500">{formatMessageTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={scrollEnd}></div>
      </div>

      {/* ---------------- bottom area ---------------- */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-3">
        {showEmoji && <Picker onEmojiClick={onEmojiClick} />}
        <div className="flex items-center gap-3">
          <button onClick={() => setShowEmoji(!showEmoji)} className="text-xl mr-2">{showEmoji ? "⌨️" : "😀"}</button>
          <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
            <input
              onChange={(e) => setInput(e.target.value)}
              value={input}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage(e)}
              type="text"
              placeholder="Send a message"
              className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
              disabled={isSending}
            />
            <input onChange={handleSendImage} type="file" id="image" accept="image/png,image/jpeg" hidden />
            <label htmlFor="image" className={isSending ? "opacity-50 pointer-events-none" : ""}>
              <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer" />
            </label>
          </div>
          <img onClick={handleSendMessage} src={assets.send_button} alt="" className={`w-7 cursor-pointer ${isSending ? "opacity-50 pointer-events-none" : ""}`} />
          {loadingImage && <p className="text-white text-sm ml-2">Sending image...</p>}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col justify-center items-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
      <img src={assets.logo_icon} className="max-w-16" alt="" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
    </div>
  );
}

export default ChatContainer;
