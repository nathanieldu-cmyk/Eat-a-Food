const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('globalThis.api = { save, state, net,','globalThis.api = { claimRainbowPepper, save, state, net,')
 .replace('    renderShop = () => {};','    renderShop = () => {}; renderInventory = () => {}; renderFoodIndex = () => {};');
const ctx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',ctx);
const event=()=>({id:'rainbow-pepper-test',type:'rainbow-pepper',startsAt:Date.now()-1000,endsAt:Date.now()-1000+60000});
test('one exact Rainbow Pepper per event save across repeated polls, reloads and missing claim ledger',()=>{
 const g=ctx.gameBoot();const e=event();assert.ok(g.tierByName['Rainbow Pepper']);
 assert.equal(g.claimRainbowPepper(e),true);assert.equal(g.save.inventory['Rainbow Pepper'],1);
 assert.equal(g.save.discovered['Rainbow Pepper'],true);assert.equal(g.save.diamonds,0);
 assert.equal(g.claimRainbowPepper(e),false);assert.equal(g.save.inventory['Rainbow Pepper'],1);
 const h=ctx.gameBoot(JSON.parse(g.storage.get('sprinkleFeastSave')));
 assert.equal(h.claimRainbowPepper(e),false);assert.equal(h.save.inventory['Rainbow Pepper'],1);
 const j=ctx.gameBoot();j.save.inventory['Rainbow Pepper']=3;assert.equal(j.claimRainbowPepper(e),true);assert.equal(j.save.inventory['Rainbow Pepper'],4);
});
test('no early, late, invalid, or hidden-player claims',()=>{
 for(const changes of [{startsAt:Date.now()+10000,endsAt:Date.now()+70000},{startsAt:Date.now()-60001,endsAt:Date.now()-1},{type:'gold'},{id:'bad id'},{endsAt:Infinity}]){
 const g=ctx.gameBoot();assert.equal(g.claimRainbowPepper({...event(),...changes}),false);assert.equal(g.save.inventory['Rainbow Pepper'],undefined);
 }
 let hiddenHarness=harness.replace('currentScript: {','hidden: true, currentScript: {');const hidden={require,__dirname,console};vm.runInNewContext(hiddenHarness+'\nglobalThis.gameBoot=boot;',hidden);
 assert.equal(hidden.gameBoot().claimRainbowPepper(event()),false);
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function bootFeed(start,record,hidden=false,lock){
 let now=start,claims=0;const timers=[],events={},banner={classList:{add(){},remove(){}},textContent:''};
 class Clock extends Date{static now(){return now;}}
 const document={hidden,getElementById:()=>banner,addEventListener(k,fn){events[k]=fn;}};
 const window={GameGiveaway:{claim(e){assert.ok(now>=e.startsAt&&now<e.endsAt);claims++;}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'giveaway.js'),'utf8'),{window,document,navigator:{locks:lock?{request:lock}:undefined},Date:Clock,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval(fn,ms){timers.push({fn,ms});},fetch:async()=>({ok:true,json:async()=>record})});
 return {document,banner,events,setTime:t=>{now=t;},claims:()=>claims,refresh:()=>timers.find(t=>t.ms===1000).fn(),sync:()=>timers.find(t=>t.ms===3000).fn()};
}
test('open active page receives once; late arrivals never claim; hidden pages wait until visible',async()=>{
 const e={id:'live',type:'rainbow-pepper',startsAt:1000,endsAt:61000};
 const g=bootFeed(1000,e);await flush();assert.equal(g.claims(),1);await g.refresh();await g.sync();assert.equal(g.claims(),1);assert.match(g.banner.textContent,/60s left/);
 const late=bootFeed(61000,e);await flush();assert.equal(late.claims(),0);
 const h=bootFeed(1000,e,true);await flush();assert.equal(h.claims(),0);h.document.hidden=false;h.events.visibilitychange();await flush();assert.equal(h.claims(),1);
 const expired=bootFeed(1000,e,true);expired.setTime(61000);expired.document.hidden=false;expired.events.visibilitychange();await flush();assert.equal(expired.claims(),0);
});
test('expiry is checked after waiting for cross-tab claim lock',async()=>{
 let release;const e={id:'live',type:'rainbow-pepper',startsAt:1000,endsAt:61000};
 const g=bootFeed(1000,e,false,async(name,fn)=>{assert.equal(name,'eat-a-food-giveaway');await new Promise(r=>release=r);return fn();});await flush();g.setTime(61000);release();await flush();assert.equal(g.claims(),0);
});
