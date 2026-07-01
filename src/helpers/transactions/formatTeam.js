const TIER_LABELS = {
  RECRUIT: `Recruit`,
  PROSPECT: `Prospect`,
  APPRENTICE: `Apprentice`,
  EXPERT: `Expert`,
  MYTHIC: `Mythic`,
  MIXED: `Mixed`,
};

function tierLabel(tier) {
  return TIER_LABELS[tier] ?? tier;
}

function formatTeamWithTier(team) {
  return `${team.name} (${tierLabel(team.tier)})`;
}

module.exports = { tierLabel, formatTeamWithTier };
