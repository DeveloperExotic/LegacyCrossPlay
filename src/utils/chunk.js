/* --------------------------------------------------------------- */
/*                            chunk.js                             */
/* --------------------------------------------------------------- */
/**
 * @param {Buffer<ArrayBuffer>} data
 * @returns {Buffer<ArrayBuffer>}
 */
function compressRLE(data) {
  /** @type {number[]} */
  const output = [];
  let i = 0;

  while (i < data.length) {
    /** @type {number} */
    const byte = /** @type {number} */ (data[i]);
    let count = 1;

    while (i + count < data.length && data[i + count] === byte && count < 256) {
      count++;
    }

    if (count <= 3) {
      if (byte === 0xff) {
        output.push(0xff, count - 1);
      } else {
        for (let j = 0; j < count; j++) {
          output.push(byte);
        }
      }
    } else {
      output.push(0xff, count - 1, byte);
    }

    i += count;
  }

  return Buffer.from(output);
}

/**
 * @param {number} n
 * @returns {number}
 */
function countSetBits(n) {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

module.exports = {
  compressRLE,
  countSetBits,
};
/* --------------------------------------------------------------- */
