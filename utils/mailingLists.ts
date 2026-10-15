import { ContactType, MailingList, Person, getContactTypeDefinition } from "@/types";
import { CustomSubtagsByType, EMPTY_CUSTOM_SUBTAGS, labelForSubtag } from "@/utils/contactSubtags";

export interface ListFilter {
  contactType?: ContactType;
  subtags: string[];
  tags: string[];
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function personMatchesList(person: Person, list: Partial<ListFilter> | null | undefined) {
  if (!person || !list) return false;
  const subtags = asStringList(list.subtags);
  const tags = asStringList(list.tags);
  const hasFilter = Boolean(list.contactType || subtags.length > 0 || tags.length > 0);
  if (!hasFilter) return false;

  if (list.contactType && person.contactType !== list.contactType) return false;

  if (subtags.length > 0 && (!person.subtag || !subtags.includes(person.subtag))) {
    return false;
  }

  if (tags.length > 0) {
    const owned = new Set((person.tags || []).map((tag) => tag.toLowerCase()));
    if (!tags.every((tag) => owned.has(tag.toLowerCase()))) return false;
  }

  return true;
}

export function peopleForList(people: Person[] | null | undefined, list: Partial<ListFilter> | null | undefined) {
  if (!Array.isArray(people)) return [];
  return people
    .filter((person) => person && personMatchesList(person, list))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function describeList(
  list: Partial<Pick<MailingList, "contactType" | "subtags" | "tags">> | null | undefined,
  customByType: CustomSubtagsByType = EMPTY_CUSTOM_SUBTAGS
) {
  if (!list) return "No filters";
  const subtags = asStringList(list.subtags);
  const tags = asStringList(list.tags);
  const parts: string[] = [];
  if (list.contactType) {
    parts.push(getContactTypeDefinition(list.contactType)?.label || list.contactType);
  }
  if (subtags.length > 0) {
    parts.push(
      subtags
        .map((subtag) => labelForSubtag(list.contactType, subtag, customByType) || subtag)
        .join(", ")
    );
  }
  if (tags.length > 0) parts.push(tags.map((tag) => `#${tag}`).join(" "));
  return parts.join(" · ") || "No filters";
}
