/**
 * Pure helpers for keeping the unit-level Category / Section / Unit fields of the
 * authoring form consistent. A unit's category is always derived from its section
 * (sec_tbl.cat_id), so the section is the source of truth.
 */

export interface SectionLike {
  sec_id: number;
  cat_id?: number | null;
}

/**
 * Returns the category id (as a string) the form should show for the selected section.
 * Falls back to the current category when the section is empty, unknown, or has no category.
 */
export function reconcileCategory(
  sections: readonly SectionLike[],
  selectedSecId: string,
  selectedCatId: string,
): string {
  if (!selectedSecId) return selectedCatId;
  const section = sections.find((s) => s.sec_id.toString() === selectedSecId);
  if (section?.cat_id == null) return selectedCatId;
  return String(section.cat_id);
}

function toPositiveInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Stamps the unit-level cat_id / sec_id / unit onto every quiz entry.
 * Only positive integers are applied; empty or invalid values leave the entry untouched
 * so strict import validation (positive ints only) is never violated.
 */
export function stampUnitFields<T extends object>(
  batch: readonly T[],
  fields: {
    catId: string | number | null | undefined;
    secId: string | number | null | undefined;
    unit: string | number | null | undefined;
  },
): T[] {
  const catId = toPositiveInt(fields.catId);
  const secId = toPositiveInt(fields.secId);
  const unit = toPositiveInt(fields.unit);
  return batch.map((entry) => ({
    ...entry,
    ...(catId === null ? {} : { cat_id: catId }),
    ...(secId === null ? {} : { sec_id: secId }),
    ...(unit === null ? {} : { unit }),
  }));
}
