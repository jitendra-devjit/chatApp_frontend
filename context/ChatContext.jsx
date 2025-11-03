import React, { createContext, useState, useEffect } from "react";
import { useContext } from "react";
import { AuthContext } from "./AuthContext.jsx";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});

  const { socket, axios } = useContext(AuthContext);

  //function to get all users for Sidebar
  // const getUsers = async () => {
  //   try {
  //     const { data } = await axios.get("/api/auth/check", {
  //       headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  //     }); 
  //     if (data.success) {
  //       setUsers(data.users);
  //       setUnseenMessages(data.unseenMessages);
  //     }
  //   } catch (error) {
  //     toast.error(error.message);
  //   }
  // };
  const getUsers = async () => {
  try {
    const { data } = await axios.get("/api/messages/users", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }); 
    if (data.success) {
      setUsers(data.users);  // ✅ an array
      setUnseenMessages(data.unseenMessages || {});
    }
  } catch (error) {
    toast.error(error.message);
  }
};


  //function to get messages for selected user
  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //function to send messages for selected user
  const sendMessage = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      
      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  //function to suscribe to messages for selected user
  const subscribeToMessages = async () => {
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });
  };

  // function to unsubscribe from messages
  const unsubscribeFromMessages = () => {
    if (socket) {
      socket.off("newMessage");
    }
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
