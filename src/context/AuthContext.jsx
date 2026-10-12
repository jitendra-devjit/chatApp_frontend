import React, { useState, createContext, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { getErrorMessage } from "../lib/utils";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const api = axios.create({ baseURL: backendUrl });

const readStoredToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

const storeToken = (token) => {
  try {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  } catch {
    // storage can be blocked, the session then lasts until the tab closes
  }
};

// every request carries the current token
api.interceptors.request.use((config) => {
  const token = readStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readStoredToken);
  const [authUser, setAuthUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(token));
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  const clearSession = useCallback(() => {
    storeToken(null);
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
  }, []);

  //Check if user is authenticated and if so, set the user data
  useEffect(() => {
    if (!readStoredToken()) return;
    let cancelled = false;

    api
      .get("/api/auth/check")
      .then(({ data }) => {
        if (!cancelled && data.success) setAuthUser(data.user);
      })
      .catch((error) => {
        // a rejected token is removed, a network error keeps it for the next visit
        if (!cancelled && error.response?.status === 401) clearSession();
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAuth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // an expired or revoked token on any later request ends the session
  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const isAuthRoute = /\/api\/auth\/(login|signup)$/.test(error.config?.url || "");
        if (error.response?.status === 401 && !isAuthRoute && readStoredToken()) {
          clearSession();
          toast.error("Session expired, please log in again");
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [clearSession]);

  // Login function to handle user authentication. Resolves to true on success

  const login = async (state, credentials) => {
    try {
      const { data } = await api.post(`/api/auth/${state}`, credentials);
      storeToken(data.token);
      setToken(data.token);
      setAuthUser(data.userData);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  // Logout function to handle user logout, the socket closes in the effect below

  const logout = () => {
    clearSession();
  };

  //Update profile function to handle user profile updates. Resolves to true on success

  const updateProfile = async (body) => {
    try {
      const { data } = await api.put("/api/auth/update-profile", body);
      setAuthUser(data.user);
      toast.success("Profile updated");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  // One socket per logged in user, authenticated with the same token as the API
  const userId = authUser?._id;
  useEffect(() => {
    if (!userId || !token) return;

    const newSocket = io(backendUrl, { auth: { token } });
    newSocket.on("getOnlineUsers", setOnlineUsers);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [userId, token]);

  const value = {
    axios: api,
    authUser,
    isCheckingAuth,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
