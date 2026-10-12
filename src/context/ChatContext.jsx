import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { AuthContext } from "./AuthContext.jsx";
import toast from "react-hot-toast";
import { APP_NAME, getErrorMessage } from "../lib/utils";
import { isNotifyEnabled, playMessageSound, showNotification } from "../lib/notify";

export const ChatContext = createContext();

// how long "typing" stays on screen without a fresh signal
const TYPING_TIMEOUT_MS = 5000;

const toPreview = (message) => ({
  _id: message._id,
  text: message.text || "",
  hasImage: Boolean(message.image),
  deleted: Boolean(message.deletedAt),
  senderId: message.senderId,
  seen: Boolean(message.seen),
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
  const [typingUsers, setTypingUsers] = useState({}); // ids of people typing to me right now

  const { socket, axios, authUser, onlineUsers } = useContext(AuthContext);

  // always the id of the open chat, so slow responses for another chat are dropped
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedUser?._id || null;

  // the latest list of people, readable inside socket handlers without re-subscribing
  const usersRef = useRef(users);
  usersRef.current = users;

  // per person, the timer that clears "typing" if their stop signal never arrives
  const typingTimers = useRef({});

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
    setTypingUsers({});
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

  // A message was edited, deleted or reacted to: swap it in wherever it is shown
  const applyMessageUpdate = useCallback((updated) => {
    setMessages((prevMessages) =>
      prevMessages.map((message) => {
        if (message._id === updated._id) return { ...updated, seen: message.seen || updated.seen };
        // replies quote it, their copy changes too
        if (message.replyTo?._id === updated._id) {
          const { _id, text, image, senderId, deletedAt } = updated;
          return { ...message, replyTo: { _id, text, image, senderId, deletedAt } };
        }
        return message;
      })
    );
    const otherId = updated.senderId === authUserId ? updated.receiverId : updated.senderId;
    setLastMessages((prev) => (prev[otherId]?._id === updated._id ? { ...prev, [otherId]: toPreview(updated) } : prev));
  }, [authUserId]);

  // runs one of the message actions and shows the result. Resolves to true on success
  const runMessageAction = async (request) => {
    try {
      const { data } = await request();
      applyMessageUpdate(data.message);
      return true;
    } catch (error) {
      if (error.response?.status !== 401) toast.error(getErrorMessage(error));
      return false;
    }
  };

  const editMessage = (messageId, text) => runMessageAction(() => axios.put(`/api/messages/${messageId}`, { text }));
  const deleteMessage = (messageId) => runMessageAction(() => axios.delete(`/api/messages/${messageId}`));
  // the same emoji again removes the reaction
  const reactToMessage = (messageId, emoji) =>
    runMessageAction(() => axios.put(`/api/messages/${messageId}/reaction`, { emoji }));

  //subscribe to incoming messages
  useEffect(() => {
    if (!socket) return;

    const setTyping = (userId, isTyping) => {
      clearTimeout(typingTimers.current[userId]);
      if (isTyping) {
        typingTimers.current[userId] = setTimeout(() => setTyping(userId, false), TYPING_TIMEOUT_MS);
      }
      setTypingUsers((prev) => {
        if (Boolean(prev[userId]) === isTyping) return prev;
        const next = { ...prev };
        if (isTyping) next[userId] = true;
        else delete next[userId];
        return next;
      });
    };

    const handleTyping = ({ from, isTyping }) => setTyping(from, isTyping);

    // the other person read what I sent them
    const handleMessagesSeen = ({ by }) => {
      setLastMessages((prev) =>
        prev[by] && prev[by].senderId !== by && !prev[by].seen ? { ...prev, [by]: { ...prev[by], seen: true } } : prev
      );
      if (selectedIdRef.current === by) {
        setMessages((prevMessages) =>
          prevMessages.map((message) => (message.receiverId === by && !message.seen ? { ...message, seen: true } : message))
        );
      }
    };

    const handleNewMessage = (newMessage) => {
      const { senderId } = newMessage;
      setTyping(senderId, false);
      setLastMessages((prev) => ({ ...prev, [senderId]: toPreview(newMessage) }));

      // sound and a system notification, unless the user is looking at this very chat
      const isBeingRead = selectedIdRef.current === senderId && !document.hidden;
      if (!isBeingRead && isNotifyEnabled()) {
        const sender = usersRef.current.find((user) => user._id === senderId);
        playMessageSound();
        showNotification({
          title: sender?.fullName || "New message",
          body: newMessage.text || "Sent a photo",
          icon: sender?.profilePic,
          tag: senderId,
          onClick: () => sender && selectUser(sender),
        });
      }

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

    // somebody went offline
    const handleLastSeen = ({ userId, lastSeen }) => {
      setUsers((prev) => prev.map((user) => (user._id === userId ? { ...user, lastSeen } : user)));
      setSelectedUser((prev) => (prev?._id === userId ? { ...prev, lastSeen } : prev));
    };

    const timers = typingTimers.current;
    socket.on("messageUpdated", applyMessageUpdate);
    socket.on("lastSeen", handleLastSeen);
    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("messagesSeen", handleMessagesSeen);
    return () => {
      socket.off("messageUpdated", applyMessageUpdate);
      socket.off("lastSeen", handleLastSeen);
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("messagesSeen", handleMessagesSeen);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [socket, axios, applyMessageUpdate, selectUser]);

  // tell a person that I started or stopped typing to them
  const sendTyping = useCallback((userId, isTyping) => {
    if (socket && userId) socket.emit("typing", { to: userId, isTyping });
  }, [socket]);

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
    editMessage,
    deleteMessage,
    reactToMessage,
    sendTyping,
    typingUsers,
    unseenMessages,
    lastMessages,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
