import {
  CONTACT_TYPES,
  ContactSubtag,
  ContactTypeDefinition,
} from "@/types";

export type SubtagsByType = Record<string, ContactSubtag[]>;

export interface ContactTagCatalog {
  byType?: Partial<SubtagsByType> | null;
  customTypes?: ContactTypeDefinition[] | null;
}

const BUILTIN_IDS = new Set(CONTACT_TYPES.map((type) => type.id));

export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function labelsMatch(a: string, b: string): boolean {
  return normalizeLabel(a).toLowerCase() === normalizeLabel(b).toLowerCase();
}

export function slugifySubtagLabel(label: string): string {
  return normalizeLabel(label)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function uniqueSubtagId(label: string, existing: ContactSubtag[]): string | null {
  const base = slugifySubtagLabel(label);
  if (!base) return null;
  if (!existing.some((item) => item.id === base)) return base;
  let suffix = 2;
  while (existing.some((item) => item.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function isStoredSubtag(value: unknown): value is ContactSubtag {
  if (!value || typeof value !== "object") return false;
  const item = value as ContactSubtag;
  return typeof item.id === "string" && item.id.length > 0 && typeof item.label === "string" && item.label.length > 0;
}

export function normalizeByType(byType?: Partial<SubtagsByType> | null): SubtagsByType {
  if (!byType || typeof byType !== "object") return {};
  const result: SubtagsByType = {};
  for (const [key, list] of Object.entries(byType)) {
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (!Array.isArray(list)) continue;
    const tags = list.filter(isStoredSubtag);
    if (tags.length > 0) result[key] = tags;
  }
  return result;
}

export function normalizeCustomTypes(value: unknown): ContactTypeDefinition[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>(BUILTIN_IDS);
  const seenLabels = new Set(CONTACT_TYPES.map((type) => type.label.toLowerCase()));
  const result: ContactTypeDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as ContactTypeDefinition;
    const id = typeof record.id === "string" ? record.id : "";
    const label = typeof record.label === "string" ? normalizeLabel(record.label) : "";
    if (!id || !label || seenIds.has(id) || seenLabels.has(label.toLowerCase())) continue;
    seenIds.add(id);
    seenLabels.add(label.toLowerCase());
    result.push({
      id,
      label,
      subtagLabel:
        typeof record.subtagLabel === "string" && record.subtagLabel.trim()
          ? record.subtagLabel
          : `${label} type`,
      subtags: [],
    });
  }
  return result;
}

export function allContactTypes(customTypes?: ContactTypeDefinition[] | null): ContactTypeDefinition[] {
  return [...CONTACT_TYPES, ...normalizeCustomTypes(customTypes)];
}

export function findContactType(id?: string, customTypes?: ContactTypeDefinition[] | null) {
  if (!id) return undefined;
  return allContactTypes(customTypes).find((type) => type.id === id);
}

export function subtagsForContactType(
  contactType: string | undefined,
  byType?: Partial<SubtagsByType> | null
): ContactSubtag[] {
  if (!contactType) return [];
  const fixed = CONTACT_TYPES.find((type) => type.id === contactType)?.subtags ?? [];
  const custom = normalizeByType(byType)[contactType] ?? [];
  const seen = new Set(fixed.map((item) => item.id));
  return [...fixed, ...custom.filter((item) => !seen.has(item.id))];
}

export function labelForSubtag(
  contactType: string | undefined,
  subtag: string | undefined,
  byType?: Partial<SubtagsByType> | null
): string | undefined {
  if (!contactType || !subtag) return undefined;
  return subtagsForContactType(contactType, byType).find((item) => item.id === subtag)?.label;
}

export type NamedResult =
  | { ok: true; id: string; label: string }
  | { ok: false; error: string };

export function validateTypeName(
  rawLabel: string,
  customTypes?: ContactTypeDefinition[] | null
): NamedResult {
  const label = normalizeLabel(rawLabel || "");
  if (!label) return { ok: false, error: "Enter a type name." };
  const existing = allContactTypes(customTypes);
  if (existing.some((type) => labelsMatch(type.label, label))) {
    return { ok: false, error: "That type already exists." };
  }
  const id = uniqueSubtagId(
    label,
    existing.map((type) => ({ id: type.id, label: type.label }))
  );
  if (!id) return { ok: false, error: "Use letters or numbers in the type name." };
  return { ok: true, id, label };
}

export function validateSubtagName(
  rawLabel: string,
  contactType: string | undefined,
  byType?: Partial<SubtagsByType> | null,
  customTypes?: ContactTypeDefinition[] | null
): NamedResult {
  const label = normalizeLabel(rawLabel || "");
  if (!label) return { ok: false, error: "Enter a sub-category name." };
  if (!contactType || !findContactType(contactType, customTypes)) {
    return { ok: false, error: "Choose a contact type first." };
  }
  const existing = subtagsForContactType(contactType, byType);
  if (existing.some((item) => labelsMatch(item.label, label))) {
    return { ok: false, error: "That sub-category already exists." };
  }
  const id = uniqueSubtagId(label, existing);
  if (!id) return { ok: false, error: "Use letters or numbers in the sub-category name." };
  return { ok: true, id, label };
}
