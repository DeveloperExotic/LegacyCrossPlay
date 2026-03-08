/* --------------------------------------------------------------- */
/*                           idmappers.js                          */
/* --------------------------------------------------------------- */
const { mapJavaBlockToLCE: mapBlockId } = require("./mappers");

function mapJavaEntityIdToLce(client, javaEntityId) {
  if (!client.javaToLceEntityId.has(javaEntityId)) {
    const lceEntityId = client.nextLceEntityId++;
    if (lceEntityId > 32767) {
      return 100;
    }
    client.javaToLceEntityId.set(javaEntityId, lceEntityId);
  }
  return client.javaToLceEntityId.get(javaEntityId);
}

function mapJavaBlockToLCE(javaBlockId) {
  return mapBlockId(javaBlockId);
}

function mapJavaParticleToLCE(particleId) {
  const particleMap = {};
  return particleMap[particleId] || "";
}

module.exports = {
  mapJavaEntityIdToLce,
  mapJavaBlockToLCE,
  mapJavaParticleToLCE,
};
/* --------------------------------------------------------------- */
