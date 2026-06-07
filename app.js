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
  isAdmin: false,
  theme: localStorage.getItem("vmFeberTheme") || "system",
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

  matches = data.map((match) => ({
    id: match.id,
    home: match.home_team,
    away: match.away_team,
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
    .select("competition_id,match_id,home_score,away_score,source,updated_at");

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
    return;
  }

  const [{ data: invitations, error: invitationError }, { data: users, error: userError }] =
    await Promise.all([
      window.vmFeberSupabase.rpc("get_admin_invitations"),
      window.vmFeberSupabase.rpc("get_admin_users"),
    ]);

  state.adminInvitations = invitationError ? [] : invitations || [];
  state.adminUsers = userError ? [] : users || [];

  const feedback = document.querySelector("#inviteFeedback");
  if (invitationError || userError) {
    feedback.textContent = invitationError?.message || userError?.message || "Kunne ikke laste admindata.";
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
  const button = row.querySelector(".save-prediction");

  if (homeScore === "" || awayScore === "") {
    setPredictionFeedback("Fyll inn både hjemme- og bortemål.", "error");
    return false;
  }

  button.disabled = true;
  button.textContent = "Lagrer";

  const { data, error } = await window.vmFeberSupabase.rpc("save_match_prediction", {
    competition_slug: activeCompetitionSlug(),
    selected_match_id: matchId,
    predicted_home_score: Number(homeScore),
    predicted_away_score: Number(awayScore),
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
  for (const row of rows) {
    if (await savePrediction(row.dataset.matchId)) savedCount += 1;
  }
  button.disabled = false;
  button.textContent = "Lagre synlige tips";
  setPredictionFeedback(`${savedCount} tips ble lagret.`, "success");
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
    row.querySelector('[data-score="home"]').value = randomScore();
    row.querySelector('[data-score="away"]').value = randomScore();
    row.querySelector(".save-prediction").textContent = "Lagre";
  });
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
    .select("username,email,invite_code,registration_source,is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profile || pendingProfile) localStorage.removeItem("vmFeberPendingProfile");

  state.user = {
    email: profile?.email || session.user.email,
    username: profile?.username || session.user.email?.split("@")[0] || "bruker",
    inviteCode: profile?.invite_code || profile?.registration_source || "åpen registrering",
  };
  state.isAdmin = Boolean(profile?.is_admin);
  save();
}

async function sendMagicLink(email, username, inviteCode) {
  if (inviteCode) {
    const { data: isValid, error: validationError } = await window.vmFeberSupabase
      .rpc("validate_invitation_code", { check_code: inviteCode });
    if (validationError || !isValid) {
      document.querySelector("#loginFeedback").textContent =
        validationError?.message || "Invitasjonskoden finnes ikke eller er brukt opp.";
      return false;
    }
  }

  localStorage.setItem("vmFeberPendingProfile", JSON.stringify({ username, inviteCode }));

  const redirectTo = window.location.href.split("#")[0].split("?")[0];
  const { error } = await window.vmFeberSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        username,
        invite_code: inviteCode || null,
      },
    },
  });

  if (error) {
    document.querySelector("#loginFeedback").textContent = `Kunne ikke sende magic link: ${error.message}`;
    return false;
  }

  document.querySelector("#loginFeedback").textContent = "Magic link sendt. Sjekk e-posten din.";
  return true;
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

function renderMatches() {
  const extra =
    state.predictionMode === "full"
      ? `
        <div class="bonus-panel">
          <h3>Bonus og sluttspill</h3>
          <div class="bonus-grid">
            <label>Verdensmester<input placeholder="Velg lag" /></label>
            <label>Finalemotstander<input placeholder="Velg lag" /></label>
            <label>Toppscorer<input placeholder="Spiller" /></label>
            <label>Gruppevinner gruppe A<input placeholder="Velg lag" /></label>
          </div>
        </div>
      `
      : "";

  let lastDay = "";
  document.querySelector("#matchList").innerHTML = visibleMatches()
    .map((match) => {
        const day = match.kickoffAt ? osloDateKey(match.kickoffAt) : match.date;
        const heading = day !== lastDay ? `<div class="match-day">${match.date.split(" kl.")[0]}</div>` : "";
        lastDay = day;
        const prediction = activePrediction(match.id);
        return `${heading}
        <article class="match-row" data-match-id="${match.id}">
          <div class="team">${match.homeCrest ? `<img class="flag" src="${match.homeCrest}" alt="" />` : `<span class="flag" style="background:${match.homeColor}"></span>`}${match.home}</div>
          <div class="score-inputs">
            <input type="number" min="0" data-score="home" value="${prediction?.home_score ?? ""}" aria-label="${match.home} mål" />
            <input type="number" min="0" data-score="away" value="${prediction?.away_score ?? ""}" aria-label="${match.away} mål" />
          </div>
          <div class="team">${match.awayCrest ? `<img class="flag" src="${match.awayCrest}" alt="" />` : `<span class="flag" style="background:${match.awayColor}"></span>`}${match.away}</div>
          <div class="deadline">${match.date}<br />${match.deadline}</div>
          <button class="save-prediction" data-save-prediction="${match.id}" ${state.sessionUserId ? "" : "disabled"}>
            ${prediction?.inheritedFromFull ? "Bruk Full VM" : prediction ? "Lagret" : "Lagre"}
          </button>
        </article>
      `;
      },
    )
    .join("");

  document.querySelector("#bonusPanel").innerHTML = extra;
  updatePredictionToolbar();
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
            </div>
            <span class="tag">${league.is_main ? "Hovedkonkurranse" : league.is_public ? "Offentlig" : "Privat"} · ${league.member_role === "owner" ? "Eier" : "Medlem"}</span>
            <div class="league-actions">
              ${league.is_main ? "" : `<button data-copy-code="${escapeHtml(league.code)}">Kopier kode</button>`}
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
    return;
  }

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
        <div class="leader-row">
          <span class="rank">${row.rank}</span>
          <div class="leader-main">
            <strong>${escapeHtml(row.username)}</strong>
            <span>${row.exact_results} eksakte resultater · ${row.scored_predictions} tips med poeng</span>
          </div>
          <span class="points">${row.points}</span>
        </div>
      `,
    )
    .join("");

}

function renderAdmin() {
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
            · Full VM: ${user.full_prediction_count} tips
            · Daglig: ${user.daily_prediction_count} tips
            · Ligaer: ${user.league_names.length ? user.league_names.map(escapeHtml).join(", ") : "ingen"}
          </span>
        </div>
      `)
      .join("")
    : '<p class="muted">Ingen registrerte brukere funnet.</p>';
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
  renderSettings();
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelector("#viewTitle").textContent = viewTitles[viewId];
  closeMobileMenu();
}

function setMobileMenu(open) {
  document.body.classList.toggle("mobile-menu-open", open);
  document.querySelector("#mobileMenuButton").setAttribute("aria-expanded", String(open));
}

function closeMobileMenu() {
  setMobileMenu(false);
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
  const visibilityInput = document.querySelector("#newLeagueVisibility");
  const feedback = document.querySelector("#createLeagueFeedback");

  if (!state.sessionUserId) {
    feedback.textContent = "Du må være innlogget for å opprette en liga.";
    return;
  }

  const { data, error } = await window.vmFeberSupabase.rpc("create_league", {
    league_name: nameInput.value.trim(),
    league_is_public: visibilityInput.value === "public",
  });

  if (error) {
    feedback.textContent = error.message;
    return;
  }

  feedback.textContent = `${data.name} er opprettet med kode ${data.code}.`;
  nameInput.value = "";
  visibilityInput.value = "private";
  await loadLeagues();
  renderLeagues();
  renderLeaderboardOptions();
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
    if (!username) {
      document.querySelector("#loginFeedback").textContent = "Velg et brukernavn som kan vises på poengtavlene.";
      return;
    }
    if (!email || !email.includes("@")) {
      document.querySelector("#loginFeedback").textContent = "Skriv inn en gyldig e-postadresse.";
      return;
    }

    if (state.supabaseReady) {
      await sendMagicLink(email, username, inviteCode);
      return;
    }

    state.user = { email, username, inviteCode: inviteCode || "åpen registrering" };
    save();
    renderUser();
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
  document.querySelector("#inviteList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-invite]");
    if (button) copyInvitationCode(button.dataset.copyInvite);
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
    if (!event.target.matches("[data-score]")) return;
    const row = event.target.closest("[data-match-id]");
    row.querySelector(".save-prediction").textContent = "Lagre";
    setPredictionFeedback("Du har ulagrede endringer.");
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
