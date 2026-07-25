const { prisma } = require(`../../../prisma/prismadb`);

/** Shared accolade definition map (emote + readable + title + description).
 * The `readable` string is the season/tier-independent value stored in the
 * Accolades.accolade column and used as the idempotency key. */
function decodeAccoladeData(shorthand, tier, season) {
  const defs = {
    WIN: {
      readable: `Winner`,
      emote: `🏆`,
      title: `Grand Finals Winner`,
      description: `Player for the Winning Season ${season} ${tier} Team`,
    },
    WIN_FM: {
      readable: `Franchise Management`,
      emote: `👑`,
      title: `Franchise Management for a Winning Grand Finals Team`,
      description: `Franchise Manager for the Winning Season ${season} ${tier} Team`,
    },
    WIN_SUB: {
      readable: `Substitute`,
      emote: `🥈`,
      title: `Substitute for a Player in a Grand Finals Match`,
      description: `Substitute for the Winning Season ${season} ${tier} Team during Grand Finals`,
    },
    AST: {
      readable: `All Star`,
      emote: `⭐`,
      title: `All Star`,
      description: `All Star for Season ${season} ${tier} Tier`,
    },
    MVP: {
      readable: `MVP`,
      emote: `🏅`,
      title: `Most Valuable Player`,
      description: `MVP of ${tier} Season ${season}`,
    },
    PICKEM_1ST: {
      readable: `Pick'Ems 1st`,
      emote: ``,
      title: `Pick'Ems Overall 1st Place`,
      description: `1st place overall in Season ${season} VDC Pick'Ems`,
    },
    PICKEM_2ND: {
      readable: `Pick'Ems 2nd`,
      emote: ``,
      title: `Pick'Ems Overall 2nd Place`,
      description: `2nd place overall in Season ${season} VDC Pick'Ems`,
    },
    PICKEM_3RD: {
      readable: `Pick'Ems 3rd`,
      emote: ``,
      title: `Pick'Ems Overall 3rd Place`,
      description: `3rd place overall in Season ${season} VDC Pick'Ems`,
    },
    PICKEM_TIER_WINNER: {
      readable: `Pick'Ems Tier Winner`,
      emote: ``,
      title: `Pick'Ems Tier Winner`,
      description: `Winner of Season ${season} ${tier} VDC Pick'Ems`,
    },
    PICKEM_TOP_GROUP: {
      readable: `Top Pick'Ems Group`,
      emote: ``,
      title: `Top Pick'Ems Group`,
      description: `Member of the top Season ${season} VDC Pick'Ems group`,
    },
  };

  return defs[shorthand];
}

/** Create an accolade only if the player doesn't already hold it, so callers
 * (including bulk championship awards) are safe to re-run.
 * @returns {Promise<{ created: boolean }>}
 */
async function awardAccoladeIfAbsent({ userID, season, tier, shorthand }) {
  const readable = decodeAccoladeData(shorthand).readable;
  const seasonNumber = Number(season);

  const existing = await prisma.accolades.findFirst({
    where: {
      userID: userID,
      season: seasonNumber,
      tier: tier,
      shorthand: shorthand,
      accolade: readable,
    },
  });
  if (existing != null) return { created: false };

  await prisma.accolades.create({
    data: {
      userID: userID,
      season: seasonNumber,
      tier: tier,
      shorthand: shorthand,
      accolade: readable,
    },
  });
  return { created: true };
}

module.exports = { decodeAccoladeData, awardAccoladeIfAbsent };
