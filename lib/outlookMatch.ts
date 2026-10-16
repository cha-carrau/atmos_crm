export const OUTLOOK_REDIRECT_URI = "http://localhost:3000/api/outlook/callback";

export const OUTLOOK_DELEGATED_PERMISSIONS = [
  "Mail.Read",
  "Calendars.Read",
  "Contacts.Read",
  "offline_access",
  "User.Read",
] as const;

export const OUTLOOK_SCOPES = OUTLOOK_DELEGATED_PERMISSIONS.join(" ");

export type OutlookEventType = "email" | "reply-received" | "meeting";

export interface CrmPersonRef {
  id: string;
  name: string;
  email?: string;
  secondaryEmail?: string;
}

export interface ExistingExternalRef {
  personId: string;
  externalId: string;
}

export interface OutlookParticipant {
  name?: string;
  address?: string;
}

export interface OutlookMessage {
  id: string;
  subject?: string;
  from?: OutlookParticipant;
  to: OutlookParticipant[];
  cc: OutlookParticipant[];
  receivedAt?: string;
  preview?: string;
  folder: "mailbox" | "sent";
}

export interface OutlookMeeting {
  id: string;
  subject?: string;
  start?: string;
  end?: string;
  organizer?: OutlookParticipant;
  attendees: OutlookParticipant[];
  isCancelled?: boolean;
}

export interface OutlookContact {
  id: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  companyName?: string;
}

export interface PendingImportEvent {
  type: OutlookEventType;
  occurredAt: string;
  notes?: string;
  externalId: string;
  subject?: string;
}

export interface ImportEventDraft extends PendingImportEvent {
  personId: string;
  personName: string;
}

export type SuggestionSource = "contact" | "mail" | "meeting";

export interface SuggestedContact {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  companyName?: string;
  sources: SuggestionSource[];
  pendingEvents: PendingImportEvent[];
}

export interface OutlookSyncSummary {
  messagesRead: number;
  meetingsRead: number;
  contactsRead: number;
  matchedEvents: number;
  skippedDuplicates: number;
  skippedFutureMeetings: number;
  suggestedContacts: number;
}

export interface OutlookConnectionStatus {
  configured: boolean;
  missingEnv: string[];
  redirectUri: string;
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  lastSyncAt?: string | null;
  lastSync?: OutlookSyncSummary | null;
}

export interface MatchResult {
  events: ImportEventDraft[];
  suggestions: SuggestedContact[];
  skippedDuplicates: number;
  skippedFutureMeetings: number;
}

const CLOCK_SKEW_MS = 60 * 1000;

export function normalizeEmail(email?: string) {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

export function normalizeName(name?: string) {
  const value = name?.trim().replace(/\s+/g, " ").toLowerCase();
  return value || undefined;
}

export function parseInstant(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  const hasZone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed);
  const normalized = (hasZone ? trimmed : `${trimmed}Z`).replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toLocalDateAndTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function interactionNotes(subject?: string, preview?: string) {
  const title = subject?.trim();
  const snippet = preview?.replace(/\s+/g, " ").trim();
  if (title && snippet && snippet !== title) {
    return `${title}\n${snippet.slice(0, 180)}`;
  }
  return title || snippet || undefined;
}

function participantKey(person: OutlookParticipant) {
  const email = normalizeEmail(person.address);
  if (email) return `email:${email}`;
  const name = normalizeName(person.name);
  return name ? `name:${name}` : undefined;
}

function dedupeParticipants(people: OutlookParticipant[]) {
  const seen = new Set<string>();
  const unique: OutlookParticipant[] = [];
  for (const person of people) {
    const key = participantKey(person);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(person);
  }
  return unique;
}

export function matchOutlookImport(input: {
  meEmails: string[];
  people: CrmPersonRef[];
  existing: ExistingExternalRef[];
  messages: OutlookMessage[];
  meetings: OutlookMeeting[];
  contacts: OutlookContact[];
  now?: Date;
}): MatchResult {
  const now = input.now ?? new Date();
  const selfEmails = new Set(
    input.meEmails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email))
  );
  const emailIndex = new Map<string, CrmPersonRef[]>();

  for (const person of input.people) {
    for (const raw of [person.email, person.secondaryEmail]) {
      const email = normalizeEmail(raw);
      if (!email) continue;
      const matches = emailIndex.get(email) ?? [];
      if (!matches.some((item) => item.id === person.id)) matches.push(person);
      emailIndex.set(email, matches);
    }
  }

  const seen = new Set(input.existing.map((item) => `${item.personId}::${item.externalId}`));
  const events: ImportEventDraft[] = [];
  const suggestions = new Map<string, SuggestedContact>();
  let skippedDuplicates = 0;
  let skippedFutureMeetings = 0;

  const isSelf = (address?: string) => {
    const email = normalizeEmail(address);
    return Boolean(email && selfEmails.has(email));
  };

  const matchPerson = (address?: string) => {
    const email = normalizeEmail(address);
    if (!email) return undefined;
    return emailIndex.get(email)?.[0];
  };

  const pushEvent = (event: ImportEventDraft) => {
    const key = `${event.personId}::${event.externalId}`;
    if (seen.has(key)) {
      skippedDuplicates += 1;
      return;
    }
    seen.add(key);
    events.push(event);
  };

  const addSuggestion = (suggestion: {
    address?: string;
    name?: string;
    source: SuggestionSource;
    jobTitle?: string;
    companyName?: string;
    pending?: PendingImportEvent;
  }) => {
    const email = normalizeEmail(suggestion.address);
    const nameKey = normalizeName(suggestion.name);
    const id = email ? `email:${email}` : nameKey ? `name:${nameKey}` : undefined;
    if (!id) return;

    const displayName = suggestion.name?.trim() || suggestion.address?.trim();
    if (!displayName) return;

    const current = suggestions.get(id) ?? {
      id,
      name: displayName,
      email: suggestion.address?.trim() || undefined,
      jobTitle: undefined,
      companyName: undefined,
      sources: [],
      pendingEvents: [],
    };

    if (suggestion.source === "contact" && suggestion.name?.trim()) {
      current.name = suggestion.name.trim();
    } else if (!current.name) {
      current.name = displayName;
    }
    if (suggestion.jobTitle?.trim()) current.jobTitle = suggestion.jobTitle.trim();
    if (suggestion.companyName?.trim()) current.companyName = suggestion.companyName.trim();
    if (suggestion.address?.trim() && !current.email) current.email = suggestion.address.trim();
    if (!current.sources.includes(suggestion.source)) current.sources.push(suggestion.source);
    if (
      suggestion.pending &&
      !current.pendingEvents.some((event) => event.externalId === suggestion.pending?.externalId)
    ) {
      current.pendingEvents.push(suggestion.pending);
    }
    suggestions.set(id, current);
  };

  const considerParticipant = (participant: {
    address?: string;
    name?: string;
    source: SuggestionSource;
    jobTitle?: string;
    companyName?: string;
    pending?: PendingImportEvent;
  }) => {
    if (isSelf(participant.address)) return;
    const email = normalizeEmail(participant.address);
    if (!email) return;
    const person = matchPerson(email);
    if (person) {
      if (participant.pending) {
        pushEvent({
          ...participant.pending,
          personId: person.id,
          personName: person.name,
        });
      }
      return;
    }

    addSuggestion(participant);
  };

  for (const message of input.messages) {
    const received = parseInstant(message.receivedAt);
    if (!message.id || !received || received.getTime() > now.getTime() + CLOCK_SKEW_MS) continue;

    const fromSelf = message.folder === "sent" || isSelf(message.from?.address);
    const pendingBase = {
      occurredAt: received.toISOString(),
      notes: interactionNotes(message.subject, message.preview),
      externalId: `outlook-message:${message.id}`,
      subject: message.subject?.trim() || undefined,
    };

    if (fromSelf) {
      for (const recipient of dedupeParticipants([...message.to, ...message.cc])) {
        considerParticipant({
          address: recipient.address,
          name: recipient.name,
          source: "mail",
          pending: { ...pendingBase, type: "email" },
        });
      }
      continue;
    }

    if (!message.from) continue;
    considerParticipant({
      address: message.from.address,
      name: message.from.name,
      source: "mail",
      pending: { ...pendingBase, type: "reply-received" },
    });
  }

  for (const meeting of input.meetings) {
    if (!meeting.id || meeting.isCancelled) continue;
    const end = parseInstant(meeting.end);
    const start = parseInstant(meeting.start);
    if (!end || !start) continue;
    if (end.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      skippedFutureMeetings += 1;
      continue;
    }

    const pending: PendingImportEvent = {
      type: "meeting",
      occurredAt: start.toISOString(),
      notes: interactionNotes(meeting.subject),
      externalId: `outlook-event:${meeting.id}`,
      subject: meeting.subject?.trim() || undefined,
    };
    const participants = dedupeParticipants([
      ...(meeting.organizer ? [meeting.organizer] : []),
      ...meeting.attendees,
    ]);
    for (const participant of participants) {
      considerParticipant({
        address: participant.address,
        name: participant.name,
        source: "meeting",
        pending,
      });
    }
  }

  for (const contact of input.contacts) {
    considerParticipant({
      address: contact.email,
      name: contact.name,
      source: "contact",
      jobTitle: contact.jobTitle,
      companyName: contact.companyName,
    });
  }

  return {
    events,
    suggestions: [...suggestions.values()]
      .sort((a, b) => {
        const interactionDelta = b.pendingEvents.length - a.pendingEvents.length;
        if (interactionDelta !== 0) return interactionDelta;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 300),
    skippedDuplicates,
    skippedFutureMeetings,
  };
}
