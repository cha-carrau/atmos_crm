import {
  ContactSubtag,
  getContactTypeDefinition,
  getSubtagLabel,
} from "@/types";

export const CUSTOMIZABLE_CONTACT_TYPES = ["partner", "hire"] as const;

export type CustomizableContactType = (typeof CUSTOMIZABLE_CONTACT_TYPES)[number];

export type CustomSubtagsByType = Record<CustomizableContactType, ContactSubtag[]>;

export const EMPTY_CUSTOM_SUBTAGS: CustomSubtagsByType = {
  partner: [],
  hire: [],
};

export function isCustomizableContactType(
  contactType?: string
): contactType is CustomizableContactType {
  return contactType === "partner" || contactType === "hire";
}

export function slugifySubtagLabel(label: string): string {
  return label
    .trim()
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

export function customSubtagsFor(
  contactType: CustomizableContactType,
  customByType?: Partial<CustomSubtagsByType> | null
): ContactSubtag[] {
  const list = customByType?.[contactType];
  if (!Array.isArray(list)) return [];
  return list.filter(isStoredSubtag);
}

export function subtagsForContactType(
  contactType: string | undefined,
  customByType?: Partial<CustomSubtagsByType> | null
): ContactSubtag[] {
  if (!contactType) return [];
  if (isCustomizableContactType(contactType)) {
    return customSubtagsFor(contactType, customByType);
  }
  return getContactTypeDefinition(contactType)?.subtags ?? [];
}

export function labelForSubtag(
  contactType: string | undefined,
  subtag: string | undefined,
  customByType?: Partial<CustomSubtagsByType> | null
): string | undefined {
  if (!contactType || !subtag) return undefined;
  const fixed = getSubtagLabel(contactType, subtag);
  if (fixed) return fixed;
  if (!isCustomizableContactType(contactType)) return undefined;
  return customSubtagsFor(contactType, customByType).find((item) => item.id === subtag)?.label;
}
