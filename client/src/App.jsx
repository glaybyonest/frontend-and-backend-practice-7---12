import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Nav from "./components/Nav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Me from "./pages/Me";
import Users from "./pages/Users";
import { api } from "./api";
import {
  clearTokens,
  getAccessToken,
  subscribeToAuthChanges
} from "./auth";

const AUTH_ROLES = ["user", "seller", "admin"];

function ProtectedRoute({ user, authReady, roles = AUTH_ROLES, children }) {
  if (!authReady) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/products" replace />;
  }

  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const loadMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    try {
      const me = await api.me();
      setUser(me);
    } catch (err) {
      clearTokens();
      setUser(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      if (!getAccessToken()) {
        setUser(null);
        setAuthReady(true);
      }
    });
  }, []);

  function handleLogout() {
    clearTokens();
    setUser(null);
  }

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route
          path="/register"
          element={user ? <Navigate to="/products" replace /> : <Register />}
        />
        <Route
          path="/login"
          element={
            user ? <Navigate to="/products" replace /> : <Login onLogin={loadMe} />
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute user={user} authReady={authReady}>
              <Products user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute user={user} authReady={authReady}>
              <ProductDetails user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me"
          element={
            <ProtectedRoute user={user} authReady={authReady}>
              <Me user={user} onRefresh={setUser} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute user={user} authReady={authReady} roles={["admin"]}>
              <Users user={user} onUserChange={setUser} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </>
  );
}
