import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ContactSubtag } from "@/types";
import {
  CustomizableContactType,
  CustomSubtagsByType,
  EMPTY_CUSTOM_SUBTAGS,
  customSubtagsFor,
  uniqueSubtagId,
} from "@/utils/contactSubtags";

export type AddSubtagResult =
  | { ok: true; subtag: ContactSubtag }
  | { ok: false; error: string };

interface ContactSubtagsState {
  byType: CustomSubtagsByType;
  addSubtag: (contactType: CustomizableContactType, label: string) => AddSubtagResult;
  removeSubtag: (contactType: CustomizableContactType, id: string) => void;
}

function normalizeByType(byType?: Partial<CustomSubtagsByType> | null): CustomSubtagsByType {
  return {
    partner: customSubtagsFor("partner", byType),
    hire: customSubtagsFor("hire", byType),
  };
}

export const useContactSubtags = create<ContactSubtagsState>()(
  persist(
    (set, get) => ({
      byType: EMPTY_CUSTOM_SUBTAGS,

      addSubtag: (contactType, rawLabel) => {
        const label = (rawLabel || "").trim();
        if (!label) return { ok: false, error: "Enter a subtype name." };
        if (!contactType) return { ok: false, error: "Choose Partner or Hire first." };

        const existing = customSubtagsFor(contactType, get().byType);
        if (existing.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
          return { ok: false, error: "That subtype already exists." };
        }

        const id = uniqueSubtagId(label, existing);
        if (!id) {
          return { ok: false, error: "Use letters or numbers in the subtype name." };
        }

        const subtag = { id, label };
        set((state) => {
          const current = normalizeByType(state.byType);
          return {
            byType: {
              ...current,
              [contactType]: [...current[contactType], subtag],
            },
          };
        });
        return { ok: true, subtag };
      },

      removeSubtag: (contactType, id) =>
        set((state) => {
          const current = normalizeByType(state.byType);
          return {
            byType: {
              ...current,
              [contactType]: current[contactType].filter((item) => item.id !== id),
            },
          };
        }),
    }),
    {
      name: "tempo-contact-subtags",
      merge: (persisted, current) => ({
        ...current,
        byType: normalizeByType((persisted as Partial<ContactSubtagsState> | undefined)?.byType),
      }),
    }
  )
);
