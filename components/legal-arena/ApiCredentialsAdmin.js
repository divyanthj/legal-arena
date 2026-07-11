"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";

const emptyForm = { playerName: "", name: "", expiresAt: "" };

export default function ApiCredentialsAdmin() {
  const [credentials, setCredentials] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");

  const load = async () => {
    try {
      const result = await apiClient.get("/admin/api-credentials");
      setCredentials(result.credentials || []);
    } catch (error) {
      toast.error(error?.message || "Failed to load API credentials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createCredential = async (event) => {
    event.preventDefault();
    setWorking(true);
    setRevealedKey("");
    try {
      const result = await apiClient.post("/admin/api-credentials", {
        ...form,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      setCredentials((current) => [result.credential, ...current]);
      setRevealedKey(result.apiKey);
      setForm(emptyForm);
      toast.success("API credential created.");
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || "Creation failed.");
    } finally {
      setWorking(false);
    }
  };

  const revoke = async (credential) => {
    if (!window.confirm(`Revoke “${credential.name}”? This cannot be undone.`)) return;
    try {
      const result = await apiClient.delete(`/admin/api-credentials/${credential.id}`);
      setCredentials((current) =>
        current.map((item) =>
          item.id === credential.id ? { ...item, revokedAt: result.revokedAt } : item
        )
      );
      toast.success("Credential revoked.");
    } catch (error) {
      toast.error(error?.message || "Revocation failed.");
    }
  };

  return (
    <div className="arena-surface">
      <div className="p-6">
        <p className="arena-kicker">AI Players</p>
        <h2 className="arena-headline mt-2 text-2xl">API credentials</h2>
        <p className="mt-2 text-sm text-white/56">
          Each key creates a separate player identity. Keys are shown only once.
        </p>

        <form className="mt-5 grid gap-4 lg:grid-cols-3" onSubmit={createCredential}>
          <input
            className="input arena-field min-h-12 w-full text-slate-100"
            required
            maxLength={100}
            placeholder="Player display name"
            value={form.playerName}
            onChange={(event) => setForm({ ...form, playerName: event.target.value })}
          />
          <input
            className="input arena-field min-h-12 w-full text-slate-100"
            required
            maxLength={100}
            placeholder="Key name (for example Claude bot)"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            className="input arena-field min-h-12 w-full text-slate-100"
            type="datetime-local"
            aria-label="Optional expiry"
            value={form.expiresAt}
            onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
          />
          <button className="arena-btn-light px-5 py-3 lg:col-span-3" disabled={working}>
            {working ? "Creating..." : "Create API Credential"}
          </button>
        </form>

        {revealedKey ? (
          <div className="mt-5 rounded-xl border border-amber-300/35 bg-amber-300/10 p-4">
            <p className="text-sm font-semibold text-amber-200">Copy this key now</p>
            <code className="mt-2 block break-all text-sm text-white">{revealedKey}</code>
            <button
              type="button"
              className="arena-btn-dark mt-3 px-4 py-2 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(revealedKey);
                toast.success("API key copied.");
              }}
            >
              Copy key
            </button>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {loading ? <p className="text-sm text-white/56">Loading credentials...</p> : null}
          {!loading && !credentials.length ? (
            <p className="arena-surface-soft p-4 text-sm text-white/56">No API credentials yet.</p>
          ) : null}
          {credentials.map((credential) => (
            <div key={credential.id} className="arena-surface-soft flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-white">{credential.name}</p>
                <p className="mt-1 text-white/62">{credential.user?.name} · {credential.keyId}</p>
                <p className="mt-1 text-xs text-white/42">
                  {credential.revokedAt
                    ? `Revoked ${new Date(credential.revokedAt).toLocaleString()}`
                    : credential.expiresAt
                      ? `Expires ${new Date(credential.expiresAt).toLocaleString()}`
                      : "No expiry"}
                  {credential.lastUsedAt
                    ? ` · Last used ${new Date(credential.lastUsedAt).toLocaleString()}`
                    : " · Never used"}
                </p>
              </div>
              {!credential.revokedAt ? (
                <button type="button" className="arena-btn-danger px-3 py-2 text-xs" onClick={() => revoke(credential)}>
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
