const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

const { FranchiseEmote, TransactionsSubTypes, ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams, Tier } = require(`../../utils/enums`);



const { getAllFranchises, getFranchiseFromSlug, getTeamsFromFranchiseName, getFranchiseFromTeamName, getPlayersOnTeamFromName, getSubList } = require(`../../prisma`);
const { Franchise, Player, Team } = require(`../../prisma`);


const tiers = [ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams];

module.exports = {

    id: `transactionsManager`,

    async execute(interaction, args) {


        switch (Number(args)) {
            case TransactionsSubTypes.FRANCHISE:
                sendTeamOptions(interaction);
                break;

            case TransactionsSubTypes.TEAM:
                sendRosteredPlayerOptions(interaction);
                break

            case TransactionsSubTypes.PLAYER:
                sendAvailableSubs(interaction);
                break

            default:
                break;
        }


    }
};

async function sendTeamOptions(interaction) {
    interaction.deferUpdate();

    const selection = interaction.values[0];
    const embed = interaction.message.embeds[0];


    const franchiseInfo = await Franchise.getBy({slug: selection});
    const franchiseTeams = await Franchise.getTeams({slug: selection});

    embed.fields[0].value = `**Franchise**\n<${FranchiseEmote[selection]}> ${selection} | ${franchiseInfo.name}`;
    console.log(franchiseTeams)

    const embedEdits = new EmbedBuilder(interaction.message.embeds[0]);
    embedEdits.addFields(
        {
            name: `\u200B`,
            value: `\u200B`,
            inline: true
        },
        {
            name: `\u200B`,
            value: `**Team**\nPlease select a team....`,
            inline: true
        }
    );

    // create the string select menu for a user to select a franchise & then add the franchises
    const selectMenu = new StringSelectMenuBuilder({
        customId: `transactions_${TransactionsSubTypes.TEAM}`,
        placeholder: 'Select a team',
        maxValues: 1,
    });

    franchiseTeams.forEach((team) => {
        // Checks to determine if teams are valid/active
        // if team.active = true return

        selectMenu.addOptions({
            label: team.name,
            value: team.name,
            description: `${team.tier} — ${franchiseInfo.name}`,
            emoji: FranchiseEmote[selection],
        })
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    subrow.addComponents(selectMenu);

    interaction.message.edit({ embeds: [embedEdits], components: [subrow] });
}

async function sendRosteredPlayerOptions(interaction) {
    interaction.deferUpdate();
    const selection = interaction.values[0]; // team

    const embed = interaction.message.embeds[0];

    const franchiseSlug = embed.fields[0].value.split(` `)[1] //slug

    // const team = await getPlayersOnTeamFromName(selection)
    const team = await Team.getRoster({name: selection})
    // const players = team.PlayerReplica;
    const players = team.Player;

    embed.fields[2].value = `**Team**\n<${FranchiseEmote[franchiseSlug]}> ${team.name} (${team.tier})`;

    console.log(team)
    // const franchise = await getFranchiseFromTeamName(selection)
    // console.log(franchise)



    // create the string select menu for a user to select a franchise & then add the franchises
    const selectMenu = new StringSelectMenuBuilder({
        customId: `transactions_${TransactionsSubTypes.PLAYER}`,
        placeholder: `Select player(s) to substitute`,
        minValues: 1,
        maxValues: 1,
    });

    players.forEach((player) => {
        // Checks to determine if teams are valid/active
        // if team.active = true return
        const playerAccount = player.Account;
        console.log(playerAccount)

        selectMenu.addOptions({
            label: playerAccount.riotID,
            value: player.id,
            description: `${team.tier} — ${team.name}`,
            emoji: FranchiseEmote[franchiseSlug],
        })
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    subrow.addComponents(selectMenu);




    const embedEdits = new EmbedBuilder(interaction.message.embeds[0]);



    interaction.message.edit({ embeds: [embedEdits], components: [subrow] });








    // console.log()

    // interaction.edit({components: interaction.message.components[0].setdisabled(true)})
    // console.log(interaction.message.components[0].components[0].data.options)
    // console.log(interaction.message.components[0].components[0].data.options.filter(o => o.value == interaction.values[0]))
    // selected franchise
    // const sf = interaction.message.components[0].components[0].data.options.filter(o => o.value == interaction.values[0])[0]


    // // console.log(sf.label)
    // const disabledInteraction = new StringSelectMenuBuilder({
    //     disabled: true,
    //     placeholder: sf.label,
    //     customId: `disabled`,
    //     options: [
    //         {
    //             value: `disabled`,
    //             label: 'disabled'
    //         }
    //     ]
    // })
    // disabledInteraction.setPlaceholder(interaction.data)
    // console.log(interaction)
    // const subrow = new ActionRowBuilder();
    // subrow.addComponents(disabledInteraction);
    // interaction.message.edit({ components: [subrow] })
    // interaction.deferUpdate();


    // const { PLAYERS } = require(`../../utils/enums/transactions`).TransactionsSubTypes;

    // const embed = interaction.message.embeds[0];

    // const team = interaction.values[0];
    // const franchise = embed.fields[0].value;
    // console.log(embed.fields)
    // embed.fields[2].value = team;

    // console.log(`HERE 1`)

    // const embedEdits = new EmbedBuilder(embed);
    // embedEdits.addFields({
    //     name: `Player(s) to subs`,
    //     value: `Please select players...`
    // });

    // // create the string select menu for a user to select a franchise & then add the franchises
    // const selectMenu = new StringSelectMenuBuilder({
    //     customId: `transactions_${PLAYERS}`,
    //     placeholder: `Select a player or players from ${team}`,
    //     minValues: 1,
    //     maxValues: 2,
    // });
    // console.log(`HERE 2`)

    // const users = [`382893405178691584`, `341835747797630986`, `405088084229619715`, `205364070566592513`, `195352519155777536`, `482190906619985930`]

    // const selectMenu =  new UserSelectMenuBuilder({
    //     customId: `transactions_${PLAYERS}`,
    //     placeholder: `Select a player or players from ${team}`,
    //     minValues: 1,
    //     maxValues: 2,

    // })

    // a = franchises[franchise].rosters[team].signed
    // console.log()
    // interaction.client.users.fetch(interaction.member)

    // const rosteredPlayers = Object.values(franchises[franchise].rosters[team].signed);

    // await rosteredPlayers.forEach(async (player) => {
    //     const usr = await interaction.guild.members.fetch(interaction.member);
    //     console.log(player);

    //     selectMenu.addOptions({
    //         label: usr.nickname,
    //         // label: player,
    //         value: player,
    //         description: `${franchise} — ${team}`,
    //         // emoji: FranchiseEmote,
    //     });
    //     // apple.setUs
    // });


    // create the action row, add the component to it & then reply with all the data
    // const subrow = await new ActionRowBuilder();
    // // console.log(subrow)
    // subrow.addComponents(selectMenu);

    // // interaction.message.edit({ embeds: [embedEdits] });
    // // console.log(subrow)
    // interaction.message.edit({ embeds: [embedEdits], components: [subrow] });
}

async function sendAvailableSubs(interaction) {
    interaction.deferUpdate();
    // interaction.reply({content: `ok`, ephemeral: true})
    const selection = interaction.values[0]; // team

    const embed = interaction.message.embeds[0];

    const franchiseSlug = embed.fields[0].value.split(` `)[1] //slug
    await getSubList('Contender')

    // // create the string select menu for a user to select a franchise & then add the franchises
    // const selectMenu = new StringSelectMenuBuilder({
    //     customId: `transactions_${TransactionsSubTypes.SUB}`,
    //     placeholder: `Select substitute(s)`,
    //     minValues: 1,
    //     maxValues: 1,
    // });

    // players.forEach((player) => {
    //     const playerAccount = player.Account;
    //     console.log(playerAccount)

    //     selectMenu.addOptions({
    //         label: playerAccount.riotID,
    //         value: player.id,
    //         description: `${team.tier} — ${team.name}`,
    //         emoji: FranchiseEmote[franchiseSlug],
    //     })
    // })

    // // create the action row, add the component to it & then reply with all the data
    // const subrow = new ActionRowBuilder();
    // subrow.addComponents(selectMenu);




    // const embedEdits = new EmbedBuilder(interaction.message.embeds[0]);



    // interaction.message.edit({ embeds: [embedEdits], components: [subrow] });





}
