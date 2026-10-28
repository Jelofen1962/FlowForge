export interface BatchItemResult<T, R> { index: number; input: T; status: 'succeeded' | 'failed' | 'cancelled'; output?: R; error?: string; attempts: number }
export interface BatchOptions { retries?: number; signal?: AbortSignal; onItem?: (result: BatchItemResult<unknown, unknown>) => void }

export async function runBatch<T, R>(items: T[], worker: (item: T, index: number, signal?: AbortSignal) => Promise<R>, options: BatchOptions = {}): Promise<BatchItemResult<T, R>[]> {
  const retries = Math.max(0, Math.min(options.retries ?? 0, 5));
  const results: BatchItemResult<T, R>[] = [];
  for (let index = 0; index < items.length; index++) {
    const input = items[index];
    if (options.signal?.aborted) {
      const result: BatchItemResult<T, R> = { index, input, status: 'cancelled', attempts: 0 };
      results.push(result); options.onItem?.(result as BatchItemResult<unknown, unknown>); continue;
    }
    let attempts = 0;
    let result: BatchItemResult<T, R>;
    while (true) {
      attempts++;
      try {
        const output = await worker(input, index, options.signal);
        result = { index, input, status: 'succeeded', output, attempts };
        break;
      } catch (error) {
        if (attempts <= retries && !options.signal?.aborted) continue;
        result = { index, input, status: options.signal?.aborted ? 'cancelled' : 'failed', error: error instanceof Error ? error.message : String(error), attempts };
        break;
      }
    }
    results.push(result); options.onItem?.(result as BatchItemResult<unknown, unknown>);
  }
  return results;
}
