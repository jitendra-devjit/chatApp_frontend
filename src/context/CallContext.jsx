import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext.jsx";
import { showNotification, startRingtone } from "../lib/notify";

export const CallContext = createContext();

// used when the server cannot be asked for its list
const FALLBACK_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const ACK_TIMEOUT_MS = 10000;
// how long the two browsers get to find a path to each other after the call is answered
const CONNECT_TIMEOUT_MS = 30000;
// how long a call that lost its connection waits for it to come back
const RECONNECT_TIMEOUT_MS = 15000;
// the server's list holds logins that run out, it is asked again after this long
const ICE_REUSE_MS = 30 * 60 * 1000;

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const CAMERA_CONSTRAINTS = { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };

export const canShareScreen = () => Boolean(navigator.mediaDevices?.getDisplayMedia);

// For testing a TURN server: with localStorage.forceRelay = "1" a call only uses the relay
const relayOnly = () => {
  try {
    return localStorage.getItem("forceRelay") === "1";
  } catch {
    return false;
  }
};

const firstNameOf = (user) => user?.fullName?.split(" ")[0] || "They";

const mediaErrorText = (error) => {
  if (!navigator.mediaDevices?.getUserMedia) return "Calls only work on a secure (https) page";
  if (error?.name === "NotAllowedError") return "Allow microphone access to make calls";
  if (error?.name === "NotFoundError") return "No microphone found";
  if (error?.name === "NotReadableError") return "Your microphone is in use by another app";
  return "Could not start the microphone";
};

// One voice or video call at a time. The sound and picture travel straight between the two
// browsers (WebRTC), the socket only carries ringing and the connection details.
//
// `call` is null, or {
//   key        number, different for every call of this tab
//   id         the server's id, null until the server answered "call:start"
//   peer       the other person: { _id, fullName, profilePic }
//   kind       "audio" | "video", how the call was started
//   direction  "outgoing" | "incoming"
//   phase      "calling" | "incoming" | "connecting" | "connected" | "reconnecting"
//   connectedAt  when the two browsers first reached each other
//   micOn, camOn, sharing    what I am sending
//   facing     "user" | "environment": which camera of a phone is in use
//   remote     { audio, video, screen }: what the other person says they are sending
// }
export const CallProvider = ({ children }) => {
  const { socket, axios, authUser } = useContext(AuthContext);
  const authUserId = authUser?._id;

  const [call, setCall] = useState(null);
  const [localVideo, setLocalVideo] = useState(null); // my camera or shared screen, as a stream
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // the same call as the state, readable right away inside socket handlers and after an await
  const callRef = useRef(null);
  const callCounter = useRef(0);
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const peerRef = useRef(null); // RTCPeerConnection
  const audioTrack = useRef(null);
  const cameraTrack = useRef(null);
  const screenTrack = useRef(null);
  const pendingCandidates = useRef([]); // candidates that arrived before the offer or answer
  const signalChain = useRef(Promise.resolve()); // signals are handled one after the other
  const iceServers = useRef(null); // { servers, relay, loadedAt }
  const wakeLock = useRef(null);
  const stopRingtone = useRef(null);
  const connectTimer = useRef(null);
  const reconnectTimer = useRef(null);

  // changes fields of the call. A patch with a key starts a new call, null ends it
  const update = useCallback((patch) => {
    let next = null;
    if (patch?.key) next = patch;
    else if (patch && callRef.current) next = { ...callRef.current, ...patch };
    callRef.current = next;
    setCall(next);
  }, []);

  const isCurrent = (key) => callRef.current?.key === key;

  const silence = () => {
    stopRingtone.current?.();
    stopRingtone.current = null;
  };

  const releaseMedia = () => {
    for (const ref of [audioTrack, cameraTrack, screenTrack]) {
      if (ref.current) {
        ref.current.onended = null;
        ref.current.stop();
      }
      ref.current = null;
    }
  };

  // puts everything back to "no call": sound, timers, connection, camera and microphone
  const cleanup = useCallback(() => {
    silence();
    clearTimeout(connectTimer.current);
    clearTimeout(reconnectTimer.current);
    connectTimer.current = null;
    reconnectTimer.current = null;
    const peer = peerRef.current;
    if (peer) {
      peer.ontrack = peer.onicecandidate = peer.onconnectionstatechange = peer.onnegotiationneeded = null;
      peer.close();
    }
    peerRef.current = null;
    pendingCandidates.current = [];
    signalChain.current = Promise.resolve();
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    releaseMedia();
    setLocalVideo(null);
    setRemoteStream(null);
    setIsMinimized(false);
    update(null);
  }, [update]);

  // asks the server something and resolves with its answer, { ok: false, message } when it stays silent
  const request = (event, payload) =>
    new Promise((resolve) => {
      const current = socketRef.current;
      if (!current?.connected) return resolve({ ok: false, message: "You are offline" });
      current.timeout(ACK_TIMEOUT_MS).emit(event, payload, (error, answer) =>
        resolve(error || !answer ? { ok: false, message: "The server did not answer" } : answer)
      );
    });

  const sendSignal = useCallback((data) => {
    const callId = callRef.current?.id;
    if (callId) socketRef.current?.emit("call:signal", { callId, data });
  }, []);

  // tells the other side what I am sending, they cannot see a camera being switched off otherwise
  const sendMediaState = useCallback(() => {
    const current = callRef.current;
    if (!current || !peerRef.current) return;
    sendSignal({ media: { audio: current.micOn, video: current.camOn || current.sharing, screen: current.sharing } });
  }, [sendSignal]);

  const currentVideoTrack = () => screenTrack.current || cameraTrack.current || null;

  // shows my own picture and sends it. A shared screen wins over the camera
  const syncVideo = useCallback(async () => {
    const track = currentVideoTrack();
    setLocalVideo(track ? new MediaStream([track]) : null);
    const sender = peerRef.current?.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "video")?.sender;
    if (sender && sender.track !== track) await sender.replaceTrack(track);
    sendMediaState();
  }, [sendMediaState]);

  // Opens the microphone, and the camera when asked. Resolves to whether there is a camera picture
  const openMedia = async (withCamera) => {
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) throw new Error("no media devices");
    let stream;
    try {
      stream = await devices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: withCamera ? CAMERA_CONSTRAINTS : false });
    } catch (error) {
      if (!withCamera) throw error;
      // no camera, or it was refused: the call still works with sound
      stream = await devices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      toast("Camera not available, joining with audio only", { icon: "🎙️" });
    }
    audioTrack.current = stream.getAudioTracks()[0] || null;
    cameraTrack.current = stream.getVideoTracks()[0] || null;
    return Boolean(cameraTrack.current);
  };

  const loadIceServers = async () => {
    const known = iceServers.current;
    if (known && Date.now() - known.loadedAt < ICE_REUSE_MS) return known.servers;
    try {
      const { data } = await axios.get("/api/calls/ice");
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        iceServers.current = { servers: data.iceServers, relay: Boolean(data.relay), loadedAt: Date.now() };
      }
    } catch {
      // the call is tried with the list from before, or the public STUN server
    }
    return iceServers.current?.servers || FALLBACK_ICE_SERVERS;
  };

  // why the two browsers found no path to each other, in words that say what to do
  const connectFailedText = () =>
    iceServers.current?.relay
      ? "Could not connect the call. Check your internet and try again"
      : "Could not connect: this network blocks direct calls and no relay (TURN) server is set up";

  // a phone must not switch its screen off in the middle of a call
  const keepScreenOn = async () => {
    try {
      if (!wakeLock.current && navigator.wakeLock) wakeLock.current = await navigator.wakeLock.request("screen");
    } catch {
      // not allowed right now (battery saver, tab in the background)
    }
  };

  // Ends the call for both sides. With `failed` the other side is told that the two browsers
  // never reached each other, so it can say so too
  const hangUp = useCallback((message, failed = false) => {
    const current = callRef.current;
    if (!current) return;
    if (current.id) {
      socketRef.current?.emit(current.phase === "incoming" ? "call:decline" : "call:end", { callId: current.id, failed });
    }
    cleanup();
    if (typeof message === "string") toast.error(message, { duration: 7000 });
  }, [cleanup]);

  // The connection between the two browsers. Only the caller makes offers, so the two never offer at once
  const createPeer = async (key, isCaller) => {
    const servers = await loadIceServers();
    if (!isCurrent(key)) return null; // the call ended while the list was loading

    const peer = new RTCPeerConnection({ iceServers: servers, iceTransportPolicy: relayOnly() ? "relay" : "all" });
    peerRef.current = peer;

    const remoteTracks = [];
    peer.ontrack = ({ track }) => {
      if (!remoteTracks.includes(track)) remoteTracks.push(track);
      setRemoteStream(new MediaStream(remoteTracks));
    };
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal({ candidate: candidate.toJSON() });
    };
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") {
        clearTimeout(connectTimer.current);
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
        update({ phase: "connected", connectedAt: callRef.current?.connectedAt || Date.now() });
        sendMediaState();
        keepScreenOn();
      } else if (state === "failed" && !callRef.current?.connectedAt) {
        // every path was tried and none works, waiting longer changes nothing
        hangUp(connectFailedText(), true);
      } else if ((state === "disconnected" || state === "failed") && callRef.current?.connectedAt) {
        update({ phase: "reconnecting" });
        if (state === "failed") {
          // a new offer with fresh network candidates, the caller makes it
          if (isCaller) peer.restartIce();
          else sendSignal({ restart: true });
        }
        reconnectTimer.current ||= setTimeout(() => hangUp("The connection was lost"), RECONNECT_TIMEOUT_MS);
      }
    };
    connectTimer.current = setTimeout(() => hangUp(connectFailedText(), true), CONNECT_TIMEOUT_MS);

    if (isCaller) {
      peer.onnegotiationneeded = async () => {
        try {
          await peer.setLocalDescription();
          sendSignal({ description: peer.localDescription.toJSON() });
        } catch (error) {
          console.error(error);
        }
      };
      // both lines always exist, so the camera and screen sharing can come and go without a new offer
      peer.addTransceiver(audioTrack.current || "audio", { direction: "sendrecv" });
      peer.addTransceiver(currentVideoTrack() || "video", { direction: "sendrecv" });
    }
    return peer;
  };

  // an offer, answer, network candidate or media state from the other person
  const handleSignal = async (data) => {
    const peer = peerRef.current;
    if (!peer || !data) return;

    if (data.media) {
      const { audio, video, screen } = data.media;
      update({ remote: { audio: audio !== false, video: Boolean(video), screen: Boolean(screen) } });
    }
    // the other side lost the connection and asks for a new offer, only the caller makes those
    if (data.restart && peer.onnegotiationneeded) peer.restartIce();

    if (data.description) {
      await peer.setRemoteDescription(data.description);
      if (data.description.type === "offer") {
        // answer with my own sound and picture on the lines the caller opened
        for (const transceiver of peer.getTransceivers()) {
          const track = transceiver.receiver.track.kind === "audio" ? audioTrack.current : currentVideoTrack();
          if (transceiver.sender.track !== track) await transceiver.sender.replaceTrack(track);
          transceiver.direction = "sendrecv";
        }
        await peer.setLocalDescription();
        sendSignal({ description: peer.localDescription.toJSON() });
        sendMediaState();
      }
      const waiting = pendingCandidates.current;
      pendingCandidates.current = [];
      for (const candidate of waiting) await peer.addIceCandidate(candidate).catch(() => {});
    }

    if (data.candidate) {
      if (peer.remoteDescription) await peer.addIceCandidate(data.candidate).catch(() => {});
      else pendingCandidates.current.push(data.candidate);
    }
  };

  // ---------- starting and answering ----------

  // `peer` is the person to call, kind is "audio" or "video"
  const startCall = async (peer, kind) => {
    if (callRef.current) return toast.error("You are already in a call");
    if (!socketRef.current?.connected) return toast.error("You are offline");

    const key = (callCounter.current += 1);
    const wantsVideo = kind === "video";
    update({
      key, id: null, peer, kind, direction: "outgoing", phase: "calling", connectedAt: null,
      micOn: true, camOn: wantsVideo, sharing: false, facing: "user",
      remote: { audio: true, video: wantsVideo, screen: false },
    });

    let hasCamera;
    try {
      hasCamera = await openMedia(wantsVideo);
    } catch (error) {
      if (isCurrent(key)) {
        cleanup();
        toast.error(mediaErrorText(error));
      }
      return;
    }
    // hung up while the browser was asking for permission
    if (!isCurrent(key)) return releaseMedia();
    update({ camOn: hasCamera });
    await syncVideo();

    const answer = await request("call:start", { to: peer._id, kind });
    if (!isCurrent(key)) {
      if (answer.ok) socketRef.current?.emit("call:end", { callId: answer.callId });
      return;
    }
    if (!answer.ok) {
      cleanup();
      return toast(answer.message || "The call could not be started", { icon: "📵" });
    }
    update({ id: answer.callId });
    stopRingtone.current = startRingtone("outgoing");
  };

  // answer the call that is ringing, with or without my camera
  const acceptCall = async (withCamera) => {
    const current = callRef.current;
    if (!current || current.phase !== "incoming") return;
    const { key, id } = current;
    silence();
    update({ phase: "connecting" });

    let hasCamera;
    try {
      hasCamera = await openMedia(withCamera ?? current.kind === "video");
    } catch (error) {
      if (isCurrent(key)) {
        socketRef.current?.emit("call:decline", { callId: id });
        cleanup();
        toast.error(mediaErrorText(error));
      }
      return;
    }
    if (!isCurrent(key)) return releaseMedia();
    update({ camOn: hasCamera });
    await syncVideo();

    if (!(await createPeer(key, false))) return;
    const answer = await request("call:accept", { callId: id });
    if (!answer.ok && isCurrent(key)) {
      cleanup();
      toast.error(answer.message || "This call has ended");
    }
  };

  const declineCall = () => hangUp();

  // ---------- during the call ----------

  const toggleMic = () => {
    const current = callRef.current;
    if (!current) return;
    const micOn = !current.micOn;
    if (audioTrack.current) audioTrack.current.enabled = micOn;
    update({ micOn });
    sendMediaState();
  };

  const toggleCamera = async () => {
    const current = callRef.current;
    if (!current) return;
    if (current.camOn) {
      // stopping the track switches the camera light off
      cameraTrack.current?.stop();
      cameraTrack.current = null;
      update({ camOn: false });
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS });
        const [track] = stream.getVideoTracks();
        if (!isCurrent(current.key)) return track.stop();
        cameraTrack.current = track;
        update({ camOn: true, facing: "user" });
      } catch (error) {
        return toast.error(error?.name === "NotAllowedError" ? "Allow camera access to turn it on" : "Could not turn the camera on");
      }
    }
    await syncVideo();
  };

  // front camera <-> back camera of a phone
  const switchCamera = async () => {
    const current = callRef.current;
    if (!current?.camOn) return;
    const facing = current.facing === "environment" ? "user" : "environment";
    // a phone cannot open both cameras, the one in use is closed first
    cameraTrack.current?.stop();
    cameraTrack.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { ...CAMERA_CONSTRAINTS, facingMode: facing } });
      const [track] = stream.getVideoTracks();
      if (!isCurrent(current.key)) return track.stop();
      cameraTrack.current = track;
      update({ facing });
    } catch {
      update({ camOn: false });
      toast.error("Could not switch the camera");
    }
    await syncVideo();
  };

  const stopSharing = async () => {
    if (!screenTrack.current) return;
    screenTrack.current.onended = null;
    screenTrack.current.stop();
    screenTrack.current = null;
    update({ sharing: false });
    await syncVideo();
  };

  const toggleScreenShare = async () => {
    const current = callRef.current;
    if (!current) return;
    if (current.sharing) return stopSharing();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [track] = stream.getVideoTracks();
      if (!isCurrent(current.key)) return track.stop();
      // the browser's own "Stop sharing" button
      track.onended = stopSharing;
      screenTrack.current = track;
      update({ sharing: true });
      await syncVideo();
    } catch {
      // the picker was closed without choosing anything
    }
  };

  // ---------- what the server tells this tab ----------

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = ({ callId, kind, from }) => {
      // this tab was just starting a call of its own
      if (callRef.current) return socket.emit("call:decline", { callId });
      const isVideo = kind === "video";
      update({
        key: (callCounter.current += 1), id: callId, peer: from, kind, direction: "incoming", phase: "incoming", connectedAt: null,
        micOn: true, camOn: false, sharing: false, facing: "user",
        remote: { audio: true, video: isVideo, screen: false },
      });
      stopRingtone.current = startRingtone("incoming");
      showNotification({
        title: from.fullName,
        body: `Incoming ${isVideo ? "video" : "voice"} call`,
        icon: from.profilePic,
        tag: "call",
      });
    };

    const handleAccepted = async ({ callId }) => {
      const current = callRef.current;
      if (current?.id !== callId) return;
      silence();
      update({ phase: "connecting" });
      await createPeer(current.key, true);
    };

    const handleSignalEvent = ({ callId, data }) => {
      if (callRef.current?.id !== callId) return;
      signalChain.current = signalChain.current.then(() => handleSignal(data)).catch((error) => console.error(error));
    };

    const handleEnded = ({ callId, reason }) => {
      const current = callRef.current;
      if (current?.id !== callId) return;
      const name = firstNameOf(current.peer);
      cleanup();
      if (reason === "declined" && current.direction === "outgoing") toast(`${name} declined the call`, { icon: "📵" });
      else if (reason === "missed" && current.direction === "outgoing") toast(`${name} did not answer`, { icon: "📵" });
      else if (reason === "disconnected") toast(`${name} lost their connection`, { icon: "📵" });
      else if (reason === "failed") toast.error(connectFailedText(), { duration: 7000 });
    };

    // without the socket the server has already ended the call
    const handleDisconnect = () => {
      if (!callRef.current) return;
      cleanup();
      toast.error("The connection was lost");
    };

    const handlers = {
      "call:incoming": handleIncoming,
      "call:accepted": handleAccepted,
      "call:signal": handleSignalEvent,
      "call:ended": handleEnded,
      disconnect: handleDisconnect,
    };
    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      // logging out or losing the session ends the call
      if (callRef.current) hangUp();
    };
    // the handlers read everything else through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, authUserId]);

  const value = useMemo(() => ({
    call, localVideo, remoteStream, isMinimized, setIsMinimized,
    startCall, acceptCall, declineCall, hangUp, toggleMic, toggleCamera, switchCamera, toggleScreenShare,
    // the functions read the current call through refs, so they never go stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [call, localVideo, remoteStream, isMinimized]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
