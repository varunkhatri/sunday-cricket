import PlayerSearch from "@/components/PlayerSearch";
import { aggregatePlayers } from "@/lib/cricket/stats";
import { getPlayers } from "@/lib/data/queries";
import { loadRange } from "@/lib/data/statsLoader";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const [players, { perfs }] = await Promise.all([getPlayers(), loadRange({})]);
  const agg = new Map(aggregatePlayers(perfs).map((a) => [a.playerId, a]));
  return (
    <div className="space-y-4">
      <h1 className="h1">Players</h1>
      <PlayerSearch
        players={players.map((p) => ({ id: p.id, name: p.name, nickname: p.nickname, matches: agg.get(p.id)?.matches ?? 0, runs: agg.get(p.id)?.runs ?? 0, wickets: agg.get(p.id)?.wickets ?? 0 }))}
      />
    </div>
  );
}
