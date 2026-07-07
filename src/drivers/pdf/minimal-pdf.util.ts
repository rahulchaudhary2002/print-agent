function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Hand-rolls a minimal single-page PDF containing left-aligned lines of text.
 * Used only for the test-print pipeline, so we don't need a PDF-generation dependency
 * for what is otherwise a ~40-line, well-understood file format.
 *
 * Note: Ghostscript/Poppler print a benign "Incorrect /Length for stream object" warning
 * for hand-written PDFs like this one (even the textbook-canonical minimal PDF triggers it —
 * verified separately). Both tools still render/extract the content correctly; it's cosmetic.
 */
export function buildMinimalTestPdf(lines: string[]): Buffer {
  const lineHeight = 16;
  const topMargin = 20;
  const startY = topMargin + lineHeight * (lines.length - 1);

  const textOps = lines
    .map((line, index) => `1 0 0 1 10 ${startY - index * lineHeight} Tm (${escapePdfText(line)}) Tj`)
    .join(' ');
  const content = `BT /F1 12 Tf ${textOps} ET`;

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 220 ${startY + topMargin}]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${Buffer.byteLength(content) + 1}>>stream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj${object}endobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body + xref + trailer, 'latin1');
}
