import { useEffect, useState, type FormEvent } from "react";
import { loadMessages, sendChat, type ChatMessageView } from "../api";

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadMessages()
      .then((result) => setMessages(result.messages))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      });
  }, []);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (message === "" || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendChat(message);
      setText("");
      const loaded = await loadMessages();
      if (loaded.messages.length > 0) {
        setMessages(loaded.messages);
      } else {
        setMessages((current) => [
          ...current,
          {
            id: `local-user-${Date.now()}`,
            role: "user",
            content: message,
            createdAt: new Date().toISOString(),
          },
          {
            id: `local-assistant-${Date.now()}`,
            role: "assistant",
            content: result.reply,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {error ? <p>{error}</p> : null}
        {messages.map((message) => (
          <p key={message.id}>
            <span>{message.role === "user" ? "You" : "Rytham"}: </span>
            <span>{message.content}</span>
          </p>
        ))}
      </div>
      <form className="flex gap-2 border-t border-white p-2" onSubmit={(event) => void handleSend(event)}>
        <input
          className="flex-1 border border-white bg-black p-1 text-white"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="border border-white px-2 py-1"
          disabled={busy || text.trim() === ""}
        >
          Send
        </button>
      </form>
    </main>
  );
}
