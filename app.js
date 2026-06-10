const state = {
  user: JSON.parse(localStorage.getItem("vmFeberUser") || "null"),
  leagues: [],
  publicLeagues: [],
  leaderboardRows: [],
  predictionMode: "daily",
  supabaseReady: Boolean(window.vmFeberSupabaseReady),
  sessionUserId: null,
  competitionIds: {},
  predictions: {},
  backups: [],
  adminInvitations: [],
  adminUsers: [],
  adminStatistics: null,
  testUsers: [],
  bonusQuestions: [],
  bonusPredictions: {},
  bonusTeams: [],
  playerSearchResults: {},
  playerSearchTimers: {},
  isAdmin: false,
  theme: localStorage.getItem("vmFeberTheme") || "system",
  liveGroupEnabled: localStorage.getItem("vmFeberLiveGroup") !== "off",
  activeLiveGroup: null,
};

const competitions = [
  {
    title: "Full VM-konkurranse",
    deadline: "2 timer før første kamp",
    description:
      "Alle kamper, gruppeplasseringer, sluttspill, vinner og bonusspørsmål leveres samlet før turneringen starter.",
  },
  {
    title: "Daglig konkurranse",
    deadline: "Kl. 12:00 norsk tid hver kampdag",
    description:
      "Dagens kamper tippes dag for dag. Denne får egen poengtavle, separat fra full VM.",
  },
];

const rules = [
  ["Riktig resultat", "3 poeng"],
  ["Riktig vinner eller uavgjort", "1 poeng"],
  ["Riktig gruppeplassering", "2 poeng"],
  ["Riktig finalist", "4 poeng"],
  ["Riktig verdensmester", "8 poeng"],
  ["Riktig toppscorer", "5 poeng"],
];

let matches = [
  {
    id: "m1",
    home: "Norge",
    away: "Brasil",
    homeColor: "#ba1f33",
    awayColor: "#f5d038",
    date: "15. juni",
    deadline: "Full VM: 19:00 · Daglig: 12:00",
  },
  {
    id: "m2",
    home: "Frankrike",
    away: "Japan",
    homeColor: "#244aa5",
    awayColor: "#f5f5f5",
    date: "15. juni",
    deadline: "Full VM: 19:00 · Daglig: 12:00",
  },
  {
    id: "m3",
    home: "Argentina",
    away: "Tyskland",
    homeColor: "#75bde8",
    awayColor: "#111111",
    date: "16. juni",
    deadline: "Full VM: 19:00 · Daglig: 12:00",
  },
];

function formatKickoff(kickoffAt) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoffAt));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function osloDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function visibleMatches() {
  if (state.predictionMode === "full" || !matches.some((match) => match.kickoffAt)) {
    return matches;
  }

  const today = osloDateKey(new Date());
  const todayMatches = matches.filter((match) => osloDateKey(match.kickoffAt) === today);
  if (todayMatches.length) return todayMatches;

  const nextMatch = matches.find((match) => new Date(match.kickoffAt) > new Date());
  if (!nextMatch) return [];

  const nextMatchDay = osloDateKey(nextMatch.kickoffAt);
  return matches.filter((match) => osloDateKey(match.kickoffAt) === nextMatchDay);
}

function fullDeadline() {
  const firstKickoff = matches.find((match) => match.kickoffAt)?.kickoffAt;
  return firstKickoff ? new Date(new Date(firstKickoff).getTime() - 2 * 60 * 60 * 1000) : null;
}

function dailyDeadline(matchList = visibleMatches()) {
  const kickoff = matchList.find((match) => match.kickoffAt)?.kickoffAt;
  if (!kickoff) return null;
  const date = osloDateKey(kickoff);
  return new Date(`${date}T10:00:00.000Z`);
}

function formatDeadline(deadline) {
  return deadline ? formatKickoff(deadline) : "Ikke tilgjengelig";
}

async function loadMatches() {
  if (!state.supabaseReady) return;

  const { data, error } = await window.vmFeberSupabase
    .from("matches")
    .select("id,stage,group_name,home_team,away_team,home_crest,away_crest,kickoff_at,status")
    .order("kickoff_at", { ascending: true });

  if (error || !data?.length) return;

  matches = data.map((match, index) => ({
    id: match.id,
    number: index + 1,
    home: match.home_team,
    away: match.away_team,
    stage: match.stage,
    groupName: match.group_name,
    homeCrest: match.home_crest,
    awayCrest: match.away_crest,
    homeColor: "#e9efe7",
    awayColor: "#e9efe7",
    date: formatKickoff(match.kickoff_at),
    kickoffAt: match.kickoff_at,
    deadline: "Full VM: samlet frist · Daglig: kl. 12:00",
  }));
}

function predictionKey(competitionId, matchId) {
  return `${competitionId}:${matchId}`;
}

async function loadPredictions() {
  if (!state.supabaseReady || !state.sessionUserId) return;

  const { data: competitionRows } = await window.vmFeberSupabase
    .from("competitions")
    .select("id,slug")
    .eq("is_active", true);

  state.competitionIds = Object.fromEntries(
    (competitionRows || []).map((competition) => [competition.slug, competition.id]),
  );

  const { data: predictionRows } = await window.vmFeberSupabase
    .from("match_predictions")
    .select("competition_id,match_id,home_score,away_score,extra_time_home_score,extra_time_away_score,penalty_home_score,penalty_away_score,source,updated_at");

  state.predictions = Object.fromEntries(
    (predictionRows || []).map((prediction) => [
      predictionKey(prediction.competition_id, prediction.match_id),
      prediction,
    ]),
  );
}

async function loadBackups() {
  if (!state.supabaseReady || !state.sessionUserId) return;

  const { data } = await window.vmFeberSupabase
    .from("prediction_backups")
    .select("backup_type,match_date,cutoff_at,created_at,user_count,prediction_count,email_sent,email_error")
    .order("created_at", { ascending: false })
    .limit(30);

  state.backups = data || [];
}

async function loadAdminData() {
  if (!state.supabaseReady || !state.sessionUserId || !state.isAdmin) {
    state.adminInvitations = [];
    state.adminUsers = [];
    state.adminStatistics = null;
    state.testUsers = [];
    return;
  }

  const [
    { data: invitations, error: invitationError },
    { data: users, error: userError },
    { data: testUsers, error: testUserError },
    { data: statistics, error: statisticsError },
  ] =
    await Promise.all([
      window.vmFeberSupabase.rpc("get_admin_invitations"),
      window.vmFeberSupabase.rpc("get_admin_users"),
      window.vmFeberSupabase.rpc("get_admin_test_users"),
      window.vmFeberSupabase.rpc("get_admin_statistics"),
    ]);

  state.adminInvitations = invitationError ? [] : invitations || [];
  state.adminUsers = userError ? [] : users || [];
  state.testUsers = testUserError ? [] : testUsers || [];
  state.adminStatistics = statisticsError ? null : Array.isArray(statistics) ? statistics[0] : statistics;

  const feedback = document.querySelector("#inviteFeedback");
  if (invitationError || userError || testUserError || statisticsError) {
    feedback.textContent =
      invitationError?.message || userError?.message || testUserError?.message
      || statisticsError?.message || "Kunne ikke laste admindata.";
  }
}

async function loadLeagues() {
  if (!state.supabaseReady || !state.sessionUserId) {
    state.leagues = [];
    state.publicLeagues = [];
    return;
  }

  const [{ data, error }, { data: publicData, error: publicError }] = await Promise.all([
    window.vmFeberSupabase.rpc("get_my_leagues"),
    window.vmFeberSupabase.rpc("get_public_leagues"),
  ]);
  if (error || publicError) {
    state.leagues = [];
    state.publicLeagues = [];
    document.querySelector("#leagueFeedback").textContent =
      (error?.message || publicError?.message || "").includes("get_")
        ? "Ligasystemet må aktiveres i Supabase."
        : error?.message || publicError?.message;
    return;
  }

  state.leagues = data || [];
  state.publicLeagues = publicData || [];
}

function activeCompetitionSlug() {
  return state.predictionMode === "full" ? "full-vm" : "daglig";
}

function activePrediction(matchId) {
  const competitionId = state.competitionIds[activeCompetitionSlug()];
  const directPrediction = state.predictions[predictionKey(competitionId, matchId)];
  if (directPrediction || state.predictionMode === "full") {
    return directPrediction?.source === "full-vm-inherited"
      ? { ...directPrediction, inheritedFromFull: true }
      : directPrediction;
  }

  const fullCompetitionId = state.competitionIds["full-vm"];
  const fullPrediction = state.predictions[predictionKey(fullCompetitionId, matchId)];
  return fullPrediction ? { ...fullPrediction, inheritedFromFull: true } : undefined;
}

function setPredictionFeedback(message, type = "") {
  const feedback = document.querySelector("#predictionFeedback");
  feedback.textContent = message;
  feedback.className = `prediction-feedback ${type}`.trim();
}

async function savePrediction(matchId) {
  if (!state.sessionUserId) {
    setPredictionFeedback("Du må være innlogget for å lagre tips.", "error");
    return false;
  }

  const row = document.querySelector(`[data-match-id="${matchId}"]`);
  const homeScore = row.querySelector('[data-score="home"]').value;
  const awayScore = row.querySelector('[data-score="away"]').value;
  const regularTie = row.querySelector("[data-tiebreak]") && Number(homeScore) === Number(awayScore);
  const rawExtraHomeScore = row.querySelector('[data-extra-score="home"]')?.value ?? "";
  const rawExtraAwayScore = row.querySelector('[data-extra-score="away"]')?.value ?? "";
  const extraHomeScore = regularTie ? rawExtraHomeScore : "";
  const extraAwayScore = regularTie ? rawExtraAwayScore : "";
  const extraTie = regularTie
    && extraHomeScore !== ""
    && extraAwayScore !== ""
    && Number(extraHomeScore) === Number(extraAwayScore);
  const penaltyHomeScore = extraTie ? row.querySelector('[data-penalty-score="home"]')?.value ?? "" : "";
  const penaltyAwayScore = extraTie ? row.querySelector('[data-penalty-score="away"]')?.value ?? "" : "";
  const button = row.querySelector(".save-prediction");

  if (homeScore === "" || awayScore === "") {
    setPredictionFeedback("Fyll inn både hjemme- og bortemål.", "error");
    return false;
  }

  if (regularTie) {
    if (extraHomeScore === "" || extraAwayScore === "") {
      setPredictionFeedback("Uavgjort sluttspilltips må avgjøres etter ekstraomganger.", "error");
      return false;
    }
    if (Number(extraHomeScore) < Number(homeScore) || Number(extraAwayScore) < Number(awayScore)) {
      setPredictionFeedback("Stillingen etter 120 minutter kan ikke være lavere enn etter ordinær tid.", "error");
      return false;
    }
    if (Number(extraHomeScore) === Number(extraAwayScore)
      && (penaltyHomeScore === "" || penaltyAwayScore === "" || Number(penaltyHomeScore) === Number(penaltyAwayScore))) {
      setPredictionFeedback("Velg en vinner med et ulikt straffesparkresultat.", "error");
      return false;
    }
  }

  button.disabled = true;
  button.textContent = "Lagrer";

  const { data, error } = await window.vmFeberSupabase.rpc("save_match_prediction", {
    competition_slug: activeCompetitionSlug(),
    selected_match_id: matchId,
    predicted_home_score: Number(homeScore),
    predicted_away_score: Number(awayScore),
    predicted_extra_time_home_score: extraHomeScore === "" ? null : Number(extraHomeScore),
    predicted_extra_time_away_score: extraAwayScore === "" ? null : Number(extraAwayScore),
    predicted_penalty_home_score: penaltyHomeScore === "" ? null : Number(penaltyHomeScore),
    predicted_penalty_away_score: penaltyAwayScore === "" ? null : Number(penaltyAwayScore),
  });

  if (error) {
    setPredictionFeedback(error.message, "error");
    button.disabled = false;
    button.textContent = "Lagre";
    return false;
  }

  const saved = Array.isArray(data) ? data[0] : data;
  state.predictions[predictionKey(saved.competition_id, saved.match_id)] = saved;
  setPredictionFeedback("Tipset er lagret.", "success");
  button.disabled = false;
  button.textContent = "Lagret";
  updateDashboard();
  updatePredictionToolbar();
  return true;
}

async function saveVisiblePredictions() {
  const button = document.querySelector("#saveVisibleButton");
  const rows = [...document.querySelectorAll("[data-match-id]")].filter((row) => {
    return row.querySelector('[data-score="home"]').value !== ""
      && row.querySelector('[data-score="away"]').value !== "";
  });

  if (!rows.length) {
    setPredictionFeedback("Fyll inn minst ett resultat først.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Lagrer...";
  let savedCount = 0;
  let failedCount = 0;
  for (const row of rows) {
    if (await savePrediction(row.dataset.matchId)) savedCount += 1;
    else failedCount += 1;
  }
  button.disabled = false;
  button.textContent = "Lagre synlige tips";
  setPredictionFeedback(
    failedCount
      ? `${savedCount} tips ble lagret. ${failedCount} tips mangler en gyldig sluttspillavgjørelse.`
      : `${savedCount} tips ble lagret.`,
    failedCount ? "error" : "success",
  );
}

function randomScore() {
  return Math.floor(Math.random() * 5);
}

function randomizeVisiblePredictions() {
  const rows = [...document.querySelectorAll("#matchList [data-match-id]")];
  const deadline = state.predictionMode === "full" ? fullDeadline() : dailyDeadline(visibleMatches());

  if (!rows.length) {
    setPredictionFeedback("Ingen synlige kamper å fylle ut.", "error");
    return;
  }
  if (deadline && new Date() >= deadline) {
    setPredictionFeedback("Fristen er utløpt. Disse tipsene kan ikke endres.", "error");
    return;
  }

  const hasExistingScores = rows.some((row) =>
    [...row.querySelectorAll("[data-score]")].some((input) => input.value !== ""),
  );
  if (hasExistingScores && !window.confirm("Dette erstatter resultatene som vises nå. Vil du trekke nye tilfeldige tips?")) {
    return;
  }

  rows.forEach((row) => {
    const home = randomScore();
    const away = randomScore();
    row.querySelector('[data-score="home"]').value = home;
    row.querySelector('[data-score="away"]').value = away;
    if (row.querySelector("[data-tiebreak]") && home === away) {
      const extraHome = home + Math.floor(Math.random() * 3);
      const extraAway = away + Math.floor(Math.random() * 3);
      row.querySelector('[data-extra-score="home"]').value = extraHome;
      row.querySelector('[data-extra-score="away"]').value = extraAway;
      if (extraHome === extraAway) {
        const penaltyHome = Math.floor(Math.random() * 5) + 3;
        row.querySelector('[data-penalty-score="home"]').value = penaltyHome;
        row.querySelector('[data-penalty-score="away"]').value = Math.max(0, penaltyHome + (Math.random() < 0.5 ? -1 : 1));
      }
    }
    updateKnockoutTiebreakVisibility(row);
    row.querySelector(".save-prediction").textContent = "Lagre";
  });
  renderProjectedGroupTables();
  setPredictionFeedback(
    `${rows.length} tilfeldige resultater er fylt inn. Kontroller dem og trykk «Lagre synlige tips».`,
    "success",
  );
}

async function syncWorldCupMatches() {
  const feedback = document.querySelector("#syncFeedback");
  const button = document.querySelector("#syncMatchesButton");
  feedback.textContent = "Synkroniserer kampdata...";
  button.disabled = true;

  try {
    const { data, error } = await window.vmFeberSupabase.functions.invoke("sync-world-cup");
    if (error || data?.error) {
      let message = data?.error || error.message;

      if (error?.context) {
        try {
          const details = await error.context.json();
          message = details?.error || details?.message || message;
        } catch {
          // Behold den generelle Supabase-feilmeldingen dersom svaret ikke er JSON.
        }
      }

      feedback.textContent = `Synkronisering feilet: ${message}`;
      return;
    }

    await loadMatches();
    renderMatches();
    feedback.textContent = `${data.synced} kamper ble synkronisert.`;
  } catch (error) {
    feedback.textContent = `Synkronisering feilet: ${error.message || String(error)}`;
  } finally {
    button.disabled = false;
  }
}

const results = [
  ["Norge - Brasil", "Ikke spilt"],
  ["Frankrike - Japan", "Ikke spilt"],
  ["Argentina - Tyskland", "Ikke spilt"],
];

const viewTitles = {
  overview: "Oversikt",
  predictions: "Mine tips",
  leagues: "Ligaer",
  leaderboards: "Poengtavler",
  rules: "Regler",
  settings: "Innstillinger",
};

function save() {
  localStorage.setItem("vmFeberUser", JSON.stringify(state.user));
}

function applyTheme(theme = state.theme) {
  state.theme = theme;
  localStorage.setItem("vmFeberTheme", theme);
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.theme = resolvedTheme;
}

async function saveProfileSettings() {
  if (!state.sessionUserId) return;
  const username = document.querySelector("#settingsUsername").value.trim();
  const feedback = document.querySelector("#settingsFeedback");
  if (!username) {
    feedback.textContent = "Brukernavn kan ikke være tomt.";
    return;
  }

  const { data, error } = await window.vmFeberSupabase
    .rpc("update_own_username", { new_username: username });
  if (error) {
    feedback.textContent = error.message;
    return;
  }

  state.user.username = data || username;
  save();
  renderUser();
  feedback.textContent = "Profilen er lagret.";
}

function renderSettings() {
  document.querySelector("#settingsUsername").value = state.user?.username || "";
  document.querySelector("#settingsEmail").textContent = state.user?.email || "Logg inn for å endre profil.";
  document.querySelector("#defaultCompetition").value = state.predictionMode;
  document.querySelector("#themeSelect").value = state.theme;
  document.querySelector("#liveGroupToggle").checked = state.liveGroupEnabled;
  document.querySelector("#saveProfileButton").disabled = !state.sessionUserId;
  document.querySelector("#settingsLogoutButton").disabled = !state.sessionUserId;
  document.querySelectorAll(".segment").forEach((segment) => {
    segment.classList.toggle("active", segment.dataset.predictionMode === state.predictionMode);
  });
}

async function syncSupabaseSession() {
  if (!state.supabaseReady) return;

  const { data } = await window.vmFeberSupabase.auth.getSession();
  const session = data.session;
  if (!session?.user) {
    state.user = null;
    state.sessionUserId = null;
    state.isAdmin = false;
    save();
    return;
  }
  state.sessionUserId = session.user.id;

  const pendingProfile = JSON.parse(localStorage.getItem("vmFeberPendingProfile") || "null");
  let { data: profile } = await window.vmFeberSupabase
    .from("profiles")
    .select("username,email,invite_code,registration_source,is_admin,email_contact_consent")
    .eq("id", session.user.id)
    .maybeSingle();

  if (pendingProfile?.emailConsent && !profile?.email_contact_consent) {
    await window.vmFeberSupabase.rpc("set_email_contact_consent", { accepted: true });
  }
  if (profile || pendingProfile) localStorage.removeItem("vmFeberPendingProfile");

  state.user = {
    email: profile?.email || session.user.email,
    username: profile?.username || session.user.email?.split("@")[0] || "bruker",
    inviteCode: profile?.invite_code || profile?.registration_source || "åpen registrering",
    emailConsent: Boolean(profile?.email_contact_consent || pendingProfile?.emailConsent),
  };
  state.isAdmin = Boolean(profile?.is_admin);
  save();
}

async function sendMagicLink(email, username, inviteCode, emailConsent) {
  if (inviteCode) {
    const { data: isValid, error: validationError } = await window.vmFeberSupabase
      .rpc("validate_invitation_code", { check_code: inviteCode });
    if (validationError || !isValid) {
      document.querySelector("#loginFeedback").textContent =
        validationError?.message || "Invitasjonskoden finnes ikke eller er brukt opp.";
      return false;
    }
  }

  localStorage.setItem("vmFeberPendingProfile", JSON.stringify({ username, inviteCode, emailConsent }));

  const redirectTo = window.location.href.split("#")[0].split("?")[0];
  const { error } = await window.vmFeberSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        username,
        invite_code: inviteCode || null,
        email_contact_consent: emailConsent,
      },
    },
  });

  if (error) {
    document.querySelector("#loginFeedback").textContent = `Kunne ikke sende magic link: ${error.message}`;
    return false;
  }

  document.querySelector("#loginFeedback").textContent =
    "Innloggingslenken er sendt fra Supabase. Åpne e-posten og trykk på lenken for å logge inn. Sjekk søppelpost/spam dersom du ikke finner den.";
  return true;
}

async function loadBonusQuestions() {
  if (!state.supabaseReady) {
    state.bonusQuestions = [];
    state.bonusTeams = [];
    return;
  }

  const [{ data: questions, error: questionError }, { data: teams, error: teamError }] = await Promise.all([
    window.vmFeberSupabase
      .from("bonus_questions")
      .select("slug,label,points,sort_order,question_type,option_source,validation_rule,description")
      .eq("is_active", true)
      .neq("question_type", "computed")
      .order("sort_order", { ascending: true }),
    window.vmFeberSupabase
      .from("teams")
      .select("fifa_code,display_name")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
  ]);

  state.bonusQuestions = questionError ? [] : questions || [];
  state.bonusTeams = teamError ? [] : teams || [];
}

async function loadMyBonusPredictions() {
  if (!state.supabaseReady || !state.sessionUserId) {
    state.bonusPredictions = {};
    return;
  }

  const { data, error } = await window.vmFeberSupabase.rpc("get_my_bonus_predictions_resolved");
  state.bonusPredictions = error
    ? {}
    : Object.fromEntries((data || []).map((prediction) => [prediction.question_slug, prediction]));
}

async function searchPlayersForQuestion(questionSlug, query) {
  const results = document.querySelector(`[data-player-results="${questionSlug}"]`);
  if (!results) return;
  if (query.trim().length < 2) {
    state.playerSearchResults[questionSlug] = [];
    results.innerHTML = "";
    return;
  }

  const { data, error } = await window.vmFeberSupabase.rpc("search_players", {
    search_query: query.trim(),
    only_active: true,
    max_results: 12,
  });
  state.playerSearchResults[questionSlug] = error ? [] : data || [];
  results.innerHTML = state.playerSearchResults[questionSlug]
    .map(
      (player) => `
        <button type="button" class="player-result" data-select-player="${player.id}" data-question-slug="${questionSlug}">
          <strong>${escapeHtml(player.player_name)}</strong>
          <span>${escapeHtml(player.team_name)} · ${escapeHtml(player.player_position)}${player.club ? ` · ${escapeHtml(player.club)}` : ""}</span>
        </button>
      `,
    )
    .join("") || '<span class="microcopy">Ingen spillere funnet.</span>';
}

async function saveBonusPrediction(questionSlug) {
  const row = document.querySelector(`[data-bonus-question="${questionSlug}"]`);
  const feedback = row?.querySelector("[data-bonus-feedback]");
  if (!state.sessionUserId) {
    feedback.textContent = "Logg inn for å lagre bonustipset.";
    return;
  }

  const answer = row.querySelector("[data-bonus-answer]")?.value?.trim() || "";
  const { error } = await window.vmFeberSupabase.rpc("save_bonus_prediction", {
    question_slug: questionSlug,
    answer_value: answer,
  });
  if (error) {
    feedback.textContent = error.message;
    return;
  }

  const question = state.bonusQuestions.find((item) => item.slug === questionSlug);
  let answerLabel = answer;
  if (question?.question_type === "player") {
    answerLabel = row.querySelector("[data-player-search]")?.value || answer;
  } else if (question?.question_type === "team") {
    answerLabel = row.querySelector("[data-bonus-answer]")?.selectedOptions?.[0]?.textContent || answer;
  } else if (question?.question_type === "boolean") {
    answerLabel = answer === "true" ? "Ja" : "Nei";
  }
  state.bonusPredictions[questionSlug] = { answer, answer_label: answerLabel };
  feedback.textContent = "Bonustipset er lagret.";
}

function renderModes() {
  const list = document.querySelector("#modeList");
  if (!list) return;
  list.innerHTML = competitions
    .map(
      (item) => `
        <article class="mode-card">
          <div>
            <h4>${item.title}</h4>
            <span class="tag">${item.deadline}</span>
          </div>
          <p>${item.description}</p>
        </article>
      `,
    )
    .join("");
}

function renderRules() {
  document.querySelector("#rulesList").innerHTML = rules
    .map(([label, points]) => `<div class="rule-row"><span>${label}</span><strong>${points}</strong></div>`)
    .join("");
}

function countPredictions(slug, matchList) {
  const competitionId = state.competitionIds[slug];
  return matchList.filter((match) => state.predictions[predictionKey(competitionId, match.id)]).length;
}

function nextNorwayMatch() {
  return matches.find((match) => {
    const isNorway = match.home.toLowerCase().includes("norway") || match.away.toLowerCase().includes("norway")
      || match.home.toLowerCase().includes("norge") || match.away.toLowerCase().includes("norge");
    return isNorway && (!match.kickoffAt || new Date(match.kickoffAt) > new Date());
  });
}

function updateDashboard() {
  const fullCount = countPredictions("full-vm", matches);
  const dailyMatches = (() => {
    const previousMode = state.predictionMode;
    state.predictionMode = "daily";
    const result = visibleMatches();
    state.predictionMode = previousMode;
    return result;
  })();
  const previousMode = state.predictionMode;
  state.predictionMode = "daily";
  const dailyCount = dailyMatches.filter((match) => activePrediction(match.id)).length;
  state.predictionMode = previousMode;
  const norway = nextNorwayMatch();
  const deadline = fullDeadline();

  document.querySelector("#fullProgressValue").textContent = `${fullCount}/${matches.length}`;
  document.querySelector("#dailyProgressValue").textContent = `${dailyCount}/${dailyMatches.length}`;
  document.querySelector("#heroDeadline").textContent = `Full VM-frist: ${formatDeadline(deadline)}. Daglige tips låses kl. 12:00 norsk tid.`;
  document.querySelector("#saveStatus").textContent = state.sessionUserId
    ? `${fullCount + dailyCount} tips lagret`
    : "Logg inn for å tippe";

  const norwayBox = document.querySelector("#norwayNext");
  if (!norway) {
    document.querySelector("#nextNorwayValue").textContent = "–";
    norwayBox.innerHTML = '<p class="muted">Ingen kommende Norge-kamp funnet.</p>';
    return;
  }

  document.querySelector("#nextNorwayValue").textContent = norway.date.split(" kl.")[0];
  document.querySelector("#nextNorwayLabel").textContent = `${norway.home} – ${norway.away}`;
  norwayBox.innerHTML = `
    <article class="norway-match">
      <div class="team">${norway.homeCrest ? `<img class="flag" src="${norway.homeCrest}" alt="" />` : ""}${norway.home}</div>
      <div class="norway-match-time">${norway.date}</div>
      <div class="team">${norway.awayCrest ? `<img class="flag" src="${norway.awayCrest}" alt="" />` : ""}${norway.away}</div>
    </article>`;
}

function updatePredictionToolbar() {
  const shownMatches = visibleMatches();
  const competitionId = state.competitionIds[activeCompetitionSlug()];
  const explicitCount = shownMatches.filter((match) => state.predictions[predictionKey(competitionId, match.id)]).length;
  const inheritedCount = state.predictionMode === "daily"
    ? shownMatches.filter((match) => activePrediction(match.id)?.inheritedFromFull).length
    : 0;
  const deadline = state.predictionMode === "full" ? fullDeadline() : dailyDeadline(shownMatches);

  document.querySelector("#predictionProgress").textContent =
    `${explicitCount} av ${shownMatches.length} kamper lagret${inheritedCount ? ` · ${inheritedCount} arves fra Full VM` : ""}`;
  document.querySelector("#predictionDeadline").textContent = `Frist: ${formatDeadline(deadline)}`;
  document.querySelector("#randomizeVisibleButton").disabled =
    !shownMatches.length || Boolean(deadline && new Date() >= deadline);
}

function bonusQuestionInput(question, prediction) {
  const answer = prediction?.answer || "";
  const answerLabel = prediction?.answer_label || "";
  if (question.question_type === "player") {
    return `
      <div class="player-picker">
        <input type="search" data-player-search="${question.slug}" value="${escapeHtml(answerLabel)}"
          placeholder="Søk etter spiller" autocomplete="off" />
        <input type="hidden" data-bonus-answer value="${escapeHtml(answer)}" />
        <div class="player-results" data-player-results="${question.slug}"></div>
      </div>
    `;
  }
  if (question.question_type === "team") {
    return `
      <select data-bonus-answer>
        <option value="">Velg lag</option>
        ${state.bonusTeams
          .map(
            (team) => `<option value="${team.fifa_code}" ${answer === team.fifa_code ? "selected" : ""}>${escapeHtml(team.display_name)}</option>`,
          )
          .join("")}
      </select>
    `;
  }
  if (question.question_type === "number") {
    const minimum = question.validation_rule?.min ?? 0;
    const maximum = question.validation_rule?.max ?? "";
    return `<input type="number" data-bonus-answer min="${minimum}" ${maximum === "" ? "" : `max="${maximum}"`} value="${escapeHtml(answer)}" />`;
  }
  if (question.question_type === "boolean") {
    return `
      <select data-bonus-answer>
        <option value="">Velg svar</option>
        <option value="true" ${answer === "true" ? "selected" : ""}>Ja</option>
        <option value="false" ${answer === "false" ? "selected" : ""}>Nei</option>
      </select>
    `;
  }
  return `<input type="text" data-bonus-answer value="${escapeHtml(answer)}" />`;
}

function renderBonusPanel() {
  if (!state.bonusQuestions.length) {
    return `
      <div class="bonus-panel">
        <h3>Bonusspørsmål</h3>
        <p class="microcopy">Bonusspørsmålene må aktiveres i Supabase før de kan fylles ut.</p>
      </div>
    `;
  }

  return `
    <div class="bonus-panel">
      <div class="bonus-heading">
        <div>
          <h3>Bonusspørsmål</h3>
          <p class="microcopy">Leveres sammen med Full VM-tipset før samlet frist.</p>
        </div>
        <span class="tag">${state.bonusQuestions.length} spørsmål</span>
      </div>
      <div class="bonus-grid">
        ${state.bonusQuestions
          .map((question) => {
            const prediction = state.bonusPredictions[question.slug];
            return `
              <article class="bonus-question" data-bonus-question="${question.slug}">
                <div class="bonus-question-heading">
                  <strong>${escapeHtml(question.label)}</strong>
                  <span>${question.points} poeng</span>
                </div>
                ${question.description ? `<p>${escapeHtml(question.description)}</p>` : ""}
                <div class="bonus-save-row">
                  ${bonusQuestionInput(question, prediction)}
                  <button type="button" data-save-bonus="${question.slug}" ${state.sessionUserId ? "" : "disabled"}>Lagre</button>
                </div>
                <span class="microcopy" data-bonus-feedback>
                  ${prediction ? `Lagret: ${escapeHtml(prediction.answer_label || prediction.answer)}` : "Ikke lagret ennå."}
                </span>
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderMatches() {
  const projectedKnockoutMatchups = state.predictionMode === "full"
    ? buildProjectedKnockoutMatchups()
    : new Map();
  const extra = state.predictionMode === "full" ? renderBonusPanel() : "";

  let lastDay = "";
  document.querySelector("#matchList").innerHTML = visibleMatches()
    .map((match) => {
        const day = match.kickoffAt ? osloDateKey(match.kickoffAt) : match.date;
        const heading = day !== lastDay ? `<div class="match-day">${match.date.split(" kl.")[0]}</div>` : "";
        lastDay = day;
        const prediction = activePrediction(match.id);
        const projectedMatchup = projectedKnockoutMatchups.get(match.number);
        const home = projectedMatchup?.home || { name: match.home, crest: match.homeCrest, origin: "" };
        const away = projectedMatchup?.away || { name: match.away, crest: match.awayCrest, origin: "" };
        return `${heading}
        <article class="match-row" data-match-id="${match.id}" data-match-number="${match.number || ""}">
          <div class="team" data-projected-team="home">${home.crest ? `<img class="flag" src="${home.crest}" alt="" />` : `<span class="flag" style="background:${match.homeColor}"></span>`}<span class="team-details"><strong>${escapeHtml(home.name)}</strong>${home.origin ? `<small>${escapeHtml(home.origin)}</small>` : ""}</span></div>
          <div class="score-inputs">
            <input type="number" min="0" data-score="home" value="${prediction?.home_score ?? ""}" aria-label="${match.home} mål" />
            <input type="number" min="0" data-score="away" value="${prediction?.away_score ?? ""}" aria-label="${match.away} mål" />
          </div>
          <div class="team" data-projected-team="away">${away.crest ? `<img class="flag" src="${away.crest}" alt="" />` : `<span class="flag" style="background:${match.awayColor}"></span>`}<span class="team-details"><strong>${escapeHtml(away.name)}</strong>${away.origin ? `<small>${escapeHtml(away.origin)}</small>` : ""}</span></div>
          <div class="deadline"><span class="match-stage-label">${escapeHtml(stageLabel(match))}</span><br />${match.date}<br />${match.deadline}</div>
          <button class="save-prediction" data-save-prediction="${match.id}" ${state.sessionUserId ? "" : "disabled"}>
            ${prediction?.inheritedFromFull ? "Bruk Full VM" : prediction ? "Lagret" : "Lagre"}
          </button>
          ${knockoutTiebreakFields(match, prediction)}
        </article>
      `;
      },
    )
    .join("");

  document.querySelector("#bonusPanel").innerHTML = extra;
  document.querySelectorAll("#matchList [data-match-id]").forEach(updateKnockoutTiebreakVisibility);
  updatePredictionToolbar();
  renderProjectedGroupTables();
}

function groupLabel(groupName) {
  const letter = String(groupName || "").match(/[A-L]$/i)?.[0]?.toUpperCase();
  return letter ? `Gruppe ${letter}` : String(groupName || "Gruppe");
}

function groupRound(match) {
  const groupMatches = matches
    .filter((item) => item.groupName === match.groupName)
    .sort((a, b) => new Date(a.kickoffAt) - new Date(b.kickoffAt));
  const index = groupMatches.findIndex((item) => item.id === match.id);
  return index >= 0 ? Math.floor(index / 2) + 1 : null;
}

function stageLabel(match) {
  if (match.stage === "GROUP_STAGE") {
    const round = groupRound(match);
    return `${groupLabel(match.groupName)} · ${round ? `${round}. runde` : "gruppespill"}`;
  }

  return {
    LAST_32: "16-delsfinale",
    LAST_16: "Åttedelsfinale",
    QUARTER_FINALS: "Kvartfinale",
    SEMI_FINALS: "Semifinale",
    THIRD_PLACE: "Bronsefinale",
    FINAL: "Finale",
  }[match.stage] || String(match.stage || "Kamp").replaceAll("_", " ");
}

function isKnockoutMatch(match) {
  return Boolean(match.stage && match.stage !== "GROUP_STAGE");
}

function knockoutTiebreakFields(match, prediction) {
  if (!isKnockoutMatch(match)) return "";
  return `
    <div class="knockout-tiebreak hidden" data-tiebreak>
      <span>Stilling etter 120 min</span>
      <div class="tiebreak-score-group">
        <div class="tiebreak-labels"><small>Hjemme</small><small>Borte</small></div>
        <div class="score-inputs">
          <input type="number" min="0" data-extra-score="home" value="${prediction?.extra_time_home_score ?? ""}" aria-label="Hjemmelag etter ekstraomganger" />
          <input type="number" min="0" data-extra-score="away" value="${prediction?.extra_time_away_score ?? ""}" aria-label="Bortelag etter ekstraomganger" />
        </div>
      </div>
      <div class="penalty-tiebreak hidden" data-penalty-tiebreak>
        <span>Etter straffespark</span>
        <div class="tiebreak-score-group">
          <div class="tiebreak-labels"><small>Hjemme</small><small>Borte</small></div>
          <div class="score-inputs">
            <input type="number" min="0" data-penalty-score="home" value="${prediction?.penalty_home_score ?? ""}" aria-label="Hjemmelag straffespark" />
            <input type="number" min="0" data-penalty-score="away" value="${prediction?.penalty_away_score ?? ""}" aria-label="Bortelag straffespark" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateKnockoutTiebreakVisibility(row) {
  const tiebreak = row.querySelector("[data-tiebreak]");
  if (!tiebreak) return;
  const extraInputs = [...row.querySelectorAll("[data-extra-score]")];
  const penaltyInputs = [...row.querySelectorAll("[data-penalty-score]")];
  const home = row.querySelector('[data-score="home"]').value;
  const away = row.querySelector('[data-score="away"]').value;
  const regularTie = home !== "" && away !== "" && Number(home) === Number(away);
  tiebreak.classList.toggle("hidden", !regularTie);
  extraInputs.forEach((input) => {
    input.disabled = !regularTie;
    if (!regularTie) input.value = "";
  });

  const penalty = row.querySelector("[data-penalty-tiebreak]");
  const extraHome = row.querySelector('[data-extra-score="home"]').value;
  const extraAway = row.querySelector('[data-extra-score="away"]').value;
  const extraTie = regularTie && extraHome !== "" && extraAway !== "" && Number(extraHome) === Number(extraAway);
  penalty.classList.toggle("hidden", !extraTie);
  penaltyInputs.forEach((input) => {
    input.disabled = !extraTie;
    if (!extraTie) input.value = "";
  });
}

function projectedScore(match) {
  const row = document.querySelector(`[data-match-id="${match.id}"]`);
  if (row) {
    const home = row.querySelector('[data-score="home"]').value;
    const away = row.querySelector('[data-score="away"]').value;
    if (home !== "" && away !== "") return [Number(home), Number(away)];
  }

  const prediction = activePrediction(match.id);
  return prediction ? [prediction.home_score, prediction.away_score] : null;
}

function projectedWinnerSide(match) {
  const score = projectedScore(match);
  if (!score) return null;
  if (score[0] !== score[1]) return score[0] > score[1] ? "home" : "away";

  const row = document.querySelector(`[data-match-id="${match.id}"]`);
  const prediction = activePrediction(match.id);
  const extraHome = row?.querySelector('[data-extra-score="home"]')?.value ?? prediction?.extra_time_home_score;
  const extraAway = row?.querySelector('[data-extra-score="away"]')?.value ?? prediction?.extra_time_away_score;
  if (extraHome !== "" && extraHome != null && extraAway !== "" && extraAway != null && Number(extraHome) !== Number(extraAway)) {
    return Number(extraHome) > Number(extraAway) ? "home" : "away";
  }

  const penaltyHome = row?.querySelector('[data-penalty-score="home"]')?.value ?? prediction?.penalty_home_score;
  const penaltyAway = row?.querySelector('[data-penalty-score="away"]')?.value ?? prediction?.penalty_away_score;
  if (penaltyHome !== "" && penaltyHome != null && penaltyAway !== "" && penaltyAway != null && Number(penaltyHome) !== Number(penaltyAway)) {
    return Number(penaltyHome) > Number(penaltyAway) ? "home" : "away";
  }
  return null;
}

function calculateGroupStandings(groupMatches) {
  const teams = new Map();
  const ensureTeam = (name, crest) => {
    if (!teams.has(name)) {
      teams.set(name, {
        name,
        crest,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }
    return teams.get(name);
  };

  groupMatches.forEach((match) => {
    const home = ensureTeam(match.home, match.homeCrest);
    const away = ensureTeam(match.away, match.awayCrest);
    const score = projectedScore(match);
    if (!score) return;

    const [homeScore, awayScore] = score;
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    if (homeScore === awayScore) {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    } else if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    }
  });

  const rows = [...teams.values()]
    .map((team) => ({ ...team, goalDifference: team.goalsFor - team.goalsAgainst }));
  const headToHead = (teamNames) => {
    const mini = new Map(teamNames.map((name) => [name, { points: 0, goalsFor: 0, goalsAgainst: 0 }]));
    groupMatches.forEach((match) => {
      if (!mini.has(match.home) || !mini.has(match.away)) return;
      const score = projectedScore(match);
      if (!score) return;
      const [homeScore, awayScore] = score;
      const home = mini.get(match.home);
      const away = mini.get(match.away);
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;
      if (homeScore === awayScore) {
        home.points += 1;
        away.points += 1;
      } else if (homeScore > awayScore) {
        home.points += 3;
      } else {
        away.points += 3;
      }
    });
    return mini;
  };

  const pointGroups = new Map();
  rows.forEach((team) => {
    if (!pointGroups.has(team.points)) pointGroups.set(team.points, []);
    pointGroups.get(team.points).push(team);
  });
  return [...pointGroups.entries()]
    .sort(([pointsA], [pointsB]) => pointsB - pointsA)
    .flatMap(([, tiedTeams]) => {
      const mini = headToHead(tiedTeams.map((team) => team.name));
      return tiedTeams.sort((a, b) => {
        const miniA = mini.get(a.name);
        const miniB = mini.get(b.name);
        return miniB.points - miniA.points
          || (miniB.goalsFor - miniB.goalsAgainst) - (miniA.goalsFor - miniA.goalsAgainst)
          || miniB.goalsFor - miniA.goalsFor
          || b.goalDifference - a.goalDifference
          || b.goalsFor - a.goalsFor
          || a.name.localeCompare(b.name, "nb");
      });
    });
}

function standingsRows(rows, thirdRanking = false) {
  return rows.map((team, index) => {
    const rowClass = thirdRanking
      ? index < 8 ? "best-third" : ""
      : index < 2 ? "qualifies" : index === 2 ? "third-place" : "";
    return `
      <tr class="${rowClass}">
        <td>${index + 1}</td>
        <td><span class="standing-team">${team.crest ? `<img src="${team.crest}" alt="" />` : ""}${escapeHtml(team.name)}</span></td>
        ${thirdRanking ? `<td>${escapeHtml(team.groupLabel)}</td>` : ""}
        <td>${team.played}</td>
        ${thirdRanking ? "" : `<td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td>`}
        <td>${team.goalsFor}-${team.goalsAgainst}</td>
        <td>${team.goalDifference > 0 ? "+" : ""}${team.goalDifference}</td>
        <td><strong>${team.points}</strong></td>
      </tr>
    `;
  }).join("");
}

const knockoutRounds = [
  {
    title: "16-delsfinaler",
    matches: [
      [73, "2A", "2B"], [74, "1E", "3A/B/C/D/F"], [75, "1F", "2C"], [76, "1C", "2F"],
      [77, "1I", "3C/D/F/G/H"], [78, "2E", "2I"], [79, "1A", "3C/E/F/H/I"], [80, "1L", "3E/H/I/J/K"],
      [81, "1D", "3B/E/F/I/J"], [82, "1G", "3A/E/H/I/J"], [83, "2K", "2L"], [84, "1H", "2J"],
      [85, "1B", "3E/F/G/I/J"], [86, "1J", "2H"], [87, "1K", "3D/E/I/J/L"], [88, "2D", "2G"],
    ],
  },
  {
    title: "Åttedelsfinaler",
    matches: [
      [89, "V74", "V77"], [90, "V73", "V75"], [91, "V76", "V78"], [92, "V79", "V80"],
      [93, "V83", "V84"], [94, "V81", "V82"], [95, "V86", "V88"], [96, "V85", "V87"],
    ],
  },
  { title: "Kvartfinaler", matches: [[97, "V89", "V90"], [98, "V93", "V94"], [99, "V91", "V92"], [100, "V95", "V96"]] },
  { title: "Semifinaler", matches: [[101, "V97", "V98"], [102, "V99", "V100"]] },
  { title: "Bronsefinale og finale", matches: [[103, "T101", "T102"], [104, "V101", "V102"]] },
];

function knockoutSlot(origin, standingsByGroup, qualifyingThirds, thirdAssignments, opposingOrigin) {
  if (/^[12][A-L]$/.test(origin)) {
    const position = Number(origin[0]) - 1;
    const groupLetter = origin[1];
    const group = standingsByGroup.find((item) => item.label === `Gruppe ${groupLetter}`);
    const team = group?.rows[position];
    return {
      name: team?.played === 3 ? team.name : `Nr. ${position + 1} i gruppe ${groupLetter}`,
      crest: team?.played === 3 ? team.crest : "",
      origin: `${position + 1}. plass i gruppe ${groupLetter}`,
    };
  }

  if (origin.startsWith("3")) {
    const assignedTeam = thirdAssignments.get(opposingOrigin);
    if (assignedTeam) {
      return {
        name: assignedTeam.name,
        crest: assignedTeam.crest,
        origin: `3. plass i gruppe ${assignedTeam.groupLetter}`,
      };
    }

    const eligibleLetters = origin.slice(1).split("/");
    const candidates = qualifyingThirds.filter((team) => eligibleLetters.includes(team.groupLetter));
    return {
      name: candidates.length ? candidates.map((team) => team.name).join(" / ") : "En av de beste tredjeplassene",
      crest: candidates.length === 1 ? candidates[0].crest : "",
      origin: `3. plass fra gruppe ${eligibleLetters.join(", ")}`,
    };
  }

  const isWinner = origin.startsWith("V");
  return {
    name: `${isWinner ? "Vinner" : "Taper"} av kamp ${origin.slice(1)}`,
    crest: "",
    origin: "Avgjøres i sluttspillet",
  };
}

function projectedStandingsByGroup() {
  const groupedMatches = matches.filter((match) => match.groupName);
  return [...new Set(groupedMatches.map((match) => match.groupName))]
    .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "nb"))
    .map((groupName) => ({
      groupName,
      label: groupLabel(groupName),
      rows: calculateGroupStandings(groupedMatches.filter((match) => match.groupName === groupName)),
    }));
}

function qualifyingProjectedThirds(standingsByGroup) {
  return standingsByGroup
    .filter((group) => group.rows[2]?.played === 3)
    .map((group) => ({ ...group.rows[2], groupLetter: group.label.slice(-1) }))
    .sort((a, b) => b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.groupLetter.localeCompare(b.groupLetter))
    .slice(0, 8);
}

function projectedThirdPlaceAssignments(qualifyingThirds) {
  if (qualifyingThirds.length !== 8) return new Map();

  const combinationKey = qualifyingThirds
    .map((team) => team.groupLetter)
    .sort()
    .join("");
  const assignment = window.VM_FEBER_THIRD_PLACE_COMBINATIONS?.[combinationKey];
  if (!assignment) return new Map();

  const winnerSlots = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
  return new Map(winnerSlots.map((winnerSlot, index) => [
    winnerSlot,
    qualifyingThirds.find((team) => team.groupLetter === assignment[index]),
  ]));
}

function buildProjectedKnockoutMatchups(standingsByGroup = projectedStandingsByGroup()) {
  const qualifyingThirds = qualifyingProjectedThirds(standingsByGroup);
  const thirdAssignments = projectedThirdPlaceAssignments(qualifyingThirds);
  const matchups = new Map();

  const resolveOrigin = (origin, opposingOrigin) => {
    if (!/^[VT]\d+$/.test(origin)) {
      return knockoutSlot(origin, standingsByGroup, qualifyingThirds, thirdAssignments, opposingOrigin);
    }

    const sourceNumber = Number(origin.slice(1));
    const sourceMatchup = matchups.get(sourceNumber);
    const sourceMatch = matches.find((match) => match.number === sourceNumber);
    const winnerSide = sourceMatch ? projectedWinnerSide(sourceMatch) : null;
    if (!sourceMatchup || !winnerSide) {
      return knockoutSlot(origin, standingsByGroup, qualifyingThirds, thirdAssignments, opposingOrigin);
    }

    const selectedSide = origin.startsWith("V")
      ? winnerSide
      : winnerSide === "home" ? "away" : "home";
    const selected = sourceMatchup[selectedSide];
    return {
      ...selected,
      origin: `${origin.startsWith("V") ? "Vinner" : "Taper"} av kamp ${sourceNumber} · ${selected.origin}`,
    };
  };

  knockoutRounds.forEach((round) => {
    round.matches.forEach(([number, homeOrigin, awayOrigin]) => {
      matchups.set(number, {
        home: resolveOrigin(homeOrigin, awayOrigin),
        away: resolveOrigin(awayOrigin, homeOrigin),
      });
    });
  });

  return matchups;
}

function updateProjectedKnockoutMatchCards(standingsByGroup) {
  if (state.predictionMode !== "full") return;
  const matchups = buildProjectedKnockoutMatchups(standingsByGroup);

  matchups.forEach((matchup, number) => {
    const row = document.querySelector(`[data-match-number="${number}"]`);
    if (!row) return;

    ["home", "away"].forEach((side) => {
      const teamElement = row.querySelector(`[data-projected-team="${side}"]`);
      const details = teamElement?.querySelector(".team-details");
      if (!details) return;
      details.innerHTML = `<strong>${escapeHtml(matchup[side].name)}</strong><small>${escapeHtml(matchup[side].origin)}</small>`;
    });
  });
}

function renderProjectedKnockout(standingsByGroup) {
  const container = document.querySelector("#projectedKnockout");
  const matchups = buildProjectedKnockoutMatchups(standingsByGroup);

  container.innerHTML = knockoutRounds.map((round) => `
    <section class="knockout-round">
      <h3>${round.title}</h3>
      <div class="knockout-grid">
        ${round.matches.map(([number, homeOrigin, awayOrigin]) => {
          const { home, away } = matchups.get(number);
          return `
            <article class="knockout-match">
              <span>Kamp ${number}</span>
              <div class="knockout-team"><strong>${escapeHtml(home.name)}</strong><small>${escapeHtml(home.origin)}</small></div>
              <div class="knockout-team"><strong>${escapeHtml(away.name)}</strong><small>${escapeHtml(away.origin)}</small></div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function renderProjectedGroupTables() {
  const section = document.querySelector("#projectedStandings");
  const grid = document.querySelector("#groupStandingsGrid");
  const thirdPanel = document.querySelector("#thirdPlacePanel");
  const groupedMatches = matches.filter((match) => match.groupName);

  section.classList.toggle("hidden", state.predictionMode !== "full" || !groupedMatches.length);
  if (state.predictionMode !== "full" || !groupedMatches.length) {
    renderLiveGroupPanel();
    return;
  }

  const groups = [...new Set(groupedMatches.map((match) => match.groupName))]
    .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "nb"));
  const standingsByGroup = groups.map((groupName) => ({
    groupName,
    label: groupLabel(groupName),
    rows: calculateGroupStandings(groupedMatches.filter((match) => match.groupName === groupName)),
  }));

  grid.innerHTML = standingsByGroup.map((group) => `
    <article class="group-table-card">
      <h4>${escapeHtml(group.label)}</h4>
      <table class="standings-table">
        <thead><tr><th>#</th><th>Lag</th><th>K</th><th>V</th><th>U</th><th>T</th><th>Mål</th><th>+/-</th><th>P</th></tr></thead>
        <tbody>${standingsRows(group.rows)}</tbody>
      </table>
    </article>
  `).join("");

  const thirdPlaces = standingsByGroup
    .filter((group) => group.rows[2])
    .map((group) => ({ ...group.rows[2], groupLabel: group.label }))
    .sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.name.localeCompare(b.name, "nb"),
    );
  thirdPanel.innerHTML = `
    <h4>Rangering av tredjeplasser</h4>
    <table class="standings-table">
      <thead><tr><th>#</th><th>Lag</th><th>Gr.</th><th>K</th><th>Mål</th><th>+/-</th><th>P</th></tr></thead>
      <tbody>${standingsRows(thirdPlaces, true)}</tbody>
    </table>
    <p class="standings-note">Grønn markering: foreløpig videre. Gruppene bruker innbyrdes oppgjør før samlet målforskjell og scorede mål. Fair play og FIFA-ranking kan ikke beregnes fra tipsene.</p>
  `;
  renderProjectedKnockout(standingsByGroup);
  updateProjectedKnockoutMatchCards(standingsByGroup);
  renderLiveGroupPanel();
}

function setLiveGroupEnabled(enabled) {
  state.liveGroupEnabled = enabled;
  localStorage.setItem("vmFeberLiveGroup", enabled ? "on" : "off");
  document.querySelector("#liveGroupToggle").checked = enabled;
  renderLiveGroupPanel();
}

function renderLiveGroupPanel(groupName = state.activeLiveGroup) {
  const panel = document.querySelector("#liveGroupPanel");
  const predictionsVisible = document.querySelector("#predictions").classList.contains("active");
  let groupMatches = matches.filter((match) => match.groupName === groupName);

  if (!state.liveGroupEnabled || state.predictionMode !== "full" || !predictionsVisible) {
    panel.classList.add("hidden");
    return;
  }

  if (!groupMatches.length) {
    const firstGroupMatch = matches.find((match) => match.groupName);
    if (!firstGroupMatch) {
      panel.classList.add("hidden");
      return;
    }
    groupName = firstGroupMatch.groupName;
    groupMatches = matches.filter((match) => match.groupName === groupName);
  }

  state.activeLiveGroup = groupName;
  const rows = calculateGroupStandings(groupMatches);
  document.querySelector("#liveGroupTitle").textContent = groupLabel(groupName);
  document.querySelector("#liveGroupTable").innerHTML = `
    <table class="standings-table">
      <thead><tr><th>#</th><th>Lag</th><th>K</th><th>+/-</th><th>P</th></tr></thead>
      <tbody>${rows.map((team, index) => `
        <tr class="${index < 2 ? "qualifies" : index === 2 ? "third-place" : ""}">
          <td>${index + 1}</td>
          <td><span class="standing-team">${team.crest ? `<img src="${team.crest}" alt="" />` : ""}${escapeHtml(team.name)}</span></td>
          <td>${team.played}</td>
          <td>${team.goalDifference > 0 ? "+" : ""}${team.goalDifference}</td>
          <td><strong>${team.points}</strong></td>
        </tr>
      `).join("")}</tbody>
    </table>
    <p class="standings-note">Oppdateres umiddelbart når du endrer et resultat i ${escapeHtml(groupLabel(groupName))}.</p>
  `;
  panel.classList.remove("hidden");
}

function renderLeagues() {
  const grid = document.querySelector("#leagueGrid");
  const publicGrid = document.querySelector("#publicLeagueGrid");
  if (!state.sessionUserId) {
    grid.innerHTML = '<p class="muted">Logg inn for å se og opprette ligaer.</p>';
    publicGrid.innerHTML = '<p class="muted">Logg inn for å utforske offentlige ligaer.</p>';
    return;
  }
  if (!state.leagues.length) {
    grid.innerHTML = '<p class="muted">Du er ikke medlem av noen ligaer ennå.</p>';
  } else {
    grid.innerHTML = state.leagues
      .map((league) => {
        return `
          <article class="league-card">
            <div>
              <h4>${escapeHtml(league.name)}</h4>
              <p>${league.member_count} medlemmer · kode ${escapeHtml(league.code)}</p>
              ${league.description ? `<p class="league-description">${escapeHtml(league.description)}</p>` : ""}
            </div>
            <span class="tag">${league.is_main ? "Hovedkonkurranse" : league.is_public ? "Offentlig" : "Privat"} · ${league.member_role === "owner" ? "Eier" : "Medlem"}</span>
            <div class="league-actions">
              ${league.is_main ? "" : `<button data-copy-code="${escapeHtml(league.code)}">Kopier kode</button>`}
              ${!league.is_main && league.member_role === "owner" ? `<button data-edit-league-description="${league.id}" data-current-description="${escapeHtml(league.description || "")}">Rediger beskrivelse</button>` : ""}
              <button data-open-leaderboard="${league.id}">Se poengtavler</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  publicGrid.innerHTML = state.publicLeagues.length
    ? state.publicLeagues
      .map((league) => `
        <article class="league-card">
          <div>
            <h4>${escapeHtml(league.name)}</h4>
            <p>${league.member_count} medlemmer</p>
            ${league.description ? `<p class="league-description">${escapeHtml(league.description)}</p>` : ""}
          </div>
          <span class="tag">Offentlig</span>
          <button data-join-public="${league.id}">Bli med</button>
        </article>
      `)
      .join("")
    : '<p class="muted">Ingen andre offentlige ligaer akkurat nå.</p>';
}

function renderLeaderboardOptions() {
  const select = document.querySelector("#leaderboardSelect");
  select.innerHTML = state.leagues
    .map((league) => `<option value="${league.id}">${escapeHtml(league.name)}</option>`)
    .join("");
  if (select.value) renderLeaderboard();
}

async function renderLeaderboard() {
  const leagueId = document.querySelector("#leaderboardSelect").value;
  const mode = document.querySelector("#leaderboardModeSelect").value;
  const dateInput = document.querySelector("#leaderboardDate");
  const feedback = document.querySelector("#leaderboardFeedback");
  const board = document.querySelector("#leaderboard");
  const isDailyDate = mode === "daglig-dato";

  dateInput.classList.toggle("hidden", !isDailyDate);
  if (isDailyDate && !dateInput.value) dateInput.value = osloDateKey(new Date());

  if (!leagueId || !state.sessionUserId) {
    board.innerHTML = '<p class="muted">Logg inn og velg en liga for å se poengtavlen.</p>';
    closeMemberPredictions();
    return;
  }

  closeMemberPredictions();
  feedback.textContent = "Laster poengtavle...";
  const { data, error } = await window.vmFeberSupabase.rpc("get_league_leaderboard", {
    selected_league_id: leagueId,
    competition_slug: mode === "full-vm" ? "full-vm" : "daglig",
    match_day: isDailyDate ? dateInput.value : null,
  });

  if (error) {
    feedback.textContent = error.message;
    board.innerHTML = "";
    return;
  }

  state.leaderboardRows = data || [];
  feedback.textContent = mode === "full-vm"
    ? "Full VM totalt"
    : isDailyDate
      ? `Daglig poengtavle for ${dateInput.value}`
      : "Daglig totalt gjennom hele VM";
  board.innerHTML = state.leaderboardRows
    .map(
      (row) => `
        <button class="leader-row" data-view-member="${row.user_id}" data-member-name="${escapeHtml(row.username)}">
          <span class="rank">${row.rank}</span>
          <div class="leader-main">
            <strong>${escapeHtml(row.username)}</strong>
            <span>${row.exact_results} eksakte resultater · ${row.scored_predictions} tips med poeng</span>
          </div>
          <span class="points">${row.points}</span>
        </button>
      `,
    )
    .join("");

}

function predictionResultLabel(row) {
  if (row.result_home_score == null || row.result_away_score == null) return "Ikke ferdigspilt";
  return `Resultat ${row.result_home_score}-${row.result_away_score}`;
}

function memberPredictionLabel(row) {
  let label = `Tips ${row.predicted_home_score}-${row.predicted_away_score}`;
  if (row.predicted_extra_time_home_score != null && row.predicted_extra_time_away_score != null) {
    label += ` · etter 120 min ${row.predicted_extra_time_home_score}-${row.predicted_extra_time_away_score}`;
  }
  if (row.predicted_penalty_home_score != null && row.predicted_penalty_away_score != null) {
    label += ` · straffer ${row.predicted_penalty_home_score}-${row.predicted_penalty_away_score}`;
  }
  return label;
}

function predictionPointsLabel(row) {
  if (row.result_home_score == null || row.result_away_score == null) return "Venter";
  if (row.points === 3) return "3 poeng · eksakt resultat";
  if (row.points === 1) return "1 poeng · riktig kamputfall";
  return "0 poeng";
}

function closeMemberPredictions() {
  document.querySelector("#memberPredictions").classList.add("hidden");
  document.querySelector("#memberPredictionList").innerHTML = "";
  document.querySelector("#memberPredictionsFeedback").textContent = "";
}

async function showMemberPredictions(userId, username) {
  const leagueId = document.querySelector("#leaderboardSelect").value;
  const mode = document.querySelector("#leaderboardModeSelect").value;
  const dateInput = document.querySelector("#leaderboardDate");
  const isDailyDate = mode === "daglig-dato";
  const panel = document.querySelector("#memberPredictions");
  const feedback = document.querySelector("#memberPredictionsFeedback");
  const list = document.querySelector("#memberPredictionList");

  panel.classList.remove("hidden");
  document.querySelector("#memberPredictionsTitle").textContent = `${username} sine tips`;
  feedback.textContent = "Laster tips...";
  list.innerHTML = "";

  const { data, error } = await window.vmFeberSupabase.rpc("get_league_member_predictions", {
    selected_league_id: leagueId,
    selected_user_id: userId,
    selected_competition_slug: mode === "full-vm" ? "full-vm" : "daglig",
    selected_match_day: isDailyDate ? dateInput.value : null,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  const rows = data || [];
  feedback.textContent = rows.length
    ? `${rows.length} tips er synlige etter fristen.`
    : "Ingen tips er tilgjengelige etter fristen ennå.";
  list.innerHTML = rows.map((row) => `
    <article class="member-prediction-row">
      <div>
        <strong>${escapeHtml(row.home_team)} - ${escapeHtml(row.away_team)}</strong>
        <span>${escapeHtml(formatKickoff(row.kickoff_at))} · ${escapeHtml(stageLabel({
          stage: row.stage,
          groupName: row.group_name,
        }))}</span>
      </div>
      <div class="member-prediction-summary">
        <span>${escapeHtml(memberPredictionLabel(row))}</span>
        <span>${escapeHtml(predictionResultLabel(row))}</span>
      </div>
      <strong class="member-prediction-points">${escapeHtml(predictionPointsLabel(row))}</strong>
    </article>
  `).join("");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAdmin() {
  const statistics = state.adminStatistics;
  document.querySelector("#adminStatisticsStatus").textContent =
    statistics ? "Oppdatert ved lasting av siden" : "Statistikk ikke tilgjengelig";
  document.querySelector("#adminStatisticsGrid").innerHTML = statistics ? `
    <article><span>Registrerte brukere</span><strong>${statistics.registered_users}</strong><small>${statistics.users_with_predictions} har levert minst ett tips</small></article>
    <article><span>Lagrede tips</span><strong>${statistics.total_predictions}</strong><small>${statistics.full_vm_predictions} Full VM · ${statistics.daily_predictions} Daglig</small></article>
    <article><span>Opprettede ligaer</span><strong>${statistics.created_leagues}</strong><small>${statistics.private_leagues} private · ${statistics.public_leagues} offentlige</small></article>
    <article><span>Ligadeltakere</span><strong>${statistics.unique_league_participants}</strong><small>${statistics.league_memberships} medlemskap totalt</small></article>
  ` : '<p class="muted">Kjør admin-statistikkmigrasjonen for å aktivere oversikten.</p>';
  document.querySelector("#adminStatisticsDetail").textContent = statistics
    ? `${statistics.email_consented_users} brukere har samtykket til konkurranserelatert e-post. Hovedkonkurransen er ikke med i ligatallene.`
    : "";

  document.querySelector("#inviteList").innerHTML = state.adminInvitations.length
    ? state.adminInvitations
      .map((invite) => `
        <div class="invite-row">
          <strong>${escapeHtml(invite.code)}</strong>
          <span>${escapeHtml(invite.label)}</span>
          <span>${invite.use_count}${invite.max_uses ? `/${invite.max_uses}` : ""} registrerte</span>
          <button data-copy-invite="${escapeHtml(invite.code)}">Kopier</button>
        </div>
      `)
      .join("")
    : '<p class="muted">Ingen invitasjonskoder er laget ennå.</p>';

  document.querySelector("#resultList").innerHTML = results
    .map(([match, status]) => `<div class="result-row"><strong>${match}</strong><span>${status}</span></div>`)
    .join("");

  document.querySelector("#backupList").innerHTML = state.backups.length
    ? state.backups
      .map((backup) => `
        <div class="backup-row">
          <strong>${backup.backup_type === "full-vm" ? "Full VM" : `Daglig ${backup.match_date}`}</strong>
          <strong>${backup.prediction_count} tips</strong>
          <span>${backup.user_count} registrerte · laget ${formatKickoff(backup.created_at)}</span>
          <span>${backup.email_sent ? "E-post sendt" : backup.email_error || "E-post ikke sendt"}</span>
        </div>
      `)
      .join("")
    : '<p class="muted">Ingen backuper er laget ennå.</p>';

  document.querySelector("#adminUserSummary").textContent =
    `${state.adminUsers.length} registrerte brukere · ${state.adminUsers.filter((user) => user.registration_source === "invitation").length} via invitasjon`;
  document.querySelector("#adminUserList").innerHTML = state.adminUsers.length
    ? state.adminUsers
      .map((user) => `
        <div class="admin-user-row">
          <strong>${escapeHtml(user.username)}</strong>
          <span>${escapeHtml(user.email)}</span>
          <span>${formatKickoff(user.created_at)}</span>
          <span class="admin-user-meta">
            ${user.invite_code ? `Invitasjon ${escapeHtml(user.invite_code)}` : "Åpen registrering"}
            · E-post: ${user.email_contact_consent ? "samtykke gitt" : "ikke tillatt"}
            · Full VM: ${user.full_prediction_count} tips
            · Daglig: ${user.daily_prediction_count} tips
            · Ligaer: ${user.league_names.length ? user.league_names.map(escapeHtml).join(", ") : "ingen"}
          </span>
        </div>
      `)
      .join("")
    : '<p class="muted">Ingen registrerte brukere funnet.</p>';

  document.querySelector("#testUserList").innerHTML = state.testUsers.length
    ? state.testUsers
      .map((user) => `
        <div class="admin-user-row">
          <strong>${escapeHtml(user.username)} <span class="tag">Test</span></strong>
          <span>Full VM: ${user.full_prediction_count} tips · ${user.full_points} poeng</span>
          <span>Daglig: ${user.daily_prediction_count} tips · ${user.daily_points} poeng</span>
          <div class="admin-user-actions">
            <button data-randomize-test="${user.id}" data-test-mode="full-vm">Tilfeldig Full VM</button>
            <button data-randomize-test="${user.id}" data-test-mode="daglig">Tilfeldig Daglig</button>
            <button class="danger-button" data-delete-test="${user.id}" data-test-name="${escapeHtml(user.username)}">Slett</button>
          </div>
        </div>
      `)
      .join("")
    : '<p class="muted">Ingen testbrukere er opprettet.</p>';
}

async function createInvitation() {
  const labelInput = document.querySelector("#newInviteLabel");
  const maxUsesInput = document.querySelector("#newInviteMaxUses");
  const feedback = document.querySelector("#inviteFeedback");
  const maxUses = maxUsesInput.value ? Number(maxUsesInput.value) : null;

  const { data, error } = await window.vmFeberSupabase.rpc("create_invitation", {
    invitation_label: labelInput.value.trim(),
    invitation_max_uses: maxUses,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `Invitasjonskoden ${data.code} er opprettet.`;
  labelInput.value = "";
  maxUsesInput.value = "";
  await loadAdminData();
  renderAdmin();
}

async function createTestUser() {
  const input = document.querySelector("#newTestUsername");
  const feedback = document.querySelector("#testUserFeedback");
  const { data, error } = await window.vmFeberSupabase.rpc("create_test_user", {
    test_username: input.value.trim(),
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `${data.username} er opprettet som testbruker.`;
  input.value = "";
  await loadAdminData();
  renderAdmin();
}

async function randomizeTestUser(testUserId, competitionSlug) {
  const feedback = document.querySelector("#testUserFeedback");
  const { data, error } = await window.vmFeberSupabase.rpc("randomize_test_user_predictions", {
    selected_test_user_id: testUserId,
    competition_slug: competitionSlug,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `${data} tilfeldige ${competitionSlug === "full-vm" ? "Full VM" : "Daglig"}-tips ble lagret.`;
  await loadAdminData();
  renderAdmin();
}

async function deleteTestUser(testUserId, username) {
  if (!window.confirm(`Slette testbrukeren ${username} og alle tipsene?`)) return;

  const feedback = document.querySelector("#testUserFeedback");
  const { error } = await window.vmFeberSupabase.rpc("delete_test_user", {
    selected_test_user_id: testUserId,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `${username} er slettet.`;
  await loadAdminData();
  renderAdmin();
}

function renderUser() {
  const loginPanel = document.querySelector("#loginPanel");
  const userPanel = document.querySelector("#userPanel");
  const feedback = document.querySelector("#loginFeedback");
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !state.isAdmin);
  });

  if (feedback && !state.supabaseReady) {
    feedback.textContent = "Demo-modus: fyll inn Supabase URL og anon key for ekte magic link.";
  }

  if (state.user) {
    loginPanel.classList.add("hidden");
    userPanel.classList.remove("hidden");
    document.querySelector("#userEmail").textContent = `${state.user.username} · ${state.user.email}`;
    setPredictionFeedback("Tipsene lagres separat for valgt konkurranse.");
  } else {
    loginPanel.classList.remove("hidden");
    userPanel.classList.add("hidden");
    setPredictionFeedback("Logg inn for å lagre tipsene dine.");
  }
  document.querySelector("#mobileLoginButton").classList.toggle("hidden", Boolean(state.user));
  renderSettings();
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelector("#viewTitle").textContent = viewTitles[viewId];
  renderLiveGroupPanel();
  closeMobileMenu();
}

function setMobileMenu(open) {
  document.body.classList.toggle("mobile-menu-open", open);
  document.querySelector("#mobileMenuButton").setAttribute("aria-expanded", String(open));
}

function closeMobileMenu() {
  setMobileMenu(false);
}

function showLiveGroupForMatchRow(row) {
  const match = matches.find((item) => item.id === row?.dataset.matchId);
  if (!match?.groupName) return;
  state.activeLiveGroup = match.groupName;
  renderLiveGroupPanel(match.groupName);
}

async function joinLeague(code) {
  const feedback = document.querySelector("#leagueFeedback");

  if (state.supabaseReady && state.user) {
    const { data, error } = await window.vmFeberSupabase.rpc("join_league_by_code", {
      join_code: code,
    });

    if (error) {
      feedback.textContent = error.message || "Fant ingen liga med den koden.";
      return;
    }

    feedback.textContent = `Du er nå med i ${data.name}.`;
    document.querySelector("#leagueCode").value = "";
    await loadLeagues();
    renderLeagues();
    renderLeaderboardOptions();
    return;
  }

  feedback.textContent = "Du må være innlogget for å bli med i en liga.";
}

async function createLeague() {
  const nameInput = document.querySelector("#newLeagueName");
  const descriptionInput = document.querySelector("#newLeagueDescription");
  const visibilityInput = document.querySelector("#newLeagueVisibility");
  const feedback = document.querySelector("#createLeagueFeedback");

  if (!state.sessionUserId) {
    feedback.textContent = "Du må være innlogget for å opprette en liga.";
    return;
  }

  const { data, error } = await window.vmFeberSupabase.rpc("create_league", {
    league_name: nameInput.value.trim(),
    league_is_public: visibilityInput.value === "public",
    league_description: descriptionInput.value.trim() || null,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `${data.name} er opprettet med kode ${data.code}.`;
  nameInput.value = "";
  descriptionInput.value = "";
  visibilityInput.value = "private";
  await loadLeagues();
  renderLeagues();
  renderLeaderboardOptions();
}

async function editLeagueDescription(leagueId, currentDescription) {
  const description = window.prompt("Beskrivelse av ligaen (maks 240 tegn):", currentDescription);
  if (description === null) return;
  const feedback = document.querySelector("#leagueFeedback");
  const { error } = await window.vmFeberSupabase.rpc("update_league_description", {
    selected_league_id: leagueId,
    league_description: description,
  });
  if (error) {
    feedback.textContent = error.message;
    return;
  }
  feedback.textContent = "Ligabeskrivelsen er oppdatert.";
  await loadLeagues();
  renderLeagues();
}

async function joinPublicLeague(leagueId) {
  const feedback = document.querySelector("#leagueFeedback");
  const { data, error } = await window.vmFeberSupabase.rpc("join_public_league", {
    selected_league_id: leagueId,
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `Du er nå med i ${data.name}.`;
  await loadLeagues();
  renderLeagues();
  renderLeaderboardOptions();
}

async function copyLeagueCode(code) {
  const feedback = document.querySelector("#leagueFeedback");
  try {
    await navigator.clipboard.writeText(code);
    feedback.textContent = `Ligakoden ${code} er kopiert.`;
  } catch {
    feedback.textContent = `Ligakode: ${code}`;
  }
}

async function copyInvitationCode(code) {
  const feedback = document.querySelector("#inviteFeedback");
  try {
    await navigator.clipboard.writeText(code);
    feedback.textContent = `Invitasjonskoden ${code} er kopiert.`;
  } catch {
    feedback.textContent = `Invitasjonskode: ${code}`;
  }
}

function bindEvents() {
  document.querySelector("#mobileMenuButton").addEventListener("click", () => setMobileMenu(true));
  document.querySelector("#mobileMenuClose").addEventListener("click", closeMobileMenu);
  document.querySelector("#mobileMenuBackdrop").addEventListener("click", closeMobileMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileMenu();
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelector("#loginButton").addEventListener("click", async () => {
    const email = document.querySelector("#emailInput").value.trim();
    const username = document.querySelector("#usernameInput").value.trim();
    const inviteCode = document.querySelector("#inviteInput").value.trim();
    const emailConsent = document.querySelector("#emailConsentInput").checked;
    if (!username) {
      document.querySelector("#loginFeedback").textContent = "Velg et brukernavn som kan vises på poengtavlene.";
      return;
    }
    if (!email || !email.includes("@")) {
      document.querySelector("#loginFeedback").textContent = "Skriv inn en gyldig e-postadresse.";
      return;
    }
    if (!emailConsent) {
      document.querySelector("#loginFeedback").textContent =
        "Du må samtykke til e-post om konkurransen før vi kan etablere brukeren.";
      return;
    }

    if (state.supabaseReady) {
      await sendMagicLink(email, username, inviteCode, emailConsent);
      return;
    }

    state.user = { email, username, inviteCode: inviteCode || "åpen registrering" };
    save();
    renderUser();
  });
  document.querySelector("#mobileLoginButton").addEventListener("click", () => {
    setMobileMenu(true);
    window.setTimeout(() => document.querySelector("#usernameInput").focus(), 200);
  });

  const logout = () => {
    state.user = null;
    state.sessionUserId = null;
    state.predictions = {};
    state.leagues = [];
    state.publicLeagues = [];
    state.leaderboardRows = [];
    state.adminInvitations = [];
    state.adminUsers = [];
    state.adminStatistics = null;
    state.testUsers = [];
    state.bonusPredictions = {};
    state.playerSearchResults = {};
    state.isAdmin = false;
    save();
    if (state.supabaseReady) {
      window.vmFeberSupabase.auth.signOut();
    }
    renderUser();
    renderLeagues();
    renderLeaderboardOptions();
    setView("overview");
  };
  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#settingsLogoutButton").addEventListener("click", logout);
  document.querySelector("#saveProfileButton").addEventListener("click", saveProfileSettings);
  document.querySelector("#createInviteButton").addEventListener("click", createInvitation);
  document.querySelector("#createTestUserButton").addEventListener("click", createTestUser);
  document.querySelector("#inviteList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-invite]");
    if (button) copyInvitationCode(button.dataset.copyInvite);
  });
  document.querySelector("#testUserList").addEventListener("click", (event) => {
    const randomizeButton = event.target.closest("[data-randomize-test]");
    if (randomizeButton) {
      randomizeTestUser(randomizeButton.dataset.randomizeTest, randomizeButton.dataset.testMode);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-test]");
    if (deleteButton) deleteTestUser(deleteButton.dataset.deleteTest, deleteButton.dataset.testName);
  });

  document.querySelector("#defaultCompetition").addEventListener("change", (event) => {
    state.predictionMode = event.target.value;
    localStorage.setItem("vmFeberDefaultCompetition", state.predictionMode);
    document.querySelectorAll(".segment").forEach((segment) => {
      segment.classList.toggle("active", segment.dataset.predictionMode === state.predictionMode);
    });
    renderMatches();
  });

  document.querySelector("#themeSelect").addEventListener("change", (event) => applyTheme(event.target.value));
  document.querySelector("#liveGroupToggle").addEventListener("change", (event) => {
    setLiveGroupEnabled(event.target.checked);
  });
  document.querySelector("#closeLiveGroupButton").addEventListener("click", () => setLiveGroupEnabled(false));

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.predictionMode = button.dataset.predictionMode;
      document.querySelectorAll(".segment").forEach((segment) => segment.classList.remove("active"));
      button.classList.add("active");
      setPredictionFeedback(
        state.sessionUserId ? "Tipsene lagres separat for denne konkurransen." : "Logg inn for å lagre tipsene dine.",
      );
      renderMatches();
    });
  });

  document.querySelector("#continueTipsButton").addEventListener("click", () => setView("predictions"));
  document.querySelector("#randomizeVisibleButton").addEventListener("click", randomizeVisiblePredictions);
  document.querySelector("#saveVisibleButton").addEventListener("click", saveVisiblePredictions);

  document.querySelector("#matchList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-save-prediction]");
    if (button) savePrediction(button.dataset.savePrediction);
  });

  document.querySelector("#matchList").addEventListener("input", (event) => {
    if (!event.target.matches("[data-score], [data-extra-score], [data-penalty-score]")) return;
    const row = event.target.closest("[data-match-id]");
    updateKnockoutTiebreakVisibility(row);
    showLiveGroupForMatchRow(row);
    row.querySelector(".save-prediction").textContent = "Lagre";
    setPredictionFeedback("Du har ulagrede endringer.");
    renderProjectedGroupTables();
  });
  document.querySelector("#matchList").addEventListener("focusin", (event) => {
    if (event.target.matches("[data-score]")) showLiveGroupForMatchRow(event.target.closest("[data-match-id]"));
  });
  document.querySelector("#bonusPanel").addEventListener("click", (event) => {
    const playerButton = event.target.closest("[data-select-player]");
    if (playerButton) {
      const row = playerButton.closest("[data-bonus-question]");
      const player = state.playerSearchResults[playerButton.dataset.questionSlug]?.find(
        (item) => item.id === playerButton.dataset.selectPlayer,
      );
      if (!row || !player) return;
      row.querySelector("[data-player-search]").value = `${player.player_name} (${player.team_name})`;
      row.querySelector("[data-bonus-answer]").value = player.id;
      row.querySelector("[data-player-results]").innerHTML = "";
      row.querySelector("[data-bonus-feedback]").textContent = "Valgt, men ikke lagret ennå.";
      return;
    }

    const saveButton = event.target.closest("[data-save-bonus]");
    if (saveButton) saveBonusPrediction(saveButton.dataset.saveBonus);
  });
  document.querySelector("#bonusPanel").addEventListener("input", (event) => {
    const input = event.target.closest("[data-player-search]");
    if (!input) return;
    const questionSlug = input.dataset.playerSearch;
    input.closest("[data-bonus-question]").querySelector("[data-bonus-answer]").value = "";
    window.clearTimeout(state.playerSearchTimers[questionSlug]);
    state.playerSearchTimers[questionSlug] = window.setTimeout(
      () => searchPlayersForQuestion(questionSlug, input.value),
      180,
    );
  });

  document.querySelector("#joinLeagueButton").addEventListener("click", () => {
    joinLeague(document.querySelector("#leagueCode").value);
  });
  document.querySelector("#createLeagueButton").addEventListener("click", createLeague);

  document.querySelector("#leagueGrid").addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-code]");
    if (copyButton) {
      copyLeagueCode(copyButton.dataset.copyCode);
      return;
    }
    const descriptionButton = event.target.closest("[data-edit-league-description]");
    if (descriptionButton) {
      editLeagueDescription(
        descriptionButton.dataset.editLeagueDescription,
        descriptionButton.dataset.currentDescription,
      );
      return;
    }
    const button = event.target.closest("[data-open-leaderboard]");
    if (!button) return;
    document.querySelector("#leaderboardSelect").value = button.dataset.openLeaderboard;
    setView("leaderboards");
    renderLeaderboard();
  });
  document.querySelector("#publicLeagueGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-join-public]");
    if (button) joinPublicLeague(button.dataset.joinPublic);
  });

  document.querySelector("#leaderboardSelect").addEventListener("change", renderLeaderboard);
  document.querySelector("#leaderboardModeSelect").addEventListener("change", renderLeaderboard);
  document.querySelector("#leaderboardDate").addEventListener("change", renderLeaderboard);
  document.querySelector("#leaderboard").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-member]");
    if (button) showMemberPredictions(button.dataset.viewMember, button.dataset.memberName);
  });
  document.querySelector("#closeMemberPredictionsButton").addEventListener("click", closeMemberPredictions);

  document.querySelector("#syncMatchesButton").addEventListener("click", () => {
    if (!state.supabaseReady || !state.user) {
      document.querySelector("#syncFeedback").textContent = "Du må være innlogget som admin.";
      return;
    }
    syncWorldCupMatches();
  });
}

async function init() {
  state.predictionMode = localStorage.getItem("vmFeberDefaultCompetition") || state.predictionMode;
  applyTheme();
  await syncSupabaseSession();
  await loadMatches();
  await loadPredictions();
  await loadBonusQuestions();
  await loadMyBonusPredictions();
  await loadBackups();
  await loadLeagues();
  await loadAdminData();
  renderModes();
  renderRules();
  renderMatches();
  renderLeagues();
  renderLeaderboardOptions();
  renderAdmin();
  renderUser();
  updateDashboard();
  bindEvents();
  if (window.lucide) window.lucide.createIcons();
}

init();
