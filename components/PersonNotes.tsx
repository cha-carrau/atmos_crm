"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

interface PersonNotesProps {
  personId: string;
  notes?: string;
}

export default function PersonNotes({ personId, notes }: PersonNotesProps) {
  const { updatePerson } = useStore();
  const saved = notes || "";
  const [draft, setDraft] = useState(saved);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(false), 2000);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  const dirty = draft !== saved;

  const handleSave = () => {
    const next = draft.trim();
    updatePerson(personId, { notes: next || undefined });
    setDraft(next);
    setSavedFlash(true);
  };

  const handleCancel = () => {
    setDraft(saved);
    setSavedFlash(false);
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
        Notes
      </h2>
      <label htmlFor="person-notes" className="sr-only">
        Notes
      </label>
      <textarea
        id="person-notes"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSavedFlash(false);
        }}
        rows={4}
        className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm leading-relaxed"
        placeholder="Where you met them, what you know about them, and anything else to remember."
      />
      <div className="flex items-center justify-end gap-3 mt-3">
        {savedFlash && !dirty && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>
        )}
        {dirty && (
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Save notes
        </button>
      </div>
    </section>
  );
}
