import axiosInstance from "../api/axiosInstance";

const AUTH_PREFIX = "/api/v1/auth";

/**
 * Register a new user.
 * @param {{ username: string, email: string, full_name: string, password: string }} userData
 */
export const registerUser = async (userData) => {
  const { data } = await axiosInstance.post(`${AUTH_PREFIX}/register`, userData);
  return data; // Returns UserBase
};

/**
 * Login and store tokens.
 * @param {{ username: string, password: string }} credentials
 * @returns {{ access_token: string, refresh_token: string }}
 */
export const loginUser = async ({ username, password }) => {
  const { data } = await axiosInstance.post(`${AUTH_PREFIX}/login`, {
    username,
    password,
  });

  // Persist tokens
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);

  return data;
};

/**
 * Refresh the access token using the stored refresh token.
 * @returns {{ access_token: string, refresh_token: string }}
 */
export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) throw new Error("No refresh token found");

  const { data } = await axiosInstance.post(`${AUTH_PREFIX}/refresh`, {
    refresh_token: refreshToken,
  });

  localStorage.setItem("access_token", data.access_token);
  return data;
};

/**
 * Logout — blacklists the refresh token and clears local storage.
 */
export const logoutUser = async () => {
  const refreshToken = localStorage.getItem("refresh_token");

  if (refreshToken) {
    try {
      await axiosInstance.post(`${AUTH_PREFIX}/logout`, {
        refresh_token: refreshToken,
      });
    } catch {
      // Even if the server call fails, clear local state
    }
  }

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

/**
 * Get the currently authenticated user's info.
 * @returns {UserBase}
 */
export const getCurrentUser = async () => {
  const { data } = await axiosInstance.get(`${AUTH_PREFIX}/users/me`);
  return data;
};