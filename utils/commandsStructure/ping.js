/** @enum {Number} Pull the enums from ApplicationCommandOptionType */
const {
    Subcommand, SubcommandGroup, String, Integer, Boolean,
    User, Channel, Role, Mentionable, Number, Attachment 
} = require(`discord.js`).ApplicationCommandOptionType;

module.exports = {
    name : "ping",
    description : "Ping the bot!"
}
