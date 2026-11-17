(() => {
  const banner = document.getElementById("giveaway-status");
  let event = null, syncing = false, claiming = false;
  let claimedId = "";
  function eligible(value, now = Date.now()) {
    return value && value.type === "rainbow-pepper" &&
      typeof value.id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value.id) &&
      Number.isFinite(value.startsAt) && Number.isFinite(value.endsAt) &&
      value.endsAt - value.startsAt === 60000 && now >= value.startsAt && now < value.endsAt;
  }
  async function refresh() {
    if (!eligible(event)) { if (banner) banner.classList.add("hidden"); return; }
    if (banner) {
      banner.classList.remove("hidden");
      const seconds = Math.max(0, Math.ceil((event.endsAt - Date.now()) / 1000));
      banner.textContent = `🌈 Rainbow Pepper Giveaway · ${seconds}s left · One free Rainbow Pepper!`;
    }
    if (document.hidden || claiming || claimedId === event.id || !window.GameGiveaway) return;
    claiming = true;
    const candidate = event;
    const claim = () => {
      // Recheck after waiting for another tab's lock and at the actual grant time.
      if (!document.hidden && eligible(candidate)) {
        window.GameGiveaway.claim(candidate);
        claimedId = candidate.id;
      }
    };
    try {
      if (navigator.locks?.request) await navigator.locks.request("eat-a-food-giveaway", claim);
      else claim();
    } catch { /* Retry while the event is active if saving failed. */ }
    finally { claiming = false; }
  }
  async function sync() {
    if (syncing || document.hidden) return;
    syncing = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`giveaway-event.json?t=${Date.now()}`, {cache: "no-store", signal: controller.signal});
      if (response.ok) {
        const value = await response.json();
        // Expired records stay harmless; they never create a delayed reward.
        event = value;
        await refresh();
      }
    } catch { /* A known event can still expire locally during a network outage. */ }
    finally { clearTimeout(timeout); syncing = false; }
  }
  sync();
  setInterval(sync, 3000);
  setInterval(refresh, 1000);
  document.addEventListener("visibilitychange", () => {refresh(); if (!document.hidden) sync();});
  window.addEventListener("pageshow", sync);
})();
