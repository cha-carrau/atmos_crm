"use client";

import { useEffect, useMemo, useState } from "react";
import { CONTACT_TYPES, ContactType, MailingList, getContactTypeDefinition } from "@/types";
import { useStore } from "@/store/useStore";
import { useContactSubtags } from "@/store/useContactSubtags";
import { subtagsForContactType } from "@/utils/contactSubtags";
import { peopleForList } from "@/utils/mailingLists";

interface MailingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  list?: MailingList;
}

export default function MailingListModal({ isOpen, onClose, list }: MailingListModalProps) {
  const { people, addMailingList, updateMailingList } = useStore();
  const safePeople = Array.isArray(people) ? people : [];
  const customByType = useContactSubtags((state) => state.byType);
  const [name, setName] = useState(list?.name || "");
  const [contactType, setContactType] = useState<ContactType | "">(list?.contactType || "");
  const [subtags, setSubtags] = useState<string[]>(list?.subtags || []);
  const [tags, setTags] = useState<string[]>(list?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(list?.name || "");
    setContactType(list?.contactType || "");
    setSubtags(Array.isArray(list?.subtags) ? list.subtags : []);
    setTags(Array.isArray(list?.tags) ? list.tags : []);
    setTagInput("");
    setError("");
  }, [isOpen, list]);

  const typeDef = getContactTypeDefinition(contactType);
  const subtypeOptions = subtagsForContactType(contactType || undefined, customByType);
  const knownTags = useMemo(() => {
    const values = new Set<string>();
    safePeople.forEach((person) => (person?.tags || []).forEach((tag) => values.add(tag)));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [safePeople]);

  const matchCount = peopleForList(safePeople, {
    contactType: contactType || undefined,
    subtags,
    tags,
  }).length;

  if (!isOpen) return null;

  const toggleSubtag = (id: string) => {
    setSubtags((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const addTag = (value: string) => {
    const next = value.trim().replace(/[|,]/g, "");
    if (!next) return;
    if (!tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setTags((current) => [...current, next]);
    }
    setTagInput("");
  };

  const handleType = (next: ContactType | "") => {
    setContactType(next);
    const allowed = new Set(subtagsForContactType(next || undefined, customByType).map((item) => item.id));
    setSubtags((current) => current.filter((id) => allowed.has(id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name this list.");
      return;
    }
    if (!contactType && subtags.length === 0 && tags.length === 0) {
      setError("Choose a contact type or at least one tag.");
      return;
    }

    const payload = {
      name: name.trim(),
      contactType: contactType || undefined,
      subtags,
      tags,
    };

    if (list) {
      updateMailingList(list.id, payload);
    } else {
      addMailingList(payload);
    }
    onClose();
  };

  const chipClass = (selected: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-200 ${
      selected
        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {list ? "Edit mailing list" : "New mailing list"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          People join this list automatically when their tags match.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm"
              placeholder="Seed investors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact type
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleType("")} className={chipClass(contactType === "")}>
                Any
              </button>
              {CONTACT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleType(type.id)}
                  className={chipClass(contactType === type.id)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {typeDef && subtypeOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {typeDef.subtagLabel}
              </label>
              <div className="flex flex-wrap gap-2">
                {subtypeOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSubtag(item.id)}
                    className={chipClass(subtags.includes(item.id))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Leave unselected to include every {typeDef.label.toLowerCase()}.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional tags
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              A person must have every tag you add here.
            </p>
            {knownTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {knownTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setTags((current) =>
                        current.some((item) => item.toLowerCase() === tag.toLowerCase())
                          ? current.filter((item) => item.toLowerCase() !== tag.toLowerCase())
                          : [...current, tag]
                      )
                    }
                    className={chipClass(tags.some((item) => item.toLowerCase() === tag.toLowerCase()))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {matchCount} {matchCount === 1 ? "person matches" : "people match"} right now.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
            >
              {list ? "Save list" : "Create list"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
