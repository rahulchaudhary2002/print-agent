import { CharacterSize } from '../interfaces/index.js';
import { DocumentBuilder } from '../builder/index.js';
import type { PrintDocument } from '../interfaces/index.js';

export function buildRestaurantReceiptExample(): PrintDocument {
  const builder = new DocumentBuilder();

  builder
    .alignCenter()
    .characterSize(CharacterSize.DoubleWidthHeight)
    .bold(true)
    .text('The Golden Spoon')
    .resetStyle()
    .alignCenter()
    .text('123 Market Street')
    .text('Table 12  •  Server: Alex')
    .resetStyle()
    .divider({ character: '=', length: 32 })
    .newSection()
    .alignLeft()
    .table(
      [
        { header: 'Item', width: 20, wrap: true },
        { header: 'Qty', width: 4 },
        { header: 'Price', width: 8 },
      ],
      [
        { cells: ['Margherita Pizza', '1', '12.50'] },
        { cells: ['Caesar Salad', '2', '8.00'] },
        { cells: ['Iced Tea', '3', '3.00'] },
      ],
    )
    .divider({ length: 32 })
    .alignRight()
    .bold(true)
    .text('Total: $31.50')
    .resetStyle()
    .newSection()
    .alignCenter()
    .qrcode('https://goldenspoon.example/receipt/8842', { size: 5 })
    .feed(1)
    .text('Thank you for dining with us!')
    .feed(3)
    .cut();

  return builder.build();
}
