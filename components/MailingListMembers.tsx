"use client";

import { useState } from "react";
import Link from "next/link";
import { Person } from "@/types";
import { useStore } from "@/store/useStore";
import { downloadCSV } from "@/utils/csvHelpers";
import { collectEmails } from "@/lib/mergePeople";
import ContactTypeBadges from "./ContactTypeBadges";

interface MailingListMembersProps {
  people: Person[];
  listName?: string;
}

function mailingListCsvFilename(listName?: string) {
  const slug = (listName || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${slug || "mailing-list"}.csv`;
}

function emailCell(email: string) {
  if (/[",\n\r]/.test(email)) {
    return `"${email.replace(/"/g, '""')}"`;
  }
  return email;
}

export default function MailingListMembers({ people, listName }: MailingListMembersProps) {
  const { getCompany } = useStore();
  const [copied, setCopied] = useState(false);
  const addresses = people.flatMap((person) => collectEmails(person));
  const missingEmail = people.filter((person) => collectEmails(person).length === 0);
  const emails = addresses.join(", ");

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

  const downloadEmails = () => {
    if (addresses.length === 0) return;
    downloadCSV(["Email", ...addresses.map(emailCell)].join("\n"), mailingListCsvFilename(listName));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={copyEmails}
          disabled={addresses.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
        >
          {copied ? "Copied" : `Copy ${addresses.length} email${addresses.length === 1 ? "" : "s"}`}
        </button>
        {addresses.length > 0 && (
          <a
            href={`mailto:?bcc=${encodeURIComponent(addresses.join(","))}`}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 text-sm"
          >
            Email list
          </a>
        )}
        <button
          onClick={downloadEmails}
          disabled={addresses.length === 0}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-gray-800 rounded-lg font-medium transition-colors duration-200 text-sm"
        >
          Download CSV
        </button>
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
                    {collectEmails(person).join(" · ") || "No email"}
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
