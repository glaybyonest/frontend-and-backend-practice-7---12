const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_CHANGE_EVENT = "auth:change";

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  notifyAuthChange();
}

export function clearTokens(options = {}) {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  if (options.emit !== false) {
    notifyAuthChange();
  }
}

export function subscribeToAuthChanges(listener) {
  window.addEventListener(AUTH_CHANGE_EVENT, listener);

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, listener);
  };
}
