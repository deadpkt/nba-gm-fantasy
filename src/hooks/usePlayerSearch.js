import { useMemo } from "react";

const normalize = (value) => value.trim().toLocaleLowerCase();

export default function usePlayerSearch(players, search, position = "ALL") {
  const indexedPlayers = useMemo(
    () =>
      players.map((player) => ({
        player,
        searchText: [player.name, player.fullName, player.team, player.position, ...(player.eligiblePositions || [])]
          .join(" ")
          .toLocaleLowerCase(),
      })),
    [players],
  );
  const normalizedSearch = useMemo(() => normalize(search), [search]);

  return useMemo(
    () =>
      indexedPlayers
        .filter(
          ({ player, searchText }) =>
            (position === "ALL" || (player.eligiblePositions || [player.position]).includes(position)) &&
            (!normalizedSearch || searchText.includes(normalizedSearch)),
        )
        .map(({ player }) => player),
    [indexedPlayers, normalizedSearch, position],
  );
}
