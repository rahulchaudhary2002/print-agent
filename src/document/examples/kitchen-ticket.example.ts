import { CharacterSize } from '../interfaces/index.js';
import { DocumentBuilder } from '../builder/index.js';
import type { PrintDocument } from '../interfaces/index.js';

export function buildKitchenTicketExample(): PrintDocument {
  const builder = new DocumentBuilder();

  builder
    .alignCenter()
    .characterSize(CharacterSize.DoubleHeight)
    .bold(true)
    .text('KITCHEN — TABLE 12')
    .resetStyle()
    .divider({ character: '=', length: 32 })
    .newSection()
    .alignLeft()
    .bold(true)
    .characterSize(CharacterSize.DoubleWidth)
    .text('2x Margherita Pizza')
    .resetStyle()
    .text('  - extra basil')
    .bold(true)
    .characterSize(CharacterSize.DoubleWidth)
    .text('1x Caesar Salad')
    .resetStyle()
    .text('  - no croutons')
    .divider({ length: 32 })
    .alignCenter()
    .text('Fired: 12:41 PM')
    .feed(3)
    .cut();

  return builder.build();
}
