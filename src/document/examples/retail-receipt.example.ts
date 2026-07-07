import { BarcodeType } from '../elements/index.js';
import { DocumentBuilder } from '../builder/index.js';
import type { PrintDocument } from '../interfaces/index.js';

export function buildRetailReceiptExample(): PrintDocument {
  const builder = new DocumentBuilder();

  builder
    .alignCenter()
    .bold(true)
    .text('Northside Hardware')
    .resetStyle()
    .alignCenter()
    .text('Receipt #48213')
    .divider({ length: 32 })
    .newSection()
    .alignLeft()
    .table(
      [
        { header: 'SKU', width: 10 },
        { header: 'Item', width: 14, truncate: true },
        { header: 'Amt', width: 8 },
      ],
      [
        { cells: ['HW-2201', 'Hex Bolt M6', '4.20'] },
        { cells: ['HW-3390', 'Wall Anchor Kit', '9.99'] },
      ],
    )
    .divider({ length: 32 })
    .alignRight()
    .text('Subtotal: $14.19')
    .text('Tax:      $1.13')
    .bold(true)
    .text('Total:    $15.32')
    .resetStyle()
    .newSection()
    .alignCenter()
    .barcode(BarcodeType.Code128, 'RET48213', { showText: true })
    .feed(2)
    .cut();

  return builder.build();
}
