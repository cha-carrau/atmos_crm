"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/invites/${token}`);
      const body = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(body.error || "This invite is no longer valid.");
      } else {
        setEmail(body.email);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not join.");
      setSaving(false);
      return;
    }
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Join AtmosOne CRM</h1>
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading invite...</p>
        ) : email ? (
          <form onSubmit={accept} className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Join as an owner with <span className="text-gray-900 dark:text-white">{email}</span>. You can edit the CRM and invite other people.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your name</label>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                placeholder="Your name"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
            >
              {saving ? "Joining..." : "Join workspace"}
            </button>
          </form>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        )}
      </div>
    </div>
  );
}
