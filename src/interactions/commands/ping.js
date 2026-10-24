const { ChatInputCommandInteraction } = require(`discord.js`);
const { prisma } = require("../../../prisma/prismadb");
const { performance } = require('node:perf_hooks');

const REPO_URL = `https://github.com/Valorant-Draft-Circuit/vdc-bot`;

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


        const sslCipherRows = await prisma.$queryRaw`SHOW STATUS LIKE 'Ssl_cipher';`;
        const sslVersionRows = await prisma.$queryRaw`SHOW STATUS LIKE 'Ssl_version';`;
    

        const cipherValue = sslCipherRows?.[0]?.Value;
        const versionValue = sslVersionRows?.[0]?.Value;

        const sslCipher = (cipherValue === '') ? 'N/A' : cipherValue;
        const sslVersion = (versionValue === '') ? 'N/A' : versionValue;

        // the commit CI built this image from (also its sha- image tag); local builds don't have one
        const commit = process.env.GIT_SHA;
        const build = commit ? `[\`${commit.slice(0, 7)}\`](<${REPO_URL}/commit/${commit}>)` : `local build (no commit)`;

        await interaction.editReply({
            content: `Pong!\n📡 Discord latency: ${discordLatency}ms - time from command received to reply saved.\n🗄️ DB latency: ${dbLatency}ms - Prisma query time to the database.\n⏱️ Code+API time: ${codeLatency}ms - total command execution time.\n🔒 SSL Cypher: \`${sslCipher}\`\n🔑 SSL Version: \`${sslVersion}\`\n🏷️ Version: ${build}`
        });


        // return await interaction.reply({ content: `Pong!` });
    }
};