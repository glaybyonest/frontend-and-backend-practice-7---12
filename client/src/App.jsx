import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Nav from "./components/Nav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Me from "./pages/Me";
import { api } from "./api";
import { clearTokens, getAccessToken } from "./auth";

function ProtectedRoute({ user, authReady, children }) {
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
        <Route path="/products" element={<Products user={user} />} />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute user={user} authReady={authReady}>
              <ProductDetails />
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
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </>
  );
}
