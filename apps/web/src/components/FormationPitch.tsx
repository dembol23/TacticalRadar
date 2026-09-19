import type { MatchTeam } from "./types";
import { shortName } from "./types";
import { buildFormationPositions, formatFormation } from "./formations";

interface FormationPitchProps {
  teams: MatchTeam[];
}

export default function FormationPitch({ teams }: FormationPitchProps) {
  if (teams.length < 2) return null;

  return (
    <section className="w-full max-w-225 rounded-lg border border-gray-700 bg-gray-800/80 p-5">
      {/* Match header */}
      <div className="mb-4 flex items-center justify-center gap-4 text-xl font-semibold text-white">
        <span>{teams[0].name}</span>
        <span className="text-sm font-normal uppercase tracking-[0.2em] text-gray-500">
          vs
        </span>
        <span>{teams[1].name}</span>
      </div>

      {/* Formation diagrams — side by side */}
      <div className="grid grid-cols-2 gap-4">
        {teams.slice(0, 2).map((team, teamIndex) => {
          const posMap = buildFormationPositions(team, teamIndex);

          return (
            <div key={team.name}>
              <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-gray-300">
                {team.name}{" "}
                {team.formation
                  ? `(${formatFormation(team.formation)})`
                  : ""}
              </h2>

              {/* Mini pitch */}
              <div className="relative aspect-[3/4] w-full rounded border border-gray-600 bg-[#1a3a1a]">
                {/* Pitch markings */}
                <div className="absolute inset-0">
                  {/* Halfway line */}
                  <div className="absolute left-0 right-0 top-1/2 border-t border-white/20" />
                  {/* Center circle */}
                  <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
                  {/* Penalty area top */}
                  <div className="absolute left-1/2 top-0 h-[12%] w-[60%] -translate-x-1/2 border-b border-l border-r border-white/20" />
                  {/* Penalty area bottom */}
                  <div className="absolute bottom-0 left-1/2 h-[12%] w-[60%] -translate-x-1/2 border-l border-r border-t border-white/20" />
                </div>

                {/* Player dots */}
                {team.players.map((player) => {
                  const pos = posMap.get(player.name);
                  if (!pos) return null;

                  // Convert the horizontal (left%) layout to vertical for
                  // single-team portrait pitch: left% → top%, top% → left%
                  const leftPct = parseFloat(pos.left);
                  const topPct = parseFloat(pos.top);

                  // For team 0 the positions go 6%..48% (GK..FWD),
                  // for team 1 they go 94%..52%. Normalise both to 0..1
                  // (GK at goal line, FWD toward center) then map to
                  // top: 90% (GK) → 10% (FWD).
                  const depthNorm =
                    teamIndex === 0
                      ? (leftPct - 6) / (48 - 6)
                      : (94 - leftPct) / (94 - 52);
                  const yPct = 90 - depthNorm * 80; // 90% (GK) → 10% (FWD)
                  const xPct = topPct; // lateral stays the same

                  return (
                    <div
                      key={player.name}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    >
                      <div
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white shadow-lg ${
                          teamIndex === 0
                            ? "border-red-300 bg-red-700"
                            : "border-blue-300 bg-blue-700"
                        }`}
                      >
                        {player.jerseyNumber || "?"}
                      </div>
                      <span className="mt-0.5 block max-w-20 truncate rounded bg-black/70 px-1 text-[9px] leading-tight text-white">
                        {shortName(player.name)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Player list */}
              <ul className="mt-2 space-y-0.5 text-xs text-gray-400">
                {team.players.map((player) => (
                  <li key={player.name}>
                    {player.jerseyNumber ? `${player.jerseyNumber}. ` : ""}
                    {player.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

