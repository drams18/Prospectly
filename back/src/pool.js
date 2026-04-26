/**
 * Runs async task factories with bounded concurrency.
 * Returns results in the same order as tasks, regardless of completion order.
 */
export async function promisePool(tasks, maxConcurrent = 5) {
  const results = new Array(tasks.length);
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
