/* --------------------------------------------------------------- */
/*                             skins.js                            */
/* --------------------------------------------------------------- */
const https = require("https");
const http = require("http");
const { PNG } = require("pngjs");

const skinCache = new Map();

function convertSkinTo64x32(skinBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const png = PNG.sync.read(skinBuffer);

      if (png.height === 32) {
        resolve(skinBuffer);
        return;
      }

      const newPng = new PNG({ width: 64, height: 32 });
      newPng.data.fill(0);

      function copy(sx, sy, w, h, dx, dy) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcIdx = ((sy + y) * 64 + (sx + x)) << 2;
            const dstIdx = ((dy + y) * 64 + (dx + x)) << 2;
            newPng.data[dstIdx] = png.data[srcIdx];
            newPng.data[dstIdx + 1] = png.data[srcIdx + 1];
            newPng.data[dstIdx + 2] = png.data[srcIdx + 2];
            newPng.data[dstIdx + 3] = png.data[srcIdx + 3];
          }
        }
      }

      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 64; x++) {
          const idx = (y * 64 + x) << 2;
          newPng.data[idx] = 0;
          newPng.data[idx + 1] = 0;
          newPng.data[idx + 2] = 0;
          newPng.data[idx + 3] = 0;
        }
      }

      copy(0, 0, 64, 16, 0, 0);
      copy(16, 16, 16, 16, 16, 16);
      copy(32, 16, 16, 16, 32, 16);
      copy(0, 16, 16, 16, 0, 16);
      copy(40, 16, 16, 16, 40, 16);
      copy(20, 16, 8, 4, 20, 16);
      copy(28, 16, 8, 4, 28, 16);
      copy(20, 20, 8, 12, 20, 20);
      copy(28, 20, 8, 12, 28, 20);
      copy(4, 16, 4, 4, 4, 16);
      copy(8, 16, 4, 4, 8, 16);
      copy(4, 20, 4, 12, 4, 20);
      copy(8, 20, 4, 12, 8, 20);
      copy(44, 16, 4, 4, 44, 16);
      copy(48, 16, 4, 4, 48, 16);
      copy(44, 20, 4, 12, 44, 20);
      copy(48, 20, 4, 12, 48, 20);

      copy(32, 0, 32, 16, 32, 0);

      resolve(PNG.sync.write(newPng));
    } catch (err) {
      reject(err);
    }
  });
}

function downloadSkin(url) {
  return new Promise((resolve, reject) => {
    if (skinCache.has(url)) {
      resolve(skinCache.get(url));
      return;
    }

    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const skinData = Buffer.concat(chunks);
          convertSkinTo64x32(skinData)
            .then((convertedSkin) => {
              skinCache.set(url, convertedSkin);
              resolve(convertedSkin);
            })
            .catch(reject);
        });
      })
      .on("error", reject);
  });
}

function generateCustomSkinName(playerName) {
  let hash = 0;
  for (let i = 0; i < playerName.length; i++) {
    hash = (hash << 5) - hash + playerName.charCodeAt(i);
    hash = hash & hash;
  }
  const skinId = (Math.abs(hash) & 0x7fffffe0) | 0x20;
  return `ugcskin${skinId.toString(16).toUpperCase().padStart(8, "0")}.png`;
}

module.exports = {
  downloadSkin,
  generateCustomSkinName,
  skinCache,
};
/* --------------------------------------------------------------- */
