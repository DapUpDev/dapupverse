/**
 * A tiny "something changed on the server" signal.
 *
 * The mock store notifies `useRepositoryQuery` on every mutation. HTTP
 * repositories have no store to watch, so after a successful write they
 * call `notifyRepositoryChange()` and every mounted query re-runs. Reads
 * from other users are not pushed; a page load or a write refreshes them.
 */

const listeners = new Set<() => void>();
let version = 0;

export function subscribeRepositoryChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function repositoryChangeVersion(): number {
  return version;
}

export function notifyRepositoryChange(): void {
  version += 1;
  for (const listener of listeners) listener();
}
