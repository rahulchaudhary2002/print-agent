import { DocumentBuilder } from '../builder/index.js';
import { CharacterSize } from '../interfaces/index.js';
import type { PrintDocument } from '../interfaces/index.js';

/** A gift receipt: no prices, just what was purchased — for the recipient, not the payer. */
export function buildGiftReceiptExample(): PrintDocument {
  const builder = new DocumentBuilder();

  builder
    .alignCenter()
    .characterSize(CharacterSize.DoubleWidth)
    .bold(true)
    .text('Northside Hardware')
    .resetStyle()
    .alignCenter()
    .text('Gift Receipt')
    .divider({ character: '=', length: 32 })
    .newSection()
    .alignLeft()
    .table(
      [
        { header: 'Item', width: 24 },
        { header: 'Qty', width: 6 },
      ],
      [
        { cells: ['Hex Bolt M6', '4'] },
        { cells: ['Wall Anchor Kit', '1'] },
      ],
    )
    .divider({ length: 32 })
    .alignCenter()
    .text('No price shown — return with this receipt')
    .text('within 30 days for store credit.')
    .feed(3)
    .cut();

  return builder.build();
}
