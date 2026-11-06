/**
 * Reads every row of a ranged PostgREST query, bypassing the 1,000-row response cap.
 * The builder MUST order deterministically (date + id) so repeated dates never
 * shift rows between pages.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  onError: (error: unknown) => never,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) onError(error);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}
