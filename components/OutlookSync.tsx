"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import {
  ImportEventDraft,
  OUTLOOK_DELEGATED_PERMISSIONS,
  OutlookConnectionStatus,
  OutlookSyncSummary,
  SuggestedContact,
  SuggestionSource,
  toLocalDateAndTime,
} from "@/lib/outlookMatch";
import { findMergeCandidates } from "@/lib/mergePeople";
import MergeSuggestionsModal, { MergeSuggestionsButton } from "@/components/MergeSuggestions";

const TYPE_LABELS: Record<ImportEventDraft["type"], string> = {
  email: "Email sent",
  "reply-received": "Reply received",
  meeting: "Meeting",
};

const ERROR_TEXT: Record<string, string> = {
  not_configured: "Outlook is not configured yet. Add the Azure values below, then restart the dev server.",
  access_denied: "Microsoft sign-in was canceled before access was granted.",
  invalid_state: "The sign-in session expired. Connect Outlook again.",
  missing_code: "Microsoft did not return an authorization code.",
  token_exchange: "Microsoft did not finish connecting. Check the client secret, redirect URI, and permissions, then try again.",
  not_connected: "Connect Outlook before syncing.",
};

interface SyncPayload {
  events: ImportEventDraft[];
  suggestions: SuggestedContact[];
  summary: OutlookSyncSummary;
  warnings?: string[];
  syncedAt: string;
  error?: string;
}

interface SessionResult {
  added: number;
  skippedDuplicates: number;
  summary: OutlookSyncSummary;
  warnings: string[];
  events: ImportEventDraft[];
  syncedAt: string;
}

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function sourceLabel(sources: SuggestionSource[]) {
  const labels: string[] = [];
  if (sources.includes("mail")) labels.push("email");
  if (sources.includes("meeting")) labels.push("meeting");
  if (sources.includes("contact")) labels.push("Outlook contact");
  return labels.join(" · ");
}

function recordEvents(events: ImportEventDraft[]) {
  const { addEvent, events: current } = useStore.getState();
  const seen = new Set(
    current
      .filter((event) => event.externalId)
      .map((event) => `${event.personId}::${event.externalId}`)
  );
  const addedEvents: ImportEventDraft[] = [];
  let skipped = 0;

  for (const event of events) {
    const when = toLocalDateAndTime(event.occurredAt);
    const key = `${event.personId}::${event.externalId}`;
    if (!when || seen.has(key)) {
      skipped += 1;
      continue;
    }
    addEvent({
      personId: event.personId,
      date: when.date,
      time: when.time,
      type: event.type,
      notes: event.notes,
      externalId: event.externalId,
    });
    seen.add(key);
    addedEvents.push(event);
  }

  return { addedEvents, skipped };
}

export default function OutlookSync({ initialStatus }: { initialStatus: OutlookConnectionStatus }) {
  const params = useSearchParams();
  const addPerson = useStore((state) => state.addPerson);
  const [status, setStatus] = useState<OutlookConnectionStatus | null>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addedNotice, setAddedNotice] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const people = useStore((state) => state.people);
  const mergeCount = useMemo(() => findMergeCandidates(people).length, [people]);

  const errorCode = params.get("error");
  const detail = params.get("detail")?.slice(0, 180);
  const justConnected = params.get("connected") === "1";

  async function loadStatus() {
    const response = await fetch("/api/outlook/status", { cache: "no-store" });
    if (!response.ok) throw new Error("status");
    return (await response.json()) as OutlookConnectionStatus;
  }

  useEffect(() => {
    let cancelled = false;
    loadStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled && !initialStatus) setStatusError("Could not check the Outlook connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function syncNow() {
    setSyncing(true);
    setSyncError("");
    setAddedNotice("");
    const state = useStore.getState();
    try {
      const response = await fetch("/api/outlook/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          people: state.people.map((person) => ({
            id: person.id,
            name: person.name,
            email: person.email,
            secondaryEmail: person.secondaryEmail,
          })),
          existingExternalIds: state.events
            .filter((event) => event.externalId)
            .map((event) => ({ personId: event.personId, externalId: event.externalId })),
        }),
      });
      const body = (await response.json()) as SyncPayload;
      if (!response.ok) {
        setSyncError(body.error || "Sync failed.");
        return;
      }
      const recorded = recordEvents(body.events);
      setResult({
        added: recorded.addedEvents.length,
        skippedDuplicates: body.summary.skippedDuplicates + recorded.skipped,
        summary: body.summary,
        warnings: body.warnings || [],
        events: recorded.addedEvents,
        syncedAt: body.syncedAt,
      });
      setSuggestions(body.suggestions);
      setSelected(new Set());
      setStatus(await loadStatus());
      if (findMergeCandidates(useStore.getState().people).length > 0) setMergeOpen(true);
    } catch {
      setSyncError("Sync failed before Microsoft Graph responded.");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Outlook on this server? Imported events stay in the CRM.")) return;
    await fetch("/api/outlook/disconnect", { method: "POST" });
    setStatus(await loadStatus());
    setResult(null);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    const chosen = suggestions.filter((suggestion) => selected.has(suggestion.id));
    if (chosen.length === 0) return;
    setAdding(true);
    const { events: current } = useStore.getState();
    const seen = new Set(
      current
        .filter((event) => event.externalId)
        .map((event) => `${event.personId}::${event.externalId}`)
    );
    let peopleAdded = 0;
    let eventsAdded = 0;

    for (const suggestion of chosen) {
      const personId = addPerson({
        name: suggestion.name,
        email: suggestion.email,
        jobTitle: suggestion.jobTitle,
        notes: suggestion.companyName
          ? `Added from Outlook. Company: ${suggestion.companyName}`
          : "Added from Outlook.",
        status: "active",
        tags: [],
      });
      peopleAdded += 1;
      for (const event of suggestion.pendingEvents) {
        const when = toLocalDateAndTime(event.occurredAt);
        const key = `${personId}::${event.externalId}`;
        if (!when || seen.has(key)) continue;
        useStore.getState().addEvent({
          personId,
          date: when.date,
          time: when.time,
          type: event.type,
          notes: event.notes,
          externalId: event.externalId,
        });
        seen.add(key);
        eventsAdded += 1;
      }
    }

    setSuggestions((currentSuggestions) => currentSuggestions.filter((suggestion) => !selected.has(suggestion.id)));
    setSelected(new Set());
    setAddedNotice(
      `Added ${peopleAdded} ${peopleAdded === 1 ? "person" : "people"} and ${eventsAdded} past ${
        eventsAdded === 1 ? "interaction" : "interactions"
      }.`
    );
    setAdding(false);
    if (findMergeCandidates(useStore.getState().people).length > 0) setMergeOpen(true);
  }

  const redirectUri = status?.redirectUri || "http://localhost:3000/api/outlook/callback";

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Outlook</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in with Microsoft and import past emails and meetings onto people who already exist in AtmosOne.
            New people are only added when you choose them.
          </p>
        </div>
        <MergeSuggestionsButton count={mergeCount} onClick={() => setMergeOpen(true)} />
      </div>

      {errorCode && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <p>{ERROR_TEXT[errorCode] || "Outlook could not connect."}</p>
          {detail && <p className="mt-1 text-red-600/80 dark:text-red-300/80">{detail}</p>}
        </div>
      )}

      {justConnected && !errorCode && (
        <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Outlook is connected. Sync when you want to import past conversations and meetings.
        </div>
      )}

      {loading && <p className="text-gray-500 dark:text-gray-400">Checking Outlook…</p>}
      {statusError && <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>}

      {status && !status.configured && (
        <SetupGuide missing={status.missingEnv} redirectUri={redirectUri} />
      )}

      {status?.configured && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Connection</h2>
              {status.connected ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Signed in as {status.accountName ? `${status.accountName} · ` : ""}
                  {status.accountEmail || "your Microsoft account"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Not connected. Microsoft will ask you to grant read access. AtmosOne never sees your password.
                </p>
              )}
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                {status.lastSyncAt ? (
                  <>
                    Last sync {formatWhen(status.lastSyncAt)}
                    {status.lastSync
                      ? ` · ${status.lastSync.matchedEvents} matched events · ${status.lastSync.suggestedContacts} suggestions`
                      : ""}
                  </>
                ) : (
                  "No sync yet."
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {status.connected ? (
                <>
                  <button
                    type="button"
                    onClick={syncNow}
                    disabled={syncing}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    type="button"
                    onClick={disconnect}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <a
                  href="/api/outlook/connect"
                  className="inline-flex px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
                >
                  Connect Outlook
                </a>
              )}
            </div>
          </div>
          {syncError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{syncError}</p>}
        </section>
      )}

      {result && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">This sync</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Added {result.added} matched {result.added === 1 ? "event" : "events"}. Skipped {result.skippedDuplicates}{" "}
            already imported. Left out {result.summary.skippedFutureMeetings} meetings that have not ended.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Messages" value={result.summary.messagesRead} />
            <Stat label="Meetings" value={result.summary.meetingsRead} />
            <Stat label="Contacts" value={result.summary.contactsRead} />
            <Stat label="Suggestions" value={suggestions.length} />
          </div>
          {result.warnings.length > 0 && (
            <ul className="mb-4 text-sm text-amber-700 dark:text-amber-300 space-y-1">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {result.events.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No new events matched people already in AtmosOne.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {result.events.slice(0, 20).map((event) => (
                <li key={`${event.personId}-${event.externalId}`} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/people/${event.personId}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600"
                    >
                      {event.personName}
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {TYPE_LABELS[event.type]}
                      {event.subject ? ` · ${event.subject}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatWhen(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {result.events.length > 20 && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              And {result.events.length - 20} more, saved on each person.
            </p>
          )}
        </section>
      )}

      {status?.configured && (suggestions.length > 0 || addedNotice) && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Suggested contacts</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                These people are not in AtmosOne yet. Nothing is added until you choose them. You can set a contact
                type afterward.
              </p>
            </div>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={addSelected}
                disabled={adding || selected.size === 0}
                className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                Add selected
              </button>
            )}
          </div>
          {addedNotice && <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">{addedNotice}</p>}
          {suggestions.length > 0 && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    selected.size === suggestions.length ? new Set() : new Set(suggestions.map((item) => item.id))
                  )
                }
                className="text-sm font-medium text-emerald-700 dark:text-emerald-300"
              >
                {selected.size === suggestions.length ? "Clear all" : "Select all"}
              </button>
            </div>
          )}
          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {suggestions.map((suggestion) => {
              const interactions = suggestion.pendingEvents.length;
              return (
                <li key={suggestion.id} className="py-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(suggestion.id)}
                      onChange={() => toggle(suggestion.id)}
                      className="mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {suggestion.name}
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400">
                        {[suggestion.email, suggestion.jobTitle, suggestion.companyName].filter(Boolean).join(" · ")}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {sourceLabel(suggestion.sources)}
                        {" · "}
                        {interactions === 0
                          ? "No past email or meeting in this sync."
                          : `${interactions} past ${interactions === 1 ? "interaction" : "interactions"} will be logged.`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <MergeSuggestionsModal open={mergeOpen} onClose={() => setMergeOpen(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-950 px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function SetupGuide({ missing, redirectUri }: { missing: string[]; redirectUri: string }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Connect Microsoft before syncing</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        AtmosOne does not include Azure credentials. Create an app registration, then put the values in{" "}
        <code className="text-gray-800 dark:text-gray-200">.env.local</code> and restart <code>npm run dev</code>.
      </p>
      {missing.length > 0 && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
          Missing: {missing.join(", ")}
        </p>
      )}
      <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700 dark:text-gray-300">
        <li>
          Open{" "}
          <a
            href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            className="text-emerald-700 dark:text-emerald-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Entra app registrations
          </a>{" "}
          and choose New registration.
        </li>
        <li>Name it AtmosOne CRM.</li>
        <li>
          Supported account types: Accounts in any organizational directory and personal Microsoft accounts. That
          matches tenant <code>common</code>.
        </li>
        <li>
          Redirect URI: platform <strong>Web</strong>, value exactly{" "}
          <code className="break-all text-gray-900 dark:text-white">{redirectUri}</code>
        </li>
        <li>
          After it is created, copy the Application (client) ID into <code>AZURE_CLIENT_ID</code>. Set{" "}
          <code>AZURE_TENANT_ID</code> to <code>common</code>, or to your Directory (tenant) ID if only one
          organization should sign in.
        </li>
        <li>
          Certificates &amp; secrets → New client secret. Copy the secret <strong>Value</strong> (not the secret ID)
          into <code>AZURE_CLIENT_SECRET</code>.
        </li>
        <li>
          API permissions → Add a permission → Microsoft Graph → Delegated permissions. Add:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            {OUTLOOK_DELEGATED_PERMISSIONS.map((permission) => (
              <li key={permission}>
                <code>{permission}</code>
              </li>
            ))}
          </ul>
          If your organization blocks user consent, an admin has to grant these delegated permissions.
        </li>
        <li>
          Create <code>.env.local</code> in the project root:
          <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 dark:bg-gray-950 p-3 text-xs text-gray-800 dark:text-gray-200">{`AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=common`}</pre>
        </li>
      </ol>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        The refresh token stays on this server in <code>data/outlook-tokens.json</code>. It is not stored in the
        browser.
      </p>
    </section>
  );
}
