(() => {
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

  const ARENA = 2880;
  const MAP_SCALE = ARENA / 720;
  const AREA_SCALE = MAP_SCALE * MAP_SCALE;
  const LOBBY_CAMERA_DISTANCE = 1150;
  const LOBBY_RADIUS = 420;
  const PORTAL_RADIUS = 70;
  const SHOP_PAD_RADIUS = 58;
  const SHOP_STALL_RADIUS = 62;
  const CRAFT_PAD_RADIUS = 58;
  const CRAFT_STALL_RADIUS = 62;
  const RUN_CAMERA_DISTANCE = 480;
  const MIN_CAMERA_DISTANCE = 240;
  const MAX_CAMERA_DISTANCE = 1650 * MAP_SCALE;
  const POINTS_PER_FOOD = 1000;
  const MAX_METER = 40;
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
    } else if (name.startsWith("Shiny ")) {
      prefix = "Shiny ";
      base = name.slice(6);
    }
    return FOOD_RENAMES[base] ? prefix + FOOD_RENAMES[base] : name;
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
      name: `Shiny ${golden.baseName}`,
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

  const GOLDEN_FOODS = FOOD_TIERS.map(makeGoldenFood);
  const SHINY_FOODS = GOLDEN_FOODS.map(makeShinyFood);
  const ALL_FOODS = [...FOOD_TIERS, ...GOLDEN_FOODS, ...SHINY_FOODS];
  const tierByName = Object.fromEntries(ALL_FOODS.map((t) => [t.name, t]));
  const foodsByRarity = Object.fromEntries(
    RARITIES.map((r) => [r.id, FOOD_TIERS.filter((t) => t.rarity === r.id)])
  );
  const rarityById = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
  const goldenByBase = Object.fromEntries(
    GOLDEN_FOODS.map((g) => [g.baseName, g])
  );
  const shinyByBase = Object.fromEntries(
    SHINY_FOODS.map((s) => [s.baseName, s])
  );

  function variantClass(tier) {
    if (tier.isShiny) return "rarity-shiny";
    if (tier.isGolden) return "rarity-golden";
    return `rarity-${tier.rarity}`;
  }

  const POTION_COST = 500;
  const POTION_DURATION_MS = 10 * 60 * 1000;
  const POTIONS = [
    { id: "luck", name: "Luck Potion", emoji: "🍀", detail: "+50% luck for 10 minutes" },
    { id: "speed", name: "Speed Potion", emoji: "⚡", detail: "+25% speed for 10 minutes" },
    { id: "growth", name: "Growth Potion", emoji: "🌱", detail: "+25% growth for 10 minutes" },
    { id: "points", name: "Points Potion", emoji: "✨", detail: "+25% points for 10 minutes" },
  ];

  function emptyPotions() {
    return { luck: 0, speed: 0, growth: 0, points: 0 };
  }

  function emptyActivePotions() {
    return { luck: [], speed: [], growth: [], points: [] };
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
      potions: emptyPotions(),
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
          tier.isGolden &&
          !best.isGolden)
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
      if (parsed.inventory && typeof parsed.inventory === "object") {
        next.inventory = {};
        for (const [rawName, count] of Object.entries(parsed.inventory)) {
          const n = Math.floor(Number(count) || 0);
          const name = renameSheetFood(migrateFoodName(rawName, fromVersion));
          if (n <= 0 || !tierByName[name]) continue;
          next.inventory[name] = (next.inventory[name] || 0) + n;
        }
        if (Object.keys(next.inventory).length === 0) next.inventory = { Peanut: 1 };
      }
      const equippedName = renameSheetFood(migrateFoodName(parsed.equipped || "", fromVersion));
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
        if (tierByName[name]) next.discovered[name] = true;
      }
      for (const [name, count] of Object.entries(next.inventory)) {
        if (count > 0 && tierByName[name]) next.discovered[name] = true;
      }
      if (fromVersion < SAVE_VERSION || hadReady) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    } catch {
      return defaultSave();
    }
  }

  function readActivePotions(raw, readyRaw) {
    const active = emptyActivePotions();
    const now = Date.now();
    if (raw && typeof raw === "object") {
      for (const key of Object.keys(active)) {
        const list = Array.isArray(raw[key]) ? raw[key] : [];
        active[key] = list
          .map((time) => Number(time))
          .filter((time) => Number.isFinite(time) && time > now);
      }
    }
    const ready = readPotionBag(readyRaw);
    for (const key of Object.keys(active)) {
      for (let i = 0; i < ready[key]; i++) active[key].push(now + POTION_DURATION_MS);
    }
    return active;
  }

  function boostStacks(id) {
    const now = Date.now();
    const list = save.activePotions[id] || [];
    const live = list.filter((time) => time > now);
    if (live.length !== list.length) save.activePotions[id] = live;
    return live.length;
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

  bestRunEl.textContent = `${save.bestRun} foods`;
  renderDiamonds();

  function rarityForRunIndex(index) {
    // Used for rival scaling with run length.
    if (index >= 28) return "mythic";
    if (index >= 20) return "legendary";
    if (index >= 13) return "epic";
    if (index >= 7) return "rare";
    if (index >= 3) return "uncommon";
    return "common";
  }

  function pickFoodFromRarity(rarityId) {
    const pool = foodsByRarity[rarityId] || foodsByRarity.common;
    return pool[Math.floor(Math.random() * pool.length)];
  }

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

  function spawnPlayer() {
    const food = createFood(equippedTier(), ARENA / 2, ARENA / 2, false);
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
    state.rivals = [];
    state.sprinkles = [];
    state.particles = [];
    state.onShopPad = false;
    state.onCraftPad = false;
    spawnLobbyPlayer();
    if (view) view.distance = LOBBY_CAMERA_DISTANCE;
    lobbyHintEl.classList.remove("hidden");
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
      !inventoryModal.classList.contains("hidden")
    );
  }

  // Returns true when the player walked into the portal and a run started.
  function updateLobby(dt) {
    if (!state.player || state.player.tier !== equippedTier()) {
      spawnLobbyPlayer(state.player || LOBBY_SPAWN);
    }
    const food = state.player;
    const blocked = lobbyBlocked();
    const dir = blocked ? null : controlDirection();
    if (dir) {
      const spd = Math.max(0.75, moveSpeed(food));
      steerToward(food, { x: food.x + dir.x * 140, y: food.y + dir.y * 140 }, 0.9 * spd);
    }
    food.vx *= 0.86;
    food.vy *= 0.86;
    food.x += food.vx * dt * 60;
    food.y += food.vy * dt * 60;
    clampToLobby(food);
    if (blocked) return false;

    if (dist(food, PORTAL_SPOT) < PORTAL_RADIUS * 0.8) {
      startRun();
      if (state.running) return true;
      spawnLobbyPlayer();
      return false;
    }
    const onPad = dist(food, SHOP_PAD_SPOT) < SHOP_PAD_RADIUS;
    if (onPad && !state.onShopPad) openShop();
    state.onShopPad = onPad;
    const onCraft = dist(food, CRAFT_PAD_SPOT) < CRAFT_PAD_RADIUS;
    if (onCraft && !state.onCraftPad) openCraft();
    state.onCraftPad = onCraft;
    return false;
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

  function spawnRival() {
    if (state.rivals.length >= MAX_RIVALS) return;
    const playerRank = rarityById[rarityForRunIndex(Math.max(0, state.foodsEarned - 1))].rank;
    const rivalRank = Math.max(0, Math.min(RARITIES.length - 1, playerRank + Math.floor(rand(-1, 2))));
    const tier = pickFoodFromRarity(RARITIES[rivalRank].id);
    const side = Math.floor(Math.random() * 4);
    let x = 40;
    let y = 40;
    if (side === 0) {
      x = rand(40, ARENA - 40);
      y = 40;
    } else if (side === 1) {
      x = ARENA - 40;
      y = rand(40, ARENA - 40);
    } else if (side === 2) {
      x = rand(40, ARENA - 40);
      y = ARENA - 40;
    } else {
      x = 40;
      y = rand(40, ARENA - 40);
    }
    const rival = createFood(tier, x, y, true);
    rival.size = rand(8, 12 + state.foodsEarned * 0.35);
    state.rivals.push(rival);
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
    const growthBoost = food === state.player ? Math.pow(1.25, boostStacks("growth")) : 1;
    food.size += pts * food.tier.growth * growthBoost;
    if (!food.isRival) addPoints(pts);
    burst(sprinkle.x, sprinkle.y, sprinkle.type.color);
    state.sprinkles.splice(index, 1);
    setTimeout(() => {
      if (state.running) spawnSprinkle();
    }, 1400 + Math.random() * 1800);
  }

  function tryEatFood(eater, prey, preyList, preyIndex) {
    if (eater.size <= prey.size) return false;
    if (dist(eater, prey) > eater.drawRadius() * 0.55) return false;

    const preySize = prey.size;
    const growthBoost = eater === state.player ? Math.pow(1.25, boostStacks("growth")) : 1;
    eater.size += preySize * eater.tier.growth * growthBoost;
    if (!eater.isRival && prey.isRival) addPoints(Math.floor(preySize));
    burst(prey.x, prey.y, prey.tier.color);
    preyList.splice(preyIndex, 1);

    if (prey === state.player) state.player = null;
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

  function nearestSprinkle(food) {
    let best = null;
    let bestD = Infinity;
    for (const s of state.sprinkles) {
      const d = dist(food, s);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function moveSpeed(food) {
    const base = (food.tier.speed || 1) * SPEED_SCALE * (food === state.player ? Math.pow(1.25, boostStacks("speed")) : 1);
    // Bigger body = slower. Starts full speed around size 10, soft-floors later.
    const bulk = Math.max(0, food.size - 10);
    const sizeFactor = Math.max(0.32, 1 / (1 + bulk / 180));
    return base * sizeFactor;
  }

  function displaySpeed(tier) {
    return tier.speed;
  }

  function updateFoods(dt) {
    const food = state.player;
    if (food) {
      const spd = moveSpeed(food);
      const dir = controlDirection();
      if (dir) steerToward(food, { x: food.x + dir.x * 140, y: food.y + dir.y * 140 }, 0.9 * spd);
      const nearest = nearestSprinkle(food);
      if (nearest && dist(food, nearest) < 140) {
        steerToward(food, nearest, 0.22 * spd);
      }

      for (const rival of state.rivals) {
        if (rival.size <= food.size) continue;
        const d = dist(food, rival);
        if (d < 120 && d > 0) {
          food.vx += ((food.x - rival.x) / d) * 0.45 * spd;
          food.vy += ((food.y - rival.y) / d) * 0.45 * spd;
        }
      }

      food.vx *= 0.86;
      food.vy *= 0.86;
      food.x += food.vx * dt * 60;
      food.y += food.vy * dt * 60;
      clampToArena(food);
    }

    for (const rival of state.rivals) {
      const spd = moveSpeed(rival);
      const prey = state.player && rival.size >= state.player.size * 1.15 ? state.player : null;
      const snack = nearestSprinkle(rival);
      if (prey && dist(rival, prey) < 220) steerToward(rival, prey, 0.42 * spd);
      else if (snack) steerToward(rival, snack, 0.4 * spd);
      else steerToward(rival, { x: ARENA / 2, y: ARENA / 2 }, 0.2 * spd);

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
    if (tier.isShiny) return "#7ec8ff";
    if (tier.isGolden) return "#ffd700";
    return "#ffffff";
  }

  // Outer edge of the ring. It scales with the food, and an orb is eaten when it touches it.
  function ringReach(food) {
    return (RING_MAJOR + RING_TUBE) * food.drawRadius() * FOOD_MODEL_SCALE;
  }

  function resolveEats() {
    const actors = [];
    if (state.player) actors.push(state.player);
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

    if (state.player) {
      for (let j = state.rivals.length - 1; j >= 0; j--) {
        tryEatFood(state.player, state.rivals[j], state.rivals, j);
      }
    }

    for (let i = state.rivals.length - 1; i >= 0; i--) {
      const r = state.rivals[i];
      if (state.player) tryEatFood(r, state.player, [state.player], 0);
      for (let j = state.rivals.length - 1; j >= 0; j--) {
        if (i === j) continue;
        if (tryEatFood(r, state.rivals[j], state.rivals, j) && j < i) i -= 1;
      }
    }
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
      if (tier.isShiny) {
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
      const label = makeLabelSprite(THREE);
      group.add(holder);
      group.add(ring);
      group.add(label);
      view.scene.add(group);
      entry = {
        group,
        holder,
        label,
        materials,
        ring,
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
    entry.group.position.set(worldX(food.x), bob, worldZ(food.y));
    entry.label.position.y = scale + 16;
    const sizeText = formatCount(food.displaySize());
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
    for (const sprinkle of state.sprinkles) {
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
    while (view.particleMeshes.length < state.particles.length) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(view.particleGeo, mat);
      view.scene.add(mesh);
      view.particleMeshes.push(mesh);
    }
    for (let i = 0; i < view.particleMeshes.length; i++) {
      const mesh = view.particleMeshes[i];
      const particle = state.particles[i];
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
    for (const rival of state.rivals) alive.add(syncFood(view.THREE, rival, t));
    if (state.player) alive.add(syncFood(view.THREE, state.player, t));
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
      new THREE.TorusGeometry(PORTAL_RADIUS, 5, 12, 96),
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
      const reach = ringReach(state.player);
      const needed = Math.max(RUN_CAMERA_DISTANCE, reach * 2.6);
      if (view.distance < needed) view.distance = Math.min(MAX_CAMERA_DISTANCE, needed);
    }
    const focus = state.player
      ? { x: worldX(state.player.x), z: worldZ(state.player.y) }
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
    const variantTag = tier.isShiny ? " · Shiny" : tier.isGolden ? " · Golden" : "";
    const oddsText = ` · 1 in ${formatOdds(tier.odds)}`;
    return `${tier.emoji} ${tier.name} · ${rarity.label}${variantTag}${oddsText} · pts ${tier.multiplier}x · grw ${tier.growth}x · spd ${displaySpeed(tier).toFixed(2)}`;
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
    if (state.running || !baseTier || baseTier.isGolden || baseTier.isShiny) return false;
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
    for (const golden of GOLDEN_FOODS) {
      shinies += Math.floor((goldenAfter[golden.name] || 0) / CRAFT_COST);
    }
    return { goldens, shinies };
  }

  function craftAll() {
    if (state.running) return { goldens: 0, shinies: 0 };
    let goldens = 0;
    let shinies = 0;
    for (const tier of FOOD_TIERS) {
      while (craftGolden(tier, { persist: false })) goldens += 1;
    }
    for (const golden of GOLDEN_FOODS) {
      while (craftShiny(golden, { persist: false })) shinies += 1;
    }
    if (goldens || shinies) persistSave();
    return { goldens, shinies };
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
    tile.title = `${tier.name} · ${rarity.label}${
      tier.isShiny ? " · Shiny" : tier.isGolden ? " · Golden" : ""
    } · 1 in ${formatOdds(tier.odds)} · pts ${tier.multiplier}x · grw ${tier.growth}x · spd ${displaySpeed(tier).toFixed(2)}`;

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
    if (counts.shinies) parts.push(`${counts.shinies} Shiny`);
    craftAllBtn.textContent = parts.length
      ? `Craft All (${parts.join(", ")})`
      : `Craft All (need ${CRAFT_COST})`;
    craftAllBtn.disabled = state.running || parts.length === 0;
    craftAllBtn.title = `50 of a food → 1 Golden. 50 Goldens → 1 Shiny.`;
    craftAllBtn.addEventListener("click", () => {
      const scrollTop = craftListEl.scrollTop;
      const beforeTypes = ownedTypeCount();
      const made = craftAll();
      if (!made.goldens && !made.shinies) return;
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
      const craftTarget = tier.isGolden ? shinyByBase[tier.baseName] : goldenByBase[tier.name];
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
      button.className = "btn craft small" + (tier.isGolden ? " shiny" : "");
      button.textContent = canCraft ? "Craft" : `${count}/${CRAFT_COST}`;
      button.disabled = state.running || !canCraft;
      button.title = `Combine ${CRAFT_COST} ${tier.name} into 1 ${craftTarget.name}`;
      button.addEventListener("click", () => {
        const beforeTypes = ownedTypeCount();
        const ok = tier.isGolden ? craftShiny(tier) : craftGolden(tier);
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
      const stacks = boostStacks(potion.id);
      const row = document.createElement("div");
      row.className = "shop-row";
      row.innerHTML = `
        <h3>${potion.emoji} ${potion.name}</h3>
        <div class="shop-actions"></div>
        <p>${potion.detail}. Owned ${owned}. <span class="potion-timer" data-potion="${potion.id}">${potionTimerText(potion.id, stacks)}</span></p>
      `;
      const actions = row.querySelector(".shop-actions");
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.className = "btn ghost small";
      buyBtn.textContent = "Buy 500";
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

  function potionTimerText(id, stacks = boostStacks(id)) {
    if (!stacks) return "Not active.";
    const latest = Math.max(...save.activePotions[id]);
    return `Active ×${stacks} · ${formatRemaining(latest - Date.now())} left.`;
  }

  function renderPotionStatus() {
    const parts = [];
    for (const potion of POTIONS) {
      const stacks = boostStacks(potion.id);
      if (!stacks) continue;
      const latest = Math.max(...save.activePotions[potion.id]);
      parts.push(`${potion.emoji} ${potion.name} ×${stacks} · ${formatRemaining(latest - Date.now())}`);
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
    save.activePotions[id].push(Date.now() + POTION_DURATION_MS);
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
    nextFoodEl.textContent = `${Math.floor(into)} / ${POINTS_PER_FOOD}`;
    foodCountEl.textContent = String(state.foodsEarned);
    const pct = Math.min(100, (state.foodsEarned / MAX_METER) * 100);
    foodFillEl.style.width = `${pct}%`;
    renderEquippedUi();
  }

  let lastTime = 0;
  function loop(now) {
    if (!state.running) return;
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    steerCamera(dt);
    updateFoods(dt);
    resolveEats();
    updateParticles(dt);

    const rivalDelay = state.rivals.length === 0 ? 10000 : 8000;
    if (now - state.lastSpawnAt > rivalDelay && state.foodsEarned >= 2) {
      spawnRival();
      state.lastSpawnAt = now;
    }

    if (sprinkleCount("xs") < MAX_XS_SPRINKLES && Math.random() < 0.14) {
      spawnSprinkle(sprinkleType("xs"));
    }
    if (sprinkleCount("small") < MAX_SMALL_SPRINKLES && Math.random() < 0.14) {
      spawnSprinkle(sprinkleType("small"));
    }

    if (!state.player) {
      endRun(true);
      return;
    }

    draw();
    state.animId = requestAnimationFrame(loop);
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
    state.rivals = [];
    state.particles = [];
    state.lastSpawnAt = performance.now();
    seedSprinkles();
    spawnPlayer();
    if (view) view.distance = RUN_CAMERA_DISTANCE;
    updateHud();
    overlay.classList.add("hidden");
    endBtn.disabled = false;
    inventoryBtn.disabled = true;
    shopBtn.disabled = true;
    craftBtn.disabled = true;
    lastTime = performance.now();
    cancelAnimationFrame(state.animId);
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
    overlay.classList.remove("hidden");
    enterLobby();
    renderEquippedUi();
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

  startBtn.addEventListener("click", closeOverlay);
  endBtn.addEventListener("click", () => endRun(false));
  inventoryBtn.addEventListener("click", openInventory);
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
      return;
    }
    const name = e.key.toLowerCase();
    if (!MOVE_KEYS.has(name)) return;
    moveKeys.add(name);
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    moveKeys.delete(e.key.toLowerCase());
  });
  window.addEventListener("blur", () => moveKeys.clear());

  enterLobby();
  updateHud();
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
