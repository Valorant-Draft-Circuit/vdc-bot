const { MapBanType } = require(`@prisma/client`);

/** Derive web veto state from MapBans rows (mirror of vdc-web lib/common/mapbansFlow.ts). */
function deriveVetoState(rowsInput) {
  const rows = [...rowsInput].sort((a, b) => a.order - b.order);

  const nextMapRow = rows.find(
    (r) =>
      r.map == null && (r.type == MapBanType.BAN || r.type == MapBanType.PICK),
  );
  if (nextMapRow) {
    return {
      phase: `map-turns`,
      rows,
      currentRow: nextMapRow,
      actingTeamId: nextMapRow.team,
    };
  }

  const unfilledDefault = rows.find((r) => r.map == null);
  if (unfilledDefault) {
    // web auto-fills these within the same action; transient state, treat as still map-turns with no actor
    return {
      phase: `map-turns`,
      rows,
      currentRow: unfilledDefault,
      actingTeamId: null,
    };
  }

  const sideRows = rows.filter(
    (r) => r.type == MapBanType.PICK || r.type == MapBanType.DECIDER,
  );
  const nextSideRow = sideRows.find((r) => r.side == null);
  if (nextSideRow) {
    return {
      phase: `side-turns`,
      rows,
      currentRow: nextSideRow,
      actingTeamId: sideChooserFor(nextSideRow, rows),
    };
  }

  return { phase: `complete`, rows, currentRow: null, actingTeamId: null };
}

/** The opponent of the row's team picks its side; DECIDER (team null) resolves to the
 *  first distinct non-null team in row order - identical to the bot's live-flow quirk. */
function sideChooserFor(sideRow, allRows) {
  const distinctTeams = Array.from(new Set(allRows.map((r) => r.team)));
  return distinctTeams.find((t) => t != null && t != sideRow.team) ?? null;
}

/** Stable signature of veto progress for change detection. */
function vetoSignature(rows) {
  return [...rows]
    .sort((a, b) => a.order - b.order)
    .map((r) => `${r.order}:${r.map ?? `_`}:${r.side ?? `_`}`)
    .join(`|`);
}

module.exports = { deriveVetoState, sideChooserFor, vetoSignature };
