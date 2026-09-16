import { useEffect, useState } from "react";
import { clearToken, getToken, loadMe, setToken, type UserView } from "./api";
import { ChatPage } from "./pages/Chat";
import { HomePage } from "./pages/Home";
import { UsagePage } from "./pages/Usage";

type Page = "/" | "/chat" | "/usage";

function currentPage(): Page {
  const path = window.location.pathname;
  if (path === "/chat") {
    return "/chat";
  }
  if (path === "/usage") {
    return "/usage";
  }
  return "/";
}

export function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [user, setUser] = useState<UserView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const authError = params.get("error");
    if (token) {
      setToken(token);
    }
    if (authError) {
      setError("Login failed");
    }
    if (token || authError) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    const onPop = () => setPage(currentPage());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadMe()
      .then((profile) => {
        setUser(profile);
        setError("");
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function go(next: Page) {
    window.history.pushState(null, "", next);
    setPage(next);
  }

  const loggedIn = user !== null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <nav className="flex flex-wrap gap-2 border-b border-white p-2">
        <button type="button" className="border border-white px-2 py-1" onClick={() => go("/")}>
          Home
        </button>
        {loggedIn ? (
          <>
            <button
              type="button"
              className="border border-white px-2 py-1"
              onClick={() => go("/chat")}
            >
              Chat
            </button>
            <button
              type="button"
              className="border border-white px-2 py-1"
              onClick={() => go("/usage")}
            >
              Usage
            </button>
          </>
        ) : null}
      </nav>
      {loading ? (
        <p className="p-4">Loading</p>
      ) : page === "/chat" && loggedIn ? (
        <ChatPage />
      ) : page === "/usage" && loggedIn ? (
        <UsagePage />
      ) : (
        <HomePage
          user={user}
          error={error}
          onLogin={(profile) => {
            setUser(profile);
            setError("");
            go("/");
          }}
          onLogout={() => {
            setUser(null);
            go("/");
          }}
          onError={setError}
        />
      )}
    </div>
  );
}
