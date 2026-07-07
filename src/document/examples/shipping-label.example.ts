import { BarcodeType, ImageFormat } from '../elements/index.js';
import { DocumentBuilder } from '../builder/index.js';
import type { PrintDocument } from '../interfaces/index.js';

// A real (not placeholder) 16x16 checkerboard PNG standing in for a carrier logo.
const LOGO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASklEQVR4AaXBsREAMBDCMPOX/Vd2WnqkAFJUWhKaSjtGx+gYPZWWhKbSktCO0TE6RgGkqLQkNJV2jI7RMXoqLQlNpSWhHaNjdIw+xpwaG36HTNQAAAAASUVORK5CYII=';

export function buildShippingLabelExample(): PrintDocument {
  const builder = new DocumentBuilder();

  builder
    .alignCenter()
    .image({ kind: 'buffer', buffer: Buffer.from(LOGO_PNG_BASE64, 'base64') }, { format: ImageFormat.Png, width: 64 })
    .bold(true)
    .text('SHIP TO')
    .resetStyle()
    .alignLeft()
    .text('Jordan Rivera')
    .text('482 Elm Street, Apt 3B')
    .text('Springfield, IL 62704')
    .divider({ length: 32 })
    .newSection()
    .alignCenter()
    .qrcode('https://carrier.example/track/1Z999AA10123456784', { size: 6, margin: 1 })
    .feed(1)
    .barcode(BarcodeType.Code128, '1Z999AA10123456784', { showText: true })
    .feed(1)
    .text('Ground • 2.4 lb')
    .feed(2)
    .cut();

  return builder.build();
}
