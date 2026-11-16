(() => {
  const INTERVAL = 15 * 60 * 1000;
  const DURATION = 5 * 60 * 1000;
  const types = ["gold", "rainbow", "double-diamonds", "double-foods"];
  const status = document.getElementById("weather-status");
  const name = document.getElementById("weather-name");
  const detail = document.getElementById("weather-detail");
  const effects = document.getElementById("weather-effects");
  const timer = document.getElementById("weather-countdown");
  let globalEvent = null;
  let syncing = false;
  let paintedType = "";
  // Fixed variation keeps visual effects separate from gameplay randomness.
  if (effects) for (let i = 0; i < 64; i++) {
    const sparkle = document.createElement("span");
    sparkle.className = "weather-sparkle";
    sparkle.style.cssText = `left:${(i * 37.7) % 100}%;--size:${6 + i % 8}px;--duration:${3 + i % 7 * .43}s;--delay:${-(i * .41) % 6}s;--drift:${i % 2 ? 26 : -26}px;--hue:${i % 7 * 50};`;
    effects.appendChild(sparkle);
  }
  function activeEvent(now) {
    if (!globalEvent || now < globalEvent.startsAt || now >= globalEvent.endsAt) return null;
    return globalEvent;
  }
  async function syncEvent() {
    if (typeof fetch !== "function" || syncing) return;
    syncing = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("weather-event.json", {cache: "no-store", signal: controller.signal});
      if (!response.ok) return;
      const event = await response.json();
      if (event === null) globalEvent = null;
      else if (typeof event.id === "string" && event.id && types.includes(event.type) &&
          Number.isFinite(event.startsAt) && Number.isFinite(event.endsAt) &&
          event.endsAt - event.startsAt === DURATION) globalEvent = event;
      refresh();
    } catch {
      // Keep the last known event until its fixed end time if the feed is offline.
    } finally {
      clearTimeout(timeout);
      syncing = false;
    }
  }
  function scheduledType(slot) {
    // A shared 32-bit permutation gives each event a 25% share of outcomes.
    // Everyone uses the same quarter-hour slot, independent of arrival or reloads.
    let seed = (slot ^ 0x9e3779b9) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    seed = Math.imul(seed ^ (seed >>> 15), 0x735a2d97);
    seed ^= seed >>> 15;
    return types[seed >>> 30];
  }
  function currentWeather(now) {
    const slot = Math.floor(now / INTERVAL);
    const startsAt = slot * INTERVAL;
    const nextRoll = startsAt + INTERVAL;
    const event = activeEvent(now);
    if (event) return {...event, nextRoll};
    return {
      type: now < startsAt + DURATION ? scheduledType(slot) : "clear",
      startsAt, endsAt: startsAt + DURATION, nextRoll,
    };
  }
  function countdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function refresh() {
    const now = Date.now();
    const weather = currentWeather(now);
    const type = weather.type;
    if (status) status.dataset.weather = type;
    if (effects && paintedType !== type) {
      effects.dataset.weather = type;
      paintedType = type;
    }
    if (name) name.textContent = {
      gold: "✦ Gold weather", rainbow: "🌈 Rainbow weather",
      "double-diamonds": "💎 Double Diamonds", "double-foods": "🍽 Double Foods", clear: "☀ Clear skies",
    }[type];
    if (detail) detail.textContent = {
      gold: "10% Gold food chance", rainbow: "10% Rainbow food chance",
      "double-diamonds": "2× diamonds from run foods", "double-foods": "Foods duplicated at collection",
      clear: `Next at ${new Date(weather.nextRoll).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}`,
    }[type];
    if (timer) timer.textContent = type === "clear"
      ? `Next event in ${countdown(weather.nextRoll - now)}`
      : `Event ends in ${countdown(weather.endsAt - now)}`;
  }
  window.GameWeather = { current: () => currentWeather(Date.now()).type };
  refresh();
  setInterval(refresh, 1000);
  syncEvent();
  setInterval(syncEvent, 15000);
  document.addEventListener("visibilitychange", () => { refresh(); if (!document.hidden) syncEvent(); });
  window.addEventListener("pageshow", refresh);

})();
