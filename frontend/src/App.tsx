import { useEffect, useMemo, useState } from "react";

type Note = { id: number; text: string; created_at: string; updated_at: string };

const API_BASE =
  import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
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
    <div className="app-container">
      <header className="header">
        <div>
          <h1>Notes</h1>
          <p className="header-subtitle">
            A tiny full-stack app (React + TypeScript + FastAPI + Postgres)
          </p>
        </div>
        <button onClick={loadNotes} disabled={isLoading}>
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="form-section">
        <form onSubmit={addNote} className="note-form">
          <input
            className="note-input"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Write a note…"
          />
          <button disabled={!canAdd}>
            {isAdding ? "Adding…" : "Add"}
          </button>
        </form>

        {err && (
          <div className="error-banner">
            <strong>Something went wrong</strong>
            <div>{err}</div>
          </div>
        )}
      </section>

      <section className="notes-section">
        {isLoading ? (
          <p className="empty-state">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="empty-state">No notes yet.</p>
        ) : (
          <ul className="notes-list">
            {notes.map((n) => {
              const isEditing = editingId === n.id;
              const isDeleting = deletingId === n.id;

              return (
                <li key={n.id} className="glass-card note-card">
                  <div className="note-content">
                    {isEditing ? (
                      <>
                        <textarea
                          className="edit-textarea"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                        />
                        <div className="edit-actions">
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || editingText.trim().length === 0}
                            type="button"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button onClick={cancelEdit} type="button">
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="note-text">{n.text}</div>
                        <div className="note-meta">
                          Created {new Date(n.created_at).toLocaleString()}
                          {n.updated_at !== n.created_at && ` · Updated ${new Date(n.updated_at).toLocaleString()}`}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="note-actions">
                    <button
                      onClick={() => startEdit(n)}
                      disabled={editingId !== null || isDeleting}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNote(n.id)}
                      disabled={isDeleting || editingId === n.id}
                      type="button"
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
