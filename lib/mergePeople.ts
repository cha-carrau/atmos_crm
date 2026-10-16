export interface EmailFields {
  email?: string;
  secondaryEmail?: string;
}

export interface MergeCandidate<T> {
  id: string;
  left: T;
  right: T;
}

export function storedEmail(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function storedSecondaryEmail(primary?: string, secondary?: string) {
  const next = storedEmail(secondary);
  const main = storedEmail(primary);
  if (!next) return undefined;
  if (main && main.toLowerCase() === next.toLowerCase()) return undefined;
  return next;
}

export function normalizeDisplayName(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

export function collectEmails(...people: Array<EmailFields | undefined>) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const person of people) {
    if (!person) continue;
    for (const raw of [person.email, person.secondaryEmail]) {
      const trimmed = raw?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      emails.push(trimmed);
    }
  }
  return emails;
}

export function emailSetsDiffer(left: EmailFields, right: EmailFields) {
  const a = collectEmails(left).map((email) => email.toLowerCase()).sort();
  const b = collectEmails(right).map((email) => email.toLowerCase()).sort();
  if (a.length !== b.length) return true;
  return a.some((email, index) => email !== b[index]);
}

export function findMergeCandidates<
  T extends EmailFields & { id: string; name: string },
>(people: T[]): MergeCandidate<T>[] {
  const groups = new Map<string, T[]>();
  for (const person of people) {
    const key = normalizeDisplayName(person.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(person);
    groups.set(key, group);
  }

  const candidates: MergeCandidate<T>[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const left = ordered[i];
        const right = ordered[j];
        if (!emailSetsDiffer(left, right)) continue;
        candidates.push({
          id: `${left.id}::${right.id}`,
          left,
          right,
        });
      }
    }
  }

  return candidates.sort((a, b) => {
    const byName = a.left.name.localeCompare(b.left.name);
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

export function chooseKeptPerson<T extends { id: string; createdAt: string }>(
  left: T,
  right: T,
  eventCount: (personId: string) => number
) {
  const leftCount = eventCount(left.id);
  const rightCount = eventCount(right.id);
  if (leftCount !== rightCount) return leftCount > rightCount ? left : right;

  const leftCreated = Date.parse(left.createdAt);
  const rightCreated = Date.parse(right.createdAt);
  const leftTime = Number.isNaN(leftCreated) ? Number.POSITIVE_INFINITY : leftCreated;
  const rightTime = Number.isNaN(rightCreated) ? Number.POSITIVE_INFINITY : rightCreated;
  if (leftTime !== rightTime) return leftTime < rightTime ? left : right;
  return left.id < right.id ? left : right;
}

export function assignEmails(
  kept: EmailFields,
  other: EmailFields,
  primaryChoice?: string,
  secondaryChoice?: string
) {
  const all = collectEmails(kept, other);
  const wantedPrimary = primaryChoice?.trim().toLowerCase();
  const primary =
    all.find((email) => email.toLowerCase() === wantedPrimary) ||
    collectEmails(kept)[0] ||
    all[0];
  const rest = all.filter((email) => email.toLowerCase() !== primary?.toLowerCase());
  const wantedSecondary = secondaryChoice?.trim().toLowerCase();
  const otherKeys = new Set(collectEmails(other).map((email) => email.toLowerCase()));
  const secondary =
    rest.find((email) => email.toLowerCase() === wantedSecondary) ||
    rest.find((email) => otherKeys.has(email.toLowerCase())) ||
    rest[0];
  const extras = rest.filter((email) => email.toLowerCase() !== secondary?.toLowerCase());
  return { primary, secondary, extras };
}

export function mergeNotes(kept?: string, removed?: string, extras: string[] = []) {
  const parts: string[] = [];
  const keptText = kept?.trim();
  const removedText = removed?.trim();
  if (keptText) parts.push(keptText);
  if (removedText && removedText !== keptText) parts.push(removedText);
  if (extras.length > 0) {
    const line = `Also associated with ${extras.join(", ")}.`;
    if (!parts.some((part) => part.includes(line))) parts.push(line);
  }
  return parts.length ? parts.join("\n\n") : undefined;
}

export function reassignEvents<T extends { personId: string; externalId?: string }>(
  events: T[],
  keepId: string,
  removeId: string,
  updatedAt: string
) {
  const seen = new Set(
    events
      .filter((event) => event.personId === keepId && event.externalId)
      .map((event) => event.externalId as string)
  );
  const next: T[] = [];
  for (const event of events) {
    if (event.personId !== removeId) {
      next.push(event);
      continue;
    }
    if (event.externalId && seen.has(event.externalId)) continue;
    if (event.externalId) seen.add(event.externalId);
    next.push({ ...event, personId: keepId, updatedAt });
  }
  return next;
}
