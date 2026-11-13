(() => {
  const INTERVAL = 10 * 60 * 1000;
  const DURATION = 5 * 60 * 1000;
  const KEY = "eatAFoodWeather";
  const types = ["clear", "gold", "rainbow"];
  const status = document.getElementById("weather-status");
  const name = document.getElementById("weather-name");
  const detail = document.getElementById("weather-detail");
  const effects = document.getElementById("weather-effects");
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
    if (effects) effects.dataset.weather = type;
    if (name) name.textContent = type === "gold" ? "✦ Gold weather" : type === "rainbow" ? "🌈 Rainbow weather" : "☀ Clear skies";
    if (detail) detail.textContent = type === "clear"
      ? `Weather roll in ${countdown(weather.nextRoll - now)}`
      : `10% ${type === "gold" ? "Gold" : "Rainbow"} food chance · ${countdown(weather.endsAt - now)} left`;
  }
  window.GameWeather = { current: () => advance(Date.now()) };
  persist();
  refresh();
  setInterval(refresh, 1000);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("storage", event => {
    if (event.key !== KEY) return;
    weather = read();
    refresh();
  });
})();
