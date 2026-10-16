import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ContactSubtag, ContactTypeDefinition } from "@/types";
import {
  ContactTagCatalog,
  SubtagsByType,
  normalizeByType,
  normalizeCustomTypes,
  validateSubtagName,
  validateTypeName,
} from "@/utils/contactSubtags";

export type AddSubtagResult =
  | { ok: true; subtag: ContactSubtag }
  | { ok: false; error: string };

export type AddTypeResult =
  | { ok: true; type: ContactTypeDefinition }
  | { ok: false; error: string };

interface ContactSubtagsState {
  byType: SubtagsByType;
  customTypes: ContactTypeDefinition[];
  addType: (label: string) => AddTypeResult;
  addSubtag: (contactType: string, label: string) => AddSubtagResult;
  removeSubtag: (contactType: string, id: string) => void;
  applyCatalog: (catalog: ContactTagCatalog) => void;
}

export const useContactSubtags = create<ContactSubtagsState>()(
  persist(
    (set, get) => ({
      byType: {},
      customTypes: [],

      addType: (rawLabel) => {
        const result = validateTypeName(rawLabel, get().customTypes);
        if (!result.ok) return result;
        const type: ContactTypeDefinition = {
          id: result.id,
          label: result.label,
          subtagLabel: `${result.label} type`,
          subtags: [],
        };
        set((state) => ({
          customTypes: [...normalizeCustomTypes(state.customTypes), type],
        }));
        return { ok: true, type };
      },

      addSubtag: (contactType, rawLabel) => {
        const result = validateSubtagName(rawLabel, contactType, get().byType, get().customTypes);
        if (!result.ok) return result;
        const subtag = { id: result.id, label: result.label };
        set((state) => {
          const current = normalizeByType(state.byType);
          const list = current[contactType] || [];
          return {
            byType: {
              ...current,
              [contactType]: [...list, subtag],
            },
          };
        });
        return { ok: true, subtag };
      },

      removeSubtag: (contactType, id) =>
        set((state) => {
          const current = normalizeByType(state.byType);
          const list = current[contactType] || [];
          const next = list.filter((item) => item.id !== id);
          const byType = { ...current };
          if (next.length > 0) byType[contactType] = next;
          else delete byType[contactType];
          return { byType };
        }),

      applyCatalog: (catalog) =>
        set({
          byType: normalizeByType(catalog.byType),
          customTypes: normalizeCustomTypes(catalog.customTypes),
        }),
    }),
    {
      name: "tempo-contact-subtags",
      merge: (persisted, current) => {
        const saved = persisted as Partial<ContactSubtagsState> | undefined;
        return {
          ...current,
          byType: normalizeByType(saved?.byType),
          customTypes: normalizeCustomTypes(saved?.customTypes),
        };
      },
    }
  )
);
