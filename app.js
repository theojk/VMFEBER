const state = {
  user: JSON.parse(localStorage.getItem("vmFeberUser") || "null"),
  leagues: JSON.parse(localStorage.getItem("vmFeberLeagues") || '["total","kollektiv"]'),
  predictionMode: "daily",
  supabaseReady: Boolean(window.vmFeberSupabaseReady),
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
    deadline: "Full VM: samlet frist · Daglig: kl. 12:00",
  }));
}

async function syncWorldCupMatches() {
  const feedback = document.querySelector("#syncFeedback");
  feedback.textContent = "Synkroniserer kampdata...";

  const { data, error } = await window.vmFeberSupabase.functions.invoke("sync-world-cup");
  if (error || data?.error) {
    feedback.textContent = `Synkronisering feilet: ${data?.error || error.message}`;
    return;
  }

  await loadMatches();
  renderMatches();
  feedback.textContent = `${data.synced} kamper ble synkronisert.`;
}

const leagues = [
  { id: "total", name: "Hovedkonkurranse", code: "ALL", members: 48, open: true },
  { id: "kollektiv", name: "Kollektivet", code: "FEBER24", members: 7, open: true },
  { id: "jobb", name: "Jobbliga", code: "KAFFE", members: 12, open: false },
  { id: "familie", name: "Familie", code: "SØNDAG", members: 9, open: false },
];

const leaderboardData = {
  total: [
    ["Tippemester", "Åpen registrering", 42],
    ["Nordlys", "Invitasjon: Ola", 39],
    ["SisteMinutt", "Åpen registrering", 35],
    ["VMKongen", "Invitasjon: deg", 33],
  ],
  kollektiv: [
    ["Nordlys", "Kollektivet", 39],
    ["VMKongen", "Kollektivet", 33],
    ["SisteMinutt", "Kollektivet", 31],
  ],
  jobb: [
    ["Kaffe først", "Jobbliga", 28],
    ["ExcelFarvel", "Jobbliga", 25],
  ],
  familie: [
    ["Onkel Offside", "Familie", 31],
    ["Finalemor", "Familie", 30],
  ],
};

const invites = [
  ["OLA-VM", "Sendt til Ola", "3 registrerte"],
  ["VENNER-26", "Åpen vennelenke", "8 registrerte"],
  ["TEST-LIGA", "Intern test", "1 registrert"],
];

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
  admin: "Admin",
};

function save() {
  localStorage.setItem("vmFeberUser", JSON.stringify(state.user));
  localStorage.setItem("vmFeberLeagues", JSON.stringify(state.leagues));
}

async function syncSupabaseSession() {
  if (!state.supabaseReady) return;

  const { data } = await window.vmFeberSupabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return;

  const pendingProfile = JSON.parse(localStorage.getItem("vmFeberPendingProfile") || "null");
  let { data: profile } = await window.vmFeberSupabase
    .from("profiles")
    .select("username,email,invite_code,registration_source")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile && pendingProfile?.username) {
    const payload = {
      id: session.user.id,
      username: pendingProfile.username,
      email: session.user.email,
      invite_code: pendingProfile.inviteCode || null,
      registration_source: pendingProfile.inviteCode ? "invitation" : "open",
    };

    const { data: insertedProfile, error } = await window.vmFeberSupabase
      .from("profiles")
      .insert(payload)
      .select("username,email,invite_code,registration_source")
      .single();

    if (!error) {
      profile = insertedProfile;
      localStorage.removeItem("vmFeberPendingProfile");
    }
  }

  state.user = {
    email: profile?.email || session.user.email,
    username: profile?.username || session.user.email?.split("@")[0] || "bruker",
    inviteCode: profile?.invite_code || profile?.registration_source || "åpen registrering",
  };
  save();
}

async function sendMagicLink(email, username, inviteCode) {
  localStorage.setItem("vmFeberPendingProfile", JSON.stringify({ username, inviteCode }));

  const redirectTo = window.location.href.split("#")[0].split("?")[0];
  const { error } = await window.vmFeberSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
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
  document.querySelector("#modeList").innerHTML = competitions
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

  document.querySelector("#matchList").innerHTML = matches
    .map(
      (match) => `
        <article class="match-row">
          <div class="team">${match.homeCrest ? `<img class="flag" src="${match.homeCrest}" alt="" />` : `<span class="flag" style="background:${match.homeColor}"></span>`}${match.home}</div>
          <div class="score-inputs">
            <input type="number" min="0" aria-label="${match.home} mål" />
            <input type="number" min="0" aria-label="${match.away} mål" />
          </div>
          <div class="team">${match.awayCrest ? `<img class="flag" src="${match.awayCrest}" alt="" />` : `<span class="flag" style="background:${match.awayColor}"></span>`}${match.away}</div>
          <div class="deadline">${match.date}<br />${match.deadline}</div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#bonusPanel").innerHTML = extra;
}

function renderLeagues() {
  document.querySelector("#leagueGrid").innerHTML = leagues
    .map((league) => {
      const isMember = state.leagues.includes(league.id);
      return `
        <article class="league-card ${isMember ? "" : "locked"}">
          <div>
            <h4>${league.name}</h4>
            <p>${league.members} medlemmer · kode ${league.code}</p>
          </div>
          <span class="tag">${isMember ? "Medlem" : "Skjult poengtavle"}</span>
          <button data-join="${league.code}" ${isMember ? "disabled" : ""}>${isMember ? "Du er med" : "Bruk kode"}</button>
        </article>
      `;
    })
    .join("");
}

function accessibleLeaderboards() {
  return leagues.filter((league) => state.leagues.includes(league.id));
}

function renderLeaderboardOptions() {
  const select = document.querySelector("#leaderboardSelect");
  select.innerHTML = accessibleLeaderboards()
    .map((league) => `<option value="${league.id}">${league.name}</option>`)
    .join("");
  renderLeaderboard(select.value || "total");
}

function renderLeaderboard(leagueId) {
  const rows = leaderboardData[leagueId] || [];
  document.querySelector("#leaderboard").innerHTML = rows
    .map(
      ([name, source, points], index) => `
        <div class="leader-row">
          <span class="rank">${index + 1}</span>
          <div class="leader-main">
            <strong>${name}</strong>
            <span>${source}</span>
          </div>
          <span class="points">${points}</span>
        </div>
      `,
    )
    .join("");
}

function renderAdmin() {
  document.querySelector("#inviteList").innerHTML = invites
    .map(([code, label, count]) => `<div class="invite-row"><strong>${code}</strong><span>${label}</span><span>${count}</span></div>`)
    .join("");

  document.querySelector("#resultList").innerHTML = results
    .map(([match, status]) => `<div class="result-row"><strong>${match}</strong><span>${status}</span></div>`)
    .join("");
}

function renderUser() {
  const loginPanel = document.querySelector("#loginPanel");
  const userPanel = document.querySelector("#userPanel");
  const feedback = document.querySelector("#loginFeedback");
  const connectionStatus = document.querySelector("#connectionStatus");

  if (connectionStatus) {
    connectionStatus.textContent = state.supabaseReady ? "Supabase koblet til" : "Demo-modus";
  }

  if (feedback && !state.supabaseReady) {
    feedback.textContent = "Demo-modus: fyll inn Supabase URL og anon key for ekte magic link.";
  }

  if (state.user) {
    loginPanel.classList.add("hidden");
    userPanel.classList.remove("hidden");
    document.querySelector("#userEmail").textContent = `${state.user.username} · ${state.user.email}`;
  } else {
    loginPanel.classList.remove("hidden");
    userPanel.classList.add("hidden");
  }
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelector("#viewTitle").textContent = viewTitles[viewId];
}

async function joinLeague(code) {
  const match = leagues.find((league) => league.code.toLowerCase() === code.trim().toLowerCase());
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
    return;
  }

  if (!match) {
    feedback.textContent = "Fant ingen liga med den koden.";
    return;
  }
  if (!state.leagues.includes(match.id)) {
    state.leagues.push(match.id);
    save();
  }
  feedback.textContent = `Du er nå med i ${match.name}.`;
  renderLeagues();
  renderLeaderboardOptions();
}

function bindEvents() {
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

  document.querySelector("#logoutButton").addEventListener("click", () => {
    state.user = null;
    save();
    if (state.supabaseReady) {
      window.vmFeberSupabase.auth.signOut();
    }
    renderUser();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.predictionMode = button.dataset.predictionMode;
      document.querySelectorAll(".segment").forEach((segment) => segment.classList.remove("active"));
      button.classList.add("active");
      renderMatches();
    });
  });

  document.querySelector("#joinLeagueButton").addEventListener("click", () => {
    joinLeague(document.querySelector("#leagueCode").value);
  });

  document.querySelector("#leagueGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-join]");
    if (button) joinLeague(button.dataset.join);
  });

  document.querySelector("#leaderboardSelect").addEventListener("change", (event) => {
    renderLeaderboard(event.target.value);
  });

  document.querySelector("#syncMatchesButton").addEventListener("click", () => {
    if (!state.supabaseReady || !state.user) {
      document.querySelector("#syncFeedback").textContent = "Du må være innlogget som admin.";
      return;
    }
    syncWorldCupMatches();
  });
}

async function init() {
  await syncSupabaseSession();
  await loadMatches();
  renderModes();
  renderRules();
  renderMatches();
  renderLeagues();
  renderLeaderboardOptions();
  renderAdmin();
  renderUser();
  bindEvents();
}

init();
