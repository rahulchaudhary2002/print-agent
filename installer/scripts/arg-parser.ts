/** Minimal `--flag`/`--key=value` parser — no argument-parsing dependency needed for a handful of flags. */
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const body = arg.slice(2);
    const eqIndex = body.indexOf('=');
    if (eqIndex === -1) {
      result[body] = true;
    } else {
      result[body.slice(0, eqIndex)] = body.slice(eqIndex + 1);
    }
  }
  return result;
}

export function flag(args: Record<string, string | boolean>, name: string, fallback = false): boolean {
  const value = args[name];
  return value === undefined ? fallback : value !== 'false';
}

export function option(args: Record<string, string | boolean>, name: string, fallback: string): string {
  const value = args[name];
  return typeof value === 'string' ? value : fallback;
}
