"use client";

import { FormEvent, useEffect, useState } from "react";

interface Member {
  id: string;
  email: string;
  name: string;
}

interface Invite {
  token: string;
  email: string;
  expiresAt: string;
}

interface CreatedInvite {
  email: string;
  link: string;
  emailed: boolean;
}

export default function TeamSettings() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/auth/me", { credentials: "include" });
    if (!response.ok) return;
    const body = await response.json();
    setMembers(body.members);
    setInvites(body.invites);
    setCurrentId(body.member.id);
  };

  useEffect(() => {
    void load();
  }, []);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setCreated(null);
    const response = await fetch("/api/invites", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "Could not create the invite.");
      return;
    }
    setCreated(body);
    setEmail("");
    if (!body.emailed) {
      const mailto = document.createElement("a");
      mailto.href = mailtoLink(body.email, body.link);
      mailto.click();
    }
    await load();
  };

  const revoke = async (token: string) => {
    await fetch(`/api/invites/${token}`, { method: "DELETE", credentials: "include" });
    await load();
  };

  const removeMember = async (member: Member) => {
    if (!window.confirm(`Remove ${member.name} from AtmosOne CRM?`)) return;
    const response = await fetch(`/api/members/${member.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not remove that person.");
      return;
    }
    await load();
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Owners</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
        Everyone invited here can edit the CRM and invite other owners.
      </p>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800 mb-6">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {member.name}
                {member.id === currentId ? " (you)" : ""}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
            </div>
            {member.id !== currentId && (
              <button
                onClick={() => removeMember(member)}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
        >
          {saving ? "Inviting..." : "Invite by email"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {created && (
        <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 p-4">
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
            {created.emailed
              ? `Invite emailed to ${created.email}.`
              : `Your email app should open with an invite to ${created.email}. You can also send this link yourself.`}
          </p>
          {created.link.includes("://localhost") && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This link only opens on this computer. To invite someone else, open AtmosOne at the network address shown in the terminal, then send the invite from there.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(created.link)}
              className="text-sm text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Copy invite link
            </button>
            <a
              href={mailtoLink(created.email, created.link)}
              className="text-sm text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Open email again
            </a>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pending invites</h3>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.token} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{invite.email}</span>
                <button
                  onClick={() => revoke(invite.token)}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function mailtoLink(email: string, link: string) {
  const subject = encodeURIComponent("Join AtmosOne CRM");
  const body = encodeURIComponent(
    `You're invited to edit AtmosOne CRM as an owner.\n\nOpen this link to join:\n${link}\n`
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
