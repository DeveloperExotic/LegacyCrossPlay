/* --------------------------------------------------------------- */
/*                         packetreader.js                         */
/* --------------------------------------------------------------- */
class PacketReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readByte() {
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUnsignedByte() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readShort() {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt() {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readLong() {
    const value = this.buffer.readBigInt64BE(this.offset);
    this.offset += 8;
    return value;
  }

  readFloat() {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  readBoolean() {
    return this.readByte() !== 0;
  }

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

  readUtf() {
    const length = this.readShort();
    let str = "";
    for (let i = 0; i < length; i++) {
      const charCode = this.buffer.readUInt16BE(this.offset);
      this.offset += 2;
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  readDouble() {
    const value = this.buffer.readDoubleBE(this.offset);
    this.offset += 8;
    return value;
  }

  readFloat() {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  skip(bytes) {
    this.offset += bytes;
  }
}

module.exports = PacketReader;
/* --------------------------------------------------------------- */
