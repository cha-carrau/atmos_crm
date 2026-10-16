"use client";

import { createContext, FormEvent, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import { pullWorkspace } from "@/store/sync";
import { useStore } from "@/store/useStore";

interface Member {
  id: string;
  email: string;
  name: string;
}

const SessionEmailContext = createContext("");

export function useSessionEmail() {
  return useContext(SessionEmailContext);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"loading" | "welcome" | "app">("loading");
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isInvite = pathname.startsWith("/invite");

  useEffect(() => {
    if (isInvite) return;
    let cancelled = false;

    async function boot() {
      try {
        const statusResponse = await fetch("/api/auth/status", { credentials: "include" });
        const status = await statusResponse.json();
        if (cancelled) return;
        setHasWorkspace(Boolean(status.hasWorkspace));

        const meResponse = await fetch("/api/auth/me", { credentials: "include" });
        if (!meResponse.ok) {
          setPhase("welcome");
          return;
        }
        const me = await meResponse.json();
        const workspaceResponse = await fetch("/api/workspace", { credentials: "include" });
        if (!workspaceResponse.ok) {
          setPhase("welcome");
          return;
        }
        const workspace = await workspaceResponse.json();
        useStore.getState().applyServerState(workspace);
        if (cancelled) return;
        setMember(me.member);
        setPhase("app");
      } catch {
        if (!cancelled) setPhase("welcome");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [isInvite]);

  useEffect(() => {
    if (phase !== "app") return;
    const timer = window.setInterval(() => {
      void pullWorkspace();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [phase]);

  if (isInvite) return <>{children}</>;

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (phase === "welcome") {
    const createWorkspace = async (event: FormEvent) => {
      event.preventDefault();
      setSaving(true);
      setError("");
      let data = null;
      try {
        const raw = localStorage.getItem("tempo-storage");
        if (raw) data = JSON.parse(raw).state || null;
      } catch {
        data = null;
      }
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, data }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Could not create the workspace.");
        setSaving(false);
        return;
      }
      window.location.assign("/");
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">AtmosOne CRM</h1>
          {hasWorkspace ? (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This workspace is shared. Ask an owner to invite your email, then open the link they send.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Invited people can edit everything and invite others.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create the shared workspace. You can then invite other owners by email.
              </p>
              <form onSubmit={createWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                    placeholder="Charlotte"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
                >
                  {saving ? "Creating..." : "Create workspace"}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  If this browser already has contacts and the workspace is empty, they are moved into the shared workspace.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <SessionEmailContext.Provider value={member?.email || ""}>
      <Navigation />
      <main>{children}</main>
    </SessionEmailContext.Provider>
  );
}
