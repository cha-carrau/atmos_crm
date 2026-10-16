import {
  CONTACT_TYPES,
  Company,
  DEFAULT_EVENT_TYPES,
  Event,
  EventTypeCategory,
  EventTypeDefinition,
  MailingList,
  Person,
} from "../types";
import { collectEmails, storedEmail, storedSecondaryEmail } from "./mergePeople";
import {
  ContactTagCatalog,
  findContactType,
  labelsMatch,
  normalizeByType,
  normalizeCustomTypes,
  subtagsForContactType,
} from "../utils/contactSubtags";

export interface AtmosoneDataFile {
  kind: "atmosone-data";
  exportedAt: string;
  people: Person[];
  companies: Company[];
  events: Event[];
  mailingLists: MailingList[];
  customEventTypes: EventTypeDefinition[];
  contactSubtags: {
    byType: ContactTagCatalog["byType"];
    customTypes: ContactTagCatalog["customTypes"];
  };
}

export interface WorkspaceData {
  people: Person[];
  companies: Company[];
  events: Event[];
  mailingLists: MailingList[];
  customEventTypes: EventTypeDefinition[];
}

export interface MergeCounts {
  added: number;
  updated: number;
}

export interface MergeSummary {
  people: MergeCounts;
  companies: MergeCounts;
  lists: MergeCounts;
  events: MergeCounts;
  contactTypesAdded: number;
  subtagsAdded: number;
  eventTypesAdded: number;
}

export interface MergeResult extends WorkspaceData {
  summary: MergeSummary;
  contactSubtags: {
    byType: NonNullable<ContactTagCatalog["byType"]>;
    customTypes: NonNullable<ContactTagCatalog["customTypes"]>;
  };
}

const EVENT_CATEGORIES: EventTypeCategory[] = ["meeting", "outbound-message", "inbound-message"];

function nameKey(value?: string) {
  const trimmed = value?.trim().replace(/\s+/g, " ").toLowerCase();
  return trimmed || undefined;
}

function blank(value?: string | null) {
  return !value || !value.trim();
}

function asString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(trimmed);
  }
  return tags;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireList(record: Record<string, unknown>, key: string) {
  if (!(key in record) || record[key] == null) return [];
  if (!Array.isArray(record[key])) {
    throw new Error(`That file's ${key} section is not a list.`);
  }
  return record[key] as unknown[];
}

function makeId(used: Set<string>, preferred?: string) {
  if (preferred && !used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  let id = "";
  do {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

function sameEmail(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function sanitizeCompany(raw: unknown): Company | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = asString(record.name);
  const id = asString(record.id);
  if (!name || !id) return null;
  const company: Company = {
    id,
    name,
    createdAt: asString(record.createdAt) || new Date().toISOString(),
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
  };
  const linkedinUrl = asString(record.linkedinUrl);
  const websiteUrl = asString(record.websiteUrl);
  const notes = asString(record.notes);
  if (linkedinUrl) company.linkedinUrl = linkedinUrl;
  if (websiteUrl) company.websiteUrl = websiteUrl;
  if (notes) company.notes = notes;
  return company;
}

function sanitizePerson(raw: unknown): Person | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name) || "";
  const email = storedEmail(asString(record.email));
  const secondaryEmail = storedSecondaryEmail(email, asString(record.secondaryEmail));
  if (!id || (!name && !email && !secondaryEmail)) return null;
  const status = record.status;
  const person: Person = {
    id,
    name,
    status: status === "parked" || status === "closed" || status === "active" ? status : "active",
    tags: asTags(record.tags),
    createdAt: asString(record.createdAt) || new Date().toISOString(),
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
  };
  if (email) person.email = email;
  if (secondaryEmail) person.secondaryEmail = secondaryEmail;
  const jobTitle = asString(record.jobTitle);
  const linkedinUrl = asString(record.linkedinUrl);
  const notes = asString(record.notes);
  const companyId = asString(record.companyId);
  const contactType = asString(record.contactType);
  const subtag = asString(record.subtag);
  const nextFollowUpDate = asString(record.nextFollowUpDate);
  if (jobTitle) person.jobTitle = jobTitle;
  if (linkedinUrl) person.linkedinUrl = linkedinUrl;
  if (notes) person.notes = notes;
  if (companyId) person.companyId = companyId;
  if (contactType) person.contactType = contactType;
  if (subtag) person.subtag = subtag;
  if (nextFollowUpDate) person.nextFollowUpDate = nextFollowUpDate;
  return person;
}

function sanitizeEvent(raw: unknown): Event | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const personId = asString(record.personId);
  const date = asString(record.date);
  const type = asString(record.type);
  if (!id || !personId || !date || !type) return null;
  const event: Event = {
    id,
    personId,
    date,
    type,
    createdAt: asString(record.createdAt) || new Date().toISOString(),
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
  };
  const time = asString(record.time);
  const notes = asString(record.notes);
  const externalId = asString(record.externalId);
  if (time) event.time = time;
  if (notes) event.notes = notes;
  if (externalId) event.externalId = externalId;
  if (typeof record.customFollowUpDays === "number" && Number.isFinite(record.customFollowUpDays)) {
    event.customFollowUpDays = record.customFollowUpDays;
  }
  return event;
}

function sanitizeList(raw: unknown): MailingList | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) return null;
  const list: MailingList = {
    id,
    name,
    subtags: asTags(record.subtags),
    tags: asTags(record.tags),
    createdAt: asString(record.createdAt) || new Date().toISOString(),
    updatedAt: asString(record.updatedAt) || new Date().toISOString(),
  };
  const contactType = asString(record.contactType);
  if (contactType) list.contactType = contactType;
  return list;
}

function sanitizeEventType(raw: unknown): EventTypeDefinition | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name);
  const category = record.category;
  if (!id || !name || typeof category !== "string" || !EVENT_CATEGORIES.includes(category as EventTypeCategory)) {
    return null;
  }
  const days =
    typeof record.defaultFollowUpDays === "number" && record.defaultFollowUpDays >= 1
      ? Math.min(365, Math.round(record.defaultFollowUpDays))
      : 7;
  return {
    id,
    name,
    category: category as EventTypeCategory,
    defaultFollowUpDays: days,
    isCustom: record.isCustom !== false,
    createdAt: asString(record.createdAt),
  };
}

function fillString(current: string | undefined, incoming: string | undefined) {
  if (!blank(current) || blank(incoming)) return { value: current, changed: false };
  return { value: incoming!.trim(), changed: true };
}

function unionTags(current: string[] | undefined, incoming: string[] | undefined) {
  const next = asTags(current);
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  let changed = false;
  for (const tag of asTags(incoming)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
    changed = true;
  }
  return { tags: next, changed };
}

function personEmailKeys(person: { email?: string; secondaryEmail?: string }) {
  return collectEmails(person).map((email) => email.toLowerCase());
}

function mergeEmailFields(existing: Person, incoming: Person) {
  let email = blank(existing.email) ? undefined : existing.email;
  let secondary = blank(existing.secondaryEmail) ? undefined : existing.secondaryEmail;
  let changed = false;

  for (const candidate of collectEmails(incoming)) {
    if (sameEmail(email, candidate) || sameEmail(secondary, candidate)) continue;
    if (!email) {
      email = candidate;
      changed = true;
      continue;
    }
    if (!secondary) {
      const next = storedSecondaryEmail(email, candidate);
      if (next) {
        secondary = next;
        changed = true;
      }
    }
  }

  return { email, secondaryEmail: secondary, changed };
}

export function mergeContactCatalog(current: ContactTagCatalog, incoming: ContactTagCatalog) {
  const customTypes = normalizeCustomTypes(current.customTypes);
  let contactTypesAdded = 0;
  for (const type of normalizeCustomTypes(incoming.customTypes)) {
    const known = [...CONTACT_TYPES, ...customTypes].some(
      (item) => item.id === type.id || labelsMatch(item.label, type.label)
    );
    if (known) continue;
    customTypes.push(type);
    contactTypesAdded += 1;
  }

  const byType = normalizeByType(current.byType);
  let subtagsAdded = 0;
  for (const [contactType, tags] of Object.entries(normalizeByType(incoming.byType))) {
    if (!findContactType(contactType, customTypes)) continue;
    const existing = subtagsForContactType(contactType, byType);
    const ids = new Set(existing.map((item) => item.id));
    const labels = new Set(existing.map((item) => item.label.toLowerCase()));
    const next = [...(byType[contactType] || [])];
    for (const tag of tags) {
      if (ids.has(tag.id) || labels.has(tag.label.toLowerCase())) continue;
      next.push(tag);
      ids.add(tag.id);
      labels.add(tag.label.toLowerCase());
      subtagsAdded += 1;
    }
    if (next.length > 0) byType[contactType] = next;
  }

  return { byType, customTypes, contactTypesAdded, subtagsAdded };
}

export function buildAtmosoneData(current: WorkspaceData, catalog: ContactTagCatalog): AtmosoneDataFile {
  return {
    kind: "atmosone-data",
    exportedAt: new Date().toISOString(),
    people: current.people,
    companies: current.companies,
    events: current.events,
    mailingLists: current.mailingLists,
    customEventTypes: current.customEventTypes,
    contactSubtags: {
      byType: normalizeByType(catalog.byType),
      customTypes: normalizeCustomTypes(catalog.customTypes),
    },
  };
}

export function parseAtmosoneData(text: string): AtmosoneDataFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const record = asRecord(parsed);
  if (!record) throw new Error("That file is not an AtmosOne data document.");
  const recognized =
    record.kind === "atmosone-data" ||
    "people" in record ||
    "companies" in record ||
    "events" in record ||
    "mailingLists" in record;
  if (!recognized) throw new Error("That file is not an AtmosOne data document.");

  const contactRaw = record.contactSubtags;
  let contactSubtags: AtmosoneDataFile["contactSubtags"] = { byType: {}, customTypes: [] };
  if (contactRaw != null) {
    const catalog = asRecord(contactRaw);
    if (!catalog) throw new Error("That file's contact types section is invalid.");
    contactSubtags = {
      byType: (catalog.byType as ContactTagCatalog["byType"]) || {},
      customTypes: (catalog.customTypes as ContactTagCatalog["customTypes"]) || [],
    };
  }

  return {
    kind: "atmosone-data",
    exportedAt: asString(record.exportedAt) || new Date().toISOString(),
    people: requireList(record, "people").map(sanitizePerson).filter((item): item is Person => Boolean(item)),
    companies: requireList(record, "companies")
      .map(sanitizeCompany)
      .filter((item): item is Company => Boolean(item)),
    events: requireList(record, "events").map(sanitizeEvent).filter((item): item is Event => Boolean(item)),
    mailingLists: requireList(record, "mailingLists")
      .map(sanitizeList)
      .filter((item): item is MailingList => Boolean(item)),
    customEventTypes: requireList(record, "customEventTypes")
      .map(sanitizeEventType)
      .filter((item): item is EventTypeDefinition => Boolean(item)),
    contactSubtags,
  };
}

export function mergeHasChanges(summary: MergeSummary) {
  return (
    summary.people.added +
      summary.people.updated +
      summary.companies.added +
      summary.companies.updated +
      summary.lists.added +
      summary.lists.updated +
      summary.events.added +
      summary.events.updated +
      summary.contactTypesAdded +
      summary.subtagsAdded +
      summary.eventTypesAdded >
    0
  );
}

export function mergeAtmosoneData(
  current: WorkspaceData,
  catalog: ContactTagCatalog,
  incomingFile: AtmosoneDataFile
): MergeResult {
  const now = new Date().toISOString();
  const companies = structuredClone(current.companies || []);
  const people = structuredClone(current.people || []);
  const events = structuredClone(current.events || []);
  const mailingLists = structuredClone(current.mailingLists || []);
  const customEventTypes = structuredClone(current.customEventTypes || []);

  const addedCompanies = new Set<string>();
  const updatedCompanies = new Set<string>();
  const companyIds = new Map<string, string>();
  const usedCompanyIds = new Set(companies.map((company) => company.id));

  for (const incoming of incomingFile.companies) {
    const match = companies.find((company) => nameKey(company.name) === nameKey(incoming.name));
    if (match) {
      companyIds.set(incoming.id, match.id);
      let changed = false;
      const next = { ...match };
      for (const field of ["linkedinUrl", "websiteUrl", "notes"] as const) {
        const filled = fillString(next[field], incoming[field]);
        if (filled.changed) {
          next[field] = filled.value;
          changed = true;
        }
      }
      if (changed) {
        next.updatedAt = now;
        const index = companies.findIndex((company) => company.id === match.id);
        companies[index] = next;
        if (!addedCompanies.has(match.id)) updatedCompanies.add(match.id);
      }
      continue;
    }

    const id = makeId(usedCompanyIds, incoming.id);
    companyIds.set(incoming.id, id);
    companies.push({ ...incoming, id });
    addedCompanies.add(id);
  }

  const typeIds = new Map<string, string>();
  const knownTypes = new Map<string, EventTypeDefinition>();
  const typesByName = new Map<string, string>();
  for (const type of DEFAULT_EVENT_TYPES) {
    knownTypes.set(type.id, type);
    const key = nameKey(type.name);
    if (key && !typesByName.has(key)) typesByName.set(key, type.id);
  }
  for (const type of customEventTypes) {
    knownTypes.set(type.id, type);
    const key = nameKey(type.name);
    if (key && !typesByName.has(key)) typesByName.set(key, type.id);
  }
  const usedTypeIds = new Set(customEventTypes.map((type) => type.id));
  let eventTypesAdded = 0;

  for (const incoming of incomingFile.customEventTypes) {
    const existing = knownTypes.get(incoming.id);
    if (existing) {
      typeIds.set(incoming.id, existing.id);
      continue;
    }
    const named = typesByName.get(nameKey(incoming.name) || "");
    if (named) {
      typeIds.set(incoming.id, named);
      continue;
    }
    const id = makeId(usedTypeIds, incoming.id);
    const created: EventTypeDefinition = { ...incoming, id, isCustom: true };
    customEventTypes.push(created);
    knownTypes.set(id, created);
    const key = nameKey(created.name);
    if (key) typesByName.set(key, id);
    typeIds.set(incoming.id, id);
    eventTypesAdded += 1;
  }

  const addedPeople = new Set<string>();
  const updatedPeople = new Set<string>();
  const personIds = new Map<string, string>();
  const usedPersonIds = new Set(people.map((person) => person.id));
  const emailIndex = new Map<string, string>();
  for (const person of people) {
    for (const key of personEmailKeys(person)) {
      if (!emailIndex.has(key)) emailIndex.set(key, person.id);
    }
  }
  const originalNames = new Map<string, string[]>();
  for (const person of current.people || []) {
    const key = nameKey(person.name);
    if (!key) continue;
    const ids = originalNames.get(key) || [];
    ids.push(person.id);
    originalNames.set(key, ids);
  }

  for (const incoming of incomingFile.people) {
    let match: Person | undefined;
    const incomingName = nameKey(incoming.name);
    if (personEmailKeys(incoming).length > 0) {
      for (const key of personEmailKeys(incoming)) {
        const id = emailIndex.get(key);
        match = id ? people.find((person) => person.id === id) : undefined;
        if (match) break;
      }
    } else if (incomingName) {
      const ids = originalNames.get(incomingName);
      if (ids && ids.length === 1) {
        match = people.find((person) => person.id === ids[0]);
      } else {
        match = people.find((person) => person.id === incoming.id && nameKey(person.name) === incomingName);
      }
    }

    if (match) {
      personIds.set(incoming.id, match.id);
      const emails = mergeEmailFields(match, incoming);
      let changed = emails.changed;
      const next: Person = {
        ...match,
        email: emails.email,
        secondaryEmail: emails.secondaryEmail,
        tags: match.tags ? [...match.tags] : [],
      };
      if (!emails.email) delete next.email;
      if (!emails.secondaryEmail) delete next.secondaryEmail;

      const filledName = fillString(next.name, incoming.name);
      if (filledName.changed && filledName.value) {
        next.name = filledName.value;
        changed = true;
      }
      for (const field of ["jobTitle", "linkedinUrl", "notes", "nextFollowUpDate"] as const) {
        const filled = fillString(next[field], incoming[field]);
        if (filled.changed && filled.value) {
          next[field] = filled.value;
          changed = true;
        }
      }

      if (blank(next.companyId) && incoming.companyId) {
        const mapped = companyIds.get(incoming.companyId);
        if (mapped) {
          next.companyId = mapped;
          changed = true;
        }
      }

      if (blank(next.contactType) && !blank(incoming.contactType)) {
        next.contactType = incoming.contactType!.trim();
        changed = true;
        if (blank(next.subtag) && !blank(incoming.subtag)) next.subtag = incoming.subtag!.trim();
      } else if (
        !blank(next.contactType) &&
        blank(next.subtag) &&
        !blank(incoming.subtag) &&
        (blank(incoming.contactType) || incoming.contactType!.trim() === next.contactType)
      ) {
        next.subtag = incoming.subtag!.trim();
        changed = true;
      }

      const tags = unionTags(next.tags, incoming.tags);
      if (tags.changed) {
        next.tags = tags.tags;
        changed = true;
      }

      if (changed) {
        next.updatedAt = now;
        const index = people.findIndex((person) => person.id === match.id);
        people[index] = next;
        for (const key of personEmailKeys(next)) {
          if (!emailIndex.has(key)) emailIndex.set(key, next.id);
        }
        if (!addedPeople.has(match.id)) updatedPeople.add(match.id);
      }
      continue;
    }

    const id = makeId(usedPersonIds, incoming.id);
    personIds.set(incoming.id, id);
    const emails = collectEmails(incoming);
    const companyId = incoming.companyId ? companyIds.get(incoming.companyId) : undefined;
    const created: Person = {
      ...incoming,
      id,
      name: incoming.name || emails[0] || "Unknown",
      tags: asTags(incoming.tags),
      email: emails[0],
      secondaryEmail: emails[1],
      companyId,
    };
    if (!created.email) delete created.email;
    if (!created.secondaryEmail) delete created.secondaryEmail;
    if (!created.companyId) delete created.companyId;
    people.push(created);
    addedPeople.add(id);
    for (const key of personEmailKeys(created)) {
      if (!emailIndex.has(key)) emailIndex.set(key, id);
    }
  }

  const addedLists = new Set<string>();
  const updatedLists = new Set<string>();
  const usedListIds = new Set(mailingLists.map((list) => list.id));

  for (const incoming of incomingFile.mailingLists) {
    const match = mailingLists.find((list) => nameKey(list.name) === nameKey(incoming.name));
    if (match) {
      let changed = false;
      const next = { ...match, subtags: [...match.subtags], tags: [...match.tags] };
      if (blank(next.contactType) && !blank(incoming.contactType)) {
        next.contactType = incoming.contactType;
        changed = true;
      }
      const subtags = unionTags(next.subtags, incoming.subtags);
      const tags = unionTags(next.tags, incoming.tags);
      if (subtags.changed) {
        next.subtags = subtags.tags;
        changed = true;
      }
      if (tags.changed) {
        next.tags = tags.tags;
        changed = true;
      }
      if (changed) {
        next.updatedAt = now;
        const index = mailingLists.findIndex((list) => list.id === match.id);
        mailingLists[index] = next;
        if (!addedLists.has(match.id)) updatedLists.add(match.id);
      }
      continue;
    }

    const id = makeId(usedListIds, incoming.id);
    mailingLists.push({ ...incoming, id });
    addedLists.add(id);
  }

  const addedEvents = new Set<string>();
  const eventIds = new Set(events.map((event) => event.id));
  const externalIds = new Set(
    events.map((event) => event.externalId).filter((id): id is string => Boolean(id))
  );

  for (const incoming of incomingFile.events) {
    if (eventIds.has(incoming.id)) continue;
    if (incoming.externalId && externalIds.has(incoming.externalId)) continue;
    const personId = personIds.get(incoming.personId);
    if (!personId || !people.some((person) => person.id === personId)) continue;
    const id = makeId(eventIds, incoming.id);
    const event: Event = {
      ...incoming,
      id,
      personId,
      type: typeIds.get(incoming.type) || incoming.type,
    };
    events.push(event);
    addedEvents.add(id);
    if (event.externalId) externalIds.add(event.externalId);
  }

  const contactSubtags = mergeContactCatalog(catalog, incomingFile.contactSubtags || {});

  return {
    people,
    companies,
    events,
    mailingLists,
    customEventTypes,
    contactSubtags: {
      byType: contactSubtags.byType,
      customTypes: contactSubtags.customTypes,
    },
    summary: {
      people: { added: addedPeople.size, updated: updatedPeople.size },
      companies: { added: addedCompanies.size, updated: updatedCompanies.size },
      lists: { added: addedLists.size, updated: updatedLists.size },
      events: { added: addedEvents.size, updated: 0 },
      contactTypesAdded: contactSubtags.contactTypesAdded,
      subtagsAdded: contactSubtags.subtagsAdded,
      eventTypesAdded,
    },
  };
}
