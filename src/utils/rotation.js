/* --------------------------------------------------------------- */
/*                          rotation.js                            */
/* --------------------------------------------------------------- */
function normalizeYaw(yaw) {
  let normalized = yaw % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

module.exports = {
  normalizeYaw,
};
/* --------------------------------------------------------------- */
