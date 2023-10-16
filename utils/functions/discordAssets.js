const { User, GuildMember, ClientUser } = require("discord.js");

const avatarsURL = `https://cdn.discordapp.com/avatars/`;


module.exports = class DiscordAssets{

    /**
     * 
     * @param {User|GuildMember} user 
     */
    static getPlayerAvatar(arg) {
        if (!(arg instanceof User || arg instanceof GuildMember)) throw new Error(`Argument isn't a Discord User or GuildMember Object`);


        let user;

        if (arg instanceof User) user = arg;
        if (arg instanceof GuildMember) user = arg.user;
        
        // console.log('clientuser? : ', arg instanceof ClientUser)
        // console.log('user?       : ', arg instanceof User)
        // console.log('guildmem?   : ', arg instanceof GuildMember)
        // console.log(user);

        return `${avatarsURL}/${user.id}/${user.avatar}`;
    }
}