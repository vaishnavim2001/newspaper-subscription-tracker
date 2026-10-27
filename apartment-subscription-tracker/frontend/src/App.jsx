import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import api from "./services/api";
import Login from "./pages/Login";
import { useAuth } from "./context/useAuth.js";

function Home() {
  const { user, logout } = useAuth();
  const [publications, setPublications] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/publications")
      .then((response) => {
        setPublications(response.data);
      })
      .catch((error) => {
        console.error("API error:", error);
        setError("Could not load publications.");
      });
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <main>
      <h1>Apartment Subscription Tracker</h1>

      {user && (
        <>
          <p>Logged in as {user.email}</p>
          <button onClick={handleLogout}>Log out</button>
        </>
      )}

      {error && <p role="alert">{error}</p>}

      <h2>Publications</h2>

      {publications.length === 0 ? (
        !error && <p>No publications found.</p>
      ) : (
        <ul>
          {publications.map((publication) => (
            <li key={publication.id}>{publication.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={user ? <Home /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
