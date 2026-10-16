"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { collectEmails } from "@/lib/mergePeople";
import { Person } from "@/types";

interface AddPeopleToCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
}

function personMatches(person: Person, query: string, companyName?: string) {
  if (!query) return true;
  const emails = collectEmails(person).join(" ");
  return (
    person.name.toLowerCase().includes(query) ||
    emails.toLowerCase().includes(query) ||
    (companyName || "").toLowerCase().includes(query)
  );
}

export default function AddPeopleToCompanyModal({
  isOpen,
  onClose,
  companyId,
  companyName,
}: AddPeopleToCompanyModalProps) {
  const { people, companies, updatePerson } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelected(new Set());
  }, [isOpen]);

  const companyNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const company of companies) names.set(company.id, company.name);
    return names;
  }, [companies]);

  const normalizedQuery = query.trim().toLowerCase();

  const { available, alreadyHere } = useMemo(() => {
    const sortByName = (list: Person[]) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name));

    const availablePeople: Person[] = [];
    const alreadyHerePeople: Person[] = [];

    for (const person of people) {
      const currentCompany = person.companyId
        ? companyNameById.get(person.companyId)
        : undefined;
      if (!personMatches(person, normalizedQuery, currentCompany)) continue;
      if (person.companyId === companyId) alreadyHerePeople.push(person);
      else availablePeople.push(person);
    }

    return {
      available: sortByName(availablePeople),
      alreadyHere: sortByName(alreadyHerePeople),
    };
  }, [people, companyId, companyNameById, normalizedQuery]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    for (const id of selected) {
      updatePerson(id, { companyId });
    }
    onClose();
  };

  const detailLine = (person: Person) => {
    const emails = collectEmails(person);
    const emailLabel = emails.length > 0 ? emails.join(", ") : "No email";
    const currentCompany = person.companyId
      ? companyNameById.get(person.companyId)
      : undefined;
    return currentCompany ? `${emailLabel} · ${currentCompany}` : emailLabel;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Add people
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">
          Choose existing profiles from People. This links them to {companyName} and does not create a new person.
        </p>

        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or company..."
          className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-white transition-colors duration-200 text-sm mb-3"
        />

        <div className="flex-1 overflow-y-auto min-h-0 border border-gray-200 dark:border-gray-800 rounded-lg">
          {people.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
              No people yet. Add profiles on the People tab first.
            </p>
          ) : available.length === 0 && alreadyHere.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
              No people match that search.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {available.map((person) => (
                <li key={person.id}>
                  <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <input
                      type="checkbox"
                      checked={selected.has(person.id)}
                      onChange={() => toggle(person.id)}
                      className="mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {person.name}
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                        {detailLine(person)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {alreadyHere.length > 0 && (
                <li className="px-4 py-2 bg-gray-50 dark:bg-gray-800/40">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Already at {companyName}
                  </p>
                </li>
              )}
              {alreadyHere.map((person) => (
                <li key={person.id}>
                  <label className="flex items-start gap-3 px-4 py-3 cursor-not-allowed opacity-70">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="mt-1 rounded border-gray-300 text-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {person.name}
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                        {detailLine(person)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {selected.size === 0
              ? "Add people"
              : `Add ${selected.size} ${selected.size === 1 ? "person" : "people"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
