/**
 * Accumulates bytes into a single growable backing buffer instead of calling `Buffer.concat`
 * per write (which reallocates and copies everything every time — O(n²) for a long receipt).
 * Doubles capacity on overflow, same amortized-O(1) growth strategy as `Array`/`ArrayList`.
 */
export class BufferWriter {
  private buffer: Buffer;
  private length = 0;

  constructor(initialCapacity = 4096) {
    this.buffer = Buffer.alloc(initialCapacity);
  }

  get size(): number {
    return this.length;
  }

  write(bytes: readonly number[] | Buffer): this {
    this.ensureCapacity(this.length + bytes.length);
    if (Buffer.isBuffer(bytes)) {
      bytes.copy(this.buffer, this.length);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        this.buffer[this.length + i] = bytes[i] as number;
      }
    }
    this.length += bytes.length;
    return this;
  }

  writeByte(byte: number): this {
    this.ensureCapacity(this.length + 1);
    this.buffer[this.length] = byte & 0xff;
    this.length += 1;
    return this;
  }

  writeBytes(...byteArrays: Array<readonly number[] | Buffer>): this {
    for (const bytes of byteArrays) {
      this.write(bytes);
    }
    return this;
  }

  writeText(text: string): this {
    return this.write(Buffer.from(text, 'latin1'));
  }

  clear(): this {
    this.length = 0;
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.buffer.subarray(0, this.length));
  }

  private ensureCapacity(required: number): void {
    if (required <= this.buffer.length) {
      return;
    }
    let nextCapacity = this.buffer.length * 2;
    while (nextCapacity < required) {
      nextCapacity *= 2;
    }
    const grown = Buffer.alloc(nextCapacity);
    this.buffer.copy(grown, 0, 0, this.length);
    this.buffer = grown;
  }
}
