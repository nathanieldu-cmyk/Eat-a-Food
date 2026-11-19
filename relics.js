(() => {
  const definitions = [
    {id: 'chili', name: 'Chili Charm', icon: '🌶️', bonuses: {speed: .05}, penalties: {sprinkleGrowth: -.02, rivalGrowth: -.02}},
    {id: 'magnet', name: 'Sprinkles Magnet', icon: '🧲', bonuses: {pickup: .07}, penalties: {points: -.03}},
    {id: 'apron', name: 'Chef’s Apron', icon: '🧑‍🍳', bonuses: {sprinkleGrowth: .08}, penalties: {speed: -.03}},
    {id: 'spoon', name: 'Golden Spoon', icon: '🥄', bonuses: {sprinklePoints: .05}, penalties: {sprinkleGrowth: -.05}},
    {id: 'fork', name: 'Hunter’s Fork', icon: '🍴', bonuses: {rivalGrowth: .15}, penalties: {sprinkleGrowth: -.04}},
    {id: 'grinder', name: 'Pepper Grinder', icon: '🧂', bonuses: {pepperSpeed: .10, pepperGrowth: .05}, penalties: {}},
    {id: 'wishbone', name: 'Lucky Wishbone', icon: '🍀', bonuses: {luck: .50}, penalties: {}},
  ];
  const tiers = ['basic', 'advanced', 'godly'];
  const costs = {fragment: 50, basic: 250, advanced: 2000};
  const validId = id => definitions.some(item => item.id === id);
  const keyFor = (id, tier) => `${tier}:${id}`;
  function parseKey(key) {
    if (typeof key !== 'string') return null;
    const [tier, id, extra] = key.split(':');
    return !extra && tiers.includes(tier) && validId(id) ? {id, tier} : null;
  }
  function emptySave() { return {fragments: {}, items: {}, equipped: {}}; }
  function count(raw) { const value = Number(raw); return Number.isFinite(value) ? Math.min(1e9, Math.max(0, Math.floor(value))) : 0; }
  function normalize(raw, inventory) {
    const bag = emptySave();
    for (const {id} of definitions) {
      bag.fragments[id] = count(raw?.fragments?.[id]);
      for (const tier of tiers) {
        const key = keyFor(id, tier);
        bag.items[key] = count(raw?.items?.[key]);
      }
    }
    const used = {};
    for (const [food, key] of Object.entries(raw?.equipped || {})) {
      if (!(inventory[food] > 0) || !parseKey(key) || (used[key] || 0) >= bag.items[key]) continue;
      bag.equipped[food] = key;
      used[key] = (used[key] || 0) + 1;
    }
    return bag;
  }
  function cleanAssignments(save) {
    if (!save.relics) save.relics = emptySave();
    const used = {};
    for (const [food, key] of Object.entries(save.relics.equipped)) {
      if (!(save.inventory[food] > 0) || !parseKey(key) || (used[key] || 0) >= (save.relics.items[key] || 0)) delete save.relics.equipped[food];
      else used[key] = (used[key] || 0) + 1;
    }
  }
  function available(save, key) {
    return Math.max(0, (save.relics.items[key] || 0) - Object.values(save.relics.equipped).filter(value => value === key).length);
  }
  function buyPack(save, random = Math.random) {
    if (save.diamonds < 250) return null;
    const results = Array.from({length: 3}, () => definitions[Math.min(definitions.length - 1, Math.floor(random() * definitions.length))].id);
    save.diamonds -= 250;
    for (const id of results) save.relics.fragments[id] = (save.relics.fragments[id] || 0) + 1;
    return results;
  }
  function combine(save, id, source) {
    if (!validId(id) || !Object.hasOwn(costs, source)) return false;
    const needed = source === 'fragment' ? 3 : 5;
    const key = keyFor(id, source);
    const bag = source === 'fragment' ? save.relics.fragments : save.relics.items;
    const sourceKey = source === 'fragment' ? id : key;
    const have = source === 'fragment' ? bag[id] || 0 : available(save, key);
    if (have < needed || save.diamonds < costs[source]) return false;
    const target = source === 'fragment' ? 'basic' : source === 'basic' ? 'advanced' : 'godly';
    bag[sourceKey] -= needed;
    save.diamonds -= costs[source];
    const result = keyFor(id, target);
    save.relics.items[result] = (save.relics.items[result] || 0) + 1;
    return result;
  }
  function equip(save, food, key) {
    if (!(save.inventory[food] > 0)) return false;
    if (key === null) { delete save.relics.equipped[food]; return true; }
    if (!parseKey(key)) return false;
    if (save.relics.equipped[food] === key) return true;
    if (available(save, key) < 1) return false;
    save.relics.equipped[food] = key;
    return true;
  }
  function effectsForKey(key) {
    const effects = {speed: 1, sprinkleGrowth: 1, rivalGrowth: 1, points: 1, sprinklePoints: 1, pickup: 1, luck: 0, pepperSpeed: 0, pepperGrowth: 0};
    const parsed = parseKey(key);
    if (!parsed) return effects;
    const item = definitions.find(item => item.id === parsed.id);
    const scale = 2 ** tiers.indexOf(parsed.tier);
    for (const [stat, bonus] of Object.entries(item.bonuses)) effects[stat] += bonus * scale;
    for (const [stat, penalty] of Object.entries(item.penalties)) effects[stat] += penalty * scale;
    return effects;
  }
  function describe(key) {
    const parsed = parseKey(key);
    if (!parsed) return '';
    const item = definitions.find(item => item.id === parsed.id);
    const scale = 2 ** tiers.indexOf(parsed.tier);
    const pct = n => `${Math.round(n * 100)}%`;
    switch (item.id) {
      case 'chili': return `+${pct(.05 * scale)} movement speed; −${pct(.02 * scale)} growth.`;
      case 'magnet': return `+${pct(.07 * scale)} sprinkle pickup distance; −${pct(.03 * scale)} points. Only collects eligible sprinkles. Rival eating range stays the same.`;
      case 'apron': return `+${pct(.08 * scale)} growth from sprinkles; −${pct(.03 * scale)} movement speed.`;
      case 'spoon': return `+${pct(.05 * scale)} points from sprinkles; −${pct(.05 * scale)} growth from sprinkles.`;
      case 'fork': return `+${pct(.15 * scale)} growth from eating rivals; −${pct(.04 * scale)} growth from sprinkles.`;
      case 'grinder': return `Eating a rival grants +${pct(.10 * scale)} speed and +${pct(.05 * scale)} growth for 5 seconds. Another rival refreshes the timer.`;
      case 'wishbone': return `+${pct(.50 * scale)} food luck for run rewards earned while using this food. Does not affect Bento Boxes.`;
    }
  }
  window.GameRelics = {definitions, tiers, costs, keyFor, parseKey, emptySave, normalize, cleanAssignments, available, buyPack, combine, equip, effectsForKey, describe};
})();
