(() => {
  const tracks = {
    lobby: new Audio("audio/local-forecast-elevator.mp3"),
    run: new Audio("audio/monkeys-spinning-monkeys.mp3"),
  };
  const titles = { lobby: "Local Forecast – Elevator (82 BPM)", run: "Monkeys Spinning Monkeys" };
  const button = document.getElementById("music-toggle");
  let mode = "lobby";
  let unlocked = false;
  let muted = false;
  try { muted = localStorage.getItem("eatAFoodMusicMuted") === "true"; } catch (_) {}
  for (const [name, track] of Object.entries(tracks)) {
    track.loop = true;
    track.volume = 0.3;
    track.preload = "none";
    track.hidden = true;
    track.dataset.musicMode = name;
    document.body.appendChild(track);
  }

  function sync() {
    button.textContent = muted ? "🔇" : "🔊";
    button.setAttribute("aria-pressed", String(!muted));
    button.title = `${muted ? "Unmute" : "Mute"} music · ${titles[mode]}`;
    for (const [name, track] of Object.entries(tracks)) {
      if (name !== mode || muted || !unlocked || document.hidden) {
        track.pause();
      } else if (track.paused) {
        // Browsers may reject playback before a user gesture or after an interruption.
        // Keep listening for gestures so playback can recover without affecting the game.
        track.play().then(() => {
          if (name !== mode || muted || document.hidden) track.pause();
        }).catch(() => {});
      }
    }
  }

  function setMode(next) {
    mode = next === "run" ? "run" : "lobby";
    sync();
  }

  function activate(event) {
    if (event.target?.closest?.("#music-toggle")) return;
    unlocked = true;
    sync();
  }

  button.addEventListener("click", () => {
    unlocked = true;
    muted = !muted;
    try { localStorage.setItem("eatAFoodMusicMuted", String(muted)); } catch (_) {}
    sync();
  });
  document.addEventListener("pointerdown", activate, { passive: true });
  document.addEventListener("keydown", activate);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => Object.values(tracks).forEach(track => track.pause()));
  window.addEventListener("pageshow", sync);
  window.GameMusic = { setMode };
  sync();
})();
