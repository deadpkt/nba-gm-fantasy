import {
  handleBrokenPlayerHeadshot,
  resolvePlayerHeadshot,
} from "../../lib/playerHeadshots";

function PlayerImage({
  player,
  alt,
  loading = "lazy",
  decoding = "async",
  ...props
}) {
  return (
    <img
      {...props}
      loading={loading}
      decoding={decoding}
      src={resolvePlayerHeadshot(player)}
      alt={alt ?? player?.name ?? ""}
      onError={handleBrokenPlayerHeadshot}
    />
  );
}

export default PlayerImage;
