import { Company } from "@/types";

/**
 * Link a typed company name to an existing company, or create one.
 * Matching is case-insensitive and ignores surrounding whitespace.
 */
export function resolveCompanyId(
  typedName: string,
  companies: Company[],
  addCompany: (company: { name: string }) => string
): string | undefined {
  const name = typedName.trim();
  if (!name) return undefined;

  const existing = companies.find(
    (company) => company.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing.id;

  return addCompany({ name });
}
