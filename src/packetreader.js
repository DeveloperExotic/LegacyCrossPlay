/* --------------------------------------------------------------- */
/*                         packetreader.js                         */
/* --------------------------------------------------------------- */
class PacketReader {
  /**
   * @param {Buffer<ArrayBuffer>} buffer
   */
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  /**
   * @returns {number}
   */
  readByte() {
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  /**
   * @returns {number}
   */
  readUnsignedByte() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  /**
   * @returns {number}
   */
  readShort() {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  /**
   * @returns {number}
   */
  readInt() {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * @returns {bigint}
   */
  readLong() {
    const value = this.buffer.readBigInt64BE(this.offset);
    this.offset += 8;
    return value;
  }

  /**
   * @returns {number}
   */
  // @ts-expect-error - Duplicate definition, identical
  readFloat() {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * @returns {boolean}
   */
  readBoolean() {
    return this.readByte() !== 0;
  }

  /**
   * @returns {string}
   */
  readString() {
    const length = this.readShort();
    let str = "";
    for (let i = 0; i < length; i++) {
      const charCode = this.buffer.readUInt16BE(this.offset);
      this.offset += 2;
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  /**
   * @returns {number}
   */
  readDouble() {
    const value = this.buffer.readDoubleBE(this.offset);
    this.offset += 8;
    return value;
  }

  /**
   * @returns {number}
   */
  // @ts-expect-error - Duplicate definition, identical
  readFloat() {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * @param {number} bytes
   * @returns {void}
   */
  skip(bytes) {
    this.offset += bytes;
  }
}

module.exports = PacketReader;
/* --------------------------------------------------------------- */
