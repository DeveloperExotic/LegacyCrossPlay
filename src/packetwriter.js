/* --------------------------------------------------------------- */
/*                        packetwriter.js                          */
/* --------------------------------------------------------------- */
class PacketWriter {
  constructor() {
    /**
     * @type {Buffer<ArrayBuffer>[]}
     */
    this.buffers = [];
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeUInt8(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  // @ts-expect-error - Duplicate definition, identical
  writeSignedByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeInt8(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  // @ts-expect-error - Duplicate definition, identical
  writeSignedByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeInt8(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeShort(value) {
    const buf = Buffer.allocUnsafe(2);
    buf.writeInt16BE(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeInt(value) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeLong(value) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigInt64BE(BigInt(value), 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeDouble(value) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleBE(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  writeFloat(value) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeFloatBE(value, 0);
    this.buffers.push(buf);
  }

  /**
   * @param {boolean} value
   * @returns {void}
   */
  writeBoolean(value) {
    this.writeByte(value ? 1 : 0);
  }

  /**
   * @param {string} str
   * @returns {void}
   */
  writeUTF(str) {
    const utf8Buffer = Buffer.from(str, "utf8");
    this.writeShort(utf8Buffer.length);
    this.buffers.push(utf8Buffer);
  }

  /**
   * @param {string} str
   * @returns {void}
   */
  writeString(str) {
    this.writeShort(str.length);
    for (let i = 0; i < str.length; i++) {
      const buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(str.charCodeAt(i), 0);
      this.buffers.push(buf);
    }
  }

  /**
   * @param {string} str
   * @returns {void}
   */
  writeUtf(str) {
    this.writeShort(str.length);
    for (let i = 0; i < str.length; i++) {
      this.writeShort(str.charCodeAt(i));
    }
  }

  /**
   * @param {Buffer<ArrayBuffer>} buffer
   * @returns {void}
   */
  writeBytes(buffer) {
    this.buffers.push(buffer);
  }

  /**
   * @returns {Buffer<ArrayBuffer>}
   */
  toBuffer() {
    return Buffer.concat(this.buffers);
  }
}

module.exports = PacketWriter;
/* --------------------------------------------------------------- */
