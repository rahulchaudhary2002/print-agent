import { createInterface } from 'node:readline/promises';

/** Step 3 — interactive prompts, used only when `--silent` isn't passed and stdin is a real TTY. */
export async function promptText(question: string, fallback: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return fallback;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [${fallback}]: `);
    return answer.trim() || fallback;
  } finally {
    rl.close();
  }
}

export async function promptYesNo(question: string, fallback: boolean): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return fallback;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = fallback ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${question} [${suffix}]: `)).trim().toLowerCase();
    if (!answer) {
      return fallback;
    }
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
