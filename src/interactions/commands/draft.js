const { Franchise, Player, Team } = require("../../../prisma");

async function draft(tier) {
  draftTeams = Team.filter((t) => t.tier === tier);
  draftPlayers = Player.filter((p) => p.tier === tier);
}
