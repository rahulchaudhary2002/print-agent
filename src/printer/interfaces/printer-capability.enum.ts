/** Features a driver may support. PrinterManager and callers use this instead of guessing by driver name. */
export enum PrinterCapability {
  Usb = 'usb',
  Network = 'network',
  RawBytes = 'raw-bytes',
  EscPos = 'escpos',
  Pdf = 'pdf',
  Images = 'images',
  CashDrawer = 'cash-drawer',
  CutPaper = 'cut-paper',
}
