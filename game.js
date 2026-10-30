(() => {
  const GAME_VERSION = (() => {
    const src = (document.currentScript && document.currentScript.src) || "";
    const match = src.match(/[?&]v=(\d+)/);
    return match ? Number(match[1]) : 0;
  })();
  try {
  const canvas = document.getElementById("arena");
  const uuid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const pointsEl = document.getElementById("points");
  const nextFoodEl = document.getElementById("next-food");
  const bestRunEl = document.getElementById("best-run");
  const diamondsEl = document.getElementById("diamonds");
  const foodCountEl = document.getElementById("food-count");
  const foodFillEl = document.getElementById("food-fill");
  const foodNextEl = document.getElementById("food-next");
  const equippedLineEl = document.getElementById("equipped-line");
  const inventoryGridEl = document.getElementById("inventory-grid");
  const inventoryScrollEl = document.getElementById("inventory-scroll");
  const craftAllSlotEl = document.getElementById("craft-all-slot");
  const craftListEl = document.getElementById("craft-list");
  const craftModal = document.getElementById("craft-modal");
  const craftCloseBtn = document.getElementById("craft-close");
  const craftBtn = document.getElementById("craft-btn");
  const overlayCraftBtn = document.getElementById("overlay-craft-btn");
  const inventoryModal = document.getElementById("inventory-modal");
  const inventoryBtn = document.getElementById("inventory-btn");
  const shopBtn = document.getElementById("shop-btn");
  const overlayInventoryBtn = document.getElementById("overlay-inventory-btn");
  const overlayShopBtn = document.getElementById("overlay-shop-btn");
  const shopModal = document.getElementById("shop-modal");
  const shopCloseBtn = document.getElementById("shop-close");
  const shopListEl = document.getElementById("shop-list");
  const shopDiamondsEl = document.getElementById("shop-diamonds");
  const invCloseBtn = document.getElementById("inv-close");
  const endBtn = document.getElementById("end-btn");
  const autoFarmBtn = document.getElementById("auto-farm-btn");
  const multiBtn = document.getElementById("multi-btn");
  const multiModal = document.getElementById("multi-modal");
  const multiCloseBtn = document.getElementById("multi-close");
  const multiStatusEl = document.getElementById("multi-status");
  const multiSetupEl = document.getElementById("multi-setup");
  const multiRoomEl = document.getElementById("multi-room");
  const multiNameEl = document.getElementById("multi-name");
  const multiCodeEl = document.getElementById("multi-code");
  const multiCreateBtn = document.getElementById("multi-create");
  const multiJoinBtn = document.getElementById("multi-join");
  const multiLeaveBtn = document.getElementById("multi-leave");
  const multiCpusBtn = document.getElementById("multi-cpus");
  const multiCpuNoteEl = document.getElementById("multi-cpu-note");
  const multiRoomCodeEl = document.getElementById("multi-room-code");
  const multiPlayersEl = document.getElementById("multi-players");
  const multiLiveEl = document.getElementById("multi-live");
  const startBtn = document.getElementById("start-btn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const pullResultsEl = document.getElementById("pull-results");
  const luckEl = document.getElementById("luck");
  const luckLabelEl = document.getElementById("luck-label");
  const luckNoticeEl = document.getElementById("luck-notice");
  const potionStatusEl = document.getElementById("potion-status");
  const lobbyHintEl = document.getElementById("lobby-hint");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardListEl = document.getElementById("leaderboard-list");
  const afterRunActionsEl = document.getElementById("after-run-actions");

  const ARENA = 2880;
  const MAP_SCALE = ARENA / 720;
  const AREA_SCALE = MAP_SCALE * MAP_SCALE;
  const LOBBY_CAMERA_DISTANCE = 1150;
  const LOBBY_RADIUS = 420;
  const PORTAL_RADIUS = 120;
  const SHOP_PAD_RADIUS = 58;
  const SHOP_STALL_RADIUS = 62;
  const CRAFT_PAD_RADIUS = 58;
  const CRAFT_STALL_RADIUS = 62;
  const RUN_CAMERA_DISTANCE = 480;
  const MIN_CAMERA_DISTANCE = 240;
  const MAX_CAMERA_DISTANCE = 1650 * MAP_SCALE;
  const POINTS_PER_FOOD = 1000;
  const MAX_RIVALS = 5;
  const MAX_SPRINKLES = Math.round(250 * AREA_SCALE);
  const MAX_XS_SPRINKLES = Math.round(140 * AREA_SCALE);
  const MAX_SMALL_SPRINKLES = Math.round(84 * AREA_SCALE);
  const MAX_MEDIUM_SPRINKLES = Math.round(1.5 * AREA_SCALE);
  const MAX_LARGE_SPRINKLES = Math.round(0.25 * AREA_SCALE);
  const MAX_XL_SPRINKLES = Math.max(1, Math.round(0.07 * AREA_SCALE));
  const START_MEDIUM_SPRINKLES = MAX_MEDIUM_SPRINKLES;
  const START_LARGE_SPRINKLES = MAX_LARGE_SPRINKLES;
  const SPEED_SCALE = 0.5; // all foods move 2x slower
  // Size stores the full sprinkle value. The model still grows at the old pace
  // and stops at the old max radius of 120.
  const SPRINKLE_GROWTH_SCALE = 55;
  const STORAGE_KEY = "sprinkleFeastSave";
  const SAVE_VERSION = 2;
  const LUCK_BASE = 1;
  const LUCK_EVERY = 10;
  const LUCK_STEP = 0.5;

  // Higher rarity always beats lower rarity on BOTH multiplier and speed.
  const RARITIES = [
    { id: "common", label: "Common", rank: 0 },
    { id: "uncommon", label: "Uncommon", rank: 1 },
    { id: "rare", label: "Rare", rank: 2 },
    { id: "epic", label: "Epic", rank: 3 },
    { id: "legendary", label: "Legendary", rank: 4 },
    { id: "mythic", label: "Mythic", rank: 5 },
  ];

  // Speeds are irregular within a rarity (no sorted pattern), but higher
  // rarities are still generally faster on average.
  // odds = "1 in N" pull chance weight (higher N = rarer).
  if (!window.FOOD_LIST) throw new Error("foods.js failed to load");
  const FOOD_TIERS = window.FOOD_LIST.map((food) => ({
    name: food.name,
    emoji: food.emoji,
    rarity: food.rarity,
    multiplier: food.points,
    growth: food.growth,
    speed: food.speed,
    odds: food.odds,
    model: food.model,
    color: food.color,
    rim: food.rim,
  }));

  // One-time renames for saves from before mythic Sundae/Donut short names.
  function migrateFoodName(name, fromVersion) {
    if (fromVersion >= SAVE_VERSION) return name;
    if (name === "Rainbow Sundae") return "Sundae";
    if (name === "Golden Donut") return "Donut";
    if (name === "Donut") return "Glazed Donut";
    if (name === "Sundae") return "Parlor Sundae";
    if (name === "Golden Sundae") return "Golden Parlor Sundae";
    return name;
  }

  // Names replaced in foods.js. Applied from the saved name on each load.
  const FOOD_RENAMES = {
    Mochi: "Grapes",
    Butter: "Blueberry",
    Pretzel: "Kiwi",
    Cracker: "Candy",
    Brownie: "Lemon",
    "Glazed Donut": "Orange",
    Macaron: "Carrot",
    "Soft Serve": "Corn",
    Cheesecake: "Cheese",
    Churro: "Baugette",
    Crepe: "Tomato",
    "Fortune Cookie": "Pepper",
    "Ice Cream": "Salad",
    Gelato: "Snow Cone",
    Milkshake: "Soda",
    "Hot Fudge": "Chocolate",
    Fondue: "Milk",
    Tiramisu: "Taco",
    Tart: "Ice",
    Trifle: "Burger",
    Chestnut: "Banana",
    "Parlor Sundae": "Sundae",
    Feast: "Mooncake",
    "Crown Cake": "Sushi",
    "Wedding Cake": "Ramen",
    "Bento Box": "Ramen",
    Takeout: "Ramen",
    Lobster: "Hotdog",
    "Firework Cake": "Pizza",
    "Birthday Cake": "Cake",
    "Trophy Cake": "Steak",
    "Gift Feast": "Dumpling",
    "Cosmic Feast": "Rice",
    "Nebula Shake": "Nebula Sha",
  };

  function renameSheetFood(name) {
    let prefix = "";
    let base = name;
    if (name.startsWith("Golden ")) {
      prefix = "Golden ";
      base = name.slice(7);
    } else if (name.startsWith("Rainbow ") || name.startsWith("Shiny ")) {
      prefix = "Rainbow ";
      base = name.startsWith("Rainbow ") ? name.slice("Rainbow ".length) : name.slice("Shiny ".length);
    } else if (name.startsWith("Shadow ")) {
      prefix = "Shadow ";
      base = name.slice("Shadow ".length);
    }
    if (FOOD_RENAMES[base]) return prefix + FOOD_RENAMES[base];
    if (prefix === "Rainbow " && name.startsWith("Shiny ")) return prefix + base;
    return name;
  }

  // Small/medium: anywhere. Large: outer ring. XL: inside the inner two circles only.
  const LARGE_OUTER = 0.55;
  // Second arena ring is 0.38 of the half-width. Zone distance is corner-normalized.
  const INNER_TWO_RINGS = (0.38 * 0.5) / Math.SQRT1_2;
  const SPRINKLE_TYPES = [
    { key: "xs", points: 5, radius: 3, color: "#ffe8c8", zone: [0, 1] },
    { key: "small", points: 25, radius: 5, color: "#ff6b9d", zone: [0, 1] },
    { key: "medium", points: 75, radius: 9, color: "#7ec8ff", zone: [0, 1] },
    { key: "large", points: 200, radius: 14, color: "#b8f27a", zone: [LARGE_OUTER, 1] },
    { key: "xl", points: 1000, radius: 20, color: "#ffd166", zone: [0, INNER_TWO_RINGS] },
  ];
  const SPRINKLE_CAPS = {
    xs: MAX_XS_SPRINKLES,
    small: MAX_SMALL_SPRINKLES,
    medium: MAX_MEDIUM_SPRINKLES,
    large: MAX_LARGE_SPRINKLES,
    xl: MAX_XL_SPRINKLES,
  };

  function sprinkleType(key) {
    return SPRINKLE_TYPES.find((type) => type.key === key);
  }

  const CRAFT_COST = 50;

  // 1.5× of a two-decimal stat, rounded half up. Plain toFixed drifts by 0.01
  // on values like 0.91 × 1.5.
  function scaledSpeed(speed) {
    return Math.round(Math.round(speed * 100) * 1.5) / 100;
  }

  function makeGoldenFood(base) {
    return {
      name: `Golden ${base.name}`,
      emoji: base.emoji,
      rarity: base.rarity,
      multiplier: +(base.multiplier + 2).toFixed(2),
      growth: +(base.growth * 1.5).toFixed(2),
      speed: scaledSpeed(base.speed),
      odds: base.odds * 4, // craft-only; rarer than the normal food, still a whole number
      color: "#ffd700",
      rim: "#b8860b",
      isGolden: true,
      baseName: base.name,
    };
  }

  function makeShinyFood(golden) {
    return {
      name: `Rainbow ${golden.baseName}`,
      emoji: golden.emoji,
      rarity: golden.rarity,
      multiplier: +(golden.multiplier + 2).toFixed(2),
      growth: +(golden.growth * 1.5).toFixed(2),
      speed: scaledSpeed(golden.speed),
      odds: golden.odds * 4,
      color: "#f7fbff",
      rim: "#7ec8ff",
      isShiny: true,
      baseName: golden.baseName,
    };
  }

  function makeShadowFood(shiny) {
    return {
      name: `Shadow ${shiny.baseName}`,
      emoji: shiny.emoji,
      rarity: shiny.rarity,
      multiplier: +(shiny.multiplier + 2).toFixed(2),
      growth: +(shiny.growth * 1.5).toFixed(2),
      speed: scaledSpeed(shiny.speed),
      odds: shiny.odds * 4,
      color: "#2a1438",
      rim: "#9b5cff",
      isShadow: true,
      baseName: shiny.baseName,
    };
  }

  const GOLDEN_FOODS = FOOD_TIERS.map(makeGoldenFood);
  const SHINY_FOODS = GOLDEN_FOODS.map(makeShinyFood);
  const SHADOW_FOODS = SHINY_FOODS.map(makeShadowFood);
  const ALL_FOODS = [...FOOD_TIERS, ...GOLDEN_FOODS, ...SHINY_FOODS, ...SHADOW_FOODS];
  const tierByName = Object.fromEntries(ALL_FOODS.map((t) => [t.name, t]));
  const rarityById = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
  const goldenByBase = Object.fromEntries(
    GOLDEN_FOODS.map((g) => [g.baseName, g])
  );
  const shinyByBase = Object.fromEntries(
    SHINY_FOODS.map((s) => [s.baseName, s])
  );
  const shadowByBase = Object.fromEntries(
    SHADOW_FOODS.map((s) => [s.baseName, s])
  );

  function variantClass(tier) {
    if (tier.isShadow) return "rarity-shadow";
    if (tier.isShiny) return "rarity-shiny";
    if (tier.isGolden) return "rarity-golden";
    return `rarity-${tier.rarity}`;
  }

  function variantLabel(tier) {
    if (tier.isShadow) return " · Shadow";
    if (tier.isShiny) return " · Rainbow";
    if (tier.isGolden) return " · Golden";
    return "";
  }

  const POTION_COST = 500;
  const POTION_DURATION_MS = 10 * 60 * 1000;
  const LUCK_POTION_MAX_STACKS = 5;
  const POTIONS = [
    {
      id: "luck",
      name: "Luck Potion",
      emoji: "🍀",
      detail: "+50% luck for 10 minutes. Strength stacks up to ×5. Time stacks forever",
    },
    {
      id: "speed",
      name: "Speed Potion",
      emoji: "⚡",
      detail: "+25% speed for 10 minutes. Time stacks forever; strength does not",
    },
    {
      id: "growth",
      name: "Growth Potion",
      emoji: "🌱",
      detail: "+25% growth for 10 minutes. Time stacks forever; strength does not",
    },
    {
      id: "points",
      name: "Points Potion",
      emoji: "✨",
      detail: "+25% points for 10 minutes. Time stacks forever; strength does not",
    },
  ];

  function emptyPotions() {
    return { luck: 0, speed: 0, growth: 0, points: 0 };
  }

  function starterPotions() {
    return { luck: 1, speed: 1, growth: 1, points: 1 };
  }

  function emptyPotionEffect() {
    return { endsAt: 0, stacks: 0 };
  }

  function emptyActivePotions() {
    return {
      luck: emptyPotionEffect(),
      speed: emptyPotionEffect(),
      growth: emptyPotionEffect(),
      points: emptyPotionEffect(),
    };
  }

  function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function readPotionBag(raw) {
    const bag = emptyPotions();
    if (!raw || typeof raw !== "object") return bag;
    for (const key of Object.keys(bag)) {
      bag[key] = Math.max(0, Math.floor(Number(raw[key]) || 0));
    }
    return bag;
  }

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      inventory: { Peanut: 1 },
      equipped: "Peanut",
      bestRun: 0,
      diamonds: 0,
      potions: starterPotions(),
      activePotions: emptyActivePotions(),
      discovered: { Peanut: true },
      // Already applied, so a brand-new save is not given the old starter foods.
      grantedGoldenCosmicFeast: true,
      grantedRamen: true,
      clearedToCracker: true,
      keptSingleCracker: true,
    };
  }

  function pickBestFromInventory(inventory) {
    let best = null;
    for (const tier of ALL_FOODS) {
      if (!(inventory[tier.name] > 0)) continue;
      if (
        !best ||
        rarityById[tier.rarity].rank > rarityById[best.rarity].rank ||
        (tier.rarity === best.rarity && tier.multiplier > best.multiplier) ||
        (tier.rarity === best.rarity &&
          tier.multiplier === best.multiplier &&
          (tier.isShadow ? 3 : tier.isShiny ? 2 : tier.isGolden ? 1 : 0) >
            (best.isShadow ? 3 : best.isShiny ? 2 : best.isGolden ? 1 : 0))
      ) {
        best = tier;
      }
    }
    return best || FOOD_TIERS[0];
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      const next = defaultSave();
      const fromVersion = Number(parsed.version || 1);
      let renamed = false;
      if (parsed.inventory && typeof parsed.inventory === "object") {
        next.inventory = {};
        for (const [rawName, count] of Object.entries(parsed.inventory)) {
          const n = Math.floor(Number(count) || 0);
          const name = renameSheetFood(migrateFoodName(rawName, fromVersion));
          if (name !== rawName) renamed = true;
          if (n <= 0 || !tierByName[name]) continue;
          next.inventory[name] = (next.inventory[name] || 0) + n;
        }
        if (Object.keys(next.inventory).length === 0) next.inventory = { Peanut: 1 };
      }
      const equippedName = renameSheetFood(migrateFoodName(parsed.equipped || "", fromVersion));
      if (equippedName !== (parsed.equipped || "")) renamed = true;
      if (equippedName && next.inventory[equippedName]) {
        next.equipped = equippedName;
      } else {
        next.equipped = pickBestFromInventory(next.inventory).name;
      }
      next.bestRun = Math.max(0, Number(parsed.bestRun || 0));
      next.diamonds = Math.max(0, Math.floor(Number(parsed.diamonds) || 0));
      next.potions = readPotionBag(parsed.potions);
      next.activePotions = readActivePotions(parsed.activePotions, parsed.readyPotions);
      next.version = SAVE_VERSION;
      const hadReady = Object.values(readPotionBag(parsed.readyPotions)).some((count) => count > 0);
      next.grantedGoldenCosmicFeast = !!parsed.grantedGoldenCosmicFeast;
      next.grantedRamen = !!parsed.grantedRamen;
      next.clearedToCracker = !!parsed.clearedToCracker;
      next.keptSingleCracker = !!parsed.keptSingleCracker;
      next.discovered = {};
      const rawDiscovered = Array.isArray(parsed.discovered)
        ? parsed.discovered
        : parsed.discovered && typeof parsed.discovered === "object"
          ? Object.keys(parsed.discovered).filter((key) => parsed.discovered[key])
          : [];
      for (const rawName of rawDiscovered) {
        const name = renameSheetFood(migrateFoodName(String(rawName), fromVersion));
        if (name !== String(rawName)) renamed = true;
        if (tierByName[name]) next.discovered[name] = true;
      }
      for (const [name, count] of Object.entries(next.inventory)) {
        if (count > 0 && tierByName[name]) next.discovered[name] = true;
      }
      if (fromVersion < SAVE_VERSION || hadReady || renamed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    } catch {
      return defaultSave();
    }
  }

  function normalizePotionEffect(raw, id, now = Date.now()) {
    const effect = emptyPotionEffect();
    if (Array.isArray(raw)) {
      const live = raw
        .map((time) => Number(time))
        .filter((time) => Number.isFinite(time) && time > now);
      if (!live.length) return effect;
      // Old saves stored one expiry per drink. Fold remaining time together.
      effect.endsAt = now + live.reduce((sum, time) => sum + (time - now), 0);
      effect.stacks =
        id === "luck" ? Math.min(LUCK_POTION_MAX_STACKS, live.length) : 1;
      return effect;
    }
    if (raw && typeof raw === "object") {
      effect.endsAt = Math.max(0, Number(raw.endsAt) || 0);
      effect.stacks = Math.max(0, Math.floor(Number(raw.stacks) || 0));
    }
    if (effect.endsAt <= now) {
      effect.endsAt = 0;
      effect.stacks = 0;
      return effect;
    }
    if (id === "luck") effect.stacks = Math.min(LUCK_POTION_MAX_STACKS, effect.stacks);
    else effect.stacks = effect.stacks > 0 ? 1 : 0;
    return effect;
  }

  function readActivePotions(raw, readyRaw) {
    const active = emptyActivePotions();
    const now = Date.now();
    if (raw && typeof raw === "object") {
      for (const key of Object.keys(active)) {
        active[key] = normalizePotionEffect(raw[key], key, now);
      }
    }
    const ready = readPotionBag(readyRaw);
    for (const key of Object.keys(active)) {
      for (let i = 0; i < ready[key]; i++) applyPotionDrink(active[key], key, now);
    }
    return active;
  }

  function applyPotionDrink(effect, id, now = Date.now()) {
    const live = effect.endsAt > now;
    const base = live ? effect.endsAt : now;
    effect.endsAt = base + POTION_DURATION_MS;
    if (id === "luck") {
      effect.stacks = Math.min(LUCK_POTION_MAX_STACKS, (live ? effect.stacks : 0) + 1);
    } else {
      effect.stacks = 1;
    }
    return effect;
  }

  function potionEffect(id) {
    const effect = save.activePotions[id] || emptyPotionEffect();
    const now = Date.now();
    if (effect.endsAt <= now) {
      if (effect.endsAt || effect.stacks) {
        effect.endsAt = 0;
        effect.stacks = 0;
        save.activePotions[id] = effect;
      }
      return effect;
    }
    if (id === "luck") effect.stacks = Math.min(LUCK_POTION_MAX_STACKS, effect.stacks);
    else effect.stacks = 1;
    return effect;
  }

  function boostStacks(id) {
    const effect = potionEffect(id);
    if (effect.endsAt <= Date.now()) return 0;
    if (id === "luck") return Math.min(LUCK_POTION_MAX_STACKS, effect.stacks);
    return effect.stacks > 0 ? 1 : 0;
  }

  function persistSave() {
    save.version = SAVE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  function rememberFood(name) {
    if (!tierByName[name]) return false;
    if (!save.discovered || typeof save.discovered !== "object") save.discovered = {};
    if (save.discovered[name]) return false;
    save.discovered[name] = true;
    return true;
  }

  function rememberInventory() {
    let added = false;
    for (const [name, count] of Object.entries(save.inventory)) {
      if (count > 0 && rememberFood(name)) added = true;
    }
    return added;
  }

  const save = loadSave();
  if (!save.keptSingleCracker) {
    save.inventory = { Cracker: 1 };
    save.equipped = "Cracker";
    save.clearedToCracker = true;
    save.keptSingleCracker = true;
    save.grantedGoldenCosmicFeast = true;
    persistSave();
  } else if (!save.clearedToCracker) {
    save.inventory = { Cracker: 1 };
    save.equipped = "Cracker";
    save.clearedToCracker = true;
    save.grantedGoldenCosmicFeast = true;
    persistSave();
  } else if (!save.grantedGoldenCosmicFeast) {
    save.inventory["Golden Cosmic Feast"] =
      (save.inventory["Golden Cosmic Feast"] || 0) + 50;
    save.grantedGoldenCosmicFeast = true;
    persistSave();
  }
  if (!save.grantedRamen) {
    if (!(save.inventory.Ramen > 0)) save.inventory.Ramen = 1;
    save.grantedRamen = true;
    persistSave();
  }
  if (rememberInventory()) persistSave();

  function renderDiamonds() {
    diamondsEl.textContent = save.diamonds.toLocaleString();
  }

  const state = {
    running: false,
    mode: "lobby",
    onShopPad: false,
    onCraftPad: false,
    autoFarm: false,
    points: 0,
    foodsEarned: 0,
    player: null,
    rivals: [],
    sprinkles: [],
    mouse: { x: ARENA / 2, y: ARENA / 2 },
    lastSpawnAt: 0,
    animId: 0,
    particles: [],
  };

  let lastFrameAt = 0;
  const PENDING_NET_KEY = "eatAFoodPendingRoom";
  const UPDATE_TRIED_KEY = "eatAFoodUpdateTried";
  const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const MAX_ROOM_PLAYERS = 8;
  const REJOIN_WINDOW_MS = 30000;
  const RELAY_URL = "wss://broker.hivemq.com:8884/mqtt";

  const net = {
    peer: null,
    hostConn: null,
    guests: new Map(),
    role: null,
    id: null,
    code: null,
    name: "Player",
    humans: new Map(),
    inputs: new Map(),
    roster: [],
    lastFocus: null,
    snapAcc: 0,
    inAcc: 0,
    cpus: true,
    worldReady: false,
    run: 0,
    endedRun: 0,
    migrating: false,
    rejoinUntil: 0,
    claimAt: 0,
    lastTry: "",
    retryTimer: 0,
    place: -1,
    sprAt: 0,
    ateSpr: [],
  };

  // CPUs can only be turned off while at least two people share a room.
  function cpusActive() {
    return !net.role || net.roster.length <= 1 || net.cpus;
  }

  // A room host keeps the arena running for everyone, even when nobody is in it.
  function arenaLive() {
    return state.running || net.role === "host";
  }

  function localZone() {
    return state.mode === "run" ? "arena" : "lobby";
  }

  // Random so run ids never repeat when a different friend takes over as host.
  function nextRunId() {
    return 1 + Math.floor(Math.random() * 2147483646);
  }

  function arenaHumans() {
    const list = [];
    if (state.player && state.mode === "run") list.push(state.player);
    if (net.role === "host") {
      for (const human of net.humans.values()) {
        if (human.zone === "arena" && !human.eaten) list.push(human);
      }
    }
    return list;
  }

  // CPUs are part of a run. When the last person leaves, they are gone.
  function clearRivalsIfArenaEmpty() {
    if (net.role === "guest") return;
    if (arenaHumans().length > 0) return;
    state.rivals = [];
  }

  bestRunEl.textContent = `${save.bestRun} foods`;
  renderDiamonds();

  function luckSnapshot(typeCount = ownedTypeCount()) {
    const steps = Math.floor(typeCount / LUCK_EVERY);
    const bonus = LUCK_BASE + steps * LUCK_STEP;
    return {
      typeCount,
      steps,
      bonus,
      into: typeCount % LUCK_EVERY,
      pct: Math.round(bonus * 100),
    };
  }

  function displayedLuckPct(typeCount = ownedTypeCount()) {
    const bonus = luckSnapshot(typeCount).bonus + boostStacks("luck") * LUCK_STEP;
    return Math.round(bonus * 100);
  }

  function luckRewardText(beforeCount, afterCount) {
    const before = luckSnapshot(beforeCount);
    const after = luckSnapshot(afterCount);
    const gainedTypes = after.typeCount - before.typeCount;
    if (gainedTypes <= 0) return "";
    const gainedPct = displayedLuckPct(afterCount) - displayedLuckPct(beforeCount);
    if (gainedPct <= 0) return `${after.into}/${LUCK_EVERY} toward the next +50% luck.`;
    return `Luck reward: +${gainedPct}% (now +${displayedLuckPct(afterCount)}%). ${after.into}/${LUCK_EVERY} toward the next +50%.`;
  }

  function showLuckNotice(beforeCount) {
    const text = luckRewardText(beforeCount, ownedTypeCount());
    if (!text) {
      luckNoticeEl.textContent = "";
      luckNoticeEl.classList.add("hidden");
      return;
    }
    luckNoticeEl.textContent = text;
    luckNoticeEl.classList.remove("hidden");
  }

  function pullWeight(food) {
    // Base weight is 1/odds. Luck boosts higher rarities more,
    // so the base and every-10 bonuses shift pulls toward rarer foods.
    const rank = rarityById[food.rarity].rank;
    const bonus = luckSnapshot().bonus + boostStacks("luck") * LUCK_STEP;
    return (1 / food.odds) * (1 + bonus * rank);
  }

  function pullFood() {
    let total = 0;
    for (const food of FOOD_TIERS) total += pullWeight(food);
    let roll = Math.random() * total;
    for (const food of FOOD_TIERS) {
      roll -= pullWeight(food);
      if (roll <= 0) return food;
    }
    return FOOD_TIERS[FOOD_TIERS.length - 1];
  }

  function equippedTier() {
    return tierByName[save.equipped] || FOOD_TIERS[0];
  }

  function ownedCount(name) {
    return save.inventory[name] || 0;
  }

  function ownedTypeCount() {
    return Object.values(save.inventory).filter((n) => n > 0).length;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clampToArena(entity) {
    const r = entity.drawRadius();
    entity.x = Math.min(ARENA - r, Math.max(r, entity.x));
    entity.y = Math.min(ARENA - r, Math.max(r, entity.y));
  }

  function createFood(tier, x, y, isRival = false) {
    return {
      id: uuid(),
      tier,
      size: 10,
      x,
      y,
      vx: 0,
      vy: 0,
      isRival,
      drawRadius() {
        const paced = 10 + (this.size - 10) / SPRINKLE_GROWTH_SCALE;
        return Math.min(120, 10 + Math.sqrt(Math.max(0, paced)) * 2.2);
      },
      displaySize() {
        return Math.floor(this.size);
      },
    };
  }

  function randomArenaSpot(margin = 80) {
    return {
      x: rand(margin, ARENA - margin),
      y: rand(margin, ARENA - margin),
    };
  }

  function farArenaSpot(fromSpots, minDist, margin = 80) {
    let best = null;
    let bestMin = -1;
    for (let i = 0; i < 48; i++) {
      const spot = randomArenaSpot(margin);
      let nearest = Infinity;
      for (const other of fromSpots) {
        nearest = Math.min(nearest, Math.hypot(spot.x - other.x, spot.y - other.y));
      }
      if (nearest >= minDist) return spot;
      if (nearest > bestMin) {
        bestMin = nearest;
        best = spot;
      }
    }
    return best || randomArenaSpot(margin);
  }

  function spawnPlayer() {
    const spot = randomArenaSpot();
    const food = createFood(equippedTier(), spot.x, spot.y, false);
    clampToArena(food);
    state.player = food;
  }

  // The lobby shares the arena's coordinates and is centered on the same point.
  const PORTAL_SPOT = { x: ARENA / 2, y: ARENA / 2 - (LOBBY_RADIUS - PORTAL_RADIUS - 12) };
  const SHOP_PAD_SPOT = { x: ARENA / 2 + 240, y: ARENA / 2 };
  const SHOP_STALL_SPOT = { x: ARENA / 2 + 335, y: ARENA / 2 };
  const CRAFT_PAD_SPOT = { x: ARENA / 2 - 240, y: ARENA / 2 };
  const CRAFT_STALL_SPOT = { x: ARENA / 2 - 335, y: ARENA / 2 };
  const LOBBY_SPAWN = { x: ARENA / 2, y: ARENA / 2 + 90 };

  function spawnLobbyPlayer(at = LOBBY_SPAWN) {
    state.player = createFood(equippedTier(), at.x, at.y, false);
  }

  function enterLobby() {
    state.mode = "lobby";
    if (!net.role && !soloWorldReady) {
      state.rivals = [];
      state.sprinkles = [];
      state.particles = [];
    }
    state.onShopPad = false;
    state.onCraftPad = false;
    spawnLobbyPlayer();
    if (net.role && state.player) state.player.netName = net.name;
    if (net.role === "host") {
      for (const person of net.roster) {
        if (person.id !== net.id) ensureNetHuman(person);
      }
    }
    if (view) view.distance = LOBBY_CAMERA_DISTANCE;
    lobbyHintEl.classList.remove("hidden");
    clearRivalsIfArenaEmpty();
  }

  function clampToLobby(food) {
    const dx = food.x - ARENA / 2;
    const dy = food.y - ARENA / 2;
    const d = Math.hypot(dx, dy);
    const max = LOBBY_RADIUS - Math.min(40, food.drawRadius() * 0.6);
    if (d > max) {
      food.x = ARENA / 2 + (dx / d) * max;
      food.y = ARENA / 2 + (dy / d) * max;
    }
    pushOutOfSpot(food, SHOP_STALL_SPOT, SHOP_STALL_RADIUS);
    pushOutOfSpot(food, CRAFT_STALL_SPOT, CRAFT_STALL_RADIUS);
  }

  function pushOutOfSpot(food, spot, radius) {
    const sx = food.x - spot.x;
    const sy = food.y - spot.y;
    const sd = Math.hypot(sx, sy);
    const minD = radius + food.drawRadius() * 0.5;
    if (sd >= minD) return;
    const nx = sd > 0 ? sx / sd : 1;
    const ny = sd > 0 ? sy / sd : 0;
    food.x = spot.x + nx * minD;
    food.y = spot.y + ny * minD;
  }

  function lobbyBlocked() {
    return (
      !overlay.classList.contains("hidden") ||
      !shopModal.classList.contains("hidden") ||
      !craftModal.classList.contains("hidden") ||
      !inventoryModal.classList.contains("hidden") ||
      !multiModal.classList.contains("hidden")
    );
  }

  function lobbySpot(index) {
    const angle = (index / 8) * Math.PI * 2;
    return {
      x: LOBBY_SPAWN.x + Math.cos(angle) * 80,
      y: LOBBY_SPAWN.y + Math.sin(angle) * 80,
    };
  }

  // Returns true when the player walked into the portal and a run started.
  function updateLobby(dt) {
    if (net.role === "guest") {
      if (state.player && net.place >= 0) applyLobbySteer(state.player, dt, null);
      smoothRemotes(dt);
      netPump(dt);
      if (state.player && !lobbyBlocked()) checkLobbyPads(state.player);
      return false;
    }
    if (!state.player || state.player.tier !== equippedTier()) {
      spawnLobbyPlayer(state.player || LOBBY_SPAWN);
      if (net.role && state.player) state.player.netName = net.name;
    }
    const food = state.player;
    const blocked = applyLobbySteer(food, dt, null);
    // CPUs keep going only while someone is still in the run.
    if (net.role === "host" && arenaHumans().length > 0) {
      stepWorld(dt, performance.now());
    }
    if (net.role === "host") {
      stepLobbyGuests(dt);
      netPump(dt);
    }
    if (blocked) return false;

    if (dist(food, PORTAL_SPOT) < PORTAL_RADIUS * 0.8) {
      startRun();
      if (state.running) return true;
      spawnLobbyPlayer();
      return false;
    }
    checkLobbyPads(food);
    return false;
  }

  function checkLobbyPads(food) {
    const onPad = dist(food, SHOP_PAD_SPOT) < SHOP_PAD_RADIUS;
    if (onPad && !state.onShopPad) openShop();
    state.onShopPad = onPad;
    const onCraft = dist(food, CRAFT_PAD_SPOT) < CRAFT_PAD_RADIUS;
    if (onCraft && !state.onCraftPad) openCraft();
    state.onCraftPad = onCraft;
  }

  // Host only: friends in the lobby walk around and enter the arena on their own.
  function stepLobbyGuests(dt) {
    for (const human of net.humans.values()) {
      if (human.zone !== "lobby") continue;
      followTarget(human, dt);
      clampToLobby(human);
      if (dist(human, PORTAL_SPOT) < PORTAL_RADIUS * 0.8) enterArena(human);
    }
  }

  // Remote foods glide toward their last known spot so 20 updates a second look smooth.
  function followTarget(food, dt) {
    if (!Number.isFinite(food.tx) || !Number.isFinite(food.ty)) return;
    const dx = food.tx - food.x;
    const dy = food.ty - food.y;
    if (Math.hypot(dx, dy) > 400) {
      food.x = food.tx;
      food.y = food.ty;
      return;
    }
    const k = 1 - Math.exp(-dt * 18);
    food.x += dx * k;
    food.y += dy * k;
  }

  // The host moved a friend (arena entry, lobby return, rejoin). Their own
  // reports only count again once they have seen this new spot.
  function markPlaced(food) {
    food.place = (food.place || 0) + 1;
    food.tx = food.x;
    food.ty = food.y;
    food.vx = 0;
    food.vy = 0;
  }

  function enterArena(food) {
    ensureWorld();
    const named = food.wantFood && tierByName[food.wantFood];
    if (named) food.tier = named;
    const spot = farArenaSpot([...arenaHumans(), ...state.rivals], ARENA * 0.22);
    food.x = spot.x;
    food.y = spot.y;
    food.vx = 0;
    food.vy = 0;
    food.size = 10;
    food.foods = 0;
    food.eaten = false;
    food.zone = "arena";
    food.run = nextRunId();
    clampToArena(food);
    markPlaced(food);
    const guest = net.guests.get(food.netId);
    if (guest) guest.needSpr = true;
    spawnBetterRival(food);
  }

  function sendToLobby(food) {
    const named = food.wantFood && tierByName[food.wantFood];
    if (named) food.tier = named;
    const spot = lobbySpot(1 + Math.floor(Math.random() * 7));
    food.x = spot.x;
    food.y = spot.y;
    food.vx = 0;
    food.vy = 0;
    food.size = 10;
    food.zone = "lobby";
    food.run = 0;
    clampToLobby(food);
    markPlaced(food);
    clearRivalsIfArenaEmpty();
  }

  // Solo play keeps one arena, the same way a room does. Guests use the host's.
  let soloWorldReady = false;

  function worldReady() {
    return net.role === "host" ? net.worldReady : soloWorldReady;
  }

  // The arena is seeded once, then keeps going while you are in the lobby.
  function ensureWorld() {
    if (net.role === "guest" || worldReady()) return;
    if (net.role === "host") net.worldReady = true;
    else soloWorldReady = true;
    state.rivals = [];
    state.particles = [];
    seedSprinkles();
    state.lastSpawnAt = performance.now();
  }

  function awardRunFood() {
    // Slot earned now; the actual food is rolled when the run ends.
    state.foodsEarned += 1;
    updateHud();
  }

  function bankPendingFoods() {
    const gained = [];
    for (let i = 0; i < state.foodsEarned; i++) {
      const food = pullFood();
      gained.push(food.name);
      save.inventory[food.name] = (save.inventory[food.name] || 0) + 1;
    }
    if (!save.inventory[save.equipped]) {
      save.equipped = Object.keys(save.inventory)[0] || "Peanut";
    }
    persistSave();
    return gained;
  }

  function spawnRivalAt(tier, x, y, size, ignoreCap = false) {
    if (!ignoreCap && state.rivals.length >= MAX_RIVALS) return null;
    const rival = createFood(tier, x, y, true);
    rival.size = size;
    clampToArena(rival);
    state.rivals.push(rival);
    return rival;
  }

  function variantLevel(tier) {
    if (tier.isShadow) return 3;
    if (tier.isShiny) return 2;
    if (tier.isGolden) return 1;
    return 0;
  }

  // 0 for a plain Common food, up to 8 for a Shadow Mythic.
  function foodPower(tier) {
    return (rarityById[tier.rarity] ? rarityById[tier.rarity].rank : 0) + variantLevel(tier);
  }

  // CPUs match the rarest food equipped in the arena, or in the room when the arena is empty.
  function cpuTier() {
    const tiers = arenaHumans().map((food) => food.tier);
    if (!tiers.length) {
      tiers.push(equippedTier());
      if (net.role === "host") {
        for (const human of net.humans.values()) tiers.push(human.tier);
      }
    }
    let best = tiers[0];
    for (const tier of tiers) {
      if (tier && foodPower(tier) > foodPower(best)) best = tier;
    }
    return best;
  }

  // The food whose points multiplier is nearest to this one plus 1.
  // Never a Common, including Golden, Rainbow, or Shadow Commons.
  // A tie prefers a different food, then the higher multiplier.
  function plusOneTier(tier) {
    const target = tier.multiplier + 1;
    let best = null;
    let bestDist = Infinity;
    for (const food of ALL_FOODS) {
      if (food.rarity === "common") continue;
      const dist = Math.abs(food.multiplier - target);
      if (dist > bestDist) continue;
      if (dist < bestDist) {
        best = food;
        bestDist = dist;
        continue;
      }
      const bestIsSelf = best === tier;
      const foodIsSelf = food === tier;
      if (bestIsSelf !== foodIsSelf) {
        if (bestIsSelf) best = food;
        continue;
      }
      if (food.multiplier > best.multiplier) best = food;
    }
    return best || tier;
  }

  // Every entry, in solo or a room, comes in with one CPU a step ahead on
  // points multiplier, far enough away that it cannot catch you at the start.
  function spawnBetterRival(food) {
    if (!cpusActive() || !food) return;
    const used = [food, ...arenaHumans()].map((other) => ({ x: other.x, y: other.y }));
    const spot = farArenaSpot(used, ARENA * 0.32);
    spawnRivalAt(plusOneTier(food.tier), spot.x, spot.y, 10, true);
  }

  function pointInZone(nx, ny, zone) {
    const d = Math.hypot(nx - 0.5, ny - 0.5) / 0.707;
    return d >= zone[0] && d <= zone[1];
  }

  function pickSprinkleType() {
    // Bigger sprinkles are much rarer; large are especially scarce.
    // Extra smalls are not in this roll; they stay at their own cap.
    const roll = Math.random();
    if (roll < 0.976) return sprinkleType("small");
    if (roll < 0.996) return sprinkleType("medium");
    if (roll < 0.999) return sprinkleType("large");
    return sprinkleType("xl");
  }

  function sprinkleCount(key) {
    let count = 0;
    for (const sprinkle of state.sprinkles) {
      if (sprinkle.type.key === key) count += 1;
    }
    return count;
  }

  function spawnSprinkle(forcedType) {
    if (state.sprinkles.length >= MAX_SPRINKLES) return;
    const type = forcedType || pickSprinkleType();
    const cap = SPRINKLE_CAPS[type.key];
    if (cap != null && sprinkleCount(type.key) >= cap) return;
    let x = 0;
    let y = 0;
    let tries = 0;
    do {
      x = rand(24, ARENA - 24);
      y = rand(24, ARENA - 24);
      tries += 1;
    } while (!pointInZone(x / ARENA, y / ARENA, type.zone) && tries < 40);

    if (tries >= 40) {
      const angle = rand(0, Math.PI * 2);
      const mid = (type.zone[0] + type.zone[1]) / 2;
      const r = mid * (ARENA * 0.5);
      x = ARENA / 2 + Math.cos(angle) * r;
      y = ARENA / 2 + Math.sin(angle) * r;
    }

    state.sprinkles.push({
      id: uuid(),
      type,
      x,
      y,
      wobble: rand(0, Math.PI * 2),
    });
  }

  function seedSprinkles() {
    state.sprinkles = [];
    for (let i = 0; i < MAX_XS_SPRINKLES; i++) spawnSprinkle(sprinkleType("xs"));
    for (let i = 0; i < MAX_SMALL_SPRINKLES; i++) spawnSprinkle(sprinkleType("small"));
    for (let i = 0; i < START_MEDIUM_SPRINKLES; i++) spawnSprinkle(sprinkleType("medium"));
    for (let i = 0; i < START_LARGE_SPRINKLES; i++) spawnSprinkle(sprinkleType("large"));
  }

  // Half the multiplier affects food pulls: (1 + mult) / 2
  // e.g. mult 2 → 1.5x foods, mult 13 → 7x foods.
  function foodGainFactor() {
    const mult = state.player?.tier?.multiplier ?? equippedTier().multiplier;
    return ((1 + mult) / 2) * Math.pow(1.25, boostStacks("points"));
  }

  function foodsFromPoints(pts) {
    return Math.floor((pts * foodGainFactor()) / POINTS_PER_FOOD);
  }

  function addPoints(amount) {
    const before = foodsFromPoints(state.points);
    state.points += amount;
    const after = foodsFromPoints(state.points);
    for (let i = 0; i < after - before; i++) awardRunFood();
    updateHud();
  }

  // Same as addPoints, but eating another food can award at most 10 foods.
  function addEatPoints(amount) {
    const before = foodsFromPoints(state.points);
    state.points += amount;
    const natural = foodsFromPoints(state.points) - before;
    const gained = Math.min(10, natural);
    if (natural > 10) {
      const factor = foodGainFactor();
      const into = (state.points * factor) % POINTS_PER_FOOD;
      state.points = ((before + 10) * POINTS_PER_FOOD + into) / factor;
    }
    for (let i = 0; i < gained; i++) awardRunFood();
    updateHud();
  }

  function burst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1, 3.5);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        color,
      });
    }
  }

  function eatSprinkle(food, sprinkle, index) {
    const pts = sprinkle.type.points;
    const growthBoost = food === state.player ? Math.pow(1.25, boostStacks("growth")) : food.growthBoost || 1;
    const gain = pts * food.tier.growth * growthBoost;
    food.size += gain;
    if (food === state.player) addPoints(pts);
    else if (net.role === "host" && food.netId) netSend({ t: "ev", kind: "pts", id: food.netId, pts });
    burst(sprinkle.x, sprinkle.y, sprinkle.type.color);
    state.sprinkles.splice(index, 1);
    setTimeout(() => {
      if (arenaLive()) spawnSprinkle();
    }, 1400 + Math.random() * 1800);
  }

  // Same size gain a player gets from eating a food: prey size × own growth.
  function growthForEat(eater) {
    const boost = eater === state.player ? Math.pow(1.25, boostStacks("growth")) : eater.growthBoost || 1;
    return eater.tier.growth * boost;
  }

  function tryEatFood(eater, prey, preyList, preyIndex) {
    if (!eater || !prey || eater === prey || prey.eaten || eater.eaten) return false;
    if (eater.size <= prey.size) return false;
    // Eat when the food models touch. The ring sits outside the model.
    if (dist(eater, prey) > bodyReach(eater) + bodyReach(prey)) return false;

    const preySize = prey.size;
    eater.size += preySize * growthForEat(eater);
    // Every 10 of their size → 1 point; foodGainFactor applies the points multiplier.
    // At most 10 foods from one eat. Guests apply that on their own save.
    if (eater === state.player && (prey.isRival || prey.netId)) addEatPoints(preySize / 10);
    if (net.role === "host" && eater.netId) netSend({ t: "ev", kind: "eat", id: eater.netId, preySize });
    burst(prey.x, prey.y, prey.tier.color);
    prey.eaten = true;
    if (prey.netId) {
      if (net.role === "host") {
        netSend({ t: "ev", kind: "dead", id: prey.netId });
        sendToLobby(prey);
      }
    } else if (prey === state.player) {
      state.player = null;
      if (net.role === "host") netSend({ t: "ev", kind: "dead", id: net.id });
    } else if (preyList && preyList[preyIndex] === prey) {
      preyList.splice(preyIndex, 1);
    }
    return true;
  }

  const moveKeys = new Set();

  function controlDirection() {
    let strafe = 0;
    let forward = 0;
    if (moveKeys.has("d")) strafe += 1;
    if (moveKeys.has("a")) strafe -= 1;
    if (moveKeys.has("w") || moveKeys.has("arrowup")) forward += 1;
    if (moveKeys.has("s") || moveKeys.has("arrowdown")) forward -= 1;
    const mag = Math.hypot(strafe, forward);
    if (!mag || !view) return null;
    const yaw = view.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    return {
      x: (rx * strafe + fx * forward) / mag,
      y: (rz * strafe + fz * forward) / mag,
    };
  }

  function steerCamera(dt) {
    if (!view) return;
    let turn = 0;
    if (moveKeys.has("arrowleft")) turn -= 1;
    if (moveKeys.has("arrowright")) turn += 1;
    if (!turn) return;
    view.yaw -= turn * 1.9 * dt;
  }

  function steerToward(food, target, speed) {
    const dx = target.x - food.x;
    const dy = target.y - food.y;
    const d = Math.hypot(dx, dy) || 1;
    food.vx += (dx / d) * speed;
    food.vy += (dy / d) * speed;
  }

  function playerIsMoving() {
    return (
      moveKeys.has("w") ||
      moveKeys.has("a") ||
      moveKeys.has("s") ||
      moveKeys.has("d") ||
      moveKeys.has("arrowup") ||
      moveKeys.has("arrowdown")
    );
  }

  function otherFoods(food) {
    const others = arenaHumans().filter((human) => human !== food);
    if (net.role === "guest") {
      for (const human of net.humans.values()) {
        if (human.zone === "arena") others.push(human);
      }
    }
    for (const rival of state.rivals) {
      if (rival !== food) others.push(rival);
    }
    return others;
  }

  // Prefer closer sprinkles, with a slight pull toward higher-point ones.
  function preferredSprinkle(food) {
    let best = null;
    let bestScore = Infinity;
    for (const s of state.sprinkles) {
      const score = dist(food, s) / (1 + s.type.points / 250);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  // Flee bigger foods, chase smaller ones, otherwise hunt sprinkles with a size bias.
  function steerLikeCpu(food, spd) {
    // Skilled CPUs notice foods from farther away and chase harder.
    const skill = food.skill || 0;
    const sight = 1 + skill * 0.12;
    let threat = null;
    let threatD = Infinity;
    let prey = null;
    let preyD = Infinity;
    for (const other of otherFoods(food)) {
      const d = dist(food, other);
      if (other.size > food.size && d < threatD) {
        threat = other;
        threatD = d;
      } else if (other.size < food.size && d < preyD) {
        prey = other;
        preyD = d;
      }
    }

    if (threat && threatD < 220 * sight && threatD > 0) {
      food.vx += ((food.x - threat.x) / threatD) * 0.55 * spd;
      food.vy += ((food.y - threat.y) / threatD) * 0.55 * spd;
      return;
    }
    if (prey && preyD < 280 * sight) {
      steerToward(food, prey, 0.48 * (1 + skill * 0.05) * spd);
      return;
    }
    const snack = preferredSprinkle(food);
    if (snack) steerToward(food, snack, 0.4 * spd);
    else steerToward(food, { x: ARENA / 2, y: ARENA / 2 }, 0.2 * spd);
  }

  function moveSpeed(food) {
    const boost = food === state.player ? Math.pow(1.25, boostStacks("speed")) : food.speedBoost || 1;
    const base = (food.tier.speed || 1) * SPEED_SCALE * boost;
    // Bigger body = slower. Starts full speed around size 10, soft-floors later.
    const bulk = Math.max(0, food.size - 10);
    const sizeFactor = Math.max(0.32, 1 / (1 + bulk / 180));
    return base * sizeFactor;
  }

  function displaySpeed(tier) {
    return tier.speed;
  }

  function directionFromKeys(keys, yaw) {
    const held = new Set(keys || []);
    let strafe = 0;
    let forward = 0;
    if (held.has("d")) strafe += 1;
    if (held.has("a")) strafe -= 1;
    if (held.has("w") || held.has("arrowup")) forward += 1;
    if (held.has("s") || held.has("arrowdown")) forward -= 1;
    const mag = Math.hypot(strafe, forward);
    if (!mag) return null;
    const fx = -Math.sin(yaw || 0);
    const fz = -Math.cos(yaw || 0);
    const rx = Math.cos(yaw || 0);
    const rz = -Math.sin(yaw || 0);
    return {
      x: (rx * strafe + fx * forward) / mag,
      y: (rz * strafe + fz * forward) / mag,
    };
  }

  function keysAreMoving(keys) {
    const held = new Set(keys || []);
    return held.has("w") || held.has("a") || held.has("s") || held.has("d") || held.has("arrowup") || held.has("arrowdown");
  }

  function applyLobbySteer(food, dt, remote) {
    const blocked = !remote && lobbyBlocked();
    const dir = blocked ? null : remote ? directionFromKeys(remote.keys, remote.yaw) : controlDirection();
    if (dir) {
      const spd = Math.max(0.75, moveSpeed(food));
      steerToward(food, { x: food.x + dir.x * 140, y: food.y + dir.y * 140 }, 0.9 * spd);
    }
    food.vx *= 0.86;
    food.vy *= 0.86;
    food.x += food.vx * dt * 60;
    food.y += food.vy * dt * 60;
    clampToLobby(food);
    return blocked;
  }

  function applyRunSteer(food, dt, remote) {
    const spd = moveSpeed(food);
    const dir = remote ? directionFromKeys(remote.keys, remote.yaw) : controlDirection();
    const moving = remote ? keysAreMoving(remote.keys) : playerIsMoving();
    const farming = remote ? !!remote.autoFarm : state.autoFarm;
    if (dir) {
      steerToward(food, { x: food.x + dir.x * 140, y: food.y + dir.y * 140 }, 0.9 * spd);
      const nearest = preferredSprinkle(food);
      if (nearest && dist(food, nearest) < 140) steerToward(food, nearest, 0.22 * spd);
    } else if (farming && !moving) {
      steerLikeCpu(food, spd);
    }
    for (const other of otherFoods(food)) {
      if (other.size <= food.size) continue;
      const d = dist(food, other);
      if (d < 120 && d > 0) {
        food.vx += ((food.x - other.x) / d) * 0.45 * spd;
        food.vy += ((food.y - other.y) / d) * 0.45 * spd;
      }
    }
    food.vx *= 0.86;
    food.vy *= 0.86;
    food.x += food.vx * dt * 60;
    food.y += food.vy * dt * 60;
    clampToArena(food);
  }

  function updateFoods(dt) {
    for (const human of arenaHumans()) {
      if (human === state.player) {
        applyRunSteer(human, dt, null);
      } else {
        followTarget(human, dt);
        clampToArena(human);
      }
    }

    for (const rival of state.rivals) {
      const spd = moveSpeed(rival);
      steerLikeCpu(rival, spd);

      rival.vx *= 0.88;
      rival.vy *= 0.88;
      rival.x += rival.vx * dt * 60;
      rival.y += rival.vy * dt * 60;
      clampToArena(rival);
    }
  }

  // Just outside the widest food. Models are fit to size 1, so a square
  // food reaches about 0.71 from the center. Every food uses this ring,
  // and it scales with drawRadius.
  const RING_MAJOR = 0.73;
  const RING_TUBE = 0.02;
  const FOOD_MODEL_SCALE = 2.15;

  function ringColor(tier) {
    if (tier.isShadow) return "#9b5cff";
    if (tier.isShiny) return "#7ec8ff";
    if (tier.isGolden) return "#ffd700";
    return "#ffffff";
  }

  // Outer edge of the ring. It scales with the food, and an orb is eaten when it touches it.
  function ringReach(food) {
    return (RING_MAJOR + RING_TUBE) * food.drawRadius() * FOOD_MODEL_SCALE;
  }

  // Half of the fitted model. Models are scaled so their longest side equals this reach times two.
  function bodyReach(food) {
    return 0.5 * food.drawRadius() * FOOD_MODEL_SCALE;
  }

  function resolveEats() {
    const actors = arenaHumans();
    actors.push(...state.rivals);

    for (let i = state.sprinkles.length - 1; i >= 0; i--) {
      const s = state.sprinkles[i];
      let eater = null;
      let bestD = Infinity;
      for (const f of actors) {
        const d = dist(f, s);
        const reach = ringReach(f) + s.type.radius;
        if (d < reach && d < bestD) {
          bestD = d;
          eater = f;
        }
      }
      if (eater) eatSprinkle(eater, s, i);
    }

    const humans = arenaHumans();
    for (const human of humans) {
      for (let j = state.rivals.length - 1; j >= 0; j--) {
        tryEatFood(human, state.rivals[j], state.rivals, j);
      }
    }

    for (const human of humans) {
      if (human.eaten) continue;
      for (const other of arenaHumans()) {
        if (human === other) continue;
        tryEatFood(human, other, [other], 0);
      }
    }

    for (let i = state.rivals.length - 1; i >= 0; i--) {
      const r = state.rivals[i];
      for (const human of arenaHumans()) tryEatFood(r, human, [human], 0);
    }
    resolveRivalEats();
  }

  // The larger CPU keeps its place and gains size. Only the smaller one is removed.
  function resolveRivalEats() {
    const rivals = state.rivals;
    const gone = new Set();
    for (let pass = 0; pass < rivals.length; pass++) {
      let ate = false;
      for (const eater of rivals) {
        if (gone.has(eater)) continue;
        for (const prey of rivals) {
          if (prey === eater || gone.has(prey)) continue;
          if (eater.size <= prey.size) continue;
          if (dist(eater, prey) > bodyReach(eater) + bodyReach(prey)) continue;
          eater.size += prey.size * growthForEat(eater);
          gone.add(prey);
          burst(prey.x, prey.y, prey.tier.color);
          ate = true;
        }
      }
      if (!ate) break;
    }
    if (gone.size) state.rivals = rivals.filter((rival) => !gone.has(rival));
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 1.8;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  // Closest CC0 model from Kenney's Food Kit (kenney.nl). Sprinkles are orbs.
  // Filenames live on each food in foods.js.
  const FOOD_MODELS = Object.fromEntries(
    FOOD_TIERS.map((food) => [food.name, food.model || "cookie.glb"])
  );

  let view = null;
  let previewId = 0;

  function modelFileFor(tier) {
    return FOOD_MODELS[tier.baseName || tier.name] || "cookie.glb";
  }

  function worldX(x) {
    return x - ARENA / 2;
  }

  function worldZ(y) {
    return y - ARENA / 2;
  }

  function formatCount(value) {
    if (!Number.isFinite(value)) return "∞";
    const negative = value < 0;
    const whole = Math.floor(Math.abs(value));
    let digits = whole.toString();
    if (digits.includes("e") || digits.includes("E")) {
      const [base, expPart] = digits.toLowerCase().split("e+");
      const [head, frac = ""] = base.split(".");
      digits = head + frac + "0".repeat(Math.max(0, Number(expPart) - frac.length));
    }
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return negative ? `-${grouped}` : grouped;
  }

  function makeLabelSprite(THREE) {
    const canvas2d = document.createElement("canvas");
    canvas2d.width = 4096;
    canvas2d.height = 64;
    const tex = new THREE.CanvasTexture(canvas2d);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    sprite.scale.set(52, 26, 1);
    sprite.userData.canvas = canvas2d;
    sprite.userData.tex = tex;
    return sprite;
  }

  function writeLabel(sprite, text) {
    const canvas2d = sprite.userData.canvas;
    const ctx2d = canvas2d.getContext("2d");
    const pad = 28;
    const height = canvas2d.height;
    const maxWidth = canvas2d.width;
    let fontSize = 42;
    let textWidth = 0;
    let font = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      font = `700 ${fontSize}px Fredoka, Nunito, sans-serif`;
      ctx2d.font = font;
      textWidth = Math.ceil(ctx2d.measureText(text).width);
      if (textWidth + pad * 2 <= maxWidth || fontSize <= 4) break;
      fontSize = Math.max(4, Math.floor((fontSize * (maxWidth - pad * 2)) / Math.max(1, textWidth)));
    }
    const used = Math.min(maxWidth, textWidth + pad * 2);
    ctx2d.clearRect(0, 0, maxWidth, height);
    ctx2d.font = font;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.lineWidth = Math.max(2, fontSize / 5);
    ctx2d.lineJoin = "round";
    ctx2d.strokeStyle = "rgba(20,10,6,0.85)";
    ctx2d.fillStyle = "#fff6ea";
    ctx2d.strokeText(text, maxWidth / 2, height / 2 + 2);
    ctx2d.fillText(text, maxWidth / 2, height / 2 + 2);
    const tex = sprite.userData.tex;
    const repeatX = used / maxWidth;
    tex.repeat.set(repeatX, 1);
    tex.offset.set((1 - repeatX) / 2, 0);
    tex.needsUpdate = true;
    sprite.userData.text = text;
    const worldHeight = 26;
    sprite.scale.set(worldHeight * (used / height), worldHeight, 1);
  }

  function normalizeModel(THREE, root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.multiplyScalar(1 / maxDim);
    root.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= fitted.min.y;
    const wrapper = new THREE.Group();
    wrapper.add(root);
    return wrapper;
  }

  function paintFood(entry, food, t) {
    const tier = food.tier;
    const shinyHue = (t * 0.2 + entry.spin) % 1;
    for (const mat of entry.materials) {
      if (tier.isShadow) {
        mat.color.set("#1a0c28");
        mat.emissive.set("#6b2dff");
        mat.emissiveIntensity = 0.55 + Math.sin(t * 2.4 + entry.spin) * 0.12;
        mat.metalness = 0.35;
        mat.roughness = 0.42;
      } else if (tier.isShiny) {
        mat.color.setHSL(shinyHue, 0.65, 0.62);
        mat.emissive.setHSL(shinyHue, 0.85, 0.38);
        mat.emissiveIntensity = 0.6;
        mat.metalness = 0.5;
        mat.roughness = 0.28;
      } else if (tier.isGolden) {
        mat.color.set("#ffd56a");
        mat.emissive.set("#c48410");
        mat.emissiveIntensity = 0.4;
        mat.metalness = 0.62;
        mat.roughness = 0.32;
      } else if (mat.map) {
        mat.color.set("#ffffff");
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0;
      } else {
        if (mat.userData.authoredColor) mat.color.copy(mat.userData.authoredColor);
        else mat.color.set(tier.color);
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0;
        if (mat.userData.authoredRoughness != null) {
          mat.roughness = mat.userData.authoredRoughness;
          mat.metalness = mat.userData.authoredMetalness;
        }
      }
      if (food.isRival) {
        mat.emissive.set("#8a2030");
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.28);
      }
    }
    if (entry.ring) {
      entry.ring.material.color.set(ringColor(tier));
    }
    if (entry.aura) {
      const pulse = 0.22 + (Math.sin(t * 2.6 + entry.spin) + 1) * 0.08;
      entry.aura.material.opacity = pulse;
      entry.aura.visible = !!tier.isShadow;
    }
  }

  function syncFood(THREE, food, t) {
    let entry = view.foods.get(food.id);
    if (!entry) {
      const file = modelFileFor(food.tier);
      const template = view.templates.get(file);
      const group = new THREE.Group();
      const holder = new THREE.Group();
      const materials = [];
      if (template) {
        const model = template.clone(true);
        model.traverse((obj) => {
          if (!obj.isMesh) return;
          const source = Array.isArray(obj.material) ? obj.material : [obj.material];
          const cloned = source.map((mat) => {
            const copy = mat.clone();
            copy.userData.authoredColor = copy.color.clone();
            copy.userData.authoredRoughness = copy.roughness;
            copy.userData.authoredMetalness = copy.metalness;
            return copy;
          });
          obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
          materials.push(...cloned);
        });
        holder.add(model);
      } else {
        const mat = new THREE.MeshStandardMaterial({ color: food.tier.color });
        materials.push(mat);
        holder.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), mat));
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(RING_MAJOR, RING_TUBE, 8, 28),
        new THREE.MeshBasicMaterial({
          color: ringColor(food.tier),
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      ring.rotation.x = Math.PI / 2;
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.92, 28, 20),
        new THREE.MeshBasicMaterial({
          color: 0x8a3dff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      );
      aura.visible = !!food.tier.isShadow;
      const label = makeLabelSprite(THREE);
      group.add(holder);
      group.add(aura);
      group.add(ring);
      group.add(label);
      view.scene.add(group);
      entry = {
        group,
        holder,
        label,
        materials,
        ring,
        aura,
        spin: Math.random() * Math.PI * 2,
        sizeText: "",
      };
      view.foods.set(food.id, entry);
    }

    const radius = food.drawRadius();
    const scale = radius * FOOD_MODEL_SCALE;
    // Hover stays positive so the model and ring never cross the arena floor.
    const bob = 0.8 + (Math.sin(t * 2.2 + entry.spin) + 1) * 1.4;
    entry.holder.scale.setScalar(scale);
    entry.holder.rotation.set(0, t * 0.65 + entry.spin, 0);
    entry.ring.rotation.set(Math.PI / 2, 0, 0);
    entry.ring.scale.setScalar(scale);
    entry.ring.position.set(0, scale * (RING_TUBE + 0.02), 0);
    if (entry.aura) {
      entry.aura.scale.setScalar(scale);
      entry.aura.position.set(0, scale * 0.45, 0);
    }
    entry.group.position.set(worldX(food.x), bob, worldZ(food.y));
    entry.label.position.y = scale + 16;
    const sizeText = food.netName
      ? `${food.netName}  ${formatCount(food.displaySize())}`
      : formatCount(food.displaySize());
    if (entry.sizeText !== sizeText) {
      writeLabel(entry.label, sizeText);
      entry.sizeText = sizeText;
    }
    paintFood(entry, food, t);
    return food.id;
  }

  function syncSprinkles(t) {
    const counts = Object.create(null);
    for (const type of SPRINKLE_TYPES) counts[type.key] = 0;
    const visible = state.mode === "run" ? state.sprinkles : [];
    for (const sprinkle of visible) {
      const key = sprinkle.type.key;
      const mesh = view.sprinkles[key];
      const index = counts[key]++;
      const bob = Math.sin(t * 3 + sprinkle.wobble) * 2.5;
      view.dummy.position.set(
        worldX(sprinkle.x),
        sprinkle.type.radius + bob,
        worldZ(sprinkle.y)
      );
      view.dummy.rotation.set(0, t + sprinkle.wobble, 0);
      view.dummy.scale.set(1, 1, 1);
      view.dummy.updateMatrix();
      mesh.setMatrixAt(index, view.dummy.matrix);
    }
    for (const type of SPRINKLE_TYPES) {
      const mesh = view.sprinkles[type.key];
      mesh.count = counts[type.key];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function syncParticles() {
    const THREE = view.THREE;
    const particles = state.mode === "run" ? state.particles : [];
    while (view.particleMeshes.length < particles.length) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(view.particleGeo, mat);
      view.scene.add(mesh);
      view.particleMeshes.push(mesh);
    }
    for (let i = 0; i < view.particleMeshes.length; i++) {
      const mesh = view.particleMeshes[i];
      const particle = particles[i];
      if (!particle) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(worldX(particle.x), 8, worldZ(particle.y));
      mesh.material.color.set(particle.color);
      mesh.material.opacity = Math.max(0, particle.life);
    }
  }

  function draw() {
    if (!view) return;
    const t = performance.now() / 1000;
    const alive = new Set();
    const zone = localZone();
    if (zone === "arena") {
      for (const rival of state.rivals) alive.add(syncFood(view.THREE, rival, t));
    }
    if (state.player) alive.add(syncFood(view.THREE, state.player, t));
    for (const human of net.humans.values()) {
      if ((human.zone || "lobby") === zone) alive.add(syncFood(view.THREE, human, t));
    }
    for (const [id, entry] of view.foods) {
      if (alive.has(id)) continue;
      view.scene.remove(entry.group);
      view.foods.delete(id);
    }
    syncSprinkles(t);
    syncParticles();
    syncLobbyScene(t);
    updateCamera();
    view.renderer.render(view.scene, view.camera);
    renderLeaderboard();
  }

  function cpuBoardName(tier) {
    if (tier.isShadow) return "Shadow CPU";
    if (tier.isShiny) return "Rainbow CPU";
    if (tier.isGolden) return "Golden CPU";
    return "CPU";
  }

  // Top five foods in a multiplayer arena, players and CPUs together.
  function leaderboardEntries() {
    const list = [];
    if (state.player && state.mode === "run") {
      list.push({
        name: net.role ? net.name || "You" : "You",
        tier: state.player.tier,
        size: state.player.size,
        you: true,
      });
    }
    for (const human of net.humans.values()) {
      if (human.zone !== "arena" || human.eaten) continue;
      list.push({ name: human.netName || "Player", tier: human.tier, size: human.size });
    }
    for (const rival of state.rivals) {
      list.push({ name: cpuBoardName(rival.tier), tier: rival.tier, size: rival.size });
    }
    list.sort((a, b) => b.size - a.size);
    return list.slice(0, 5);
  }

  let leaderboardAt = 0;
  let leaderboardKey = null;
  function renderLeaderboard() {
    if (!net.role) {
      leaderboardEl.classList.add("hidden");
      leaderboardKey = null;
      return;
    }
    leaderboardEl.classList.remove("hidden");
    const now = performance.now();
    if (now - leaderboardAt < 250) return;
    leaderboardAt = now;
    const entries = leaderboardEntries().map((entry, i) => ({
      ...entry,
      label: `${i + 1}. ${entry.tier.emoji} ${entry.name}`,
      sizeText: formatCount(Math.round(entry.size)),
    }));
    const key = entries.map((entry) => `${entry.label}|${entry.sizeText}|${entry.you ? 1 : 0}`).join("\n");
    if (key === leaderboardKey) return;
    leaderboardKey = key;
    leaderboardListEl.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "lb-empty";
      empty.textContent = "Nobody yet";
      leaderboardListEl.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const item = document.createElement("li");
      if (entry.you) item.classList.add("you");
      const name = document.createElement("span");
      name.className = "lb-name";
      name.textContent = entry.label;
      const size = document.createElement("span");
      size.textContent = entry.sizeText;
      item.append(name, size);
      leaderboardListEl.appendChild(item);
    }
  }

  function syncLobbyScene(t) {
    const inLobby = state.mode === "lobby";
    view.arenaGroup.visible = !inLobby;
    const lobby = view.lobby;
    lobby.group.visible = inLobby;
    if (!inLobby) return;
    lobby.portalSwirl.rotation.z = t * 1.6;
    lobby.portalRing.material.emissiveIntensity = 0.75 + Math.sin(t * 3) * 0.25;
    lobby.beam.material.opacity = 0.12 + (Math.sin(t * 2) + 1) * 0.05;
    lobby.padRing.material.opacity = state.onShopPad ? 0.95 : 0.55 + Math.sin(t * 2.4) * 0.2;
    lobby.craftPadRing.material.opacity = state.onCraftPad ? 0.95 : 0.55 + Math.sin(t * 2.2) * 0.2;
    lobby.craftGem.rotation.y = t * 1.4;
  }

  function buildLobby(THREE) {
    const group = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(LOBBY_RADIUS, 96),
      new THREE.MeshStandardMaterial({
        color: 0x5a3824,
        roughness: 0.94,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(LOBBY_RADIUS, 6, 10, 128),
      new THREE.MeshStandardMaterial({ color: 0xf2d6b0, roughness: 0.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 4;
    group.add(rim);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(118, 122, 72),
      new THREE.MeshBasicMaterial({
        color: 0xfff3e0,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.5;
    group.add(innerRing);

    const portal = new THREE.Group();
    portal.position.set(worldX(PORTAL_SPOT.x), 0, worldZ(PORTAL_SPOT.y));
    const portalDisc = new THREE.Mesh(
      new THREE.CircleGeometry(PORTAL_RADIUS, 64),
      new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.55, depthWrite: false })
    );
    portalDisc.rotation.x = -Math.PI / 2;
    portalDisc.position.y = 0.8;
    const portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(PORTAL_RADIUS, 8, 12, 96),
      new THREE.MeshStandardMaterial({
        color: 0xbfe6ff,
        emissive: 0x4aa8ff,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      })
    );
    portalRing.rotation.x = Math.PI / 2;
    portalRing.position.y = 5;
    const portalSwirl = new THREE.Mesh(
      new THREE.RingGeometry(PORTAL_RADIUS * 0.35, PORTAL_RADIUS * 0.62, 48, 1, 0, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    portalSwirl.rotation.x = -Math.PI / 2;
    portalSwirl.position.y = 1.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(PORTAL_RADIUS * 0.92, PORTAL_RADIUS, 150, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7ec8ff,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.position.y = 75;
    const portalLabel = makeLabelSprite(THREE);
    writeLabel(portalLabel, "Start Run");
    portalLabel.scale.multiplyScalar(2);
    portalLabel.position.y = 190;
    portal.add(portalDisc, portalRing, portalSwirl, beam, portalLabel);
    group.add(portal);

    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(SHOP_PAD_RADIUS - 6, SHOP_PAD_RADIUS, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(worldX(SHOP_PAD_SPOT.x), 0.9, worldZ(SHOP_PAD_SPOT.y));
    group.add(padRing);
    const padFill = new THREE.Mesh(
      new THREE.CircleGeometry(SHOP_PAD_RADIUS - 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.12, depthWrite: false })
    );
    padFill.rotation.x = -Math.PI / 2;
    padFill.position.set(worldX(SHOP_PAD_SPOT.x), 0.7, worldZ(SHOP_PAD_SPOT.y));
    group.add(padFill);

    const stall = new THREE.Group();
    stall.position.set(worldX(SHOP_STALL_SPOT.x), 0, worldZ(SHOP_STALL_SPOT.y));
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6234, roughness: 0.8 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(56, 46, 170), wood);
    counter.position.y = 23;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(64, 6, 178),
      new THREE.MeshStandardMaterial({ color: 0xf4e2c4, roughness: 0.7 })
    );
    top.position.y = 49;
    stall.add(counter, top);
    for (const [x, z] of [[-26, -82], [-26, 82], [26, -82], [26, 82]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 130, 10), wood);
      post.position.set(x, 65, z);
      stall.add(post);
    }
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(80, 7, 184 / stripes),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xfff3e0 : 0xff6b9d, roughness: 0.7 })
      );
      stripe.position.set(0, 134, -92 + (184 / stripes) * (i + 0.5));
      stripe.rotation.z = 0.12;
      stall.add(stripe);
    }
    const potionColors = [0x7ed957, 0xffd166, 0x5ad1a0, 0xb07cff];
    potionColors.forEach((color, i) => {
      const bottle = new THREE.Mesh(
        new THREE.SphereGeometry(9, 16, 12),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.25 })
      );
      bottle.position.set(-8, 61, -54 + i * 36);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 9, 10),
        new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.4 })
      );
      neck.position.set(-8, 73, -54 + i * 36);
      stall.add(bottle, neck);
    });
    const shopLabel = makeLabelSprite(THREE);
    writeLabel(shopLabel, "Shop");
    shopLabel.scale.multiplyScalar(2);
    shopLabel.position.y = 180;
    stall.add(shopLabel);
    group.add(stall);

    const craftPadRing = new THREE.Mesh(
      new THREE.RingGeometry(CRAFT_PAD_RADIUS - 6, CRAFT_PAD_RADIUS, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    craftPadRing.rotation.x = -Math.PI / 2;
    craftPadRing.position.set(worldX(CRAFT_PAD_SPOT.x), 0.9, worldZ(CRAFT_PAD_SPOT.y));
    group.add(craftPadRing);
    const craftPadFill = new THREE.Mesh(
      new THREE.CircleGeometry(CRAFT_PAD_RADIUS - 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.14, depthWrite: false })
    );
    craftPadFill.rotation.x = -Math.PI / 2;
    craftPadFill.position.set(worldX(CRAFT_PAD_SPOT.x), 0.7, worldZ(CRAFT_PAD_SPOT.y));
    group.add(craftPadFill);

    const bench = new THREE.Group();
    bench.position.set(worldX(CRAFT_STALL_SPOT.x), 0, worldZ(CRAFT_STALL_SPOT.y));
    const benchWood = new THREE.MeshStandardMaterial({ color: 0x6e4428, roughness: 0.75 });
    const benchCounter = new THREE.Mesh(new THREE.BoxGeometry(56, 46, 170), benchWood);
    benchCounter.position.y = 23;
    const benchTop = new THREE.Mesh(
      new THREE.BoxGeometry(64, 6, 178),
      new THREE.MeshStandardMaterial({ color: 0x2a2140, roughness: 0.45, metalness: 0.2 })
    );
    benchTop.position.y = 49;
    bench.add(benchCounter, benchTop);
    for (const [x, z] of [[-26, -82], [-26, 82], [26, -82], [26, 82]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 130, 10), benchWood);
      post.position.set(x, 65, z);
      bench.add(post);
    }
    for (let i = 0; i < stripes; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(80, 7, 184 / stripes),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffd166 : 0xc084fc, roughness: 0.55 })
      );
      stripe.position.set(0, 134, -92 + (184 / stripes) * (i + 0.5));
      stripe.rotation.z = -0.12;
      bench.add(stripe);
    }
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(16, 18, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xc48a12, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.45 })
    );
    bowl.scale.y = 0.45;
    bowl.position.set(10, 58, -28);
    const craftGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(13, 0),
      new THREE.MeshStandardMaterial({
        color: 0x9ae7ff,
        emissive: 0x7ec8ff,
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.35,
      })
    );
    craftGem.position.set(10, 78, 34);
    bench.add(bowl, craftGem);
    const craftLabel = makeLabelSprite(THREE);
    writeLabel(craftLabel, "Craft");
    craftLabel.scale.multiplyScalar(2);
    craftLabel.position.y = 180;
    bench.add(craftLabel);
    group.add(bench);

    return { group, portalRing, portalSwirl, beam, padRing, craftPadRing, craftGem };
  }

  function updateCamera() {
    if (!view) return;
    if (state.player) {
      net.lastFocus = { x: state.player.x, y: state.player.y };
      const reach = ringReach(state.player);
      const needed = Math.max(RUN_CAMERA_DISTANCE, reach * 2.6);
      if (view.distance < needed) view.distance = Math.min(MAX_CAMERA_DISTANCE, needed);
    }
    const focus = state.player
      ? { x: worldX(state.player.x), z: worldZ(state.player.y) }
      : net.lastFocus
        ? { x: worldX(net.lastFocus.x), z: worldZ(net.lastFocus.y) }
        : { x: 0, z: 0 };
    const horizontal = Math.cos(view.pitch) * view.distance;
    view.camera.position.set(
      focus.x + Math.sin(view.yaw) * horizontal,
      Math.sin(view.pitch) * view.distance,
      focus.z + Math.cos(view.yaw) * horizontal
    );
    view.camera.lookAt(focus.x, 0, focus.z);
  }

  function startLobbyLoop() {
    cancelAnimationFrame(previewId);
    let last = performance.now();
    const tick = (now) => {
      if (state.running) return;
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      lastFrameAt = performance.now();
      steerCamera(dt);
      if (updateLobby(dt)) return;
      draw();
      previewId = requestAnimationFrame(tick);
    };
    previewId = requestAnimationFrame(tick);
  }

  function resizeView() {
    if (!view) return;
    const width = canvas.clientWidth || ARENA;
    const height = canvas.clientHeight || ARENA;
    view.renderer.setSize(width, height, false);
    view.camera.aspect = width / Math.max(1, height);
    view.camera.updateProjectionMatrix();
  }

  async function initView() {
    const THREE = await import("./vendor/three.module.js");
    const { GLTFLoader } = await import("./vendor/GLTFLoader.js?v=2");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x2c1a10);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2c1a10, 900 * MAP_SCALE, 1900 * MAP_SCALE);
    const camera = new THREE.PerspectiveCamera(40, 1, 10, 4000 * MAP_SCALE);
    camera.position.set(0, 820, 700);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xfff3df, 0x3a2216, 1.15));
    const sun = new THREE.DirectionalLight(0xfff6ea, 1.45);
    sun.position.set(-260, 700, 220);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffe8cc, 0.35));

    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA, ARENA),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.96, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.material.polygonOffset = true;
    floor.material.polygonOffsetFactor = 2;
    floor.material.polygonOffsetUnits = 2;
    arenaGroup.add(floor);

    const borderMat = new THREE.MeshBasicMaterial({ color: 0xfff3e0, transparent: true, opacity: 0.28 });
    const half = ARENA / 2;
    const edge = 8;
    for (const [width, depth, x, z] of [
      [ARENA, edge, 0, -half],
      [ARENA, edge, 0, half],
      [edge, ARENA, -half, 0],
      [edge, ARENA, half, 0],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 6, depth), borderMat);
      bar.position.set(x, 3, z);
      arenaGroup.add(bar);
    }

    for (const t of [0.2, 0.38, 0.62]) {
      const radius = t * ARENA * 0.5;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 1.4, radius + 1.4, 72),
        new THREE.MeshBasicMaterial({
          color: 0xfff3e0,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.5;
      arenaGroup.add(ring);
    }

    const lobby = buildLobby(THREE);
    scene.add(lobby.group);

    const sprinkles = {};
    for (const type of SPRINKLE_TYPES) {
      const mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(type.radius, 18, 14),
        new THREE.MeshStandardMaterial({
          color: type.color,
          emissive: type.color,
          emissiveIntensity: 0.45,
          roughness: 0.28,
          metalness: 0.08,
        }),
        MAX_SPRINKLES
      );
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Instance positions move every frame. The mesh bounds stay at the origin,
      // so turning the camera would cull every sprinkle of that size at once.
      mesh.frustumCulled = false;
      scene.add(mesh);
      sprinkles[type.key] = mesh;
    }

    const loader = new GLTFLoader();
    const templates = new Map();
    const files = [...new Set(Object.values(FOOD_MODELS))];
    await Promise.all(
      files.map(async (file) => {
        try {
          const gltf = await loader.loadAsync(`models/${file}`);
          templates.set(file, normalizeModel(THREE, gltf.scene));
        } catch (err) {
          console.warn("Food model failed to load:", file, err);
        }
      })
    );

    view = {
      THREE,
      renderer,
      scene,
      camera,
      sprinkles,
      templates,
      arenaGroup,
      lobby,
      foods: new Map(),
      yaw: 0.55,
      pitch: 0.86,
      distance: state.running ? RUN_CAMERA_DISTANCE : LOBBY_CAMERA_DISTANCE,
      dummy: new THREE.Object3D(),
      particleGeo: new THREE.SphereGeometry(3.2, 10, 8),
      particleMeshes: [],
    };
    resizeView();
    window.addEventListener("resize", resizeView);
    startLobbyLoop();
  }

  function formatOdds(odds) {
    return Number(odds).toLocaleString();
  }

  function tierStatsLabel(tier) {
    const rarity = rarityById[tier.rarity];
    const oddsText = ` · 1 in ${formatOdds(tier.odds)}`;
    return `${tier.emoji} ${tier.name} · ${rarity.label}${variantLabel(tier)}${oddsText} · pts ${tier.multiplier}x · grw ${tier.growth}x · spd ${displaySpeed(tier).toFixed(2)}`;
  }

  function spendCraft(fromName, toName) {
    const have = ownedCount(fromName);
    if (have < CRAFT_COST) return false;
    save.inventory[fromName] = have - CRAFT_COST;
    if (save.inventory[fromName] <= 0) delete save.inventory[fromName];
    save.inventory[toName] = (save.inventory[toName] || 0) + 1;
    rememberFood(toName);
    if (!save.inventory[save.equipped]) save.equipped = toName;
    return true;
  }

  function craftGolden(baseTier, { persist = true } = {}) {
    if (
      state.running ||
      !baseTier ||
      baseTier.isGolden ||
      baseTier.isShiny ||
      baseTier.isShadow
    ) {
      return false;
    }
    const golden = goldenByBase[baseTier.name];
    if (!golden || !spendCraft(baseTier.name, golden.name)) return false;
    if (persist) persistSave();
    return true;
  }

  function craftShiny(goldenTier, { persist = true } = {}) {
    if (state.running || !goldenTier?.isGolden) return false;
    const shiny = shinyByBase[goldenTier.baseName];
    if (!shiny || !spendCraft(goldenTier.name, shiny.name)) return false;
    if (persist) persistSave();
    return true;
  }

  function craftShadow(shinyTier, { persist = true } = {}) {
    if (state.running || !shinyTier?.isShiny) return false;
    const shadow = shadowByBase[shinyTier.baseName];
    if (!shadow || !spendCraft(shinyTier.name, shadow.name)) return false;
    if (persist) persistSave();
    return true;
  }

  function craftableCounts() {
    let goldens = 0;
    const goldenAfter = {};
    for (const tier of FOOD_TIERS) {
      const made = Math.floor(ownedCount(tier.name) / CRAFT_COST);
      goldens += made;
      const golden = goldenByBase[tier.name];
      goldenAfter[golden.name] = ownedCount(golden.name) + made;
    }
    let shinies = 0;
    const shinyAfter = {};
    for (const golden of GOLDEN_FOODS) {
      const made = Math.floor((goldenAfter[golden.name] || 0) / CRAFT_COST);
      shinies += made;
      const shiny = shinyByBase[golden.baseName];
      shinyAfter[shiny.name] = ownedCount(shiny.name) + made;
    }
    let shadows = 0;
    for (const shiny of SHINY_FOODS) {
      shadows += Math.floor((shinyAfter[shiny.name] || 0) / CRAFT_COST);
    }
    return { goldens, shinies, shadows };
  }

  function craftAll() {
    if (state.running) return { goldens: 0, shinies: 0, shadows: 0 };
    let goldens = 0;
    let shinies = 0;
    let shadows = 0;
    for (const tier of FOOD_TIERS) {
      while (craftGolden(tier, { persist: false })) goldens += 1;
    }
    for (const golden of GOLDEN_FOODS) {
      while (craftShiny(golden, { persist: false })) shinies += 1;
    }
    for (const shiny of SHINY_FOODS) {
      while (craftShadow(shiny, { persist: false })) shadows += 1;
    }
    if (goldens || shinies || shadows) persistSave();
    return { goldens, shinies, shadows };
  }

  function renderEquippedUi() {
    const tier = equippedTier();
    const pill = tierStatsLabel(tier);
    const rarityClass = variantClass(tier);
    const luck = luckSnapshot();
    const potionLuck = boostStacks("luck") * LUCK_STEP;
    const shownPct = displayedLuckPct();
    equippedLineEl.innerHTML = `
      <div>Equipped: <span class="${rarityClass}">${pill}</span></div>
      <div class="type-count-line">Amount of food types: ${luck.typeCount} · Luck +${shownPct}% · ${luck.into}/${LUCK_EVERY} to next +50%</div>
    `;
    luckEl.textContent = `+${shownPct}%`;
    luckLabelEl.textContent = `Luck · ${luck.into}/${LUCK_EVERY}`;
    const luckTitle = `+100% base, and +50% every 10 types (${luck.into}/${LUCK_EVERY} toward the next).`;
    luckEl.title = potionLuck
      ? `${luckTitle} Plus +${Math.round(potionLuck * 100)}% from a luck potion.`
      : `${luckTitle} Luck makes rarer foods more likely.`;
  }

  function appendInventoryItem(tier, tileGrid) {
    const rarity = rarityById[tier.rarity];
    const count = ownedCount(tier.name);
    const detailParts = [
      `1/${formatOdds(tier.odds)}`,
      `pts ${tier.multiplier}x`,
      `grw ${tier.growth}x`,
      `spd ${displaySpeed(tier).toFixed(2)}`,
    ];

    const tile = document.createElement("div");
    tile.className =
      "inv-item " +
      variantClass(tier) +
      (save.equipped === tier.name ? " equipped" : "");
    tile.title = `${tier.name} · ${rarity.label}${variantLabel(tier)} · 1 in ${formatOdds(tier.odds)} · pts ${tier.multiplier}x · grw ${tier.growth}x · spd ${displaySpeed(tier).toFixed(2)}`;

    tile.innerHTML = `
      <span class="count">×${count}</span>
      <span class="emoji">${tier.emoji}</span>
      <span class="name">${tier.name}</span>
      <span class="detail">${detailParts.join(" · ")}</span>
      <span class="inv-actions"></span>
    `;

    const actions = tile.querySelector(".inv-actions");
    const equipBtn = document.createElement("button");
    equipBtn.type = "button";
    equipBtn.className = "btn ghost small";
    equipBtn.textContent = save.equipped === tier.name ? "On" : "Equip";
    equipBtn.disabled = state.running || save.equipped === tier.name;
    equipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.running) return;
      save.equipped = tier.name;
      persistSave();
      renderEquippedUi();
      renderInventory();
    });
    actions.appendChild(equipBtn);

    tileGrid.appendChild(tile);
  }

  function appendRaritySection(label, rarityClass, foods) {
    if (!foods.length) return;
    const section = document.createElement("section");
    section.className = "inv-section";

    const header = document.createElement("div");
    header.className = `inv-rarity-header ${rarityClass}`;
    header.textContent = label;
    section.appendChild(header);

    const tiles = document.createElement("div");
    tiles.className = "inv-tiles";
    for (const tier of foods) appendInventoryItem(tier, tiles);
    section.appendChild(tiles);
    inventoryGridEl.appendChild(section);
  }

  function renderCraftAllBar() {
    craftAllSlotEl.innerHTML = "";
    const counts = craftableCounts();
    const craftAllBtn = document.createElement("button");
    craftAllBtn.type = "button";
    craftAllBtn.className = "btn craft";
    const parts = [];
    if (counts.goldens) parts.push(`${counts.goldens} Golden`);
    if (counts.shinies) parts.push(`${counts.shinies} Rainbow`);
    if (counts.shadows) parts.push(`${counts.shadows} Shadow`);
    craftAllBtn.textContent = parts.length
      ? `Craft All (${parts.join(", ")})`
      : `Craft All (need ${CRAFT_COST})`;
    craftAllBtn.disabled = state.running || parts.length === 0;
    craftAllBtn.title = `50 of a food → 1 Golden. 50 Goldens → 1 Rainbow. 50 Rainbows → 1 Shadow.`;
    craftAllBtn.addEventListener("click", () => {
      const scrollTop = craftListEl.scrollTop;
      const beforeTypes = ownedTypeCount();
      const made = craftAll();
      if (!made.goldens && !made.shinies && !made.shadows) return;
      showLuckNotice(beforeTypes);
      renderEquippedUi();
      renderCraft();
      craftListEl.scrollTop = scrollTop;
    });
    craftAllSlotEl.appendChild(craftAllBtn);
  }

  function ownedFoods() {
    return ALL_FOODS.filter((t) => ownedCount(t.name) > 0);
  }

  function pickBestOwned(score) {
    let best = null;
    let bestScore = -Infinity;
    for (const tier of ownedFoods()) {
      const value = score(tier);
      if (
        value > bestScore ||
        (value === bestScore &&
          best &&
          rarityById[tier.rarity].rank > rarityById[best.rarity].rank)
      ) {
        best = tier;
        bestScore = value;
      }
    }
    return best;
  }

  function equipFood(tier) {
    if (state.running || !tier || ownedCount(tier.name) <= 0) return;
    save.equipped = tier.name;
    persistSave();
    renderEquippedUi();
    renderInventory();
  }

  function appendBestEquipBar() {
    const bar = document.createElement("div");
    bar.className = "best-equip-bar";

    const options = [
      {
        label: "Equip Best Points",
        pick: () => pickBestOwned((t) => t.multiplier),
      },
      {
        label: "Equip Best Growth",
        pick: () => pickBestOwned((t) => t.growth),
      },
      {
        label: "Equip Best Speed",
        pick: () => pickBestOwned((t) => t.speed),
      },
      {
        label: "Equip Best Overall",
        pick: () => pickBestOwned((t) => t.multiplier * t.growth * t.speed),
      },
    ];

    for (const option of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost";
      btn.textContent = option.label;
      btn.disabled = state.running || ownedFoods().length === 0;
      btn.addEventListener("click", () => {
        const scrollTop = inventoryScrollEl.scrollTop;
        equipFood(option.pick());
        inventoryScrollEl.scrollTop = scrollTop;
      });
      bar.appendChild(btn);
    }

    inventoryGridEl.appendChild(bar);
  }

  function renderInventory() {
    const scrollTop = inventoryScrollEl ? inventoryScrollEl.scrollTop : 0;
    inventoryGridEl.innerHTML = "";

    const owned = ownedFoods();
    if (owned.length === 0) {
      inventoryGridEl.innerHTML = `<div class="inv-empty">No foods yet. Finish a run to bank some!</div>`;
      return;
    }

    appendBestEquipBar();

    for (let i = RARITIES.length - 1; i >= 0; i--) {
      const rarity = RARITIES[i];
      const group = [];
      const bases = FOOD_TIERS.filter((t) => t.rarity === rarity.id).sort(
        (a, b) => b.odds - a.odds
      );
      for (const base of bases) {
        const shadow = shadowByBase[base.name];
        if (shadow && ownedCount(shadow.name) > 0) group.push(shadow);
        const shiny = shinyByBase[base.name];
        if (shiny && ownedCount(shiny.name) > 0) group.push(shiny);
        const golden = goldenByBase[base.name];
        if (golden && ownedCount(golden.name) > 0) group.push(golden);
        if (ownedCount(base.name) > 0) group.push(base);
      }
      appendRaritySection(rarity.label, `rarity-${rarity.id}`, group);
    }

    inventoryScrollEl.scrollTop = scrollTop;
  }

  function renderCraft() {
    const scrollTop = craftListEl.scrollTop;
    renderCraftAllBar();
    craftListEl.innerHTML = "";
    const rows = [];
    for (let i = RARITIES.length - 1; i >= 0; i--) {
      const rarity = RARITIES[i];
      const bases = FOOD_TIERS.filter((t) => t.rarity === rarity.id).sort((a, b) => b.odds - a.odds);
      for (const base of bases) {
        const shiny = shinyByBase[base.name];
        if (shiny && ownedCount(shiny.name) > 0) rows.push(shiny);
        const golden = goldenByBase[base.name];
        if (golden && ownedCount(golden.name) > 0) rows.push(golden);
        if (ownedCount(base.name) > 0) rows.push(base);
      }
    }
    if (!rows.length) {
      craftListEl.innerHTML = `<div class="inv-empty">No foods to combine yet. Bank foods from a run, then bring 50 of one here.</div>`;
      return;
    }
    for (const tier of rows) {
      const craftTarget = tier.isShiny
        ? shadowByBase[tier.baseName]
        : tier.isGolden
          ? shinyByBase[tier.baseName]
          : goldenByBase[tier.name];
      if (!craftTarget) continue;
      const count = ownedCount(tier.name);
      const canCraft = count >= CRAFT_COST;
      const row = document.createElement("div");
      row.className = "shop-row";
      row.innerHTML = `
        <h3 class="${variantClass(tier)}">${tier.emoji} ${tier.name}</h3>
        <div class="shop-actions"></div>
        <p>×${count} · ${count}/${CRAFT_COST} → ${craftTarget.emoji} ${craftTarget.name}</p>
      `;
      const actions = row.querySelector(".shop-actions");
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "btn craft small" +
        (tier.isShiny ? " shadow" : tier.isGolden ? " shiny" : "");
      button.textContent = canCraft ? "Craft" : `${count}/${CRAFT_COST}`;
      button.disabled = state.running || !canCraft;
      button.title = `Combine ${CRAFT_COST} ${tier.name} into 1 ${craftTarget.name}`;
      button.addEventListener("click", () => {
        const beforeTypes = ownedTypeCount();
        const ok = tier.isShiny
          ? craftShadow(tier)
          : tier.isGolden
            ? craftShiny(tier)
            : craftGolden(tier);
        if (!ok) return;
        showLuckNotice(beforeTypes);
        renderEquippedUi();
        renderCraft();
      });
      actions.appendChild(button);
      craftListEl.appendChild(row);
    }
    craftListEl.scrollTop = scrollTop;
  }

  function renderShop() {
    shopDiamondsEl.textContent = `${save.diamonds.toLocaleString()} diamonds`;
    shopListEl.innerHTML = "";
    for (const potion of POTIONS) {
      const owned = save.potions[potion.id] || 0;
      const row = document.createElement("div");
      row.className = "shop-row";
      row.innerHTML = `
        <h3>${potion.emoji} ${potion.name}</h3>
        <div class="shop-actions"></div>
        <p>${potion.detail}. Owned ${owned}. <span class="potion-timer" data-potion="${potion.id}">${potionTimerText(potion.id)}</span></p>
      `;
      const actions = row.querySelector(".shop-actions");
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "btn ghost small";
      buyBtn.textContent = `Buy ${POTION_COST}`;
      buyBtn.disabled = state.running || save.diamonds < POTION_COST;
      buyBtn.addEventListener("click", () => buyPotion(potion.id));
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "btn primary small";
      useBtn.textContent = "Use";
      useBtn.disabled = state.running || owned <= 0;
      useBtn.addEventListener("click", () => usePotion(potion.id));
      actions.appendChild(buyBtn);
      actions.appendChild(useBtn);
      shopListEl.appendChild(row);
    }
  }

  function potionTimerText(id) {
    const effect = potionEffect(id);
    if (effect.endsAt <= Date.now()) return "Not active.";
    const power =
      id === "luck"
        ? ` · strength ×${boostStacks(id)}/${LUCK_POTION_MAX_STACKS}`
        : "";
    return `Active${power} · ${formatRemaining(effect.endsAt - Date.now())} left.`;
  }

  function renderPotionStatus() {
    const parts = [];
    for (const potion of POTIONS) {
      const effect = potionEffect(potion.id);
      if (effect.endsAt <= Date.now()) continue;
      const power =
        potion.id === "luck" ? ` ×${boostStacks(potion.id)}` : "";
      parts.push(
        `${potion.emoji} ${potion.name}${power} · ${formatRemaining(effect.endsAt - Date.now())}`
      );
    }
    potionStatusEl.textContent = parts.join("   ");
    potionStatusEl.classList.toggle("hidden", parts.length === 0);
    if (!shopModal.classList.contains("hidden")) {
      for (const timer of shopListEl.querySelectorAll(".potion-timer")) {
        timer.textContent = potionTimerText(timer.dataset.potion);
      }
    }
  }

  function buyPotion(id) {
    if (state.running || save.diamonds < POTION_COST) return;
    save.diamonds -= POTION_COST;
    save.potions[id] = (save.potions[id] || 0) + 1;
    persistSave();
    renderDiamonds();
    renderShop();
  }

  function usePotion(id) {
    if (state.running || (save.potions[id] || 0) <= 0) return;
    save.potions[id] -= 1;
    if (!save.activePotions[id] || Array.isArray(save.activePotions[id])) {
      save.activePotions[id] = emptyPotionEffect();
    }
    applyPotionDrink(save.activePotions[id], id);
    persistSave();
    renderShop();
    renderPotionStatus();
    renderEquippedUi();
  }

  function openShop() {
    if (state.running) return;
    closeInventory();
    closeCraft();
    renderShop();
    shopModal.classList.remove("hidden");
    shopModal.setAttribute("aria-hidden", "false");
  }

  function closeShop() {
    shopModal.classList.add("hidden");
    shopModal.setAttribute("aria-hidden", "true");
  }

  function openCraft() {
    if (state.running) return;
    closeInventory();
    closeShop();
    renderCraft();
    craftModal.classList.remove("hidden");
    craftModal.setAttribute("aria-hidden", "false");
  }

  function closeCraft() {
    craftModal.classList.add("hidden");
    craftModal.setAttribute("aria-hidden", "true");
    luckNoticeEl.textContent = "";
    luckNoticeEl.classList.add("hidden");
  }

  function openInventory() {
    closeShop();
    closeCraft();
    renderInventory();
    renderEquippedUi();
    inventoryModal.classList.remove("hidden");
    inventoryModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    inventoryScrollEl.scrollTop = 0;
  }

  function closeInventory() {
    inventoryModal.classList.add("hidden");
    inventoryModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function updateHud() {
    pointsEl.textContent = Math.floor(state.points).toLocaleString();
    const effective = state.points * foodGainFactor();
    const into = effective % POINTS_PER_FOOD;
    const remaining = Math.max(0, Math.ceil(POINTS_PER_FOOD - into));
    nextFoodEl.textContent = `${Math.floor(into)} / ${POINTS_PER_FOOD}`;
    foodCountEl.textContent = String(state.foodsEarned);
    foodFillEl.style.width = `${(into / POINTS_PER_FOOD) * 100}%`;
    foodNextEl.textContent = `${remaining.toLocaleString()} pts`;
    renderEquippedUi();
  }

  let lastTime = 0;
  function loop(now) {
    if (!state.running) return;
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    lastFrameAt = performance.now();

    steerCamera(dt);
    if (!runStep(dt, now)) return;
    draw();
    state.animId = requestAnimationFrame(loop);
  }

  // Returns false when the run ended during this step.
  function runStep(dt, now) {
    if (net.role === "guest") {
      if (state.player && net.place >= 0) {
        applyRunSteer(state.player, dt, null);
        guestEatSprinkles();
      }
      smoothRemotes(dt);
      updateParticles(dt);
      netPump(dt);
      return true;
    }
    stepWorld(dt, now);
    if (net.role === "host") {
      stepLobbyGuests(dt);
      netPump(dt);
    }
    if (!state.player) {
      endRun(true);
      return false;
    }
    return true;
  }

  function stepWorld(dt, now) {
    const power = foodPower(cpuTier());
    for (const rival of state.rivals) {
      rival.skill = power;
      rival.speedBoost = 1 + power * 0.025;
    }

    updateFoods(dt);
    resolveEats();
    updateParticles(dt);

    if (sprinkleCount("xs") < MAX_XS_SPRINKLES && Math.random() < 0.14) {
      spawnSprinkle(sprinkleType("xs"));
    }
    if (sprinkleCount("small") < MAX_SMALL_SPRINKLES && Math.random() < 0.14) {
      spawnSprinkle(sprinkleType("small"));
    }
  }

  // Background tabs stop animation frames, so a worker timer keeps a room
  // host simulating and sending snapshots while its tab is hidden.
  let lastBeatAt = 0;
  let heartbeat = null;

  function onHeartbeat() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastBeatAt) / 1000 || 0.033);
    lastBeatAt = now;
    if (!net.role || now - lastFrameAt < 150) return;
    if (state.running) runStep(dt, now);
    else updateLobby(dt);
  }

  function startHeartbeat() {
    if (heartbeat) return;
    lastBeatAt = performance.now();
    try {
      const src = "setInterval(() => postMessage(0), 33);";
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = onHeartbeat;
      heartbeat = { stop: () => worker.terminate() };
    } catch (err) {
      const id = setInterval(onHeartbeat, 33);
      heartbeat = { stop: () => clearInterval(id) };
    }
  }

  function stopHeartbeat() {
    if (heartbeat) heartbeat.stop();
    heartbeat = null;
  }

  function startRun() {
    if (!save.inventory[save.equipped]) {
      openInventory();
      return;
    }

    closeInventory();
    closeShop();
    closeCraft();
    pullResultsEl.classList.add("hidden");
    pullResultsEl.innerHTML = "";
    state.running = true;
    state.mode = "run";
    state.onShopPad = false;
    state.onCraftPad = false;
    lobbyHintEl.classList.add("hidden");
    state.points = 0;
    state.foodsEarned = 0;
    state.player = null;
    ensureWorld();
    const spot = farArenaSpot([...arenaHumans(), ...state.rivals], ARENA * 0.22);
    state.player = createFood(equippedTier(), spot.x, spot.y, false);
    clampToArena(state.player);
    if (net.role) state.player.netName = net.name;
    spawnBetterRival(state.player);
    if (view) view.distance = RUN_CAMERA_DISTANCE;
    updateHud();
    overlay.classList.add("hidden");
    endBtn.disabled = false;
    inventoryBtn.disabled = true;
    shopBtn.disabled = true;
    craftBtn.disabled = true;
    closeMulti();
    lastTime = performance.now();
    cancelAnimationFrame(state.animId);
    if (net.role === "host") broadcastSnap(true);
    state.animId = requestAnimationFrame(loop);
  }

  function renderPullResults(banked, seenBefore = new Set()) {
    pullResultsEl.innerHTML = "";
    if (!banked.length) {
      pullResultsEl.classList.add("hidden");
      return;
    }

    const counts = new Map();
    for (const name of banked) counts.set(name, (counts.get(name) || 0) + 1);

    // Rarest first (by rarity rank, then by pull odds).
    const rows = [...counts.entries()]
      .map(([name, n]) => ({ tier: tierByName[name], count: n }))
      .filter((row) => row.tier)
      .sort((a, b) => {
        const rankDiff =
          rarityById[b.tier.rarity].rank - rarityById[a.tier.rarity].rank;
        if (rankDiff !== 0) return rankDiff;
        return b.tier.odds - a.tier.odds;
      });

    for (const { tier, count } of rows) {
      const rarity = rarityById[tier.rarity];
      const isNew = !seenBefore.has(tier.name);
      const row = document.createElement("div");
      row.className = "pull-row" + (isNew ? " is-new" : "");
      row.innerHTML = `
        <span class="pull-name">
          <span>${tier.emoji} ${tier.name}${count > 1 ? ` ×${count}` : ""}</span>
          <span class="pull-rarity rarity-${tier.rarity}">${rarity.label}</span>
          ${isNew ? `<span class="pull-new">New</span>` : ""}
        </span>
        <span class="pull-odds">1 in ${formatOdds(tier.odds)}</span>
      `;
      pullResultsEl.appendChild(row);
    }

    pullResultsEl.classList.remove("hidden");
  }

  function endRun(wipedOut = false) {
    if (!state.running) return;
    state.running = false;
    if (net.role === "guest") net.place = -1;
    cancelAnimationFrame(state.animId);
    endBtn.disabled = true;
    inventoryBtn.disabled = false;
    shopBtn.disabled = false;
    craftBtn.disabled = false;

    const earned = state.foodsEarned;
    const seenBefore = new Set(Object.keys(save.discovered || {}));
    const banked = bankPendingFoods();
    for (const name of banked) rememberFood(name);
    renderPullResults(banked, seenBefore);

    save.diamonds += earned;
    if (earned > save.bestRun) {
      save.bestRun = earned;
      bestRunEl.textContent = `${save.bestRun} foods`;
    }
    persistSave();
    renderDiamonds();

    overlayTitle.textContent = wipedOut ? "Wiped Out!" : "Run Ended";
    const diamondText = `${earned.toLocaleString()} diamond${earned === 1 ? "" : "s"}`;
    const bankText = earned
      ? `Banked ${earned} food${earned === 1 ? "" : "s"} and ${diamondText} (rarest first):`
      : `No new foods this run. ${diamondText}.`;
    overlayMsg.textContent = wipedOut
      ? `A rival ate you. ${bankText} (${Math.floor(state.points).toLocaleString()} pts)`
      : `Nice run! ${bankText} (${Math.floor(state.points).toLocaleString()} pts)`;
    startBtn.textContent = "Back to Lobby";
    afterRunActionsEl.classList.remove("hidden");
    overlay.classList.remove("hidden");
    enterLobby();
    renderEquippedUi();
    if (net.role === "host") broadcastSnap(true);
    draw();
    startLobbyLoop();
  }

  function closeOverlay() {
    overlay.classList.add("hidden");
  }

  let draggingCamera = false;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    draggingCamera = true;
    canvas.classList.add("dragging");
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    draggingCamera = false;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!draggingCamera || !view) return;
    view.yaw -= e.movementX * 0.005;
    view.pitch = Math.min(1.28, Math.max(0.22, view.pitch + e.movementY * 0.004));
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!view) return;
      e.preventDefault();
      const zoom = Math.exp(e.deltaY * 0.0011);
      view.distance = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, view.distance * zoom));
    },
    { passive: false }
  );

  renderPotionStatus();
  setInterval(renderPotionStatus, 1000);

  function netReady() {
    if (net.role === "host") return !!net.peer;
    if (net.role === "guest") return !!(net.hostConn && net.hostConn.open);
    return false;
  }

  function netSend(obj) {
    if (net.role === "host") {
      for (const guest of net.guests.values()) {
        if (guest.conn.open) guest.conn.send(obj);
      }
    } else if (net.role === "guest" && net.hostConn && net.hostConn.open) {
      net.hostConn.send(obj);
    }
  }

  function broadcastSnap(forceSpr) {
    if (net.role !== "host") return;
    const players = [];
    if (state.player) players.push(packActor(state.player, net.id, net.name, localZone(), 0));
    for (const food of net.humans.values()) {
      players.push(packActor(food, food.netId, food.netName, food.zone, food.run));
    }
    const msg = {
      t: "snap",
      players,
      rivals: state.rivals.map((food) => ({
        id: food.id,
        food: food.tier.name,
        x: Math.round(food.x),
        y: Math.round(food.y),
        size: Math.round(food.size),
      })),
    };
    // One update goes to the whole room. Sprinkles ride along twice a second while
    // anyone is in the arena, and rarely otherwise so a new host still has them.
    if (!net.guests.size || !net.peer || !net.peer.publish) return;
    const now = performance.now();
    let every = 2000;
    let needSpr = forceSpr;
    for (const [id, guest] of net.guests) {
      if (guest.needSpr) needSpr = true;
      const human = net.humans.get(id);
      if (human && human.zone === "arena") every = 500;
    }
    if (needSpr || now - net.sprAt >= every) {
      net.sprAt = now;
      for (const guest of net.guests.values()) guest.needSpr = false;
      msg.spr = packSprinkles(state.sprinkles);
    }
    net.peer.publish({ from: "host", to: "*", msg });
  }

  // Sprinkles travel as binary (x | type << 12, then y) so thousands of them
  // stay one small message instead of a giant list of numbers.
  function packSprinkles(sprinkles) {
    const words = new Uint16Array(sprinkles.length * 2);
    sprinkles.forEach((sprinkle, i) => {
      const type = Math.max(0, SPRINKLE_TYPES.indexOf(sprinkle.type));
      words[i * 2] = (Math.round(sprinkle.x) & 0xfff) | (type << 12);
      words[i * 2 + 1] = Math.round(sprinkle.y);
    });
    return words.buffer;
  }

  function unpackSprinkles(data) {
    const bytes = data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const words = new Uint16Array(bytes.slice().buffer, 0, Math.floor(bytes.byteLength / 2));
    const sprinkles = [];
    for (let i = 0; i + 1 < words.length; i += 2) {
      const type = SPRINKLE_TYPES[words[i] >> 12] || SPRINKLE_TYPES[0];
      sprinkles.push({ x: words[i] & 0xfff, y: words[i + 1], type, wobble: (i * 0.17) % 6.2 });
    }
    return sprinkles;
  }

  function packActor(food, id, name, zone, run) {
    return {
      id,
      name: name || "Player",
      zone: zone === "arena" ? "arena" : "lobby",
      run: run || 0,
      p: food.place || 0,
      food: food.tier.name,
      x: Math.round(food.x * 10) / 10,
      y: Math.round(food.y * 10) / 10,
      size: Math.round(food.size),
    };
  }

  // Guests only: other players and CPUs glide between host updates.
  function smoothRemotes(dt) {
    for (const food of net.humans.values()) followTarget(food, dt);
    for (const rival of state.rivals) followTarget(rival, dt);
  }

  // Guests only: sprinkles you touch vanish right away. The host still decides
  // growth and points, so this only hides them until its next update agrees.
  function guestEatSprinkles() {
    const food = state.player;
    const reach = ringReach(food);
    const now = performance.now();
    for (let i = state.sprinkles.length - 1; i >= 0; i--) {
      const s = state.sprinkles[i];
      if (dist(food, s) >= reach + s.type.radius) continue;
      burst(s.x, s.y, s.type.color);
      state.sprinkles.splice(i, 1);
      net.ateSpr.push({ key: `${Math.round(s.x)},${Math.round(s.y)}`, at: now });
    }
  }

  function netPump(dt) {
    if (!netReady()) return;
    if (net.role === "guest") {
      net.inAcc += dt;
      if (net.inAcc < 0.05) return;
      net.inAcc = 0;
      const food = state.player;
      netSend({
        t: "in",
        p: food ? net.place : -1,
        zone: localZone(),
        x: food ? Math.round(food.x * 10) / 10 : 0,
        y: food ? Math.round(food.y * 10) / 10 : 0,
        keys: [...moveKeys],
        autoFarm: state.autoFarm,
        yaw: view ? view.yaw : 0,
        food: equippedTier().name,
        foods: state.running ? state.foodsEarned : 0,
        growth: Math.pow(1.25, boostStacks("growth")),
        speed: Math.pow(1.25, boostStacks("speed")),
      });
      return;
    }
    net.snapAcc += dt;
    if (net.snapAcc >= 0.05) {
      net.snapAcc = 0;
      broadcastSnap(false);
    }
  }

  function ensureNetHuman(person) {
    let food = net.humans.get(person.id);
    const tier = (person.food && tierByName[person.food]) || tierByName.Peanut || FOOD_TIERS[0];
    if (!food) {
      const spot = lobbySpot(net.humans.size + 1);
      food = createFood(tier, spot.x, spot.y, false);
      food.netId = person.id;
      food.netName = String(person.name || "Player").slice(0, 12);
      food.growthBoost = 1;
      food.speedBoost = 1;
      food.zone = "lobby";
      food.run = 0;
      food.foods = 0;
      markPlaced(food);
      net.humans.set(person.id, food);
    } else {
      food.netName = String(person.name || food.netName || "Player").slice(0, 12);
    }
    return food;
  }

  function applyRoster(players, cpus) {
    net.roster = players || [];
    if (net.role === "guest" && typeof cpus === "boolean") net.cpus = cpus;
    if (net.role === "host" && net.roster.length <= 1) net.cpus = true;
    renderRoster();
    if (net.role !== "host") return;
    syncCpus();
    const ids = new Set();
    for (const person of net.roster) {
      if (person.id === net.id) continue;
      ids.add(person.id);
      ensureNetHuman(person);
    }
    for (const id of [...net.humans.keys()]) {
      if (!ids.has(id)) {
        net.humans.delete(id);
        net.inputs.delete(id);
      }
    }
    clearRivalsIfArenaEmpty();
  }

  function onGuestInput(msg) {
    const food = net.humans.get(msg.id);
    if (!food) return;
    net.inputs.set(msg.id, msg);
    const x = Number(msg.x);
    const y = Number(msg.y);
    if (msg.p === food.place && msg.zone === food.zone && Number.isFinite(x) && Number.isFinite(y)) {
      food.tx = x;
      food.ty = y;
    }
    food.growthBoost = Number(msg.growth) > 0 ? Number(msg.growth) : 1;
    food.speedBoost = Number(msg.speed) > 0 ? Number(msg.speed) : 1;
    food.foods = Math.max(0, Number(msg.foods) || 0);
    food.wantFood = msg.food;
    if (food.zone === "lobby" && msg.food && tierByName[msg.food]) food.tier = tierByName[msg.food];
  }

  function renderRoster() {
    multiPlayersEl.innerHTML = "";
    for (const person of net.roster) {
      const item = document.createElement("li");
      const food = person.food ? ` · ${person.food}` : "";
      item.textContent = `${person.name}${person.host ? " (host)" : ""}${food}`;
      multiPlayersEl.appendChild(item);
    }
    renderCpuToggle();
  }

  function renderCpuToggle() {
    const on = cpusActive();
    const alone = net.roster.length <= 1;
    multiCpusBtn.textContent = `CPUs: ${on ? "On" : "Off"}`;
    multiCpusBtn.setAttribute("aria-pressed", on ? "true" : "false");
    multiCpusBtn.disabled = net.role !== "host" || alone;
    if (alone) multiCpuNoteEl.textContent = "CPUs stay on until someone else joins.";
    else if (net.role === "host") multiCpuNoteEl.textContent = "Only the host can change this.";
    else multiCpuNoteEl.textContent = "The host chooses whether CPUs play.";
  }

  // Host only: drop CPUs when they are switched off. If they come back on
  // and the arena has none, one starting CPU returns.
  function syncCpus() {
    if (net.role !== "host" || !net.worldReady) return;
    if (!cpusActive()) {
      state.rivals = [];
      return;
    }
    if (state.rivals.length === 0) {
      const foods = arenaHumans();
      if (foods.length) spawnBetterRival(foods[0]);
      state.lastSpawnAt = performance.now();
    }
  }

  function setRoomCpus(on) {
    if (net.role !== "host" || net.roster.length <= 1) return;
    net.cpus = on;
    shareRoster();
  }

  function setNetStatus(text) {
    multiStatusEl.textContent = text;
  }

  function showRoom(code) {
    multiSetupEl.classList.add("hidden");
    multiRoomEl.classList.remove("hidden");
    multiRoomCodeEl.textContent = code;
    multiLiveEl.textContent = code;
    multiLiveEl.classList.remove("hidden");
  }

  function showSetup() {
    multiRoomEl.classList.add("hidden");
    multiSetupEl.classList.remove("hidden");
    multiRoomCodeEl.textContent = "";
    multiLiveEl.textContent = "";
    multiLiveEl.classList.add("hidden");
  }

  function openMulti() {
    multiModal.classList.remove("hidden");
    multiModal.setAttribute("aria-hidden", "false");
    if (!net.role) reloadIfOutdated();
  }

  function closeMulti() {
    multiModal.classList.add("hidden");
    multiModal.setAttribute("aria-hidden", "true");
  }

  function playerNetName() {
    const name = (multiNameEl.value || "Player").trim().slice(0, 12);
    return name || "Player";
  }

  // Closes the connection but keeps the room's game state, for reconnecting.
  function dropLink() {
    const peer = net.peer;
    net.peer = null;
    net.hostConn = null;
    net.guests.clear();
    clearTimeout(net.joinTimer);
    clearTimeout(net.retryTimer);
    if (peer) {
      try { peer.destroy(); } catch (err) { /* already closed */ }
    }
  }

  function clearNet() {
    dropLink();
    stopHeartbeat();
    net.role = null;
    net.id = null;
    net.code = null;
    net.humans.clear();
    net.inputs.clear();
    net.roster = [];
    net.cpus = true;
    net.worldReady = false;
    soloWorldReady = false;
    net.run = 0;
    net.endedRun = 0;
    net.migrating = false;
    net.place = -1;
    net.sprAt = 0;
    net.ateSpr = [];
    if (state.player) state.player.netName = null;
    if (!state.running) {
      state.rivals = [];
      state.sprinkles = [];
      state.particles = [];
    }
    renderRoster();
    showSetup();
    renderLeaderboard();
  }

  function guestBeginRun(run) {
    closeInventory();
    closeShop();
    closeCraft();
    closeMulti();
    pullResultsEl.classList.add("hidden");
    pullResultsEl.innerHTML = "";
    state.running = true;
    state.mode = "run";
    net.run = run;
    net.place = -1;
    state.points = 0;
    state.foodsEarned = 0;
    state.particles = [];
    lobbyHintEl.classList.add("hidden");
    overlay.classList.add("hidden");
    endBtn.disabled = false;
    inventoryBtn.disabled = true;
    shopBtn.disabled = true;
    craftBtn.disabled = true;
    if (view) view.distance = RUN_CAMERA_DISTANCE;
    updateHud();
    cancelAnimationFrame(previewId);
    cancelAnimationFrame(state.animId);
    lastTime = performance.now();
    state.animId = requestAnimationFrame(loop);
  }

  function applySnap(msg) {
    if (net.role !== "guest") return;
    const players = msg.players || [];
    const mine = players.find((person) => person.id === net.id);
    if (mine) {
      const inArena = mine.zone === "arena";
      if (inArena && !state.running && mine.run && mine.run !== net.endedRun) guestBeginRun(mine.run);
      else if (!inArena && state.running) endRun(false);
      // Skip stale positions from a run this player already ended.
      const current = state.running ? inArena && mine.run === net.run : !inArena;
      if (current) {
        if (!state.player) spawnLobbyPlayer();
        state.player.tier = tierByName[mine.food] || state.player.tier;
        state.player.netName = net.name;
        state.player.size = Math.max(10, mine.size || 10);
        // Your own food moves on your screen right away. Only take the host's
        // spot when it placed you somewhere new.
        if (mine.p !== net.place) {
          net.place = mine.p;
          state.player.x = mine.x;
          state.player.y = mine.y;
          state.player.vx = 0;
          state.player.vy = 0;
          net.lastFocus = { x: state.player.x, y: state.player.y };
        }
      }
    }
    const keep = new Set();
    for (const person of players) {
      if (person.id === net.id) continue;
      keep.add(person.id);
      let food = net.humans.get(person.id);
      const tier = tierByName[person.food] || FOOD_TIERS[0];
      if (!food) {
        food = createFood(tier, person.x, person.y, false);
        food.netId = person.id;
        net.humans.set(person.id, food);
      }
      const zone = person.zone === "arena" ? "arena" : "lobby";
      if (food.zone !== zone) {
        food.x = person.x;
        food.y = person.y;
      }
      food.tier = tier;
      food.netName = String(person.name || "Player").slice(0, 12);
      food.zone = zone;
      food.tx = person.x;
      food.ty = person.y;
      food.size = Math.max(10, person.size || 10);
    }
    for (const id of [...net.humans.keys()]) if (!keep.has(id)) net.humans.delete(id);
    if (msg.rivals) {
      const previous = new Map(state.rivals.map((food) => [food.id, food]));
      state.rivals = msg.rivals.map((rival) => {
        const tier = tierByName[rival.food] || FOOD_TIERS[0];
        let food = previous.get(rival.id);
        if (!food) {
          food = createFood(tier, rival.x, rival.y, true);
          food.id = rival.id;
        }
        food.tier = tier;
        food.tx = rival.x;
        food.ty = rival.y;
        food.size = Math.max(1, rival.size || 1);
        return food;
      });
    }
    if (msg.spr) {
      const now = performance.now();
      net.ateSpr = net.ateSpr.filter((eaten) => now - eaten.at < 1500);
      const eaten = new Set(net.ateSpr.map((item) => item.key));
      const sprinkles = unpackSprinkles(msg.spr);
      state.sprinkles = eaten.size
        ? sprinkles.filter((s) => !eaten.has(`${s.x},${s.y}`))
        : sprinkles;
    }
  }

  function onNetMessage(msg) {
    if (msg.t === "err") {
      setNetStatus(msg.msg || "Could not join.");
      clearNet();
      return;
    }
    if (msg.t === "closed") {
      giveUpRoom(msg.msg);
      return;
    }
    if (msg.t === "room") {
      const rejoined = net.migrating;
      net.migrating = false;
      net.role = msg.host ? "host" : "guest";
      net.id = msg.id;
      net.code = msg.code;
      net.place = -1;
      if (state.player) state.player.netName = net.name;
      startHeartbeat();
      applyRoster(msg.players, msg.cpus);
      showRoom(msg.code);
      if (rejoined) {
        if (state.running && msg.run) net.run = msg.run;
        const host = (msg.players || []).find((person) => person.host);
        setNetStatus(`Reconnected. ${host ? host.name : "A friend"} is the host now.`);
        return;
      }
      setNetStatus(msg.host ? "Share this code." : "Joined the room.");
      closeOverlay();
      openMulti();
      return;
    }
    if (msg.t === "roster") {
      applyRoster(msg.players, msg.cpus);
      return;
    }
    if (msg.t === "snap" && net.role === "guest") applySnap(msg);
    if (msg.t === "ev" && net.role === "guest" && msg.id === net.id && state.running) {
      if (msg.kind === "eat") addEatPoints(Number(msg.preySize) / 10);
      if (msg.kind === "pts") addPoints(Number(msg.pts) || 0);
      if (msg.kind === "dead") {
        net.endedRun = net.run;
        endRun(true);
      }
    }
  }

  function giveUpRoom(text) {
    const message = text || "The room closed. You are back in single player.";
    const running = state.running;
    clearNet();
    if (running) endRun(false);
    overlayTitle.textContent = "Multiplayer";
    overlayMsg.textContent = message;
    startBtn.textContent = "Enter Lobby";
    overlay.classList.remove("hidden");
    setNetStatus(message);
  }

  // When the host leaves, the first friend in the list takes over the same code
  // with the arena they last saw, and everyone else reconnects to them.
  function onHostLost() {
    if (net.role !== "guest" || net.migrating) return;
    const guests = net.roster.filter((person) => !person.host);
    const place = Math.max(0, guests.findIndex((person) => person.id === net.id));
    const now = Date.now();
    net.migrating = true;
    net.rejoinUntil = now + REJOIN_WINDOW_MS;
    net.claimAt = now + place * 4000;
    net.lastTry = "";
    net.place = -1;
    dropLink();
    net.humans.clear();
    setNetStatus("The host left. Reconnecting…");
    net.retryTimer = setTimeout(() => reconnectStep(net.code), place ? 1200 : 300);
  }

  function reconnectStep(code) {
    if (!net.migrating) return;
    if (Date.now() > net.rejoinUntil) {
      giveUpRoom();
      return;
    }
    const claim = Date.now() >= net.claimAt && net.lastTry !== "claim";
    net.lastTry = claim ? "claim" : "join";
    if (claim) claimRoom(code);
    else joinRoom(code, net.name, resumeInfo());
  }

  function retryReconnect(code) {
    dropLink();
    net.retryTimer = setTimeout(() => reconnectStep(code), 1000);
  }

  function resumeInfo() {
    const food = state.player;
    return {
      zone: state.running ? "arena" : "lobby",
      x: food ? food.x : LOBBY_SPAWN.x,
      y: food ? food.y : LOBBY_SPAWN.y,
      size: food ? food.size : 10,
    };
  }

  // Rooms go through a public message relay so two devices can play together
  // when a direct connection between them never opens.
  function relayFrame(type, body) {
    const length = [];
    let n = body.length;
    do {
      let byte = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) byte |= 128;
      length.push(byte);
    } while (n > 0);
    const out = new Uint8Array(1 + length.length + body.length);
    out[0] = type;
    out.set(length, 1);
    out.set(body, 1 + length.length);
    return out;
  }

  function relayConnect(clientId) {
    const id = new TextEncoder().encode(clientId);
    const body = new Uint8Array(12 + id.length);
    body.set([0, 4, 77, 81, 84, 84, 4, 2, 0, 60], 0);
    body[10] = id.length >> 8;
    body[11] = id.length & 255;
    body.set(id, 12);
    return relayFrame(0x10, body);
  }

  function relaySubscribe(topic) {
    const name = new TextEncoder().encode(topic);
    const body = new Uint8Array(5 + name.length);
    body[0] = 0;
    body[1] = 1;
    body[2] = name.length >> 8;
    body[3] = name.length & 255;
    body.set(name, 4);
    return relayFrame(0x82, body);
  }

  function relayPublish(topic, text) {
    const name = new TextEncoder().encode(topic);
    const payload = new TextEncoder().encode(text);
    const body = new Uint8Array(2 + name.length + payload.length);
    body[0] = name.length >> 8;
    body[1] = name.length & 255;
    body.set(name, 2);
    body.set(payload, 2 + name.length);
    return relayFrame(0x30, body);
  }

  function relayTake(state) {
    if (state.buf.length < 2) return null;
    let multiplier = 1;
    let value = 0;
    let bytes = 1;
    let encoded = 0;
    do {
      if (bytes > 4) {
        state.buf = new Uint8Array(0);
        return null;
      }
      if (bytes >= state.buf.length) return null;
      encoded = state.buf[bytes];
      value += (encoded & 127) * multiplier;
      multiplier *= 128;
      bytes += 1;
    } while ((encoded & 128) !== 0);
    const total = bytes + value;
    if (state.buf.length < total) return null;
    const packet = state.buf.slice(0, total);
    state.buf = state.buf.slice(total);
    return { type: packet[0] >> 4, body: packet.slice(bytes) };
  }

  function encodeRelay(obj) {
    return JSON.stringify(obj, (key, value) => {
      if (!(value instanceof ArrayBuffer)) return value;
      const bytes = new Uint8Array(value);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, bytes.length)));
      }
      return { __buf: btoa(bin) };
    });
  }

  function decodeRelay(text) {
    return JSON.parse(text, (key, value) => {
      if (!value || typeof value !== "object" || typeof value.__buf !== "string") return value;
      if (Object.keys(value).length !== 1) return value;
      const bin = atob(value.__buf);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    });
  }

  function decodePublish(body) {
    try {
      if (body.length < 2) return null;
      const len = (body[0] << 8) | body[1];
      const start = 2 + len;
      if (start > body.length) return null;
      const env = decodeRelay(new TextDecoder().decode(body.subarray(start)));
      return env && typeof env === "object" ? env : null;
    } catch (err) {
      return null;
    }
  }

  function makeLink(peerId, send, open = true) {
    const handlers = { data: [], close: [], open: [], error: [] };
    let closed = false;
    const conn = {
      peer: peerId,
      open,
      lastHeard: performance.now(),
      armed: false,
      on(ev, fn) { handlers[ev].push(fn); },
      send(obj) { if (!closed) send(obj); },
      close() {
        if (closed) return;
        closed = true;
        conn.open = false;
        handlers.close.forEach((fn) => fn());
      },
      deliver(msg) {
        if (closed) return;
        conn.lastHeard = performance.now();
        handlers.data.forEach((fn) => fn(msg));
      },
    };
    return conn;
  }

  function openRelay(code, role, onMessage) {
    const room = String(code || "").replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const topicIn = `eaf1/${room}/${role === "host" ? "up" : "down"}`;
    const topicOut = `eaf1/${room}/${role === "host" ? "down" : "up"}`;
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const newClientId = () => {
      let id = "eaf";
      for (let i = 0; i < 8; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
      return id;
    };
    let ws = null;
    let reconnects = 0;
    let settled = false;
    const state = { buf: new Uint8Array(0) };
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const relay = {
      destroyed: false,
      live: false,
      links: null,
      guestConn: null,
      guestId: "",
      onLost: null,
      ready,
      publish(envelope) {
        if (relay.destroyed || !ws || ws.readyState !== 1) return;
        ws.send(relayPublish(topicOut, encodeRelay(envelope)));
      },
      destroy() {
        if (relay.destroyed) return;
        const wasLive = relay.live;
        relay.destroyed = true;
        clearInterval(ping);
        clearInterval(watch);
        if (wasLive && ws && ws.readyState === 1) {
          try {
            const leave = role === "host"
              ? { from: "host", to: "*", msg: { t: "hostleft" } }
              : { from: relay.guestId, msg: { t: "bye" } };
            if (role === "host" || relay.guestId) ws.send(relayPublish(topicOut, encodeRelay(leave)));
          } catch (err) { /* socket already closing */ }
        }
        if (ws) {
          try { ws.close(); } catch (err) { /* already closed */ }
        }
        if (!settled) {
          settled = true;
          rejectReady(new Error("closed"));
        }
      },
    };

    const fail = (err) => {
      if (settled || relay.live) return;
      settled = true;
      relay.destroyed = true;
      clearInterval(ping);
      clearInterval(watch);
      if (ws) {
        try { ws.close(); } catch (closeErr) { /* already closed */ }
      }
      rejectReady(err);
    };

    const connect = () => {
      if (relay.destroyed) return;
      state.buf = new Uint8Array(0);
      const socket = new WebSocket(RELAY_URL);
      ws = socket;
      socket.binaryType = "arraybuffer";
      const giveUp = setTimeout(() => {
        if (socket === ws && socket.readyState !== 1) {
          try { socket.close(); } catch (err) { /* already closed */ }
        }
      }, 8000);
      socket.onopen = () => {
        clearTimeout(giveUp);
        reconnects = 0;
        socket.send(relayConnect(newClientId()));
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        clearTimeout(giveUp);
        if (relay.destroyed || socket !== ws) return;
        if (!relay.live) {
          fail(new Error("relay"));
          return;
        }
        reconnects += 1;
        if (reconnects > 4) {
          relay.destroyed = true;
          clearInterval(ping);
          clearInterval(watch);
          if (relay.onLost) relay.onLost();
          return;
        }
        setTimeout(connect, 400);
      };
      socket.onmessage = (ev) => {
        if (socket !== ws || relay.destroyed) return;
        const chunk = new Uint8Array(ev.data);
        const next = new Uint8Array(state.buf.length + chunk.length);
        next.set(state.buf, 0);
        next.set(chunk, state.buf.length);
        state.buf = next;
        for (;;) {
          const packet = relayTake(state);
          if (!packet) break;
          if (packet.type === 2) {
            if (packet.body[1] !== 0) {
              fail(new Error("connack"));
              return;
            }
            socket.send(relaySubscribe(topicIn));
          } else if (packet.type === 9) {
            const now = performance.now();
            if (relay.links) {
              for (const conn of relay.links.values()) conn.lastHeard = now;
            }
            if (relay.guestConn) relay.guestConn.lastHeard = now;
            if (!relay.live) {
              relay.live = true;
              settled = true;
              resolveReady(relay);
            }
          } else if (packet.type === 3) {
            const env = decodePublish(packet.body);
            if (env) onMessage(env);
          }
        }
      };
    };

    const ping = setInterval(() => {
      if (ws && ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0x00]));
    }, 20000);
    const watch = setInterval(() => {
      if (relay.destroyed || !ws || ws.readyState !== 1) return;
      const now = performance.now();
      if (relay.links) {
        for (const conn of [...relay.links.values()]) {
          if (conn.open && now - conn.lastHeard > 10000) conn.close();
        }
      }
      const guest = relay.guestConn;
      if (guest && guest.open && guest.armed && now - guest.lastHeard > 10000) guest.close();
    }, 2000);
    setTimeout(() => fail(new Error("timeout")), 12000);
    connect();
    return relay;
  }

  function beginHost(code) {
    const links = new Map();
    const relay = openRelay(code, "host", (env) => {
      if (!env || !env.from || env.from === "host" || !env.msg) return;
      if (env.msg.t === "bye") {
        const existing = links.get(env.from);
        if (existing) existing.close();
        links.delete(env.from);
        return;
      }
      let conn = links.get(env.from);
      if (!conn || !conn.open) {
        conn = makeLink(env.from, (obj) => {
          relay.publish({ from: "host", to: env.from, msg: obj });
        });
        links.set(env.from, conn);
        conn.on("close", () => {
          if (links.get(env.from) === conn) links.delete(env.from);
        });
        hostAccept(conn);
      }
      conn.deliver(env.msg);
    });
    relay.links = links;
    return relay;
  }

  function claimRoom(code) {
    const relay = beginHost(code);
    net.peer = relay;
    relay.onLost = () => {
      if (net.peer !== relay || net.role !== "host") return;
      giveUpRoom("Lost the connection. Join the code again if a friend is still hosting.");
    };
    relay.ready.then(() => {
      if (net.peer !== relay || !net.migrating) return;
      promoteToHost(code);
    }).catch(() => {
      if (net.peer !== relay || !net.migrating) return;
      retryReconnect(code);
    });
  }

  function promoteToHost(code) {
    net.migrating = false;
    net.role = "host";
    net.id = "host";
    net.code = code;
    net.hostConn = null;
    net.humans.clear();
    net.inputs.clear();
    net.worldReady = true;
    for (const rival of state.rivals) {
      rival.vx = 0;
      rival.vy = 0;
    }
    if (!state.sprinkles.length) seedSprinkles();
    state.lastSpawnAt = performance.now();
    if (state.player) state.player.netName = net.name;
    shareRoster();
    showRoom(code);
    setNetStatus("The host left, so you are the host now. The code is the same.");
  }

  function newRoomCode() {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    return code;
  }

  function cleanRoomCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }

  function startNet() {
    if (net.role) {
      setNetStatus("Leave the current room first.");
      return false;
    }
    if (net.peer) return false;
    if (typeof WebSocket !== "function") {
      setNetStatus("This browser does not support multiplayer.");
      return false;
    }
    return true;
  }

  function hostRoster() {
    const players = [{ id: net.id, name: net.name, food: equippedTier().name, host: true }];
    for (const [id, guest] of net.guests) {
      players.push({ id, name: guest.name, food: guest.food, host: false });
    }
    return players;
  }

  function shareRoster() {
    if (net.role !== "host") return;
    const players = hostRoster();
    applyRoster(players);
    netSend({ t: "roster", players, cpus: cpusActive() });
  }

  async function latestVersion() {
    try {
      const res = await fetch(`index.html?check=${Date.now()}`, { cache: "no-store" });
      const match = (await res.text()).match(/game\.js\?v=(\d+)/);
      return match ? Number(match[1]) : 0;
    } catch (err) {
      return 0;
    }
  }

  function reloadForUpdate(version, pending) {
    if (sessionStorage.getItem(UPDATE_TRIED_KEY) === String(version)) return false;
    sessionStorage.setItem(UPDATE_TRIED_KEY, String(version));
    if (pending) sessionStorage.setItem(PENDING_NET_KEY, JSON.stringify(pending));
    setNetStatus("Updating the game…");
    location.reload();
    return true;
  }

  async function reloadIfOutdated(pending) {
    if (!GAME_VERSION || state.running || net.role) return false;
    const latest = await latestVersion();
    if (!latest || latest <= GAME_VERSION) return false;
    return reloadForUpdate(latest, pending);
  }

  function resumePendingNet() {
    const raw = sessionStorage.getItem(PENDING_NET_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_NET_KEY);
    let pending = null;
    try {
      pending = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!pending || !pending.action) return;
    multiNameEl.value = pending.name || "";
    multiCodeEl.value = pending.code || "";
    openMulti();
    if (pending.action === "create") createRoom(playerNetName());
    else if (pending.action === "join" && pending.code) joinRoom(pending.code, playerNetName());
  }

  function hostAccept(conn) {
    let joined = false;
    conn.on("data", (msg) => {
      if (net.role !== "host" || !msg || typeof msg !== "object") return;
      if (!joined) {
        if (msg.t !== "join") return;
        const guestVersion = Number(msg.v) || 0;
        if (guestVersion !== GAME_VERSION) {
          const guestOld = guestVersion < GAME_VERSION;
          conn.send({
            t: "err",
            update: guestOld,
            v: GAME_VERSION,
            msg: guestOld
              ? "This page is out of date. Refresh and join again."
              : "The host's page is out of date. Ask them to refresh and make a new room.",
          });
          if (!guestOld) setNetStatus("A friend has a newer version. Refresh this page and make a new room.");
          setTimeout(() => conn.close(), 500);
          return;
        }
        if (net.guests.size + 1 >= MAX_ROOM_PLAYERS) {
          conn.send({ t: "err", msg: "That room is full (8 players)." });
          setTimeout(() => conn.close(), 500);
          return;
        }
        joined = true;
        const person = {
          id: conn.peer,
          name: String(msg.name || "Player").trim().slice(0, 12) || "Player",
          food: String(msg.food || "").slice(0, 80),
        };
        net.guests.set(conn.peer, { conn, name: person.name, food: person.food, needSpr: true });
        const food = ensureNetHuman(person);
        if (msg.resume) placeResumed(food, msg.resume);
        conn.send({
          t: "room",
          code: net.code,
          id: conn.peer,
          host: false,
          players: hostRoster(),
          cpus: net.cpus,
          run: food.run,
        });
        shareRoster();
        return;
      }
      const guest = net.guests.get(conn.peer);
      if (!guest) return;
      if (msg.t === "in") {
        msg.id = conn.peer;
        const food = String(msg.food || "").slice(0, 80);
        if (food && food !== guest.food) {
          guest.food = food;
          shareRoster();
        }
        onGuestInput(msg);
      } else if (msg.t === "end") {
        const food = net.humans.get(conn.peer);
        if (food && food.zone === "arena") sendToLobby(food);
      }
    });
    conn.on("close", () => {
      const guest = net.guests.get(conn.peer);
      if (!guest || guest.conn !== conn) return;
      net.guests.delete(conn.peer);
      shareRoster();
    });
    conn.on("error", () => {});
  }

  // A friend reconnecting after a host change keeps their spot, and their run if they had one.
  function placeResumed(food, resume) {
    const x = Number(resume.x);
    const y = Number(resume.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    food.x = x;
    food.y = y;
    food.vx = 0;
    food.vy = 0;
    if (resume.zone === "arena") {
      ensureWorld();
      food.zone = "arena";
      food.run = nextRunId();
      food.eaten = false;
      food.size = Math.max(10, Number(resume.size) || 10);
      clampToArena(food);
    } else {
      clampToLobby(food);
    }
    markPlaced(food);
  }

  function createRoom(name, attempt = 0) {
    if (!startNet()) return;
    const code = newRoomCode();
    net.name = name;
    setNetStatus("Creating room…");
    const relay = beginHost(code);
    net.peer = relay;
    relay.onLost = () => {
      if (net.peer !== relay || net.role !== "host") return;
      giveUpRoom("Lost the connection. Create a room again.");
    };
    relay.ready.then(() => {
      if (net.peer !== relay) return;
      net.name = name;
      net.id = "host";
      net.code = code;
      net.role = "host";
      ensureWorld();
      onNetMessage({ t: "room", host: true, code, id: "host", players: hostRoster() });
      setNetStatus("Share this code. Friends can join from any computer.");
    }).catch(() => {
      if (net.peer !== relay) return;
      if (attempt < 2) {
        clearNet();
        createRoom(name, attempt + 1);
        return;
      }
      onNetMessage({ t: "err", msg: "Could not reach the multiplayer service. Check your internet and try again." });
    });
  }

  // `resume` is set when reconnecting after a host change; failures then retry quietly.
  function joinRoom(code, name, resume = null) {
    if (!resume && !startNet()) return;
    net.name = name;
    if (!resume) setNetStatus("Connecting…");
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let myId = "g";
    for (let i = 0; i < 8; i++) myId += alphabet[Math.floor(Math.random() * alphabet.length)];
    let relay = null;
    let joined = false;
    let rejected = false;
    let done = false;
    let joinPulse = 0;
    const conn = makeLink(myId, (obj) => {
      if (relay) relay.publish({ from: myId, to: "host", msg: obj });
    }, false);
    const stopJoin = () => {
      clearInterval(joinPulse);
      clearTimeout(net.joinTimer);
    };
    const fail = (text) => {
      if (done || joined || !relay || net.peer !== relay) return;
      done = true;
      stopJoin();
      if (resume) retryReconnect(code);
      else onNetMessage({ t: "err", msg: text });
    };
    relay = openRelay(code, "guest", (env) => {
      if (!env || !env.msg) return;
      if (env.to && env.to !== myId && env.to !== "*") return;
      if (env.from === myId) return;
      if (env.msg.t === "hostleft") {
        conn.close();
        return;
      }
      conn.deliver(env.msg);
    });
    relay.guestConn = conn;
    relay.guestId = myId;
    net.peer = relay;
    net.hostConn = conn;
    relay.onLost = () => {
      if (net.hostConn === conn) conn.close();
    };
    conn.on("data", (msg) => {
      if (net.hostConn !== conn || !msg || typeof msg !== "object") return;
      if (msg.t === "room") {
        joined = true;
        conn.armed = true;
        stopJoin();
      }
      if (msg.t === "err") {
        rejected = true;
        done = true;
        stopJoin();
      }
      if (msg.t === "err" && msg.update && !net.role) {
        clearNet();
        if (reloadForUpdate(Number(msg.v) || "host", { action: "join", code, name })) return;
      }
      onNetMessage(msg);
    });
    conn.on("close", () => {
      if (net.hostConn !== conn) return;
      if (joined) {
        if (done) return;
        done = true;
        stopJoin();
        onHostLost();
        return;
      }
      if (rejected || done) return;
      fail("Could not reach that room. Check the code and try again.");
    });
    const sendJoin = () => {
      if (done || joined || rejected || net.hostConn !== conn) return;
      conn.send({ t: "join", v: GAME_VERSION, name, food: equippedTier().name, resume });
    };
    relay.ready.then(() => {
      if (done || net.peer !== relay) return;
      conn.lastHeard = performance.now();
      sendJoin();
      conn.open = true;
      joinPulse = setInterval(sendJoin, 1500);
      net.joinTimer = setTimeout(() => fail("No room with that code."), 8000);
    }).catch(() => {
      fail("Could not reach the multiplayer service. Check your internet and try again.");
    });
  }

  window.addEventListener("pagehide", () => {
    if (net.peer) {
      try { net.peer.destroy(); } catch (err) { /* already closed */ }
    }
  });

  startBtn.addEventListener("click", closeOverlay);
  endBtn.addEventListener("click", () => {
    if (net.role === "guest") {
      net.endedRun = net.run;
      netSend({ t: "end" });
    }
    endRun(false);
  });
  autoFarmBtn.addEventListener("click", () => {
    state.autoFarm = !state.autoFarm;
    autoFarmBtn.setAttribute("aria-pressed", state.autoFarm ? "true" : "false");
  });
  inventoryBtn.addEventListener("click", openInventory);
  multiBtn.addEventListener("click", openMulti);
  multiCloseBtn.addEventListener("click", closeMulti);
  multiCreateBtn.addEventListener("click", async () => {
    const name = playerNetName();
    if (await reloadIfOutdated({ action: "create", name })) return;
    createRoom(name);
  });
  multiJoinBtn.addEventListener("click", async () => {
    const code = cleanRoomCode(multiCodeEl.value);
    if (code.length < 4) {
      setNetStatus("Enter the 4-character code.");
      return;
    }
    const name = playerNetName();
    if (await reloadIfOutdated({ action: "join", code, name })) return;
    joinRoom(code, name);
  });
  multiCpusBtn.addEventListener("click", () => setRoomCpus(!net.cpus));
  multiLeaveBtn.addEventListener("click", () => {
    const running = state.running;
    clearNet();
    if (running) endRun(false);
    setNetStatus("Left the room. You are back in single player.");
  });
  multiCodeEl.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") multiJoinBtn.click();
  });
  multiNameEl.addEventListener("keydown", (e) => e.stopPropagation());
  overlayInventoryBtn.addEventListener("click", openInventory);
  shopBtn.addEventListener("click", openShop);
  overlayShopBtn.addEventListener("click", openShop);
  shopCloseBtn.addEventListener("click", closeShop);
  shopModal.addEventListener("click", (e) => {
    if (e.target === shopModal) closeShop();
  });
  craftBtn.addEventListener("click", openCraft);
  overlayCraftBtn.addEventListener("click", openCraft);
  craftCloseBtn.addEventListener("click", closeCraft);
  craftModal.addEventListener("click", (e) => {
    if (e.target === craftModal) closeCraft();
  });
  craftListEl.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  invCloseBtn.addEventListener("click", closeInventory);
  inventoryModal.addEventListener("click", (e) => {
    if (e.target === inventoryModal) closeInventory();
  });
  inventoryModal.addEventListener(
    "wheel",
    (e) => {
      if (!inventoryModal.classList.contains("hidden")) e.stopPropagation();
    },
    { passive: true }
  );
  inventoryScrollEl.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeShop();
      closeCraft();
      closeInventory();
      closeMulti();
      return;
    }
    const name = e.key.toLowerCase();
    if (!MOVE_KEYS.has(name)) return;
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (typing) return;
    moveKeys.add(name);
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    moveKeys.delete(e.key.toLowerCase());
  });
  window.addEventListener("blur", () => moveKeys.clear());

  enterLobby();
  updateHud();
  resumePendingNet();
  initView().catch((err) => {
    console.error("3D view failed:", err);
    const msg = document.getElementById("overlay-msg");
    if (msg) msg.textContent = `3D view failed to load: ${err && err.message ? err.message : err}`;
  });
  } catch (err) {
    console.error("Eat a Food failed to start:", err);
    const msg = document.getElementById("overlay-msg");
    if (msg) msg.textContent = `Game failed to load: ${err && err.message ? err.message : err}`;
  }
})();
