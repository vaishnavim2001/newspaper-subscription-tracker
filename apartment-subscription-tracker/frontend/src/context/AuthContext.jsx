/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from "react";
import api, { setAccessToken as updateApiAccessToken } from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    updateApiAccessToken(response.data.accessToken);
    setAccessToken(response.data.accessToken);
    setRefreshToken(response.data.refreshToken);
    setUser(response.data.user);

    return response.data;
  };

  const logout = async () => {
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } finally {
      updateApiAccessToken(null);
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
