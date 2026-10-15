"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useContactSubtags } from "@/store/useContactSubtags";
import { CONTACT_TYPES } from "@/types";
import { subtagsForContactType } from "@/utils/contactSubtags";
import { describeList, peopleForList } from "@/utils/mailingLists";
import MailingListModal from "@/components/MailingListModal";

export default function ListsPage() {
  const { people, mailingLists } = useStore();
  const safePeople = Array.isArray(people) ? people : [];
  const safeLists = Array.isArray(mailingLists) ? mailingLists : [];
  const customByType = useContactSubtags((state) => state.byType);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Lists</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Mailing lists built from contact types and tags
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
          >
            New list
          </button>
        </div>

        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          By type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {CONTACT_TYPES.map((type) => {
            const peopleOfType = safePeople.filter((person) => person?.contactType === type.id);
            const subtypes = subtagsForContactType(type.id, customByType);
            return (
              <div
                key={type.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link href={`/lists/type/${type.id}`} className="group">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {type.label}
                    </h3>
                  </Link>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{peopleOfType.length}</span>
                </div>
                {subtypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subtypes.map((subtag) => {
                      const count = peopleOfType.filter((person) => person?.subtag === subtag.id).length;
                      return (
                        <Link
                          key={subtag.id}
                          href={`/lists/type/${type.id}?subtag=${subtag.id}`}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
                        >
                          {subtag.label}
                          <span className="ml-1.5 text-gray-400">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <Link
                    href={`/lists/type/${type.id}`}
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View list
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Saved lists
        </h2>
        {safeLists.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">No saved lists yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Save a combination of type, subtype, and tags, like Series A investors or pilot clients.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
            >
              Create a list
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeLists.map((list) => {
              const count = peopleForList(safePeople, list).length;
              return (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">{list.name}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{count}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{describeList(list, customByType)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <MailingListModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
