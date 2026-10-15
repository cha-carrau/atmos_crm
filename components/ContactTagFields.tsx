"use client";

import { useState } from "react";
import { CONTACT_TYPES, ContactType, getContactTypeDefinition } from "@/types";
import { useContactSubtags } from "@/store/useContactSubtags";
import { isCustomizableContactType, subtagsForContactType } from "@/utils/contactSubtags";

interface ContactTagFieldsProps {
  contactType: ContactType | "";
  subtag: string;
  tags: string[];
  onChange: (next: { contactType: ContactType | ""; subtag: string; tags: string[] }) => void;
  error?: string;
}

const chipClass = (selected: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-200 ${
    selected
      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
  }`;

export default function ContactTagFields({
  contactType,
  subtag,
  tags,
  onChange,
  error,
}: ContactTagFieldsProps) {
  const [tagInput, setTagInput] = useState("");
  const [subtypeInput, setSubtypeInput] = useState("");
  const [subtypeError, setSubtypeError] = useState("");
  const customByType = useContactSubtags((state) => state.byType);
  const addCustomSubtag = useContactSubtags((state) => state.addSubtag);
  const typeDef = getContactTypeDefinition(contactType);
  const safeTags = Array.isArray(tags) ? tags : [];
  const subtypeOptions = subtagsForContactType(contactType || undefined, customByType);
  const canAddSubtype = isCustomizableContactType(contactType);

  const setType = (next: ContactType) => {
    const subtagStillValid = subtagsForContactType(next, customByType).some((item) => item.id === subtag);
    setSubtypeInput("");
    setSubtypeError("");
    onChange({
      contactType: next,
      subtag: subtagStillValid ? subtag : "",
      tags: safeTags,
    });
  };

  const addSubtype = () => {
    if (!canAddSubtype) return;
    const result = addCustomSubtag(contactType, subtypeInput);
    if (!result.ok) {
      setSubtypeError(result.error);
      return;
    }
    setSubtypeInput("");
    setSubtypeError("");
    onChange({ contactType, subtag: result.subtag.id, tags: safeTags });
  };

  const addTag = () => {
    const value = tagInput.trim().replace(/[|,]/g, "");
    if (!value) return;
    if (safeTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagInput("");
      return;
    }
    onChange({ contactType, subtag, tags: [...safeTags, value] });
    setTagInput("");
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Contact type *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CONTACT_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setType(type.id)}
              className={chipClass(contactType === type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {(subtypeOptions.length > 0 || canAddSubtype) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {typeDef?.subtagLabel || "Subtype"}
          </label>
          {subtypeOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subtypeOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      contactType,
                      subtag: subtag === item.id ? "" : item.id,
                      tags: safeTags,
                    })
                  }
                  className={chipClass(subtag === item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {canAddSubtype && (
            <div className={subtypeOptions.length > 0 ? "mt-2" : ""}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={subtypeInput}
                  onChange={(e) => {
                    setSubtypeInput(e.target.value);
                    if (subtypeError) setSubtypeError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubtype();
                    }
                  }}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm"
                  placeholder="Add a subtype"
                />
                <button
                  type="button"
                  onClick={addSubtype}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
                >
                  Add
                </button>
              </div>
              {subtypeError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{subtypeError}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Additional tags
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm"
            placeholder="Add a tag and press Enter"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
          >
            Add
          </button>
        </div>
        {safeTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {safeTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      contactType,
                      subtag,
                      tags: safeTags.filter((item) => item !== tag),
                    })
                  }
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
