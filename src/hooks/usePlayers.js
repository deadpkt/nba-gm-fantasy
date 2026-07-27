import { useContext } from "react";
import { PlayersContext } from "../context/PlayersContext";

export default function usePlayers() {
  const playersContext = useContext(PlayersContext);
  if (!playersContext) {
    throw new Error("usePlayers must be used inside PlayersProvider");
  }
  return playersContext;
}
