export interface InstallerContext {
  /** Absolute path to the Node.js executable to run the agent with. */
  nodePath: string;
  /** Absolute path to the project root (contains `dist/index.js`). */
  projectRoot: string;
  /** Absolute path to the compiled entry point. */
  entryPoint: string;
  /** Absolute path to the logs directory. */
  logsDir: string;
  /** OS user the service should run as, where the target platform supports it. */
  serviceUser: string;
}

export interface GeneratedFile {
  /** Path relative to the output directory this file set is written into. */
  relativePath: string;
  content: string;
  /** Marks shell/PowerShell scripts so the CLI can `chmod +x` them on POSIX systems. */
  executable?: boolean | undefined;
}
