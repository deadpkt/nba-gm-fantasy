import { LEAGUE_STATUS, getLeagueStatusLabel } from "./leagueStatuses.js";

export const LEAGUE_PROGRESS_STEPS = Object.freeze([
  { status: LEAGUE_STATUS.LOBBY, label: "Lobby" },
  { status: LEAGUE_STATUS.DRAFTING, label: "Draft" },
  { status: LEAGUE_STATUS.SEASON_READY, label: "Team Setup" },
  { status: LEAGUE_STATUS.REGULAR_SEASON, label: "Regular Season" },
  { status: LEAGUE_STATUS.PLAYOFFS, label: "Playoffs" },
  { status: LEAGUE_STATUS.OFFSEASON, label: "Offseason" },
]);

const action = (title, description, actionLabel, actionPath, actionType = "primary", blockedReason = "") => ({
  title, description, actionLabel, actionPath, actionType, blockedReason,
});

export function getLeagueNextAction({
  league,
  userId,
  memberReady = false,
  teamReady = false,
  readyCount = 0,
  totalMembers = 0,
  allTeamsReady = false,
  currentMatchup = null,
  currentRound = 1,
  totalRounds = 0,
  roundStatus = "pending",
  regularSeasonComplete = false,
  playoffGames = [],
  offseasonRequirements = null,
} = {}) {
  if (!league) {
    return {
      phase: null,
      phaseLabel: "NO ACTIVE LEAGUE",
      ...action("Build your league", "Create a league or join friends with an invite code.", "Create / Join League", "/league"),
    };
  }

  const dashboardPath = `/league/${league.id}`;
  const isCommissioner = league.commissionerUid === userId;
  const phase = league.status;
  const base = { phase, phaseLabel: getLeagueStatusLabel(phase) };

  if (phase === LEAGUE_STATUS.LOBBY) {
    if (!memberReady) return { ...base, ...action("Ready for the draft", "Mark your franchise ready when you are prepared to begin.", "Open League Lobby", dashboardPath) };
    if (isCommissioner && totalMembers === league.maxMembers && readyCount === totalMembers) {
      return { ...base, ...action("Start the shared draft", "Every franchise slot is filled and ready.", "Start Draft", `${dashboardPath}#league-controls`) };
    }
    const remaining = Math.max(0, league.maxMembers - totalMembers) + Math.max(0, totalMembers - readyCount);
    return { ...base, ...action("Waiting for franchises", `${readyCount} of ${totalMembers} joined franchises are ready.`, "View Lobby", dashboardPath, "secondary", `${remaining} lobby requirement${remaining === 1 ? "" : "s"} remaining.`) };
  }

  if (phase === LEAGUE_STATUS.DRAFTING) {
    return { ...base, ...action("Draft your roster", "The shared draft is active for every franchise.", "Enter Draft Room", "/league/draft") };
  }

  if (phase === LEAGUE_STATUS.SEASON_READY) {
    if (!teamReady) return { ...base, ...action("Confirm your starting five", "Assign PG, SG, SF, PF, and C, then confirm your lineup.", "Go to My Team", "/my-team") };
    if (isCommissioner && allTeamsReady) return { ...base, ...action("Start the regular season", "Every franchise has confirmed a valid starting five.", "Start Season", `${dashboardPath}#league-controls`) };
    return { ...base, ...action("Waiting for franchises", `${readyCount} of ${totalMembers} franchises are ready for the season.`, "View Team Setup", dashboardPath, "secondary", allTeamsReady ? "Waiting for the commissioner to start the season." : `${Math.max(0, totalMembers - readyCount)} franchise${totalMembers - readyCount === 1 ? "" : "s"} remaining.`) };
  }

  if (phase === LEAGUE_STATUS.REGULAR_SEASON) {
    if (regularSeasonComplete) return { ...base, ...action("Review the final table", "The regular season is complete and playoff seeding is ready.", "View Standings", "/standings") };
    const live = currentMatchup && (currentMatchup.status === "in_progress" || currentMatchup.presentationLive);
    if (live) return { ...base, ...action("Your official game is live", `Round ${currentRound}: ${currentMatchup.awayTeamName} at ${currentMatchup.homeTeamName}.`, "Watch Live", "/games") };
    if (isCommissioner && ["pending", "completed"].includes(roundStatus)) {
      const round = roundStatus === "completed" ? Math.min(currentRound + 1, totalRounds || currentRound + 1) : currentRound;
      return { ...base, ...action(`Start Round ${round}`, "Open Games to launch the next official round.", `Start Round ${round}`, "/games") };
    }
    return { ...base, ...action(`Round ${currentRound}`, currentMatchup ? `${currentMatchup.awayTeamName} at ${currentMatchup.homeTeamName}.` : "League games are progressing now.", "Open Games", "/games", "secondary", roundStatus === "active" ? "Waiting for live games to finish." : "Waiting for the commissioner to start the round.") };
  }

  if (phase === LEAGUE_STATUS.PLAYOFFS) {
    const liveGame = playoffGames.find((game) => [game.homeUid, game.awayUid].includes(userId) && (game.status === "in_progress" || game.presentationLive));
    if (liveGame) return { ...base, ...action("Your playoff game is live", `${liveGame.awayTeamName} at ${liveGame.homeTeamName}.`, "Watch Live", "/playoffs") };
    if (league.postseason?.status === "completed") return { ...base, ...action("Season championship complete", `${league.postseason?.champion?.teamName || "A champion"} has won Season ${league.season}.`, isCommissioner ? "Enter Offseason" : "View Championship", "/playoffs") };
    return { ...base, ...action("The postseason is underway", isCommissioner ? "Open the bracket to manage the next playoff stage." : "Follow the trusted playoff bracket and official results.", "Open Playoffs", "/playoffs") };
  }

  if (phase === LEAGUE_STATUS.OFFSEASON) {
    const nextSeason = league.offseason?.nextSeason || league.season + 1;
    if (offseasonRequirements && !offseasonRequirements.rosterValid) return { ...base, ...action(`Complete your Season ${nextSeason} roster`, "Use Free Agency to fill every configured roster spot.", "Go to Free Agency", "/free-agency") };
    if (offseasonRequirements && !offseasonRequirements.lineupValid) return { ...base, ...action(`Set your Season ${nextSeason} lineup`, "Assign a valid Starting Five after your roster moves.", "Go to My Team", "/my-team") };
    if (offseasonRequirements && !offseasonRequirements.capValid) return { ...base, ...action("Review your salary cap", "Your franchise contracts must be valid and cap compliant.", "View Contracts", "/contracts") };
    if (!teamReady) return { ...base, ...action(`Confirm for Season ${nextSeason}`, "Your roster, lineup, and contracts are ready. Confirm your franchise preparation.", "Go to My Team", "/my-team") };
    if (isCommissioner && allTeamsReady) return { ...base, ...action(`Start Season ${nextSeason}`, "Every franchise has confirmed its next-season roster.", `Start Season ${nextSeason}`, `${dashboardPath}#league-controls`) };
    return { ...base, ...action(`Preparing for Season ${nextSeason}`, `${readyCount} of ${totalMembers} franchises are ready.`, "View Offseason", dashboardPath, "secondary", allTeamsReady ? "Waiting for the commissioner to start the next season." : `${Math.max(0, totalMembers - readyCount)} franchise${totalMembers - readyCount === 1 ? "" : "s"} remaining.`) };
  }

  return { ...base, ...action("League lifecycle complete", "This league has no active action.", "League Dashboard", dashboardPath, "secondary") };
}

export function getLeagueProgress(status) {
  const activeIndex = LEAGUE_PROGRESS_STEPS.findIndex((step) => step.status === status);
  return LEAGUE_PROGRESS_STEPS.map((step, index) => ({
    ...step,
    state: activeIndex < 0 ? "upcoming" : index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming",
  }));
}
