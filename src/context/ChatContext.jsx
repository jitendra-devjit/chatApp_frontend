import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { AuthContext } from "./AuthContext.jsx";
import toast from "react-hot-toast";
import { APP_NAME, getErrorMessage } from "../lib/utils";

export const ChatContext = createContext();

const toPreview = (message) => ({
  text: message.text || "",
  hasImage: Boolean(message.image),
  senderId: message.senderId,
  createdAt: message.createdAt,
});

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  const { socket, axios, authUser, onlineUsers } = useContext(AuthContext);

  // always the id of the open chat, so slow responses for another chat are dropped
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedUser?._id || null;

  const authUserId = authUser?._id;

  //function to get all users for Sidebar
  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setLastMessages(data.lastMessages || {});
      // the open chat is being read right now, it never shows a count
      const unseen = { ...(data.unseenMessages || {}) };
      delete unseen[selectedIdRef.current];
      setUnseenMessages(unseen);
    } catch (error) {
      if (error.response?.status !== 401) toast.error(getErrorMessage(error));
    } finally {
      setIsLoadingUsers(false);
    }
  }, [axios]);

  // load the list on login, forget everything on logout
  useEffect(() => {
    if (authUserId) {
      getUsers();
      return;
    }
    setUsers([]);
    setIsLoadingUsers(true);
    setMessages([]);
    setHasMore(false);
    setSelectedUser(null);
    setUnseenMessages({});
    setLastMessages({});
  }, [authUserId, getUsers]);

  // somebody who signed up after the list was loaded came online
  useEffect(() => {
    if (!authUserId || isLoadingUsers) return;
    const known = new Set(users.map((user) => user._id));
    const hasNewUser = onlineUsers.some((id) => id !== authUserId && !known.has(id));
    if (hasNewUser) getUsers();
  }, [onlineUsers, users, authUserId, isLoadingUsers, getUsers]);

  // open a chat (or close it with null)
  const selectUser = useCallback((user) => {
    setSelectedUser(user);
    if (user) setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
  }, []);

  //function to get the newest messages for selected user
  const selectedId = selectedUser?._id;
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    if (!selectedId) return;

    let cancelled = false;
    setIsLoadingMessages(true);
    axios
      .get(`/api/messages/${selectedId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((error) => {
        if (!cancelled && error.response?.status !== 401) toast.error(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, axios]);

  //function to load the page of messages before the oldest one on screen
  const loadOlderMessages = async () => {
    const chatId = selectedIdRef.current;
    if (!chatId || !hasMore || isLoadingOlder || messages.length === 0) return;

    setIsLoadingOlder(true);
    try {
      const { data } = await axios.get(`/api/messages/${chatId}`, {
        params: { before: messages[0].createdAt },
      });
      if (selectedIdRef.current !== chatId) return;
      setMessages((prev) => {
        const known = new Set(prev.map((message) => message._id));
        return [...data.messages.filter((message) => !known.has(message._id)), ...prev];
      });
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      if (error.response?.status !== 401) toast.error(getErrorMessage(error));
    } finally {
      setIsLoadingOlder(false);
    }
  };

  //function to send message to selected user. Resolves to true on success
  const sendMessage = async (messageData) => {
    const chatId = selectedIdRef.current;
    if (!chatId) return false;
    try {
      const { data } = await axios.post(`/api/messages/send/${chatId}`, messageData);
      const { newMessage } = data;
      setLastMessages((prev) => ({ ...prev, [chatId]: toPreview(newMessage) }));
      // the user may have opened another chat while the request was running
      if (selectedIdRef.current === chatId) {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
      return true;
    } catch (error) {
      if (error.response?.status !== 401) toast.error(getErrorMessage(error));
      return false;
    }
  };

  //subscribe to incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      const { senderId } = newMessage;
      setLastMessages((prev) => ({ ...prev, [senderId]: toPreview(newMessage) }));

      if (selectedIdRef.current === senderId) {
        setMessages((prevMessages) =>
          prevMessages.some((message) => message._id === newMessage._id)
            ? prevMessages
            : [...prevMessages, { ...newMessage, seen: true }]
        );
        axios.put(`/api/messages/mark/${newMessage._id}`).catch(() => {});
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [senderId]: (prevUnseenMessages[senderId] || 0) + 1,
        }));
      }
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [socket, axios]);

  // after a dropped connection comes back, catch up on what was missed
  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => getUsers();
    socket.io.on("reconnect", handleReconnect);
    return () => socket.io.off("reconnect", handleReconnect);
  }, [socket, getUsers]);

  // unread count in the browser tab
  const totalUnseen = Object.values(unseenMessages).reduce((sum, count) => sum + count, 0);
  useEffect(() => {
    document.title = totalUnseen > 0 ? `(${totalUnseen}) ${APP_NAME}` : APP_NAME;
  }, [totalUnseen]);

  const value = {
    messages,
    hasMore,
    isLoadingMessages,
    isLoadingOlder,
    users,
    isLoadingUsers,
    selectedUser,
    selectUser,
    loadOlderMessages,
    sendMessage,
    unseenMessages,
    lastMessages,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
