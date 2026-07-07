export interface PrinterProfile {
  id: string;
  name: string;
  model: string | null;
  paperWidth: string;
  defaultRenderer: string;
  supportedDrivers: string[];
  encoding: string;
  capabilities: string[];
  imageSupport: boolean;
  qrSupport: boolean;
  barcodeSupport: boolean;
  cashDrawerSupport: boolean;
  cutSupport: boolean;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrinterProfileInput {
  name: string;
  model?: string | null | undefined;
  paperWidth: string;
  defaultRenderer: string;
  supportedDrivers: string[];
  encoding: string;
  capabilities?: string[] | undefined;
  imageSupport?: boolean | undefined;
  qrSupport?: boolean | undefined;
  barcodeSupport?: boolean | undefined;
  cashDrawerSupport?: boolean | undefined;
  cutSupport?: boolean | undefined;
}

export type UpdatePrinterProfileInput = { [K in keyof CreatePrinterProfileInput]?: CreatePrinterProfileInput[K] | undefined };
