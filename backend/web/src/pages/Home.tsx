import { useState, type FormEvent } from "react";
import {
  clearToken,
  loginApiKey,
  logout,
  setToken,
  type UserView,
} from "../api";

type Props = {
  user: UserView | null;
  error: string;
  onLogin: (user: UserView) => void;
  onLogout: () => void;
  onError: (message: string) => void;
};

export function HomePage({ user, error, onLogin, onLogout, onError }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleApiLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await loginApiKey(apiKey.trim());
      setToken(result.token);
      setApiKey("");
      onLogin(result.user);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch {
      // token is cleared either way
    } finally {
      clearToken();
      setBusy(false);
      onLogout();
    }
  }

  if (!user) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <h1>Home</h1>
        {error ? <p>{error}</p> : null}
        <a className="w-fit border border-white px-2 py-1" href="/api/google">
          Sign in / Sign up with Google
        </a>
        <form className="flex flex-col gap-2" onSubmit={(event) => void handleApiLogin(event)}>
          <label>
            API key
            <input
              className="mt-1 block w-full border border-white bg-black p-1 text-white"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="w-fit border border-white px-2 py-1"
            disabled={busy || apiKey.trim() === ""}
          >
            Login with API key
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1>Home</h1>
      {error ? <p>{error}</p> : null}
      {user.picture ? (
        <img src={user.picture} alt="" width={48} height={48} />
      ) : null}
      <p>{user.name}</p>
      <p>{user.email}</p>
      <p>{user.timezone}</p>
      <label>
        API key
        <input
          className="mt-1 block w-full border border-white bg-black p-1 text-white"
          value={user.apiKey}
          type={showKey ? "text" : "password"}
          readOnly
        />
      </label>
      <button
        type="button"
        className="w-fit border border-white px-2 py-1"
        onClick={() => setShowKey((value) => !value)}
      >
        {showKey ? "Hide API key" : "Show API key"}
      </button>
      <button
        type="button"
        className="w-fit border border-white px-2 py-1"
        onClick={() => void handleLogout()}
        disabled={busy}
      >
        Logout
      </button>
    </main>
  );
}
