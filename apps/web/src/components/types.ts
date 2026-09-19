export type Point = [number, number];

export interface Event {
  minute: number;
  second: number;
  type: string;
  team: string;
  player: string;
  startLocation?: Point;
  endLocation?: Point;
}

export interface MatchPlayer {
  name: string;
  position?: string;
  jerseyNumber: number;
}

export interface MatchTeam {
  name: string;
  formation: number;
  players: MatchPlayer[];
}

export interface MatchInfo {
  type: "MATCH_INFO";
  teams: MatchTeam[];
}

export interface TickFrame {
  type: "TICK";
  data: Event;
  index: number;
  total: number;
}

export type StreamFrame = TickFrame | MatchInfo;

export interface Visual {
  type: string;
  start: { x: number; y: number };
  end?: { x: number; y: number };
  color: string;
  startTime: number;
  duration: number;
}

export function normalizeMatchTeams(teams: unknown): MatchTeam[] {
  if (!Array.isArray(teams)) return [];

  return teams.flatMap((team) => {
    if (!team || typeof team !== "object") return [];
    const value = team as {
      name?: unknown;
      formation?: unknown;
      players?: unknown;
    };
    const rawPlayers = Array.isArray(value.players) ? value.players : [];
    const players: MatchPlayer[] = rawPlayers.flatMap((player) => {
      if (typeof player === "string") {
        return [{ name: player, jerseyNumber: 0 }];
      }
      if (!player || typeof player !== "object") return [];
      const entry = player as Partial<MatchPlayer>;
      if (!entry.name) return [];
      return [
        {
          name: entry.name,
          position: entry.position ?? "",
          jerseyNumber: entry.jerseyNumber ?? 0,
        },
      ];
    });
    return [
      {
        name: typeof value.name === "string" ? value.name : "Unknown team",
        formation: typeof value.formation === "number" ? value.formation : 0,
        players,
      },
    ];
  });
}

/**
 * Derive a short display name from a full legal name.
 *
 * StatsBomb names are full legal names (e.g. "Lionel Andrés Messi Cuccittini").
 * In Spanish/Portuguese naming, the structure is typically:
 *   FirstName [MiddleNames] PaternalSurname MaternalSurname
 *
 * We pick: first name + paternal surname (second-to-last word) for 3+ word
 * names, which gives "Lionel Messi" instead of "Cuccittini".
 *
 * Name particles (ter, van, de, i, di, etc.) are not treated as standalone
 * surnames — we include them with the following word or fall back further.
 */
const NAME_PARTICLES = new Set([
  "de", "del", "di", "da", "do", "dos", "das",
  "van", "von", "ter", "ten",
  "el", "al", "la", "le",
  "i", "y", "e",
]);

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;

  // Walk backwards to find the paternal surname (second-to-last non-particle).
  // If the second-to-last word is a particle, include it + everything after it.
  const firstName = parts[0];
  const surnameStart = parts.length - 2;

  if (NAME_PARTICLES.has(parts[surnameStart].toLowerCase())) {
    // Particle found — include from the particle onward (e.g. "ter Stegen")
    // But check if the word before the particle is also significant
    // For "Sergio Busquets i Burgos": particle is "i" at index 2,
    // so take index 1 = "Busquets"
    const fallback = surnameStart - 1;
    if (fallback >= 1 && !NAME_PARTICLES.has(parts[fallback].toLowerCase())) {
      return `${firstName} ${parts[fallback]}`;
    }
    // Otherwise include particle + rest (e.g. "Marc-André ter Stegen")
    return `${firstName} ${parts.slice(surnameStart).join(" ")}`;
  }

  return `${firstName} ${parts[surnameStart]}`;
}
