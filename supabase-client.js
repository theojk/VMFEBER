(function () {
  const config = window.VM_FEBER_SUPABASE;

  window.vmFeberSupabaseReady = Boolean(
    window.supabase &&
      config &&
      config.url &&
      config.anonKey &&
      !config.url.includes("DIN-PROSJEKT-REF") &&
      !config.anonKey.includes("DIN-PUBLIC-ANON-KEY"),
  );

  window.vmFeberSupabase = window.vmFeberSupabaseReady
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;
})();
