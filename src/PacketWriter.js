/* --------------------------------------------------------------- */
/*                        packetwriter.js                          */
/* --------------------------------------------------------------- */
class PacketWriter {
  constructor() {
    this.buffers = [];
  }

  writeByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeUInt8(value, 0);
    this.buffers.push(buf);
  }

  writeSignedByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeInt8(value, 0);
    this.buffers.push(buf);
  }

  writeSignedByte(value) {
    const buf = Buffer.allocUnsafe(1);
    buf.writeInt8(value, 0);
    this.buffers.push(buf);
  }

  writeShort(value) {
    const buf = Buffer.allocUnsafe(2);
    buf.writeInt16BE(value, 0);
    this.buffers.push(buf);
  }

  writeInt(value) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(value, 0);
    this.buffers.push(buf);
  }

  writeLong(value) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigInt64BE(BigInt(value), 0);
    this.buffers.push(buf);
  }

  writeDouble(value) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleBE(value, 0);
    this.buffers.push(buf);
  }

  writeFloat(value) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeFloatBE(value, 0);
    this.buffers.push(buf);
  }

  writeBoolean(value) {
    this.writeByte(value ? 1 : 0);
  }

  writeUTF(str) {
    const utf8Buffer = Buffer.from(str, "utf8");
    this.writeShort(utf8Buffer.length);
    this.buffers.push(utf8Buffer);
  }

  writeString(str) {
    this.writeShort(str.length);
    for (let i = 0; i < str.length; i++) {
      const buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(str.charCodeAt(i), 0);
      this.buffers.push(buf);
    }
  }

  writeUtf(str) {
    this.writeShort(str.length);
    for (let i = 0; i < str.length; i++) {
      this.writeShort(str.charCodeAt(i));
    }
  }

  writeBytes(buffer) {
    this.buffers.push(buffer);
  }

  toBuffer() {
    return Buffer.concat(this.buffers);
  }
}

module.exports = PacketWriter;
/* --------------------------------------------------------------- */
