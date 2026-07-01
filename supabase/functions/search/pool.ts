// Runs async task factories with bounded concurrency.
// Returns results in the same order as tasks, regardless of completion order.
export async function promisePool<T>(tasks: Array<() => Promise<T>>, maxConcurrent = 5): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}
