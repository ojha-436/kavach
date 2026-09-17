/**
 * Maps over items with a ceiling on how many run at once, preserving input
 * order in the result.
 *
 * The ceiling is the point. Corpus ingest pulls PDFs over the network and
 * parses each one into memory, so running a batch of forty serially wastes
 * most of the wall clock waiting on I/O, while running all forty at once
 * would hold forty parsed PDFs in a container with 1 GiB to its name. Neither
 * extreme is right, and "it worked on the batch I tried" is not a memory
 * bound. A small pool overlaps the waiting without letting peak memory scale
 * with batch size.
 *
 * Rejections are not caught here: a caller that wants per-item error handling
 * should return a result object rather than throw, so one bad item cannot
 * discard the work already done by the others.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) throw new RangeError("limit must be at least 1");
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
