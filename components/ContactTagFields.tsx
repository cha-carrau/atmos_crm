"use client";

import { useRef, useState } from "react";
import { ContactType } from "@/types";
import { useContactSubtags } from "@/store/useContactSubtags";
import { allContactTypes, findContactType, subtagsForContactType } from "@/utils/contactSubtags";

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

const fieldClass =
  "block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm";

const addButtonClass =
  "px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm";

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
  const [addingType, setAddingType] = useState(false);
  const [typeInput, setTypeInput] = useState("");
  const [typeError, setTypeError] = useState("");
  const typeInputRef = useRef<HTMLInputElement>(null);
  const customByType = useContactSubtags((state) => state.byType);
  const customTypes = useContactSubtags((state) => state.customTypes);
  const addCustomType = useContactSubtags((state) => state.addType);
  const addCustomSubtag = useContactSubtags((state) => state.addSubtag);
  const types = allContactTypes(customTypes);
  const typeDef = findContactType(contactType, customTypes);
  const safeTags = Array.isArray(tags) ? tags : [];
  const subtypeOptions = subtagsForContactType(contactType || undefined, customByType);

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

  const openAddType = () => {
    setAddingType(true);
    setTypeError("");
    requestAnimationFrame(() => typeInputRef.current?.focus());
  };

  const addType = () => {
    const result = addCustomType(typeInput);
    if (!result.ok) {
      setTypeError(result.error);
      return;
    }
    setTypeInput("");
    setTypeError("");
    setAddingType(false);
    setType(result.type.id);
  };

  const addSubtype = () => {
    if (!contactType) return;
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
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setType(type.id)}
              className={chipClass(contactType === type.id)}
            >
              {type.label}
            </button>
          ))}
          <button
            type="button"
            onClick={openAddType}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed transition-colors duration-200 ${
              addingType
                ? "border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50"
                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
            }`}
          >
            Add type
          </button>
        </div>
        {addingType && (
          <div className="mt-2">
            <div className="flex gap-2">
              <input
                ref={typeInputRef}
                type="text"
                value={typeInput}
                onChange={(e) => {
                  setTypeInput(e.target.value);
                  if (typeError) setTypeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addType();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAddingType(false);
                    setTypeError("");
                  }
                }}
                className={fieldClass}
                placeholder="Type name"
                aria-label="New contact type name"
              />
              <button type="button" onClick={addType} className={addButtonClass}>
                Add
              </button>
            </div>
            {typeError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{typeError}</p>}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {contactType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {typeDef?.subtagLabel || "Sub-category"}
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
                className={fieldClass}
                placeholder="Add a sub-category"
                aria-label="New sub-category name"
              />
              <button type="button" onClick={addSubtype} className={addButtonClass}>
                Add
              </button>
            </div>
            {subtypeError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{subtypeError}</p>
            )}
          </div>
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
            className={fieldClass}
            placeholder="Add a tag and press Enter"
          />
          <button type="button" onClick={addTag} className={addButtonClass}>
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
