import React, { createContext, useState, useEffect, useContext, useRef, useCallback, useMemo } from "react";
import { AuthContext } from "./AuthContext.jsx";
import toast from "react-hot-toast";
import { APP_NAME, describeCall, getErrorMessage } from "../lib/utils";
import { isPhoneLayout, useBackButton } from "../lib/backButton";
import { isNotifyEnabled, playMessageSound, showNotification } from "../lib/notify";

export const ChatContext = createContext();

// how long "typing" stays on screen without a fresh signal
const TYPING_TIMEOUT_MS = 5000;
// the newest messages of this many chats are kept, so coming back to a chat shows it at once
const MAX_CACHED_CHATS = 30;
const CACHED_MESSAGES = 50;

// ids of messages that are on screen but not on the server yet
let nextTempId = 1;

const toPreview = (message) => ({
  _id: message._id,
  text: message.text || "",
  hasImage: Boolean(message.image),
  // kind and name of the first file, and how many there are
  attachment: message.attachments?.length
    ? { type: message.attachments[0].type, name: message.attachments[0].name, count: message.attachments.length }
    : undefined,
  deleted: Boolean(message.deletedAt),
  system: Boolean(message.system),
  call: message.call,
  senderId: message.senderId,
  seen: Boolean(message.seen),
  createdAt: message.createdAt,
});

// A group gets the same fields a person has (fullName, profilePic, bio), so lists,
// avatars and headers can show both without caring which one it is
const toGroupChat = (group) => ({
  ...group,
  isGroup: true,
  fullName: group.name,
  profilePic: group.avatar,
  bio: group.description,
});

// where the messages of a chat are read from and sent to
const messagesUrl = (chat) => (chat.isGroup ? `/api/groups/${chat._id}/messages` : `/api/messages/${chat._id}`);
const sendUrl = (chat) => (chat.isGroup ? `/api/groups/${chat._id}/messages` : `/api/messages/send/${chat._id}`);
const searchUrl = (chat) => (chat.isGroup ? `/api/groups/${chat._id}/search` : `/api/messages/search/${chat._id}`);

const withoutKey = (object, key) => {
  if (!(key in object)) return object;
  const next = { ...object };
  delete next[key];
  return next;
};

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({}); // chat id -> unread count
  const [lastMessages, setLastMessages] = useState({}); // chat id -> preview of the newest message
  const [typing, setTyping] = useState({}); // chat id -> { user id: true } of who is typing there
  const [jumpTarget, setJumpTarget] = useState(null); // { id } of a message the chat should scroll to

  const { socket, axios, authUser, onlineUsers, saveChatPrefs } = useContext(AuthContext);
  const authUserId = authUser?._id;

  // people and groups together, the open one is looked up here so it always shows fresh data
  const chats = useMemo(() => [...users, ...groups], [users, groups]);
  const selectedChat = useMemo(() => chats.find((chat) => chat._id === selectedId) || null, [chats, selectedId]);

  // latest values, readable inside socket handlers and slow requests without re-subscribing
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedChat?._id || null;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  // "<chat id>:<user id>" -> timer that clears "typing" if the stop signal never arrives
  const typingTimers = useRef({});

  // chat id -> { messages, hasMore } as they were when the chat was last on screen
  const messageCache = useRef(new Map());
  const messagesOwner = useRef(null); // the chat the `messages` state belongs to

  // on a phone the chat covers the list, so "back" returns to the list
  useBackButton(Boolean(selectedId) && isPhoneLayout(), () => setSelectedId(null));

  // remember what the open chat looks like. Declared before the effect that opens a chat:
  // when the chat changes, this must not file the old messages under the new chat
  useEffect(() => {
    const chatId = messagesOwner.current;
    if (!chatId || chatId !== selectedIdRef.current || messages.length === 0) return;
    const cache = messageCache.current;
    cache.delete(chatId); // puts it last, the chat not opened for the longest time goes first
    cache.set(chatId, { messages: messages.slice(-CACHED_MESSAGES), hasMore: hasMore || messages.length > CACHED_MESSAGES });
    if (cache.size > MAX_CACHED_CHATS) cache.delete(cache.keys().next().value);
  }, [messages, hasMore]);

  const showError = (error) => {
    if (error.response?.status !== 401) toast.error(getErrorMessage(error));
  };

  //function to get all people and groups for the Sidebar
  const loadChats = useCallback(async () => {
    try {
      const [people, mine] = await Promise.all([axios.get("/api/messages/users"), axios.get("/api/groups")]);
      setUsers(Array.isArray(people.data.users) ? people.data.users : []);
      setGroups((mine.data.groups || []).map(toGroupChat));
      setLastMessages({ ...people.data.lastMessages, ...mine.data.lastMessages });
      // the open chat is being read right now, it never shows a count
      setUnseenMessages(withoutKey({ ...people.data.unseenMessages, ...mine.data.unseenMessages }, selectedIdRef.current));
    } catch (error) {
      showError(error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [axios]);

  // load the list on login, forget everything on logout
  useEffect(() => {
    if (authUserId) {
      loadChats();
      return;
    }
    setUsers([]);
    setGroups([]);
    setIsLoadingChats(true);
    setMessages([]);
    setHasMore(false);
    setSelectedId(null);
    setUnseenMessages({});
    setLastMessages({});
    setTyping({});
    messageCache.current.clear();
  }, [authUserId, loadChats]);

  // somebody who signed up after the list was loaded came online
  useEffect(() => {
    if (!authUserId || isLoadingChats) return;
    const known = new Set(users.map((user) => user._id));
    const hasNewUser = onlineUsers.some((id) => id !== authUserId && !known.has(id));
    if (hasNewUser) loadChats();
  }, [onlineUsers, users, authUserId, isLoadingChats, loadChats]);

  // open a chat (or close it with null)
  const selectChat = useCallback((chat) => {
    setSelectedId(chat?._id || null);
    if (chat) setUnseenMessages((prev) => withoutKey(prev, chat._id));
  }, []);

  //function to get the newest messages of the open chat
  const openChatId = selectedChat?._id;
  useEffect(() => {
    setJumpTarget(null);
    const chat = chatsRef.current.find((item) => item._id === openChatId);
    // what this chat showed last time is on screen at once, the fresh page from the server replaces it
    const cached = chat ? messageCache.current.get(chat._id) : null;
    messagesOwner.current = chat?._id || null;
    setMessages(cached?.messages || []);
    setHasMore(Boolean(cached?.hasMore));
    if (!chat) return;

    let cancelled = false;
    setIsLoadingMessages(!cached);
    axios
      .get(messagesUrl(chat))
      .then(({ data }) => {
        if (cancelled) return;
        // messages still on their way (or that failed) are not on the server's page, they stay at the end
        setMessages((prev) => {
          const unsent = prev.filter((message) => message.pending || message.failed);
          return unsent.length > 0 ? [...data.messages, ...unsent] : data.messages;
        });
        setHasMore(Boolean(data.hasMore));
      })
      .catch((error) => {
        if (!cancelled) showError(error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openChatId, axios]);

  //function to load the page of messages before the oldest one on screen
  const loadOlderMessages = async () => {
    const chat = selectedChat;
    if (!chat || !hasMore || isLoadingOlder || messages.length === 0) return;

    setIsLoadingOlder(true);
    try {
      const { data } = await axios.get(messagesUrl(chat), { params: { before: messages[0].createdAt } });
      if (selectedIdRef.current !== chat._id) return;
      setMessages((prev) => {
        const known = new Set(prev.map((message) => message._id));
        return [...data.messages.filter((message) => !known.has(message._id)), ...prev];
      });
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      showError(error);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Changes the messages of a chat: on screen when it is the open one, in the remembered copy otherwise
  // (the user may have opened another chat while a request was running)
  const patchThread = (chatId, change) => {
    if (selectedIdRef.current === chatId) return setMessages(change);
    const cached = messageCache.current.get(chatId);
    if (cached) messageCache.current.set(chatId, { ...cached, messages: change(cached.messages) });
  };

  // Hands a message to the server. `tempId` is the message that already stands in for it on screen.
  // Resolves to true on success
  const deliver = async (chat, body, tempId) => {
    try {
      const { data } = await axios.post(sendUrl(chat), body);
      // clientId keeps the bubble the same element when its temporary id becomes the real one
      const newMessage = tempId ? { ...data.newMessage, clientId: tempId } : data.newMessage;
      setLastMessages((prev) => ({ ...prev, [chat._id]: toPreview(newMessage) }));
      patchThread(chat._id, (list) => {
        if (list.some((message) => message._id === newMessage._id)) return list.filter((message) => message._id !== tempId);
        if (list.some((message) => message._id === tempId)) return list.map((message) => (message._id === tempId ? newMessage : message));
        return [...list, newMessage];
      });
      return true;
    } catch (error) {
      if (!tempId) {
        showError(error);
        return false;
      }
      // it stays in the chat, marked, with a way to try again
      patchThread(chat._id, (list) =>
        list.map((message) => (message._id === tempId ? { ...message, pending: false, failed: true } : message))
      );
      if (selectedIdRef.current !== chat._id && error.response?.status !== 401) {
        toast.error(`Your message to ${chat.fullName} was not sent`);
      }
      return false;
    }
  };

  // Sends a message to the open chat. Resolves to true when the composer can be emptied.
  // Text shows in the chat at once and is delivered in the background: waiting for the server
  // before showing anything is what made sending feel slow. A message with files is shown once
  // it is stored, its upload takes far longer than the request anyway.
  // `replyToMessage` is the quoted message itself, for showing the quote right away
  const sendMessage = (messageData) => {
    const chat = selectedChat;
    if (!chat) return Promise.resolve(false);
    const { replyToMessage, ...body } = messageData;
    if (body.attachments?.length || body.image) return deliver(chat, body, null);

    const tempId = `temp-${Date.now()}-${nextTempId++}`;
    const quoted = replyToMessage && {
      _id: replyToMessage._id, text: replyToMessage.text, image: replyToMessage.image, attachments: replyToMessage.attachments,
      senderId: replyToMessage.senderId, deletedAt: replyToMessage.deletedAt,
    };
    const temp = {
      _id: tempId, clientId: tempId, senderId: authUserId, [chat.isGroup ? "groupId" : "receiverId"]: chat._id,
      text: body.text, replyTo: quoted || undefined, attachments: [], reactions: [],
      createdAt: new Date().toISOString(), pending: true, draft: body,
    };
    setMessages((prev) => [...prev, temp]);
    setLastMessages((prev) => ({ ...prev, [chat._id]: toPreview(temp) }));
    deliver(chat, body, tempId);
    return Promise.resolve(true);
  };

  // try a message that was not sent once more
  const retryMessage = (tempId) => {
    const message = messages.find((item) => item._id === tempId);
    const chat = message && chatsRef.current.find((item) => item._id === (message.groupId || message.receiverId));
    if (!message?.failed || !chat) return;
    setMessages((prev) => prev.map((item) => (item._id === tempId ? { ...item, failed: false, pending: true } : item)));
    deliver(chat, message.draft, tempId);
  };

  // give up on a message that was not sent
  const discardMessage = (tempId) => {
    const rest = messages.filter((item) => item._id !== tempId);
    setMessages(rest);
    const chatId = selectedIdRef.current;
    const last = rest[rest.length - 1];
    setLastMessages((prev) => (prev[chatId]?._id !== tempId ? prev : last ? { ...prev, [chatId]: toPreview(last) } : withoutKey(prev, chatId)));
  };

  // Sends a message on to other chats (`targets` are chats). Resolves to true on success
  const forwardMessage = async (messageId, targets) => {
    try {
      const { data } = await axios.post(`/api/messages/${messageId}/forward`, {
        userIds: targets.filter((chat) => !chat.isGroup).map((chat) => chat._id),
        groupIds: targets.filter((chat) => chat.isGroup).map((chat) => chat._id),
      });
      for (const message of data.messages) {
        const chatId = message.groupId || message.receiverId;
        setLastMessages((prev) => ({ ...prev, [chatId]: toPreview(message) }));
        patchThread(chatId, (list) => (list.some((item) => item._id === message._id) ? list : [...list, message]));
      }
      toast.success(targets.length === 1 ? `Forwarded to ${targets[0].fullName.split(" ")[0]}` : `Forwarded to ${targets.length} chats`);
      return true;
    } catch (error) {
      showError(error);
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
          const { _id, text, image, attachments, senderId, deletedAt } = updated;
          return { ...message, replyTo: { _id, text, image, attachments, senderId, deletedAt } };
        }
        return message;
      })
    );
    const chatId = updated.groupId || (updated.senderId === authUserId ? updated.receiverId : updated.senderId);
    setLastMessages((prev) => (prev[chatId]?._id === updated._id ? { ...prev, [chatId]: toPreview(updated) } : prev));
  }, [authUserId]);

  // runs one of the message actions and shows the result. Resolves to true on success
  const runMessageAction = async (request) => {
    try {
      const { data } = await request();
      applyMessageUpdate(data.message);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const editMessage = (messageId, text) => runMessageAction(() => axios.put(`/api/messages/${messageId}`, { text }));
  const deleteMessage = (messageId) => runMessageAction(() => axios.delete(`/api/messages/${messageId}`));
  // the same emoji again removes the reaction
  const reactToMessage = (messageId, emoji) =>
    runMessageAction(() => axios.put(`/api/messages/${messageId}/reaction`, { emoji }));

  // ---------- search inside the open chat ----------

  // resolves to the matching messages, newest first
  const searchMessages = async (query) => {
    if (!selectedChat) return [];
    const { data } = await axios.get(searchUrl(selectedChat), { params: { q: query } });
    return data.results;
  };

  // Scrolls the chat to a message. When it is older than what is loaded,
  // everything from that message until now is loaded first
  const openAtMessage = async (message) => {
    const chat = selectedChat;
    if (!chat) return;
    if (!messages.some((item) => item._id === message._id)) {
      try {
        const { data } = await axios.get(messagesUrl(chat), { params: { since: message.createdAt } });
        if (selectedIdRef.current !== chat._id) return;
        setMessages(data.messages);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        showError(error);
        return;
      }
    }
    setJumpTarget({ id: message._id });
  };

  // ---------- groups ----------

  const upsertGroup = useCallback((group) => {
    const chat = toGroupChat(group);
    setGroups((prev) => (prev.some((item) => item._id === chat._id) ? prev.map((item) => (item._id === chat._id ? chat : item)) : [...prev, chat]));
  }, []);

  const forgetGroup = useCallback((groupId) => {
    setGroups((prev) => prev.filter((group) => group._id !== groupId));
    setLastMessages((prev) => withoutKey(prev, groupId));
    setUnseenMessages((prev) => withoutKey(prev, groupId));
    setSelectedId((current) => (current === groupId ? null : current));
  }, []);

  // runs a group request, stores the group it answers with. Resolves to that group, or false on failure
  const runGroupAction = async (request, successText) => {
    try {
      const { data } = await request();
      if (data.group) upsertGroup(data.group);
      if (successText) toast.success(successText);
      return data.group || true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const createGroup = async (body) => {
    const group = await runGroupAction(() => axios.post("/api/groups", body), "Group created");
    if (group?._id) setSelectedId(group._id);
    return Boolean(group);
  };
  const updateGroup = (groupId, body) => runGroupAction(() => axios.put(`/api/groups/${groupId}`, body), "Group updated");
  const addGroupMembers = (groupId, userIds) => runGroupAction(() => axios.post(`/api/groups/${groupId}/members`, { userIds }), "Added to the group");
  const setGroupMemberRole = (groupId, userId, role) => runGroupAction(() => axios.put(`/api/groups/${groupId}/members/${userId}`, { role }));
  // removing yourself is leaving the group
  const removeGroupMember = async (groupId, userId) => {
    const done = await runGroupAction(() => axios.delete(`/api/groups/${groupId}/members/${userId}`));
    if (done && userId === authUserId) forgetGroup(groupId);
    return Boolean(done);
  };

  // ---------- pin, mute, archive ----------

  const pinnedIds = authUser?.pinnedChats;
  const mutedIds = authUser?.mutedChats;
  const archivedIds = authUser?.archivedChats;
  const chatPrefs = useMemo(() => ({
    pinned: new Set(pinnedIds),
    muted: new Set(mutedIds),
    archived: new Set(archivedIds),
  }), [pinnedIds, mutedIds, archivedIds]);

  // patch is any of { pinned, muted, archived } as true or false
  const setChatPref = (chatId, patch) => saveChatPrefs({ chatId, ...patch });

  //subscribe to everything the server pushes
  useEffect(() => {
    if (!socket) return;

    const markTyping = (chatId, userId, isTyping) => {
      const key = `${chatId}:${userId}`;
      clearTimeout(typingTimers.current[key]);
      if (isTyping) typingTimers.current[key] = setTimeout(() => markTyping(chatId, userId, false), TYPING_TIMEOUT_MS);
      setTyping((prev) => {
        if (Boolean(prev[chatId]?.[userId]) === isTyping) return prev;
        const inChat = isTyping ? { ...prev[chatId], [userId]: true } : withoutKey(prev[chatId] || {}, userId);
        return Object.keys(inChat).length > 0 ? { ...prev, [chatId]: inChat } : withoutKey(prev, chatId);
      });
    };

    const handleTyping = ({ from, groupId, isTyping }) => markTyping(groupId || from, from, isTyping);

    // the other person read what I sent them (one-to-one chats)
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

    // a group member read up to a moment, the ticks of the group are worked out from these
    const handleGroupRead = ({ groupId, userId, lastReadAt }) => {
      setGroups((prev) =>
        prev.map((group) =>
          group._id !== groupId ? group : {
            ...group,
            members: group.members.map((member) => (member.user._id === userId ? { ...member, lastReadAt } : member)),
          }
        )
      );
    };

    const handleNewMessage = (newMessage) => {
      const me = authUserRef.current;
      // only lines written by the server come back to me: group events, and the calls I made
      const isMine = newMessage.senderId === me?._id;
      const chatId = newMessage.groupId || (isMine ? newMessage.receiverId : newMessage.senderId);
      const chat = chatsRef.current.find((item) => item._id === chatId);
      const isOpen = selectedIdRef.current === chatId;
      // of the calls, only one I did not pick up is news
      const countsAsUnread = !isMine && !newMessage.system && (!newMessage.call || newMessage.call.status === "missed");

      // a group I was just added to and do not know yet
      if (!chat && newMessage.groupId) loadChats();

      markTyping(chatId, newMessage.senderId, false);
      setLastMessages((prev) => ({ ...prev, [chatId]: toPreview(newMessage) }));

      // sound and a system notification, unless muted or the user is looking at this very chat
      const isMuted = me?.mutedChats?.includes(chatId);
      if (countsAsUnread && !isMuted && isNotifyEnabled() && !(isOpen && !document.hidden)) {
        const sender = chatsRef.current.find((item) => item._id === newMessage.senderId);
        const senderName = sender?.fullName || "New message";
        playMessageSound();
        showNotification({
          title: chat?.isGroup ? `${senderName.split(" ")[0]} in ${chat.fullName}` : senderName,
          body: newMessage.text || (newMessage.call ? describeCall(newMessage.call, false).preview : "Sent a photo"),
          icon: (chat?.isGroup ? chat : sender)?.profilePic,
          tag: chatId,
          onClick: () => chat && selectChat(chat),
        });
      }

      if (isOpen) {
        setMessages((prevMessages) =>
          prevMessages.some((message) => message._id === newMessage._id)
            ? prevMessages
            : [...prevMessages, newMessage.groupId || isMine ? newMessage : { ...newMessage, seen: true }]
        );
        if (countsAsUnread) {
          const markRead = newMessage.groupId ? `/api/groups/${chatId}/read` : `/api/messages/mark/${newMessage._id}`;
          axios.put(markRead).catch(() => {});
        }
      } else if (countsAsUnread) {
        setUnseenMessages((prev) => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
      }
    };

    // somebody went offline
    const handleLastSeen = ({ userId, lastSeen }) => {
      setUsers((prev) => prev.map((user) => (user._id === userId ? { ...user, lastSeen } : user)));
    };

    const handleGroupRemoved = ({ groupId }) => forgetGroup(groupId);

    const handlers = {
      newMessage: handleNewMessage,
      messageUpdated: applyMessageUpdate,
      messagesSeen: handleMessagesSeen,
      typing: handleTyping,
      lastSeen: handleLastSeen,
      groupUpdated: upsertGroup,
      groupRead: handleGroupRead,
      groupRemoved: handleGroupRemoved,
    };
    const timers = typingTimers.current;
    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      Object.values(timers).forEach(clearTimeout);
    };
  }, [socket, axios, applyMessageUpdate, selectChat, loadChats, upsertGroup, forgetGroup]);

  // tell the other side of a chat that I started or stopped typing
  const sendTyping = useCallback((chat, isTyping) => {
    if (socket && chat) socket.emit("typing", { to: chat._id, isGroup: Boolean(chat.isGroup), isTyping });
  }, [socket]);

  // after a dropped connection comes back, catch up on what was missed
  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => loadChats();
    socket.io.on("reconnect", handleReconnect);
    return () => socket.io.off("reconnect", handleReconnect);
  }, [socket, loadChats]);

  // unread count in the browser tab, muted chats stay quiet here too
  const totalUnseen = Object.entries(unseenMessages).reduce(
    (sum, [chatId, count]) => (chatPrefs.muted.has(chatId) ? sum : sum + count),
    0
  );
  useEffect(() => {
    document.title = totalUnseen > 0 ? `(${totalUnseen}) ${APP_NAME}` : APP_NAME;
  }, [totalUnseen]);

  const value = {
    messages,
    hasMore,
    isLoadingMessages,
    isLoadingOlder,
    users,
    groups,
    chats,
    isLoadingChats,
    selectedChat,
    selectChat,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    discardMessage,
    forwardMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    searchMessages,
    openAtMessage,
    jumpTarget,
    sendTyping,
    typing,
    unseenMessages,
    lastMessages,
    createGroup,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    setGroupMemberRole,
    chatPrefs,
    setChatPref,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
