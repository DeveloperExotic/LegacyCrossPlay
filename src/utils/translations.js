/* --------------------------------------------------------------- */
/*                        translations.js                          */
/* --------------------------------------------------------------- */
function getTranslation(key, args = []) {
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
