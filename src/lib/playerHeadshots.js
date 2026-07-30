export const PLAYER_HEADSHOT_PLACEHOLDER = "/player-placeholder.svg";

const usableUrl = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

export function resolvePlayerHeadshot(player) {
  const storedUrl = usableUrl(player?.headshot?.storageUrl);
  if (storedUrl) return storedUrl;
  const canonicalUrl = usableUrl(player?.imageUrl);
  if (canonicalUrl) return canonicalUrl;
  const legacyUrl = usableUrl(player?.image);
  if (legacyUrl) return legacyUrl;

  const nbaPlayerId = player?.nbaPlayerId ?? player?.headshot?.nbaPlayerId ?? player?.source?.nbaPlayerId;
  if (nbaPlayerId) return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`;
  return PLAYER_HEADSHOT_PLACEHOLDER;
}

export function handleBrokenPlayerHeadshot(event) {
  const image = event?.currentTarget;
  if (!image || image.src.endsWith(PLAYER_HEADSHOT_PLACEHOLDER)) return;
  image.onerror = null;
  image.src = PLAYER_HEADSHOT_PLACEHOLDER;
}
