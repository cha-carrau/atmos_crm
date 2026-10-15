"use client";

import Link from "next/link";
import { Person, getContactTypeDefinition } from "@/types";
import { useContactSubtags } from "@/store/useContactSubtags";
import { labelForSubtag } from "@/utils/contactSubtags";
import Badge from "./Badge";

interface ContactTypeBadgesProps {
  person: Person;
  linked?: boolean;
}

export default function ContactTypeBadges({ person, linked = false }: ContactTypeBadgesProps) {
  const customByType = useContactSubtags((state) => state.byType);
  if (!person) return null;
  const typeDef = getContactTypeDefinition(person.contactType);
  const subtagLabel = labelForSubtag(person.contactType, person.subtag, customByType);
  const tags = Array.isArray(person?.tags) ? person.tags : [];

  if (!typeDef && !subtagLabel && tags.length === 0) return null;

  const typeBadge = typeDef ? (
    <Badge variant="primary">{typeDef.label}</Badge>
  ) : null;

  const subtagBadge = subtagLabel ? <Badge variant="info">{subtagLabel}</Badge> : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {typeBadge && linked && person.contactType ? (
        <Link href={`/lists/type/${person.contactType}`}>{typeBadge}</Link>
      ) : (
        typeBadge
      )}
      {subtagBadge && linked && person.contactType && person.subtag ? (
        <Link href={`/lists/type/${person.contactType}?subtag=${person.subtag}`}>{subtagBadge}</Link>
      ) : (
        subtagBadge
      )}
      {tags.map((tag) => (
        <Badge key={tag} variant="soft">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
