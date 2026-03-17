import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

let refreshPromise = null;

async function refreshTokens() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "X-Refresh-Token": refreshToken
    }
  });

  const data = await parseResponse(response);
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

async function getRefreshedTokens() {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function buildHeaders(includeAuth, body) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (includeAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload && payload.error ? payload.error : "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;

    if (response.status === 403 && message === "User is blocked") {
      clearTokens();
    }

    throw error;
  }

  return payload;
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, auth = true } = options;
  const headers = buildHeaders(auth, body);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status !== 401 || !auth) {
    return parseResponse(response);
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return parseResponse(response);
  }

  try {
    await getRefreshedTokens();
  } catch (err) {
    clearTokens();
    return parseResponse(response);
  }

  const retryHeaders = buildHeaders(auth, body);
  const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: retryHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  return parseResponse(retryResponse);
}

export const api = {
  register(payload) {
    return apiRequest("/api/auth/register", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  login(payload) {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  me() {
    return apiRequest("/api/auth/me", { auth: true });
  },
  listProducts() {
    return apiRequest("/api/products", { auth: true });
  },
  createProduct(payload) {
    return apiRequest("/api/products", {
      method: "POST",
      body: payload,
      auth: true
    });
  },
  getProduct(id) {
    return apiRequest(`/api/products/${id}`, { auth: true });
  },
  updateProduct(id, payload) {
    return apiRequest(`/api/products/${id}`, {
      method: "PUT",
      body: payload,
      auth: true
    });
  },
  deleteProduct(id) {
    return apiRequest(`/api/products/${id}`, {
      method: "DELETE",
      auth: true
    });
  },
  listUsers() {
    return apiRequest("/api/users", { auth: true });
  },
  getUser(id) {
    return apiRequest(`/api/users/${id}`, { auth: true });
  },
  updateUser(id, payload) {
    return apiRequest(`/api/users/${id}`, {
      method: "PUT",
      body: payload,
      auth: true
    });
  },
  blockUser(id) {
    return apiRequest(`/api/users/${id}`, {
      method: "DELETE",
      auth: true
    });
  }
};
