import { useEffect, useMemo, useState } from "react";

type Note = { id: number; text: string; created_at: string; updated_at: string };

const API_BASE =
  import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";



async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    // Try to surface FastAPI error messages nicely
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  // DELETE returns JSON in our backend, but this keeps it flexible
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return undefined as T;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newText, setNewText] = useState("");
  const [err, setErr] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canAdd = useMemo(() => newText.trim().length > 0 && !isAdding, [newText, isAdding]);

  async function loadNotes() {
    setErr("");
    setIsLoading(true);
    try {
      const data = await api<Note[]>("/notes");
      setNotes(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = newText.trim();
    if (!t || isAdding) return;

    setErr("");
    setIsAdding(true);
    try {
      const created = await api<Note>("/notes", {
        method: "POST",
        body: JSON.stringify({ text: t }),
      });
      setNotes((prev) => [created, ...prev]);
      setNewText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add note.");
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(note: Note) {
    setErr("");
    setEditingId(note.id);
    setEditingText(note.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
    setSavingEdit(false);
  }

  async function saveEdit() {
    if (editingId === null) return;
    const t = editingText.trim();
    if (!t || savingEdit) return;

    setErr("");
    setSavingEdit(true);
    try {
      const updated = await api<Note>(`/notes/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ text: t }),
      });

      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      cancelEdit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update note.");
      setSavingEdit(false);
    }
  }

  async function deleteNote(id: number) {
    if (deletingId !== null) return;

    setErr("");
    setDeletingId(id);
    try {
      await api<{ deleted: boolean; id: number }>(`/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: 16, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Notes</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            A tiny full-stack app (React + TypeScript + FastAPI + Postgres)
          </p>
        </div>
        <button onClick={loadNotes} disabled={isLoading} style={{ padding: "10px 12px" }}>
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section style={{ marginTop: 18 }}>
        <form onSubmit={addNote} style={{ display: "flex", gap: 10 }}>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write a note…"
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button disabled={!canAdd} style={{ padding: "12px 14px", borderRadius: 10 }}>
            {isAdding ? "Adding…" : "Add"}
          </button>
        </form>

        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #f5c2c7" }}>
            <strong style={{ display: "block", marginBottom: 6 }}>Something went wrong</strong>
            <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
          </div>
        )}
      </section>

      <section style={{ marginTop: 18 }}>
        {isLoading ? (
          <p>Loading…</p>
        ) : notes.length === 0 ? (
          <p>No notes yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {notes.map((n) => {
              const isEditing = editingId === n.id;
              const isDeleting = deletingId === n.id;

              return (
                <li
                  key={n.id}
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            resize: "vertical",
                          }}
                        />
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || editingText.trim().length === 0}
                            style={{ padding: "10px 12px", borderRadius: 10 }}
                            type="button"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button onClick={cancelEdit} type="button" style={{ padding: "10px 12px", borderRadius: 10 }}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{n.text}</div>
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.5 }}>
                          Created {new Date(n.created_at).toLocaleString()}
                          {n.updated_at !== n.created_at && ` · Updated ${new Date(n.updated_at).toLocaleString()}`}
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startEdit(n)}
                      disabled={editingId !== null || isDeleting}
                      type="button"
                      style={{ padding: "10px 12px", borderRadius: 10 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNote(n.id)}
                      disabled={isDeleting || editingId === n.id}
                      type="button"
                      style={{ padding: "10px 12px", borderRadius: 10 }}
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
