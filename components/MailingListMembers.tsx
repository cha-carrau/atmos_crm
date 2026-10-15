"use client";

import { useState } from "react";
import Link from "next/link";
import { Person } from "@/types";
import { useStore } from "@/store/useStore";
import ContactTypeBadges from "./ContactTypeBadges";

interface MailingListMembersProps {
  people: Person[];
}

export default function MailingListMembers({ people }: MailingListMembersProps) {
  const { getCompany } = useStore();
  const [copied, setCopied] = useState(false);
  const withEmail = people.filter((person) => person.email);
  const missingEmail = people.filter((person) => !person.email);
  const emails = withEmail.map((person) => person.email).join(", ");

  const copyEmails = async () => {
    if (!emails) return;
    try {
      await navigator.clipboard.writeText(emails);
    } catch {
      const el = document.createElement("textarea");
      el.value = emails;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={copyEmails}
          disabled={withEmail.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
        >
          {copied ? "Copied" : `Copy ${withEmail.length} email${withEmail.length === 1 ? "" : "s"}`}
        </button>
        {withEmail.length > 0 && (
          <a
            href={`mailto:?bcc=${encodeURIComponent(withEmail.map((person) => person.email).join(","))}`}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
          >
            Email list
          </a>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {people.length} {people.length === 1 ? "person" : "people"}
          {missingEmail.length > 0 ? ` · ${missingEmail.length} missing email` : ""}
        </p>
      </div>

      {people.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matching contacts</h2>
          <p className="text-gray-600 dark:text-gray-400">
            People show up here when their type and tags match this list.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {people.map((person) => {
            const company = person.companyId ? getCompany(person.companyId) : undefined;
            return (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{person.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {person.email || "No email"}
                    {company ? ` · ${company.name}` : ""}
                  </p>
                </div>
                <ContactTypeBadges person={person} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
