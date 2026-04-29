import axios from "axios";
import { getSession, signOut } from "next-auth/react";

// Create an Axios instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  async (config) => {
    // Attempt to get the NextAuth session which contains our access token
    const session = await getSession();

    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor: Handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error status is 401 and there is no originalRequest._retry flag,
    // it means the token has expired and we need to refresh it
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Here you could implement a token refresh logic if supported by your API
        // For example: await axios.post('/api/auth/refresh-token');

        // If refresh fails or is not supported, log the user out immediately
        await signOut({ callbackUrl: "/login" });

        return Promise.reject(error);
      } catch (refreshError) {
        // If refresh token fails, sign out
        await signOut({ callbackUrl: "/login" });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
