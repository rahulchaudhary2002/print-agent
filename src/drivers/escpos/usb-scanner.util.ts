import { getDeviceList } from 'usb';
import type { DiscoveredPrinter } from '../../printer/interfaces/index.js';

/** USB-IF device class code for printers (the descriptor most ESC/POS printers self-report). */
const USB_PRINTER_CLASS = 0x07;

/** Enumerates connected USB devices and returns the ones that self-report as printers. */
export function scanUsbPrinters(): DiscoveredPrinter[] {
  return getDeviceList()
    .filter((device) => device.deviceDescriptor.bDeviceClass === USB_PRINTER_CLASS)
    .map((device) => {
      const vendorId = device.deviceDescriptor.idVendor.toString(16).padStart(4, '0');
      const productId = device.deviceDescriptor.idProduct.toString(16).padStart(4, '0');
      return {
        name: `USB Printer ${vendorId}:${productId}`,
        connection: 'USB',
        driver: 'escpos-usb',
      };
    });
}
