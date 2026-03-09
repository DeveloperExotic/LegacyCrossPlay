/* --------------------------------------------------------------- */
/*                        translations.js                          */
/* --------------------------------------------------------------- */
/**
 * @param {string} key
 * @param {unknown[]} args
 */
function getTranslation(key, args = []) {
  /** @type {Record<string, (...args: unknown[]) => string>} */
  const translations = {};

  const translationFunc = translations[key];
  if (translationFunc) {
    return translationFunc(args);
  }

  if (args.length > 0) {
    return `${key}: ${args.join(" ")}`;
  }
  return key;
}

module.exports = { getTranslation };
/* --------------------------------------------------------------- */
