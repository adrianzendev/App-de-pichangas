const { randomUUID } = require("node:crypto");

// UUID aleatorio por usuario virtual: no existe en la base, asi que
// markMessagesAsDelivered no toca mensajes reales.
module.exports = {
  setSyntheticUser(context, _events, done) {
    context.vars.userId = randomUUID();
    done();
  },
};
