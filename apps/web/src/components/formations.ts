import type { MatchPlayer, MatchTeam } from "./types";

/**
 * Describes where a named position sits on the pitch.
 *
 * - `depthTier`  – how far up the pitch (0 = GK, 1 = defence … 5 = forward).
 *                  Used to sort players back-to-front before assigning them to
 *                  the formation lines encoded in the formation digits.
 * - `lateralOrder` – left-to-right ordering within the same formation line
 *                    (0 = far left, 4 = far right). Used to spread players
 *                    correctly across the width of the pitch.
 */
export interface PositionDescriptor {
  depthTier: number;
  lateralOrder: number;
}

/** Depth tiers (back → front). */
export const Depth = {
  GK: 0,
  DEF: 1,
  DEF_WIDE: 1.5, // wing-backs sit between DEF and DEF_MID
  DEF_MID: 2,
  MID: 3,
  ATT_MID: 4,
  FWD: 5,
} as const;

/** Lateral slots (left → right). */
export const Lateral = {
  LEFT: 0,
  LEFT_CENTER: 1,
  CENTER: 2,
  RIGHT_CENTER: 3,
  RIGHT: 4,
} as const;

/**
 * Exhaustive map of every StatsBomb position name to its pitch descriptor.
 * Add new entries here if the data source introduces additional positions.
 */
export const POSITION_MAP: Record<string, PositionDescriptor> = {
  // Goalkeeper
  "Goalkeeper":                 { depthTier: Depth.GK,      lateralOrder: Lateral.CENTER },

  // Defence
  "Left Back":                  { depthTier: Depth.DEF,     lateralOrder: Lateral.LEFT },
  "Left Center Back":           { depthTier: Depth.DEF,     lateralOrder: Lateral.LEFT_CENTER },
  "Center Back":                { depthTier: Depth.DEF,     lateralOrder: Lateral.CENTER },
  "Right Center Back":          { depthTier: Depth.DEF,     lateralOrder: Lateral.RIGHT_CENTER },
  "Right Back":                 { depthTier: Depth.DEF,     lateralOrder: Lateral.RIGHT },

  // Wing-backs (between defence and midfield)
  "Left Wing Back":             { depthTier: Depth.DEF_WIDE, lateralOrder: Lateral.LEFT },
  "Right Wing Back":            { depthTier: Depth.DEF_WIDE, lateralOrder: Lateral.RIGHT },

  // Defensive midfield
  "Left Defensive Midfield":    { depthTier: Depth.DEF_MID, lateralOrder: Lateral.LEFT },
  "Center Defensive Midfield":  { depthTier: Depth.DEF_MID, lateralOrder: Lateral.CENTER },
  "Right Defensive Midfield":   { depthTier: Depth.DEF_MID, lateralOrder: Lateral.RIGHT },

  // Midfield
  "Left Midfield":              { depthTier: Depth.MID,     lateralOrder: Lateral.LEFT },
  "Left Center Midfield":       { depthTier: Depth.MID,     lateralOrder: Lateral.LEFT_CENTER },
  "Center Midfield":            { depthTier: Depth.MID,     lateralOrder: Lateral.CENTER },
  "Right Center Midfield":      { depthTier: Depth.MID,     lateralOrder: Lateral.RIGHT_CENTER },
  "Right Midfield":             { depthTier: Depth.MID,     lateralOrder: Lateral.RIGHT },

  // Attacking midfield
  "Left Attacking Midfield":    { depthTier: Depth.ATT_MID, lateralOrder: Lateral.LEFT },
  "Center Attacking Midfield":  { depthTier: Depth.ATT_MID, lateralOrder: Lateral.CENTER },
  "Right Attacking Midfield":   { depthTier: Depth.ATT_MID, lateralOrder: Lateral.RIGHT },

  // Forward
  "Left Center Forward":        { depthTier: Depth.FWD,     lateralOrder: Lateral.LEFT_CENTER },
  "Center Forward":             { depthTier: Depth.FWD,     lateralOrder: Lateral.CENTER },
  "Right Center Forward":       { depthTier: Depth.FWD,     lateralOrder: Lateral.RIGHT_CENTER },
  "Left Wing":                  { depthTier: Depth.FWD,     lateralOrder: Lateral.LEFT },
  "Right Wing":                 { depthTier: Depth.FWD,     lateralOrder: Lateral.RIGHT },
};

const DEFAULT_DESCRIPTOR: PositionDescriptor = {
  depthTier: Depth.FWD,
  lateralOrder: Lateral.CENTER,
};

export function getDescriptor(position: string): PositionDescriptor {
  return POSITION_MAP[position] ?? DEFAULT_DESCRIPTOR;
}

/** Parse formation int (e.g. 442) into digit array [4,4,2]. */
export function parseFormation(formation: number): number[] {
  if (formation <= 0) return [];
  return String(formation)
    .split("")
    .map(Number)
    .filter((d) => d > 0);
}

/** Display formation like "4-4-2". */
export function formatFormation(formation: number): string {
  const digits = parseFormation(formation);
  return digits.length > 0 ? digits.join("-") : String(formation);
}

/**
 * Build positional map for every player in a team, using the formation digits
 * to decide how many lines exist and how many players per line.
 *
 * Returns a Map from player name → { left%, top% }.
 */
export function buildFormationPositions(
  team: MatchTeam,
  teamIndex: number,
): Map<string, { left: string; top: string }> {
  const positions = new Map<string, { left: string; top: string }>();
  const digits = parseFormation(team.formation);

  // Separate GK from outfield using the descriptor
  const gk = team.players.filter(
    (p) => getDescriptor(p.position ?? "").depthTier === Depth.GK,
  );
  const outfield = team.players
    .filter((p) => getDescriptor(p.position ?? "").depthTier !== Depth.GK)
    .sort((a, b) => {
      const da = getDescriptor(a.position ?? "");
      const db = getDescriptor(b.position ?? "");
      return da.depthTier - db.depthTier || da.lateralOrder - db.lateralOrder;
    });

  // Place goalkeeper(s)
  const gkX = teamIndex === 0 ? 6 : 94;
  gk.forEach((p) => {
    positions.set(p.name, { left: `${gkX}%`, top: "50%" });
  });

  // Determine outfield lines from formation digits
  const lines: number[] = digits.length > 0 ? digits : [4, 3, 3]; // fallback

  // Distribute outfield players across the formation lines.
  // Players are already sorted by depthTier then lateralOrder, so we
  // assign greedily from most defensive to most attacking.
  const lineAssignments: MatchPlayer[][] = lines.map(() => []);
  let playerIdx = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const count = lines[lineIdx];
    for (let i = 0; i < count && playerIdx < outfield.length; i++) {
      lineAssignments[lineIdx].push(outfield[playerIdx]);
      playerIdx++;
    }
  }
  // Any remaining players go into the last line
  while (playerIdx < outfield.length) {
    lineAssignments[lineAssignments.length - 1].push(outfield[playerIdx]);
    playerIdx++;
  }

  // Sort each line by lateralOrder so players spread left → right
  for (const line of lineAssignments) {
    line.sort(
      (a, b) =>
        getDescriptor(a.position ?? "").lateralOrder -
        getDescriptor(b.position ?? "").lateralOrder,
    );
  }

  // X positions for each line, spread across the team's half.
  // Team 0 plays left-to-right (x: 15-48%), Team 1 plays right-to-left (x: 85-52%).
  const lineCount = lines.length;
  for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
    const t = lineCount === 1 ? 0.5 : lineIdx / (lineCount - 1);
    const xPct =
      teamIndex === 0
        ? 15 + t * 33 // 15% → 48%
        : 85 - t * 33; // 85% → 52%

    const playersInLine = lineAssignments[lineIdx];
    const lineSize = playersInLine.length;

    playersInLine.forEach((player, idx) => {
      // Spread vertically within the line
      const yPct =
        lineSize === 1
          ? 50
          : 15 + (idx / (lineSize - 1)) * 70; // 15% → 85%

      positions.set(player.name, {
        left: `${xPct}%`,
        top: `${yPct}%`,
      });
    });
  }

  return positions;
}

