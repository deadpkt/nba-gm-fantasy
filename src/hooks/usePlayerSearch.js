import { useMemo } from "react";

const normalize = (value) => value.trim().toLocaleLowerCase();

export default function usePlayerSearch(players, search, position = "ALL") {
  const indexedPlayers = useMemo(
    () =>
      players.map((player) => ({
        player,
        searchText: [player.name, player.team, player.position]
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
            (position === "ALL" || player.position === position) &&
            (!normalizedSearch || searchText.includes(normalizedSearch)),
        )
        .map(({ player }) => player),
    [indexedPlayers, normalizedSearch, position],
  );
}
