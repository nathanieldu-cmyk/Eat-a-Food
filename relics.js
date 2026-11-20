(() => {
  // All relic names, pack prices/odds, family chances and percentage stats live here.
  // Stat sequences are always Common → Uncommon → Rare → Epic → Legendary → Mythic.
  const config = {
    schema: 2,
    rarities: [
      {id:'common', label:'Common', color:'#d7d7d7', price:100},
      {id:'uncommon', label:'Uncommon', color:'#6dde8a', price:400},
      {id:'rare', label:'Rare', color:'#6eb6ff', price:1000},
      {id:'epic', label:'Epic', color:'#c089ff', price:3000},
      {id:'legendary', label:'Legendary', color:'#ffb347', price:10000},
      {id:'mythic', label:'Mythic', color:'#ff6b9d', price:30000},
    ],
    rarityWeights: [825,100,50,25],
    families: [
      {id:'spoon', name:'Spoon', icon:'🥄', weight:51, stats:{sprinklePoints:[5,8,12,17,23,30]}},
      {id:'fork', name:'Fork', icon:'🍴', weight:51, stats:{sprinkleGrowth:[5,8,12,17,23,30]}},
      {id:'chili', name:'Chili Charm', icon:'🌶️', weight:51, stats:{speed:[3,5,7,10,12,15]}},
      {id:'dish', name:'Diamond Dish', icon:'💎', weight:51, stats:{diamonds:[5,8,12,17,23,30]}},
      {id:'badge', name:'Chef’s Badge', icon:'🏅', weight:41, stats:{speed:[1,2,3,4,5,6],sprinkleGrowth:[2,4,6,8,12,15],sprinklePoints:[2,4,6,8,12,15]}},
      {id:'ladle', name:'Heavy Ladle', icon:'🥣', weight:51, stats:{sprinkleGrowth:[8,13,20,28,38,50],speed:[-2,-3,-5,-6,-8,-10]}},
      {id:'goblet', name:'Glass Goblet', icon:'🍷', weight:51, stats:{sprinklePoints:[5,8,13,20,30,40],sprinkleGrowth:[-3,-5,-8,-12,-15,-20]}},
      {id:'tooth', name:'Hunter’s Tooth', icon:'🦷', weight:51, stats:{rivalGrowth:[8,13,20,28,38,50]}},
      {id:'crown', name:'Crumb Crown', icon:'👑', weight:51, stats:{xsPoints:[10,20,35,50,75,100]}},
      {id:'medal', name:'Feast Medal', icon:'🎖️', weight:51, stats:{rivalPoints:[8,13,20,28,38,50]}},
    ],
  };
  const labels = {speed:'movement speed',sprinkleGrowth:'growth from sprinkles',sprinklePoints:'points from sprinkles',diamonds:'diamonds when banking a run',rivalGrowth:'growth from eating rivals',xsPoints:'points from extra-small sprinkles only',rivalPoints:'points from eating rivals'};
  const keyFor = (family, rarity) => `${rarity}:${family}`;
  const count = raw => Number.isFinite(Number(raw)) ? Math.min(1e9,Math.max(0,Math.floor(Number(raw)))) : 0;
  const rarityWeightTotal = config.rarityWeights.reduce((a,b)=>a+b,0);
  const familyWeightTotal = config.families.reduce((sum,family)=>sum+family.weight,0);
  const packs = config.rarities.map((rarity,index)=>{
    const odds = config.rarities.map(()=>0);
    config.rarityWeights.forEach((weight,offset)=>{odds[Math.min(index+offset,config.rarities.length-1)]+=weight;});
    return {id:rarity.id,name:`${rarity.label} Pack`,rarity:rarity.id,price:rarity.price,odds:odds.map((weight,i)=>({rarity:config.rarities[i].id,label:config.rarities[i].label,weight,chance:weight/rarityWeightTotal*100})).filter(row=>row.weight)};
  });
  const relics = config.rarities.flatMap((rarity,index)=>config.families.map(family=>({
    key:keyFor(family.id,rarity.id),family:family.id,rarity:rarity.id,name:`${rarity.label} ${family.name}`,icon:family.icon,color:rarity.color,
    stats:Object.fromEntries(Object.entries(family.stats).map(([stat,values])=>[stat,values[index]])),
  })));
  const byKey = new Map(relics.map(relic=>[relic.key,relic]));
  const getRelic = key => byKey.get(key) || null;
  function parseKey(key) {const relic=getRelic(key);return relic?{id:relic.family,family:relic.family,rarity:relic.rarity,tier:relic.rarity}:null;}
  function emptySave() {return {schema:config.schema,items:{},equipped:null,diamondCarry:0,tutorialGiftEligible:false,tutorialGiftClaimed:false};}
  function normalize(raw, {completedTutorial=false,food=null} = {}) {
    const bag=emptySave();
    if (raw?.schema===config.schema) {
      for(const relic of relics){const n=count(raw.items?.[relic.key]);if(n)bag.items[relic.key]=n;}
      bag.equipped=getRelic(raw.equipped)&&bag.items[raw.equipped]>0?raw.equipped:null;
      bag.diamondCarry=count(raw.diamondCarry)%100;
      bag.tutorialGiftClaimed=raw.tutorialGiftClaimed===true;
      bag.tutorialGiftEligible=raw.tutorialGiftEligible===true||completedTutorial;
      if(raw.legacyArchive)bag.legacyArchive=raw.legacyArchive;
      return bag;
    }
    // Preserve old collections and archive the original fragment/fusion data.
    if(raw && typeof raw==='object') {
      const families={spoon:'spoon',fork:'fork',chili:'chili',apron:'badge',magnet:'crown',grinder:'medal',wishbone:'dish'};
      const rarities={basic:'common',advanced:'epic',godly:'mythic'};
      const converted={};
      for(const [old,n]of Object.entries(raw.items||{})){
        const [tier,id]=old.split(':');if(!rarities[tier]||!families[id])continue;
        const key=keyFor(families[id],rarities[tier]);bag.items[key]=(bag.items[key]||0)+count(n);converted[old]=key;
      }
      for(const [id,n]of Object.entries(raw.fragments||{}))if(families[id]){
        const key=keyFor(families[id],'common'),made=Math.floor(count(n)/3);if(made)bag.items[key]=(bag.items[key]||0)+made;
      }
      const oldEquipped=raw.equipped?.[food]||Object.values(raw.equipped||{})[0];
      if(converted[oldEquipped]&&bag.items[converted[oldEquipped]])bag.equipped=converted[oldEquipped];
      bag.legacyArchive={items:raw.items||{},fragments:raw.fragments||{},equipped:raw.equipped||{}};
    }
    bag.tutorialGiftEligible=completedTutorial;
    return bag;
  }
  function cleanAssignments(save) {
    if(save.relics?.schema!==config.schema)save.relics=normalize(save.relics);
    if(!getRelic(save.relics.equipped)||!(save.relics.items[save.relics.equipped]>0))save.relics.equipped=null;
  }
  function weighted(rows,total,random) {
    const unit=random();if(!Number.isFinite(unit)||unit<0||unit>=1)throw new RangeError('Relic random roll must be in [0, 1).');
    let cumulative=0;
    for(const row of rows){cumulative+=row.weight;if(unit<cumulative/total)return row;}
    return rows[rows.length-1];
  }
  function roll(packId, random=Math.random) {
    const pack=packs.find(pack=>pack.id===packId);if(!pack)return null;
    const rarity=weighted(pack.odds,rarityWeightTotal,random).rarity;
    const family=weighted(config.families,familyWeightTotal,random).id;
    return keyFor(family,rarity);
  }
  function award(save,key) {save.relics.items[key]=(save.relics.items[key]||0)+1;return key;}
  function buyPack(save,packId,running=false,random=Math.random) {
    const pack=packs.find(pack=>pack.id===packId);
    if(running||!pack||!Number.isFinite(save.diamonds)||save.diamonds<pack.price)return null;
    const key=roll(packId,random);save.diamonds-=pack.price;return award(save,key);
  }
  function equip(save,key,running=false) {
    if(running)return false;
    if(key===null){save.relics.equipped=null;return true;}
    if(!getRelic(key)||!(save.relics.items[key]>0))return false;
    save.relics.equipped=key;return true;
  }
  function effectsForKey(key) {
    const effects={speed:1,sprinkleGrowth:1,sprinklePoints:1,rivalGrowth:1,rivalPoints:1,xsPoints:1,diamonds:0};
    const relic=getRelic(key);if(!relic)return effects;
    for(const [stat,pct]of Object.entries(relic.stats))effects[stat]=stat==='diamonds'?pct:1+pct/100;
    return effects;
  }
  function bankDiamonds(save,base,key) {
    const earned=Number.isFinite(base)?Math.max(0,Math.floor(base)):0,pct=effectsForKey(key).diamonds;
    const units=earned*pct+save.relics.diamondCarry;
    const bonus=Math.floor(units/100);save.relics.diamondCarry=units%100;
    save.diamonds+=earned+bonus;
    return {base:earned,bonus,total:earned+bonus,carry:save.relics.diamondCarry};
  }
  function unlockTutorialGift(save) {save.relics.tutorialGiftEligible=true;}
  function claimTutorialPack(save,running=false,random=Math.random) {
    if(running||!save.relics.tutorialGiftEligible||save.relics.tutorialGiftClaimed)return null;
    const key=roll('common',random);save.relics.tutorialGiftClaimed=true;return award(save,key);
  }
  function describe(key) {
    const relic=getRelic(key);if(!relic)return 'No relic equipped.';
    let text=Object.entries(relic.stats).map(([stat,pct])=>`${pct<0?'−':'+'}${Math.abs(pct)}% ${labels[stat]}`).join('; ')+'.';
    if(relic.family==='tooth')text+=' Does not increase sprinkle growth.';
    if(relic.family==='medal')text+=' Does not increase sprinkle points. The 10-base-food cap per rival still applies.';
    if(relic.family==='dish')text+=' Rounded down after weather rewards; fractional bonus diamonds carry between runs.';
    return text;
  }
  function artHtml(id) {
    const family=config.families.find(family=>family.id===id);
    const symbol=family?family.id:'crest';
    return `<svg class="relic-glyph" viewBox="0 0 96 96" aria-hidden="true"><use href="relic-art.svg?v=2#${symbol}"></use></svg>`;
  }
  const oddsText = pack => pack.odds.map(row=>`${row.chance}% ${row.label}`).join(' · ');
  window.GameRelics={config,rarities:config.rarities,definitions:config.families,tiers:config.rarities.map(rarity=>rarity.id),packs,relics,getRelic,keyFor,parseKey,emptySave,normalize,cleanAssignments,roll,buyPack,equip,effectsForKey,bankDiamonds,unlockTutorialGift,claimTutorialPack,describe,artHtml,oddsText,familyWeightTotal};
})();
