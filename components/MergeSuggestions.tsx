"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventTypeCategory, Person } from "@/types";
import { useStore } from "@/store/useStore";
import { isMessageCategory } from "@/components/MessageList";
import {
  assignEmails,
  chooseKeptPerson,
  collectEmails,
  findMergeCandidates,
  MergeCandidate,
} from "@/lib/mergePeople";

const inputClass = "rounded border-gray-300 text-emerald-600 focus:ring-emerald-500";

export function useMergeCandidateCount() {
  const people = useStore((state) => state.people);
  return useMemo(() => findMergeCandidates(people).length, [people]);
}

export function MergeSuggestionsButton({
  onClick,
  count,
}: {
  onClick: () => void;
  count: number;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 rounded-lg font-medium transition-colors duration-200 text-sm"
    >
      Merge suggestions
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-xs">
        {count}
      </span>
    </button>
  );
}

function activityLabel(
  personId: string,
  events: { personId: string; type: string }[],
  categoryFor: (typeId: string) => EventTypeCategory | undefined
) {
  let messages = 0;
  let other = 0;
  for (const event of events) {
    if (event.personId !== personId) continue;
    if (isMessageCategory(categoryFor(event.type))) messages += 1;
    else other += 1;
  }
  return `${messages} ${messages === 1 ? "message" : "messages"} · ${other} ${
    other === 1 ? "event" : "events"
  }`;
}

function EmailLines({ person }: { person: Person }) {
  const emails = collectEmails(person);
  if (emails.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No email</p>;
  }
  return (
    <div className="space-y-0.5">
      {emails.map((email) => {
        const isPrimary = person.email?.trim().toLowerCase() === email.toLowerCase();
        return (
          <p key={email} className="text-sm text-gray-600 dark:text-gray-300">
            {email}
            <span className="text-gray-400 dark:text-gray-500">
              {" "}
              · {isPrimary ? "primary" : "secondary"}
            </span>
          </p>
        );
      })}
    </div>
  );
}

function ContactColumn({
  person,
  role,
  activity,
}: {
  person: Person;
  role: string;
  activity: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
        {role}
      </p>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{person.name}</p>
      <div className="mt-2">
        <EmailLines person={person} />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{activity}</p>
    </div>
  );
}

export default function MergeSuggestionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const people = useStore((state) => state.people);
  const events = useStore((state) => state.events);
  const mergePeople = useStore((state) => state.mergePeople);
  const getEventTypeById = useStore((state) => state.getEventTypeById);
  const candidates = useMemo(() => findMergeCandidates(people), [people]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [primaryChoice, setPrimaryChoice] = useState<string | undefined>();
  const [secondaryChoice, setSecondaryChoice] = useState<string | undefined>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setPrimaryChoice(undefined);
      setSecondaryChoice(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (open && candidates.length === 0) onCloseRef.current();
  }, [open, candidates.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || candidates.length === 0) return null;

  const selected = candidates.find((candidate) => candidate.id === selectedId) || null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-suggestions-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {selected ? (
          <ReviewMerge
            candidate={selected}
            events={events}
            categoryFor={(typeId) => getEventTypeById(typeId)?.category}
            primaryChoice={primaryChoice}
            secondaryChoice={secondaryChoice}
            onPrimary={(email) => {
              setPrimaryChoice(email);
              setSecondaryChoice((current) =>
                current?.toLowerCase() === email.toLowerCase() ? undefined : current
              );
            }}
            onSecondary={setSecondaryChoice}
            onBack={() => {
              setSelectedId(null);
              setPrimaryChoice(undefined);
              setSecondaryChoice(undefined);
            }}
            onConfirm={(keepId, removeId, primary, secondary) => {
              mergePeople(keepId, removeId, primary, secondary);
              setSelectedId(null);
              setPrimaryChoice(undefined);
              setSecondaryChoice(undefined);
            }}
          />
        ) : (
          <SuggestionList
            candidates={candidates}
            events={events}
            categoryFor={(typeId) => getEventTypeById(typeId)?.category}
            onReview={(id) => {
              setSelectedId(id);
              setPrimaryChoice(undefined);
              setSecondaryChoice(undefined);
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function SuggestionList({
  candidates,
  events,
  categoryFor,
  onReview,
  onClose,
}: {
  candidates: MergeCandidate<Person>[];
  events: { personId: string; type: string }[];
  categoryFor: (typeId: string) => EventTypeCategory | undefined;
  onReview: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <h2 id="merge-suggestions-title" className="text-lg font-medium text-gray-900 dark:text-white">
        Merge suggestions
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
        These contacts share a name and use different email addresses. Nothing is combined until you confirm.
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {candidate.left.name.trim()}
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ContactColumn
                    person={candidate.left}
                    role="Contact"
                    activity={activityLabel(candidate.left.id, events, categoryFor)}
                  />
                  <ContactColumn
                    person={candidate.right}
                    role="Contact"
                    activity={activityLabel(candidate.right.id, events, categoryFor)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onReview(candidate.id)}
                className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
              >
                Review
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
        >
          Not now
        </button>
      </div>
    </>
  );
}

function ReviewMerge({
  candidate,
  events,
  categoryFor,
  primaryChoice,
  secondaryChoice,
  onPrimary,
  onSecondary,
  onBack,
  onConfirm,
}: {
  candidate: MergeCandidate<Person>;
  events: { personId: string; type: string }[];
  categoryFor: (typeId: string) => EventTypeCategory | undefined;
  primaryChoice?: string;
  secondaryChoice?: string;
  onPrimary: (email: string) => void;
  onSecondary: (email: string) => void;
  onBack: () => void;
  onConfirm: (keepId: string, removeId: string, primary?: string, secondary?: string) => void;
}) {
  const eventCount = (personId: string) => events.filter((event) => event.personId === personId).length;
  const kept = chooseKeptPerson(candidate.left, candidate.right, eventCount);
  const other = kept.id === candidate.left.id ? candidate.right : candidate.left;
  const assignment = assignEmails(kept, other, primaryChoice, secondaryChoice);
  const allEmails = collectEmails(kept, other);
  const sameHistory = eventCount(kept.id) === eventCount(other.id);

  return (
    <>
      <h2 id="merge-suggestions-title" className="text-lg font-medium text-gray-900 dark:text-white">
        Merge {kept.name.trim()}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
        {sameHistory
          ? "Both contacts have the same number of messages and events, so the older contact is kept."
          : "The contact with more messages and events is kept."}{" "}
        Events move onto that contact, including Outlook ids, so a later sync does not import them again. The other
        contact is removed.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <ContactColumn person={kept} role="Keep" activity={activityLabel(kept.id, events, categoryFor)} />
        <ContactColumn person={other} role="Merge in" activity={activityLabel(other.id, events, categoryFor)} />
      </div>

      {allEmails.length > 0 && (
        <fieldset className="mb-4">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Primary email</legend>
          <div className="space-y-2">
            {allEmails.map((email) => (
              <label key={email} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="merge-primary-email"
                  className={inputClass}
                  checked={assignment.primary?.toLowerCase() === email.toLowerCase()}
                  onChange={() => onPrimary(email)}
                />
                {email}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {allEmails.length === 2 && assignment.secondary && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Secondary email: <span className="text-gray-900 dark:text-white">{assignment.secondary}</span>
        </p>
      )}

      {allEmails.length > 2 && (
        <fieldset className="mb-4">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Secondary email</legend>
          <div className="space-y-2">
            {allEmails
              .filter((email) => email.toLowerCase() !== assignment.primary?.toLowerCase())
              .map((email) => (
                <label key={email} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="merge-secondary-email"
                    className={inputClass}
                    checked={assignment.secondary?.toLowerCase() === email.toLowerCase()}
                    onChange={() => onSecondary(email)}
                  />
                  {email}
                </label>
              ))}
          </div>
        </fieldset>
      )}

      {assignment.extras.length > 0 && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
          Only two addresses can be stored. {assignment.extras.join(", ")} will be saved in notes.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onConfirm(kept.id, other.id, assignment.primary, assignment.secondary)}
          className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
        >
          Merge contacts
        </button>
      </div>
    </>
  );
}
