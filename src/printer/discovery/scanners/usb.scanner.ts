import { getDeviceList, type Device } from 'usb';
import type { DiscoveredPrinterCandidate } from '../types/index.js';

const USB_PRINTER_CLASS = 0x07;
const DESCRIPTOR_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
  ]);
}

/** Best-effort read of a USB string descriptor — many printers refuse this without elevated permissions. */
async function readStringDescriptor(device: Device, index: number | undefined): Promise<string | undefined> {
  if (!index) {
    return undefined;
  }
  return new Promise((resolve) => {
    device.getStringDescriptor(index, (error, value) => resolve(error ? undefined : value));
  });
}

async function describeDevice(
  device: Device,
): Promise<{ manufacturer?: string | undefined; model?: string | undefined; serialNumber?: string | undefined }> {
  try {
    device.open();
  } catch {
    return {};
  }
  try {
    const descriptor = device.deviceDescriptor;
    const [manufacturer, model, serialNumber] = await withTimeout(
      Promise.all([
        readStringDescriptor(device, descriptor.iManufacturer),
        readStringDescriptor(device, descriptor.iProduct),
        readStringDescriptor(device, descriptor.iSerialNumber),
      ]),
      DESCRIPTOR_TIMEOUT_MS,
    ) ?? [undefined, undefined, undefined];
    return { manufacturer, model, serialNumber };
  } finally {
    try {
      device.close();
    } catch {
      // already closed or never opened successfully — nothing to clean up
    }
  }
}

/**
 * Normalized USB printer discovery (Step 3) — vendor/product IDs, manufacturer/model/serial
 * (best-effort; requires OS permission to open the device), USB path, and a structured
 * `connection` object ready to hand to `PrinterService.create()`.
 */
export async function scanUsbCandidates(): Promise<DiscoveredPrinterCandidate[]> {
  const printerDevices = getDeviceList().filter((device) => device.deviceDescriptor.bDeviceClass === USB_PRINTER_CLASS);
  const now = new Date().toISOString();

  return Promise.all(
    printerDevices.map(async (device) => {
      const { idVendor, idProduct } = device.deviceDescriptor;
      const details = await describeDevice(device);
      const usbPath = `${device.busNumber}-${device.portNumbers?.join('.') ?? device.deviceAddress}`;
      const vendorHex = idVendor.toString(16).padStart(4, '0');
      const productHex = idProduct.toString(16).padStart(4, '0');

      const candidate: DiscoveredPrinterCandidate = {
        // Matches `fingerprintFromConnection('escpos-usb', ...)` — deliberately excludes
        // serial/usbPath so it stays comparable to a registered printer's stored connection.
        fingerprint: `usb:${vendorHex}:${productHex}`,
        name: details.model ?? `USB Printer ${vendorHex}:${productHex}`,
        driver: 'escpos-usb',
        transport: 'usb',
        connection: { vendorId: idVendor, productId: idProduct },
        vendorId: idVendor,
        productId: idProduct,
        manufacturer: details.manufacturer,
        model: details.model,
        serialNumber: details.serialNumber,
        usbPath,
        status: 'connected',
        discoveredAt: now,
      };
      return candidate;
    }),
  );
}
