"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useContactSubtags } from "@/store/useContactSubtags";
import { describeList, peopleForList } from "@/utils/mailingLists";
import MailingListMembers from "@/components/MailingListMembers";
import MailingListModal from "@/components/MailingListModal";

export default function SavedListPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const { people, getMailingList, deleteMailingList } = useStore();
  const customByType = useContactSubtags((state) => state.byType);
  const customTypes = useContactSubtags((state) => state.customTypes);
  const [isEditing, setIsEditing] = useState(false);
  const list = getMailingList(listId);

  if (!list) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">List not found</h2>
          <Link href="/lists" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            Back to Lists
          </Link>
        </div>
      </div>
    );
  }

  const members = peopleForList(people, list);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/lists"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          Back to Lists
        </Link>
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{list.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {describeList(list, { byType: customByType, customTypes })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg font-medium text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => {
                deleteMailingList(list.id);
                router.push("/lists");
              }}
              className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium text-sm"
            >
              Delete
            </button>
          </div>
        </div>
        <MailingListMembers people={members} listName={list.name} />
      </div>
      <MailingListModal isOpen={isEditing} onClose={() => setIsEditing(false)} list={list} />
    </div>
  );
}
