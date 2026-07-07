import { spawn } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Thin wrapper around `child_process.spawn` used everywhere the installer shells out (systemctl, dpkg-deb, etc). */
export function run(command: string, args: string[], options: { cwd?: string } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return run(probe, [command]).then((result) => result.code === 0);
}
