(() => {
  const INTERVAL = 10 * 60 * 1000;
  const DURATION = 5 * 60 * 1000;
  const KEY = "eatAFoodWeather";
  const types = ["clear", "gold", "rainbow"];
  const status = document.getElementById("weather-status");
  const name = document.getElementById("weather-name");
  const detail = document.getElementById("weather-detail");
  const effects = document.getElementById("weather-effects");
  const timer = document.getElementById("weather-countdown");
  let globalEvent = null;
  let appliedEventId = "";
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
    if (appliedEventId !== globalEvent.id) {
      // Resume regular rolls five minutes after the shared event finishes.
      weather = {type: "clear", endsAt: 0, nextRoll: globalEvent.endsAt + DURATION};
      appliedEventId = globalEvent.id;
      persist();
    }
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
      else if (typeof event.id === "string" && event.id && ["gold", "rainbow"].includes(event.type) &&
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
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      const now = Date.now();
      if (saved && types.includes(saved.type) && Number.isFinite(saved.nextRoll) &&
          saved.nextRoll > 0 && saved.nextRoll <= now + INTERVAL &&
          Number.isFinite(saved.endsAt) && saved.endsAt >= 0 &&
          (saved.type === "clear" ? saved.endsAt === 0 : saved.endsAt === saved.nextRoll - INTERVAL + DURATION)) return saved;
    } catch {}
    return { type: "clear", nextRoll: Date.now() + INTERVAL, endsAt: 0 };
  }
  let weather = read();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(weather)); } catch {}
  }
  function advance(now) {
    const event = activeEvent(now);
    if (event) return event.type;
    let changed = false;
    if (now >= weather.nextRoll) {
      // Skip expired intervals after a suspended tab or an offline period.
      const rollAt = weather.nextRoll + Math.floor((now - weather.nextRoll) / INTERVAL) * INTERVAL;
      weather.nextRoll = rollAt + INTERVAL;
      const roll = now < rollAt + DURATION ? Math.random() : 1;
      weather.type = roll < .25 ? "gold" : roll < .5 ? "rainbow" : "clear";
      weather.endsAt = weather.type === "clear" ? 0 : rollAt + DURATION;
      changed = true;
    }
    if (weather.type !== "clear" && now >= weather.endsAt) {
      weather.type = "clear";
      weather.endsAt = 0;
      changed = true;
    }
    if (changed) persist();
    return weather.type;
  }
  function countdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function refresh() {
    const now = Date.now();
    const type = advance(now);
    if (status) status.dataset.weather = type;
    if (effects && paintedType !== type) {
      effects.dataset.weather = type;
      paintedType = type;
    }
    if (name) name.textContent = type === "gold" ? "✦ Gold weather" : type === "rainbow" ? "🌈 Rainbow weather" : "☀ Clear skies";
    if (detail) detail.textContent = type === "clear"
      ? "25% Gold · 25% Rainbow · 50% clear"
      : `10% ${type === "gold" ? "Gold" : "Rainbow"} food chance`;
    if (timer) timer.textContent = type === "clear"
      ? `Next roll in ${countdown(weather.nextRoll - now)}`
      : `Event ends in ${countdown((activeEvent(now)?.endsAt || weather.endsAt) - now)}`;
  }
  window.GameWeather = { current: () => advance(Date.now()) };
  persist();
  refresh();
  setInterval(refresh, 1000);
  syncEvent();
  setInterval(syncEvent, 15000);
  document.addEventListener("visibilitychange", () => { refresh(); if (!document.hidden) syncEvent(); });
  window.addEventListener("pageshow", refresh);
  window.addEventListener("storage", event => {
    if (event.key !== KEY) return;
    weather = read();
    refresh();
  });
})();
