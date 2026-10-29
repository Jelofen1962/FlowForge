export interface BatchItemResult<T, R> { index: number; input: T; status: 'succeeded' | 'failed' | 'cancelled'; output?: R; error?: string; attempts: number }
export interface BatchOptions<T = unknown, R = unknown> { retries?: number; concurrency?: number; signal?: AbortSignal; resumeResults?: BatchItemResult<T, R>[]; onItem?: (result: BatchItemResult<unknown, unknown>) => void }

export async function runBatch<T, R>(items: T[], worker: (item: T, index: number, signal?: AbortSignal) => Promise<R>, options: BatchOptions<T, R> = {}): Promise<BatchItemResult<T, R>[]> {
  const retries = Math.max(0, Math.min(options.retries ?? 0, 5));
  const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency ?? 1), items.length || 1, 32));
  const results = new Array<BatchItemResult<T, R>>(items.length);
  for (const checkpoint of options.resumeResults ?? []) {
    if (checkpoint.status !== 'succeeded' || !Number.isInteger(checkpoint.index) || checkpoint.index < 0 || checkpoint.index >= items.length) continue;
    const currentInput = items[checkpoint.index];
    let matches = Object.is(currentInput, checkpoint.input);
    if (!matches && currentInput && checkpoint.input && typeof currentInput === 'object' && typeof checkpoint.input === 'object') {
      try { matches = JSON.stringify(currentInput) === JSON.stringify(checkpoint.input); } catch { matches = false; }
    }
    if (matches) results[checkpoint.index] = checkpoint;
  }
  let nextIndex = 0;

  async function processItems(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      if (results[index]) continue;
      const input = items[index];
      let result: BatchItemResult<T, R>;
      if (options.signal?.aborted) {
        result = { index, input, status: 'cancelled', attempts: 0 };
      } else {
        let attempts = 0;
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
      }
      results[index] = result;
      options.onItem?.(result as BatchItemResult<unknown, unknown>);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => processItems()));
  return results;
}
