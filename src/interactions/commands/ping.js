const { ChatInputCommandInteraction } = require(`discord.js`);
const { prisma } = require("../../../prisma/prismadb");
const { performance } = require('node:perf_hooks');

module.exports = {

    name: `ping`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        // Measure the time taken to send the message
        await interaction.deferReply();
        const sent = await interaction.fetchReply();
        const discordLatency = sent.createdTimestamp - interaction.createdTimestamp;

        // Start timing full logic
        const startTime = performance.now();

        // Cold start warmup
        await prisma.$queryRaw`SELECT 1`;

        // Actual query
        const dbStart = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Math.round(performance.now() - dbStart);

        // Total code latency
        const codeLatency = Math.round(performance.now() - startTime);
        

        await interaction.editReply({
            content: `Pong!\n📡 Discord latency: ${discordLatency}ms - time from command received to reply saved.\n🗄️ DB latency: ${dbLatency}ms - Prisma query time to the database.\n⏱️ Code+API time: ${codeLatency}ms - total command execution time.`
        });


        // return await interaction.reply({ content: `Pong!` });
    }
};