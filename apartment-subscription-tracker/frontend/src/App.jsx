import { useEffect, useState } from "react";
import api from "./services/api";

function App() {
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
        setError("Could not load publications");
      });
  }, []);

  return (
    <div>
      <h1>Apartment Subscription Tracker</h1>

      {error && <p>{error}</p>}

      <h2>Publications</h2>

      {publications.length === 0 ? (
        <p>No publications found.</p>
      ) : (
        <ul>
          {publications.map((publication) => (
            <li key={publication.id}>{publication.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
