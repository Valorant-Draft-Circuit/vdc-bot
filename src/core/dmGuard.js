const { DMChannel, UserManager, RESTJSONErrorCodes } = require(`discord.js`);

/**
 * Development bots run against prod-synced data, so any DM they send reaches a real league member.
 * Outside production every DM is blocked unless `DEV_DMS_ENABLED=true`. A blocked DM rejects with
 * Discord's "Cannot send messages to this user" error, so callers take the same path they already
 * take for a member with DMs closed.
 * @returns {Boolean} whether the guard was installed
 */
function installDevDmGuard() {
    if (Boolean(Number(process.env.PROD))) return false;

    if ((/true/i).test(process.env.DEV_DMS_ENABLED)) {
        logger.log(`WARNING`, `DEV_DMS_ENABLED is true: the development bot will DM real users`);
        return false;
    }

    // user.send(), member.send() and client.users.send() all open the DM through UserManager#createDM;
    // DMChannel#send covers DM channels that are already open (e.g. replying inside a DM)
    UserManager.prototype.createDM = async function (user) {
        return blockDM(this.resolveId(user));
    };
    DMChannel.prototype.send = async function () {
        let recipientID;
        try { recipientID = this.recipientId; } catch { recipientID = `unknown recipient`; }
        return blockDM(recipientID);
    };

    logger.log(`INFO`, `Development DM guard active: DMs are blocked (set DEV_DMS_ENABLED=true to allow)`);
    return true;
}

function blockDM(recipientID) {
    logger.log(`DEBUG`, `Blocked a DM to \`${recipientID}\` (development DM guard)`);

    const error = new Error(`DMs are blocked on the development bot (set DEV_DMS_ENABLED=true to allow)`);
    error.code = RESTJSONErrorCodes.CannotSendMessagesToThisUser;
    throw error;
}

module.exports = { installDevDmGuard };
