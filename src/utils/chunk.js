/* --------------------------------------------------------------- */
/*                            chunk.js                             */
/* --------------------------------------------------------------- */
function compressRLE(data) {
  const output = [];
  let i = 0;

  while (i < data.length) {
    const byte = data[i];
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
