/* --------------------------------------------------------------- */
/*                            utils.js                             */
/* --------------------------------------------------------------- */
function encodeVarInt(value) {
  const bytes = [];
  do {
    let temp = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      temp |= 0x80;
    }
    bytes.push(temp);
  } while (value !== 0);
  return Buffer.from(bytes);
}

module.exports = {
  encodeVarInt,
};
/* --------------------------------------------------------------- */
