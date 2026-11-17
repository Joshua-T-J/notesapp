/** localStorage access that never throws (private mode, disabled storage, SSR). */
export function readItem(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: the setting simply won't survive a reload.
  }
}
