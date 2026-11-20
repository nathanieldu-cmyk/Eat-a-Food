const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'relic-opening.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(reducedMotion=false){
 const window={};vm.runInNewContext(source,{window});let now=0,next=0;const jobs=new Map(),history=[],changes=[];
 const c=window.GameRelicReveal.createController(state=>changes.push(plain(state)),{reducedMotion,schedule(fn,delay){const id=++next,job={at:now+delay,fn};jobs.set(id,job);history.push(job);return id;},cancel:id=>jobs.delete(id)});
 const advance=ms=>{const target=now+ms;while(true){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;const[id,job]=next;now=job.at;jobs.delete(id);job.fn();}now=target;};return{c,jobs,history,changes,advance};
}
const results=['rare:spoon','rare:spoon','secret:dragon'];
test('a purchase waits indefinitely for one pack tap, then starts revealing automatically',()=>{
 const g=boot(),input=[...results],owned=[2,2,1];assert.ok(g.c.show(input,{packId:'rare',ownedCounts:owned}));input[0]='mythic:chili';owned[0]=9;
 g.advance(10000);assert.equal(g.c.snapshot().phase,'sealed');assert.equal(g.jobs.size,0);assert.equal(g.c.reveal,undefined);
 assert.ok(g.c.openPack());assert.equal(g.c.openPack(),false);g.advance(999);assert.equal(g.c.snapshot().phase,'opening');g.advance(651);assert.equal(g.c.snapshot().phase,'revealing');assert.equal(g.c.snapshot().revealingIndex,0);
 assert.deepEqual(plain(g.c.snapshot().rewards),results);assert.deepEqual(plain(g.c.snapshot().ownedCounts),[2,2,1]);
});
test('all three cards reveal in sequence without further taps, with suspense beats and no rerolls',()=>{
 const g=boot();g.c.show(results);g.c.openPack();g.advance(1650);assert.deepEqual(plain(g.c.snapshot().revealed),[]);
 g.advance(1299);assert.deepEqual(plain(g.c.snapshot().revealed),[]);assert.deepEqual(g.changes.filter(s=>s.revealingIndex===0&&s.pulse>0).map(s=>s.pulse),[1,2,3]);
 g.advance(1);assert.deepEqual(plain(g.c.snapshot().revealed),[0]);g.advance(949);assert.equal(g.c.snapshot().phase,'cards');g.advance(1);assert.equal(g.c.snapshot().revealingIndex,1);
 g.advance(20000);assert.equal(g.c.snapshot().phase,'complete');assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);assert.equal(g.jobs.size,0);assert.equal(g.c.revealAll,undefined);assert.deepEqual(plain(g.c.snapshot().rewards),results);
});
test('each rarity increases suspense duration; the biggest reveal is saved for last',()=>{
 let lastDelay=0;for(const rarity of ['common','uncommon','rare','epic','legendary','mythic','secret']){
  const g=boot();g.c.show(Array(3).fill(`${rarity}:spoon`));g.c.openPack();g.advance(1650);
  const firstBeat=[...g.jobs.values()][0],delay=(firstBeat.at-1650)*4;assert.ok(delay>lastDelay);lastDelay=delay;
  g.advance(delay-1);assert.equal(g.c.snapshot().phase,'revealing');g.advance(1);assert.deepEqual(plain(g.c.snapshot().revealed),[0]);
 }
 const g=boot();g.c.show(['secret:dragon','common:spoon','rare:spoon']);g.c.openPack();g.advance(30000);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);assert.deepEqual(plain(g.c.snapshot().rewards),['common:spoon','rare:spoon','secret:dragon']);
});
test('closing cancels all future beats and reveals; stale callbacks cannot affect a later pack',()=>{
 const g=boot();g.c.show(results);g.c.openPack();g.advance(1650);const stale=g.history.at(-1);g.c.close();assert.equal(g.c.isOpen(),false);assert.equal(g.jobs.size,0);
 g.c.show(results);stale.fn();g.advance(30000);assert.equal(g.c.snapshot().phase,'sealed');assert.deepEqual(plain(g.c.snapshot().revealed),[]);
});
test('exactly three cards are required and duplicate pack taps cannot start parallel sequences',()=>{
 const g=boot();for(const invalid of [[],['common:spoon'],['common:spoon','common:fork'],[null,...results.slice(1)],[...results,'common:fork']])assert.equal(g.c.show(invalid),false);
 assert.ok(g.c.show(results));assert.equal(g.c.show(results),false);assert.ok(g.c.openPack());assert.equal(g.c.openPack(),false);g.advance(30000);assert.equal(g.changes.filter(s=>s.phase==='complete').length,1);
});
test('reduced motion keeps the pack tap and presents a static Secret spotlight',()=>{
 const g=boot(true);g.c.show(results);assert.equal(g.c.snapshot().phase,'sealed');assert.equal(g.c.snapshot().revealed.length,0);g.c.openPack();assert.equal(g.c.snapshot().phase,'spotlight');assert.equal(g.c.snapshot().spotlightIndex,2);assert.equal(g.c.snapshot().spotlightStage,'revealed');assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);g.advance(2600);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.jobs.size,0);
});
test('the purchase handler saves all three awards before animation, blocks duplicate clicks and rejects runs',()=>{
 const window={};let rolls=0,open=false;const math=Object.create(Math);math.random=()=>{rolls++;return 0;};vm.runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window,Math:math});
 const save={diamonds:500,relics:window.GameRelics.emptySave()},shown=[],saved=[];
 window.GameRelicOpening={isOpen:()=>open,show(keys,packId,counts){assert.equal(saved.length,shown.length+1);shown.push(plain({keys,packId,counts}));open=true;}};
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8'),start=game.indexOf('  function purchaseRelicPack('),end=game.indexOf('\n  function ',start+1);
 const context={window,save,state:{running:false},relicPurchaseBusy:false,finishRelicAction(){saved.push(plain(save));}};
 vm.runInNewContext(game.slice(start,end)+'\nglobalThis.buy=purchaseRelicPack;',context);
 context.buy('common');context.buy('common');assert.equal(save.diamonds,250);assert.equal(rolls,6);assert.equal(shown.length,1);assert.deepEqual(shown[0],{keys:['common:spoon','common:spoon','common:spoon'],packId:'common',counts:[3,3,3]});
 assert.equal(saved[0].relics.items['common:spoon'],3);
 open=false;context.state.running=true;assert.equal(context.buy('common'),null);assert.equal(save.diamonds,250);context.state.running=false;context.buy('common');assert.equal(save.diamonds,0);assert.equal(save.relics.items['common:spoon'],6);assert.equal(rolls,12);
});

test('only Secret cards take over the screen, flip once, and hold before the next reveal',()=>{
 const g=boot();g.c.show(['secret:dragon','common:spoon','secret:hat']);g.c.openPack();g.advance(1650);
 assert.equal(g.c.snapshot().spotlightIndex,null);g.advance(650+950);assert.equal(g.c.snapshot().spotlightIndex,1);assert.equal(g.c.snapshot().spotlightStage,'charging');
 g.advance(4799);assert.equal(g.c.snapshot().spotlightStage,'charging');assert.deepEqual(plain(g.c.snapshot().revealed),[0]);g.advance(1);assert.equal(g.c.snapshot().phase,'spotlight');assert.equal(g.c.snapshot().spotlightStage,'revealed');assert.deepEqual(plain(g.c.snapshot().revealed),[0,1]);
 g.advance(2599);assert.equal(g.c.snapshot().spotlightIndex,1);g.advance(1);assert.equal(g.c.snapshot().spotlightIndex,null);g.advance(950);assert.equal(g.c.snapshot().spotlightIndex,2);g.advance(7400);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.c.snapshot().spotlightIndex,null);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);
});
test('closing during a Secret cinematic clears the spotlight and all timers',()=>{
 const g=boot();g.c.show(['secret:dragon','secret:hat','secret:truffle']);g.c.openPack();g.advance(1650+4800);assert.equal(g.c.snapshot().phase,'spotlight');g.c.close();assert.equal(g.c.snapshot().spotlightIndex,null);assert.equal(g.jobs.size,0);g.advance(30000);assert.equal(g.c.snapshot().phase,'closed');
});
test('reduced motion without a Secret completes immediately with no cinematic timers',()=>{
 const g=boot(true);g.c.show(['common:spoon','rare:spoon','mythic:spoon']);g.c.openPack();assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.c.snapshot().spotlightIndex,null);assert.equal(g.jobs.size,0);
});

test('every arrangement of zero, one, two or three Secrets places them in the last card slots',()=>{
 for(let mask=0;mask<8;mask++){
  const g=boot(),input=[0,1,2].map(i=>mask&(1<<i)?['secret:dragon','secret:hat','secret:truffle'][i]:'common:spoon'),counts=[7,2,11];
  const original=[...input],expected=input.map((key,i)=>({key,count:counts[i]})).filter(row=>!row.key.startsWith('secret:')).concat(input.map((key,i)=>({key,count:counts[i]})).filter(row=>row.key.startsWith('secret:')));
  g.c.show(input,{ownedCounts:counts});const s=g.c.snapshot();assert.deepEqual(plain(s.rewards),expected.map(row=>row.key));assert.deepEqual(plain(s.ownedCounts),expected.map(row=>row.count));assert.deepEqual(input,original);
  const secrets=input.filter(key=>key.startsWith('secret:')).length;assert.ok(s.rewards.slice(0,3-secrets).every(key=>!key.startsWith('secret:')));assert.ok(s.rewards.slice(3-secrets).every(key=>key.startsWith('secret:')));
  g.c.openPack();g.advance(30000);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);assert.equal(g.c.snapshot().phase,'complete');
 }
});

test('three-pack opening advances straight to the next sealed pack and requires one tap for each pack',()=>{
 const g=boot(),packs=[['common:spoon','common:fork','common:spoon'],['secret:dragon','rare:spoon','rare:fork'],['secret:hat','secret:hat','secret:truffle']],counts=[[5,7,5],[1,2,3],[2,2,1]];
 assert.ok(g.c.showBatch(packs,{packId:'rare',ownedCounts:counts}));packs[0][0]='mythic:spoon';counts[0][0]=99;
 let s=g.c.snapshot();assert.equal(s.packNumber,1);assert.equal(s.packTotal,3);assert.deepEqual(plain(s.ownedCounts),[5,7,5]);assert.equal(s.rewards[0],'common:spoon');
 for(let i=1;i<=3;i++){
  s=g.c.snapshot();assert.equal(s.phase,'sealed');assert.equal(s.packNumber,i);assert.deepEqual(plain(s.revealed),[]);assert.ok(g.c.openPack());assert.equal(g.c.openPack(),false);g.advance(30000);
 }
 s=g.c.snapshot();assert.equal(s.phase,'complete');assert.equal(s.packNumber,3);assert.equal(s.packId,'rare');assert.deepEqual(plain(s.rewards),['secret:hat','secret:hat','secret:truffle']);assert.deepEqual(plain(s.ownedCounts),[2,2,1]);assert.equal(g.jobs.size,0);
 assert.deepEqual(g.changes.filter(row=>row.phase==='sealed').map(row=>row.packNumber),[1,2,3]);
});
test('reduced-motion batches show each result before automatically preparing the next sealed pack',()=>{
 const g=boot(true),pack=['common:spoon','common:fork','common:spoon'];g.c.showBatch([pack,pack,pack]);g.c.openPack();assert.equal(g.c.snapshot().phase,'complete');g.advance(1199);assert.equal(g.c.snapshot().packNumber,1);g.advance(1);assert.equal(g.c.snapshot().phase,'sealed');assert.equal(g.c.snapshot().packNumber,2);assert.equal(g.c.snapshot().revealed.length,0);
 const stale=g.history.at(-1);g.c.close();g.c.show(pack);stale.fn();g.advance(30000);assert.equal(g.c.snapshot().phase,'sealed');assert.equal(g.c.snapshot().packTotal,1);
});
test('invalid batch contents and a second active purchase cannot replace an opening',()=>{
 const g=boot(),pack=['common:spoon','common:fork','common:spoon'];for(const invalid of [[],[pack,pack],[pack,pack,['common:spoon']],null])assert.equal(g.c.showBatch(invalid),false);
 assert.ok(g.c.showBatch([pack,pack,pack]));assert.equal(g.c.showBatch([pack,pack,pack]),false);assert.equal(g.c.snapshot().packNumber,1);
});
test('the triple-purchase handler saves all nine awards before opening, charges once and blocks repeated buys',()=>{
 const window={};let rolls=0,open=false;const math=Object.create(Math);math.random=()=>{rolls++;return 0;};vm.runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window,Math:math});
 const save={diamonds:1000,relics:window.GameRelics.emptySave()},saved=[],shown=[];
 window.GameRelicOpening={isOpen:()=>open,showBatch(packs,packId,counts){assert.equal(saved.length,1);assert.equal(saved[0].diamonds,250);assert.equal(saved[0].relics.items['common:spoon'],9);shown.push(plain({packs,packId,counts}));open=true;}};
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8'),start=game.indexOf('  function purchaseRelicPack('),end=game.indexOf('\n  function ',start+1);
 const context={window,save,state:{running:false},relicPurchaseBusy:false,finishRelicAction(){saved.push(plain(save));}};vm.runInNewContext(game.slice(start,end)+'\nglobalThis.buy=purchaseRelicPack;',context);
 const results=context.buy('common',false,3);assert.equal(results.length,3);assert.equal(rolls,18);assert.equal(save.diamonds,250);assert.equal(shown.length,1);assert.deepEqual(shown[0].counts,[[9,9,9],[9,9,9],[9,9,9]]);
 assert.equal(context.buy('common',false,3),null);assert.equal(rolls,18);open=false;assert.equal(context.buy('common',false,3),null);assert.equal(rolls,18);assert.equal(saved.length,1);
});
