"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { useContactSubtags } from "@/store/useContactSubtags";
import { ContactType } from "@/types";
import { findContactType, labelForSubtag, subtagsForContactType } from "@/utils/contactSubtags";
import MailingListMembers from "@/components/MailingListMembers";

function TypeListContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contactType = params.contactType as ContactType;
  const subtag = searchParams.get("subtag") || "";
  const { people } = useStore();
  const customByType = useContactSubtags((state) => state.byType);
  const customTypes = useContactSubtags((state) => state.customTypes);
  const typeDef = findContactType(contactType, customTypes);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useContactSubtags.persist;
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  if (!typeDef && !hydrated) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950" />;
  }

  if (!typeDef) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Unknown contact type</h2>
          <Link href="/lists" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            Back to Lists
          </Link>
        </div>
      </div>
    );
  }

  const safePeople = Array.isArray(people) ? people : [];
  const subtagLabel = labelForSubtag(contactType, subtag, customByType);
  const subtypes = subtagsForContactType(contactType, customByType);
  const members = safePeople
    .filter((person) => person?.contactType === contactType && (!subtag || person.subtag === subtag))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const listName = subtagLabel ? `${subtagLabel} ${typeDef.label.toLowerCase()}s` : `${typeDef.label}s`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/lists"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          Back to Lists
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{listName}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Everyone tagged as {subtagLabel ? `${subtagLabel.toLowerCase()} ` : ""}
          {typeDef.label.toLowerCase()}.
        </p>

        {subtypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href={`/lists/type/${contactType}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                !subtag
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
              }`}
            >
              All
            </Link>
            {subtypes.map((item) => {
              const count = safePeople.filter(
                (person) => person?.contactType === contactType && person.subtag === item.id
              ).length;
              return (
                <Link
                  key={item.id}
                  href={`/lists/type/${contactType}?subtag=${item.id}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    subtag === item.id
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 text-gray-400">{count}</span>
                </Link>
              );
            })}
          </div>
        )}

        <MailingListMembers people={members} listName={listName} />
      </div>
    </div>
  );
}

export default function TypeListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
      <TypeListContent />
    </Suspense>
  );
}
