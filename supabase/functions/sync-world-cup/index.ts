import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(status: string) {
  if (status === "FINISHED") return "finished";
  if (["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(status)) return "live";
  return "scheduled";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const footballDataKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
    const syncCronSecret = Deno.env.get("SYNC_CRON_SECRET");

    if (!footballDataKey) throw new Error("Mangler FOOTBALL_DATA_API_KEY.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const providedCronSecret = request.headers.get("x-sync-secret");
    const isScheduledSync = Boolean(
      syncCronSecret && providedCronSecret && syncCronSecret === providedCronSecret,
    );

    if (!isScheduledSync) {
      const authHeader = request.headers.get("Authorization") ?? "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) throw new Error("Du ma vaere innlogget.");

      const { data: profile } = await adminClient
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();
      if (!profile?.is_admin) throw new Error("Kun admin kan synkronisere kampdata.");
    }

    if (isScheduledSync) {
      const fifteenMinutesAhead = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: dueMatches, error: dueMatchesError } = await adminClient
        .from("matches")
        .select("id,kickoff_at,status,last_synced_at")
        .lte("kickoff_at", fifteenMinutesAhead)
        .neq("status", "finished");
      if (dueMatchesError) throw dueMatchesError;

      const needsApiCall = (dueMatches || []).some(
        (match) => !match.last_synced_at || match.last_synced_at <= oneHourAgo,
      );
      if (!needsApiCall) {
        return Response.json({
          skipped: true,
          reason: dueMatches?.length
            ? "Venter en time for neste kontroll av pagaaende kamp."
            : "Ingen kamp trenger resultatkontroll naa.",
          unfinishedMatches: dueMatches?.length || 0,
        }, { headers: corsHeaders });
      }
    }

    const response = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      { headers: { "X-Auth-Token": footballDataKey } },
    );
    if (!response.ok) throw new Error(`football-data.org svarte med status ${response.status}.`);

    const payload = await response.json();
    const syncedAt = new Date().toISOString();
    const rows = payload.matches.map((match: any) => {
      const regularTime = match.score.regularTime || match.score.fullTime;
      const extraTime = match.score.extraTime;
      // football-data.org reports only goals scored during extra time in this node.
      const hasExtraTimeScore = regularTime?.home != null
        && regularTime?.away != null
        && extraTime?.home != null
        && extraTime?.away != null;
      return {
        external_id: String(match.id),
        stage: match.stage || "UNKNOWN",
        group_name: match.group,
        home_team: match.homeTeam.name || "Ikke avgjort",
        away_team: match.awayTeam.name || "Ikke avgjort",
        home_crest: match.homeTeam.crest,
        away_crest: match.awayTeam.crest,
        kickoff_at: match.utcDate,
        home_score: regularTime?.home,
        away_score: regularTime?.away,
        extra_time_home_score: hasExtraTimeScore ? regularTime.home + extraTime.home : null,
        extra_time_away_score: hasExtraTimeScore ? regularTime.away + extraTime.away : null,
        penalty_home_score: match.score.penalties?.home,
        penalty_away_score: match.score.penalties?.away,
        status: mapStatus(match.status),
        last_synced_at: syncedAt,
      };
    });

    const { error } = await adminClient.from("matches").upsert(rows, { onConflict: "external_id" });
    if (error) throw error;

    const { data: scoredPredictions, error: scoringError } = await adminClient
      .rpc("recalculate_match_prediction_points");
    if (scoringError) throw scoringError;

    const { data: scoredTestPredictions } = await adminClient
      .rpc("recalculate_test_user_prediction_points");

    return new Response(JSON.stringify({
      synced: rows.length,
      scoredPredictions,
      scoredTestPredictions,
      syncedAt,
      trigger: isScheduledSync ? "scheduled" : "admin",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
