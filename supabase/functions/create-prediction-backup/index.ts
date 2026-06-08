import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function osloDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatOslo(value: string | Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const backupEmail = Deno.env.get("BACKUP_EMAIL");
    const backupFromEmail = Deno.env.get("BACKUP_FROM_EMAIL") || "VM FEBER <onboarding@resend.dev>";
    const backupCronSecret = Deno.env.get("BACKUP_CRON_SECRET");

    if (!backupCronSecret || request.headers.get("x-backup-secret") !== backupCronSecret) {
      return Response.json({ error: "Ugyldig backup-nøkkel." }, { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await request.json().catch(() => ({}));
    const requestedType = body.type;
    const now = new Date();

    const { data: competitions, error: competitionError } = await adminClient
      .from("competitions")
      .select("id,slug,name,daily_lock_time,timezone")
      .in("slug", ["full-vm", "daglig"]);
    if (competitionError) throw competitionError;

    const { data: allMatches, error: matchError } = await adminClient
      .from("matches")
      .select("id,home_team,away_team,kickoff_at")
      .order("kickoff_at", { ascending: true });
    if (matchError) throw matchError;
    if (!allMatches?.length) throw new Error("Ingen kamper finnes i databasen.");

    let backupType: "full-vm" | "daglig";
    let matchDate: string | null;
    let cutoffAt: Date;
    let selectedMatches = allMatches;

    if (requestedType === "full-vm") {
      backupType = "full-vm";
      matchDate = null;
      cutoffAt = new Date(new Date(allMatches[0].kickoff_at).getTime() - 2 * 60 * 60 * 1000);
    } else {
      backupType = "daglig";
      matchDate = body.matchDate || osloDate(now);
      selectedMatches = allMatches.filter((match) => osloDate(match.kickoff_at) === matchDate);
      if (!selectedMatches.length) {
        return Response.json({ skipped: true, reason: "Ingen kamper pa valgt dato." }, { headers: corsHeaders });
      }
      cutoffAt = new Date(`${matchDate}T10:00:00.000Z`);
    }

    const backupKey = backupType === "full-vm" ? "full-vm" : `daglig-${matchDate}`;
    const { data: existingBackup } = await adminClient
      .from("prediction_backups")
      .select("id")
      .eq("backup_key", backupKey)
      .maybeSingle();
    if (existingBackup) {
      return Response.json({ skipped: true, reason: "Backup finnes allerede." }, { headers: corsHeaders });
    }

    if (now < cutoffAt) {
      return Response.json({ skipped: true, reason: "Fristen har ikke gatt ut enna." }, { headers: corsHeaders });
    }

    const competition = competitions?.find((item) => item.slug === backupType);
    if (!competition) throw new Error("Fant ikke konkurransen.");

    let inheritedPredictionCount = 0;
    if (backupType === "daglig" && matchDate) {
      const { data: copiedCount, error: copyError } = await adminClient
        .rpc("fill_daily_predictions_from_full", { target_date: matchDate });
      if (copyError) throw copyError;
      inheritedPredictionCount = copiedCount || 0;
    }

    const matchIds = selectedMatches.map((match) => match.id);
    const { data: registeredUsers, error: userError } = await adminClient
      .from("profiles")
      .select("id,username,email,created_at")
      .order("created_at", { ascending: true });
    if (userError) throw userError;

    const { data: predictions, error: predictionError } = await adminClient
      .from("match_predictions")
      .select("user_id,match_id,home_score,away_score,extra_time_home_score,extra_time_away_score,penalty_home_score,penalty_away_score,source,updated_at,profiles(username,email)")
      .eq("competition_id", competition.id)
      .in("match_id", matchIds);
    if (predictionError) throw predictionError;

    const matchMap = new Map(selectedMatches.map((match) => [match.id, match]));
    const predictionSnapshot = (predictions || []).map((prediction: any) => ({
      username: prediction.profiles?.username,
      email: prediction.profiles?.email,
      home_team: matchMap.get(prediction.match_id)?.home_team,
      away_team: matchMap.get(prediction.match_id)?.away_team,
      kickoff_at: matchMap.get(prediction.match_id)?.kickoff_at,
      home_score: prediction.home_score,
      away_score: prediction.away_score,
      extra_time_home_score: prediction.extra_time_home_score,
      extra_time_away_score: prediction.extra_time_away_score,
      penalty_home_score: prediction.penalty_home_score,
      penalty_away_score: prediction.penalty_away_score,
      source: prediction.source,
      saved_at: prediction.updated_at,
    }));
    const snapshot = {
      registered_users: registeredUsers || [],
      matches: selectedMatches,
      predictions: predictionSnapshot,
    };

    const { data: backup, error: backupError } = await adminClient
      .from("prediction_backups")
      .upsert({
        backup_key: backupKey,
        backup_type: backupType,
        competition_id: competition.id,
        match_date: matchDate,
        cutoff_at: cutoffAt.toISOString(),
        user_count: registeredUsers?.length || 0,
        prediction_count: predictionSnapshot.length,
        snapshot,
      }, { onConflict: "backup_key" })
      .select("id")
      .single();
    if (backupError) throw backupError;

    if (!resendApiKey || !backupEmail) {
      return Response.json({
        backupId: backup.id,
        userCount: registeredUsers?.length || 0,
        predictionCount: predictionSnapshot.length,
        inheritedPredictionCount,
        emailSent: false,
        warning: "Backup er lagret, men e-post er ikke konfigurert.",
      }, { headers: corsHeaders });
    }

    const csvHeader = ["Brukernavn", "E-post", "Kamp", "Kampstart", "Ordinær tid", "Etter ekstraomganger", "Straffespark", "Kilde", "Lagret"].map(csvValue).join(",");
    const csvRows = predictionSnapshot.map((row) => [
      row.username,
      row.email,
      `${row.home_team} - ${row.away_team}`,
      formatOslo(row.kickoff_at),
      `${row.home_score} - ${row.away_score}`,
      row.extra_time_home_score == null ? "" : `${row.extra_time_home_score} - ${row.extra_time_away_score}`,
      row.penalty_home_score == null ? "" : `${row.penalty_home_score} - ${row.penalty_away_score}`,
      row.source === "full-vm-inherited" ? "Arvet fra Full VM" : "Levert daglig",
      formatOslo(row.saved_at),
    ].map(csvValue).join(","));
    const csv = [csvHeader, ...csvRows].join("\r\n");
    const label = backupType === "full-vm" ? "Full VM" : `Daglig ${matchDate}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: backupFromEmail,
        to: [backupEmail],
        subject: `VM FEBER backup: ${label}`,
        html: `<h1>VM FEBER backup</h1><p>${predictionSnapshot.length} tips fra ${registeredUsers?.length || 0} registrerte brukere ble lagret for ${label}.</p><p>${inheritedPredictionCount} manglende daglige tips ble arvet fra Full VM.</p><p>Frist: ${formatOslo(cutoffAt)}</p>`,
        attachments: [{
          content: toBase64(csv),
          filename: `vm-feber-${backupType}-${matchDate || "full"}.csv`,
        }],
      }),
    });
    const emailResult = await emailResponse.json();

    await adminClient
      .from("prediction_backups")
      .update({
        email_sent: emailResponse.ok,
        email_error: emailResponse.ok ? null : (emailResult?.message || "Ukjent e-postfeil"),
      })
      .eq("id", backup.id);

    if (!emailResponse.ok) throw new Error(emailResult?.message || "Kunne ikke sende backup-e-post.");

    return Response.json({
      backupId: backup.id,
      userCount: registeredUsers?.length || 0,
      predictionCount: predictionSnapshot.length,
      inheritedPredictionCount,
      emailSent: true,
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
