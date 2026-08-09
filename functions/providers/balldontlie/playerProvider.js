import { fetchAllCursorPages, loadProviderDirectory } from "./client.js";
import { normalizePlayerName, normalizePosition, resolveHeadshotEnrichment } from "../../shared/nbaCatalog.js";
import { normalizeSeasonStatRecord } from "../../shared/seasonStats.js";

const nullable = (value) => value === undefined || value === "" ? null : value;

export function createBalldontliePlayerProvider({
  client,
  currentPlayerNames = [],
  currentSeason,
  headshotLookup = new Map(),
  logger = () => { },
  goatSeasonStatsLoader = null,
} = {}) {
  if (!client?.request) throw new Error("BALLDONTLIE client is required.");
  const activeNames = new Set(currentPlayerNames.map(normalizePlayerName));
  let directoryContext = null;

  return {
    id: "balldontlie",
    async fetchPlayers() {
      directoryContext = await loadProviderDirectory(client, { logger });
      return directoryContext.players;
    },
    async fetchTeams() {
      const response = await client.request("/teams", { per_page: 100 });
      return Array.isArray(response?.data) ? response.data : [];
    },
    async fetchSeasonStats({ season, playerIds = [] } = {}) {
      if (!season || playerIds.length === 0) return [];
      if (goatSeasonStatsLoader) return goatSeasonStatsLoader({ client, season, playerIds, logger });
      return fetchAllCursorPages(
        (cursor) => client.request("/stats", { seasons: [season], player_ids: playerIds, per_page: 100, cursor }),
        { logger, label: "season-stat" },
      );
    },
    normalizePlayer(player) {
      if (!Number.isInteger(player?.id)) throw new Error("BALLDONTLIE player ID must be an integer.");
      const name = `${player.first_name || ""} ${player.last_name || ""}`.trim();
      const position = normalizePosition(player.position, `bdl_${player.id}`);
      const providerActive = directoryContext?.activeIds?.has(player.id) === true;
      const snapshotActive = activeNames.has(normalizePlayerName(name));
      const active = directoryContext?.activeMode === "provider-active" ? providerActive : snapshotActive;
      const headshot = resolveHeadshotEnrichment(player, headshotLookup);
      return {
        identity: {
          id: `bdl_${player.id}`,
          externalIds: [{ namespace: "balldontlie", value: String(player.id) }],
        },
        name: { full: name, first: player.first_name || "", last: player.last_name || "" },
        position: position.primaryPosition,
        eligiblePositions: [...position.eligiblePositions],
        team: player.team ? {
          id: nullable(player.team.id),
          name: nullable(player.team.full_name ?? player.team.name),
          abbreviation: nullable(player.team.abbreviation),
        } : null,
        height: nullable(player.height),
        weight: nullable(player.weight),
        experience: { draftYear: nullable(player.draft_year), draftRound: nullable(player.draft_round), draftNumber: nullable(player.draft_number) },
        headshot: { url: headshot?.imageUrl || null, externalId: headshot?.nbaPlayerId || null },
        status: { active, draftEligible: active, retired: false },
        ratings: null,
        metadata: {
          source: "balldontlie",
          season: currentSeason || null,
          verificationStrategy: directoryContext?.activeMode || "unresolved",
        },
      };
    },
    normalizeSeasonStats(row, { season = currentSeason } = {}) {
      const base = row?.base?.stats || row?.base || row?.stats || row;
      const advanced = row?.advanced?.stats || row?.advanced || {};
      const scoring = row?.scoring?.stats || row?.scoring || {};
      const shooting = row?.shooting?.stats || row?.shooting || {};
      const tracking = row?.tracking?.stats || row?.tracking || {};
      const passing = row?.passing || tracking.passing || {};
      const hustle = row?.hustle?.stats || row?.hustle || {};
      const defense = row?.defense?.stats || row?.defense || {};
      const playtype = row?.playtype || {};
      const player = row?.player || base?.player || {};
      return normalizeSeasonStatRecord({
        provider: "balldontlie",
        externalPlayerId: player.id ?? row?.player_id,
        season: row?.season ?? base?.season ?? season,
        gamesPlayed: base.games_played ?? base.gp, gamesStarted: base.games_started ?? base.gs,
        minutesPerGame: base.min ?? base.minutes, totalMinutes: base.total_minutes,
        pointsPerGame: base.pts ?? base.points, assistsPerGame: base.ast ?? base.assists,
        turnoversPerGame: base.turnover ?? base.tov, fieldGoalPercentage: base.fg_pct,
        threePointPercentage: base.fg3_pct, threePointAttemptsPerGame: base.fg3a,
        freeThrowPercentage: base.ft_pct, freeThrowAttemptsPerGame: base.fta,
        offensiveReboundsPerGame: base.oreb, defensiveReboundsPerGame: base.dreb,
        stealsPerGame: base.stl, blocksPerGame: base.blk,
        usageRate: advanced.usage_percentage, trueShootingPercentage: advanced.true_shooting_percentage,
        effectiveFieldGoalPercentage: advanced.effective_field_goal_percentage,
        assistPercentage: advanced.assist_percentage, turnoverPercentage: advanced.turnover_ratio,
        offensiveReboundPercentage: advanced.offensive_rebound_percentage,
        defensiveReboundPercentage: advanced.defensive_rebound_percentage,
        rimFrequency: shooting.rim_frequency ?? shooting.less_than_5ft_frequency ?? shooting["less_than_5_ft._fga_frequency"],
        rimEfficiency: shooting.rim_efficiency ?? shooting.less_than_5ft_percentage ?? shooting["less_than_5_ft._fg_pct"],
        midRangeFrequency: shooting.midrange_frequency ?? scoring.pct_pts_midrange_2pt,
        midRangeEfficiency: shooting.midrange_efficiency,
        threePointFrequency: shooting.three_point_frequency ?? scoring.pct_fga_3pt,
        threePointEfficiency: shooting.three_point_efficiency ?? base.fg3_pct,
        catchAndShootFrequency: shooting.catch_and_shoot_frequency,
        catchAndShootEfficiency: shooting.catch_and_shoot_efficiency,
        pullUpFrequency: shooting.pullup_frequency, pullUpEfficiency: shooting.pullup_efficiency,
        driveFrequency: tracking.drives, driveEfficiency: tracking.drive_efficiency,
        postUpFrequency: playtype.postup?.frequency, postUpEfficiency: playtype.postup?.efficiency,
        passingMetrics: { potentialAssists: passing.potential_assists ?? null, passEfficiency: passing.pass_efficiency ?? null, assistToTurnover: advanced.assist_to_turnover ?? null },
        trackingMetrics: { touches: tracking.touches ?? null, rimContests: tracking.rim_contests ?? null, contestedReboundPercentage: tracking.contested_rebound_percentage ?? null, reboundChanceConversion: tracking.rebound_chance_conversion ?? null, transitionFrequency: playtype.transition?.frequency ?? null },
        hustleMetrics: { deflections: hustle.deflections ?? null, contestedThreePointShots: hustle.contested_shots_3pt ?? null, looseBallsRecovered: hustle.loose_balls_recovered ?? null, activityRate: hustle.activity_rate ?? null },
        defensiveDistanceMetrics: { rimOpponentEfficiency: defense.rim_opponent_efficiency ?? defense.less_than_6ft_opponent_percentage ?? null, perimeterOpponentEfficiency: defense.perimeter_opponent_efficiency ?? defense.greater_than_15ft_opponent_percentage ?? null },
        gameLogVariance: row.gameLogVariance || null,
        primaryPosition: row.primaryPosition || player.position,
        eligiblePositions: row.eligiblePositions,
        sourceCategoryCoverage: row.sourceCategoryCoverage || {},
        position: player.position,
        team: row?.team?.abbreviation ?? base?.team?.abbreviation,
      });
    },
  };
}
