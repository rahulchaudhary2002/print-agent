export interface PrinterConfigurationOverrides {
  printerId: string;
  friendlyName: string | null;
  profileId: string | null;
  preferredDriver: string | null;
  paperWidth: string | null;
  renderer: string | null;
  timeoutMs: number | null;
  retryMax: number | null;
  retryBackoffMs: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Merged view: the printer's core fields + its extended overrides + global defaults where unset. */
export interface PrinterConfiguration {
  printerId: string;
  friendlyName: string;
  isDefaultPrinter: boolean;
  preferredDriver: string;
  paperWidth: string | null;
  renderer: string | null;
  timeoutMs: number;
  retryMax: number;
  retryBackoffMs: number;
  enabled: boolean;
  profileId: string | null;
  updatedAt: string;
}

export interface UpdatePrinterConfigurationInput {
  friendlyName?: string | null | undefined;
  profileId?: string | null | undefined;
  preferredDriver?: string | null | undefined;
  paperWidth?: string | null | undefined;
  renderer?: string | null | undefined;
  timeoutMs?: number | null | undefined;
  retryMax?: number | null | undefined;
  retryBackoffMs?: number | null | undefined;
}
