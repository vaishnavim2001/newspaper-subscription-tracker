import axios from "axios";

let accessToken = null;

// Allows AuthContext to update the token used by Axios.
export function setAccessToken(token) {
  accessToken = token;
}

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the token to requests whenever one is available.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export default api;
