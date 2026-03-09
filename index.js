/* --------------------------------------------------------------- */
/*                           index.js                              */
/* --------------------------------------------------------------- */
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning") return;
  console.warn(warning.name, warning.message);
});

const LCEProxy = require("./src/lceproxy");

const proxy = new LCEProxy();

(async () => {
  await proxy.start();
})();

process.on("SIGINT", () => {
  proxy.stop();
  process.exit(0);
});
/* --------------------------------------------------------------- */
