const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'relic-opening.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(reducedMotion=false){
 const window={};vm.runInNewContext(source,{window});let now=0,next=0;const jobs=new Map(),history=[],changes=[];
 const c=window.GameRelicReveal.createController(state=>changes.push(plain(state)),{reducedMotion,schedule(fn,delay){const id=++next,job={at:now+delay,fn};jobs.set(id,job);history.push(job);return id;},cancel:id=>jobs.delete(id)});
 const advance=ms=>{now+=ms;for(const[id,job]of [...jobs].sort((a,b)=>a[1].at-b[1].at))if(job.at<=now&&jobs.delete(id))job.fn();};return{c,jobs,history,changes,advance};
}
const results=['rare:spoon','rare:spoon','secret:dragon'];
test('a purchase waits indefinitely for a pack tap and never reveals untouched cards',()=>{
 const g=boot(),input=[...results],owned=[2,2,1];assert.ok(g.c.show(input,{packId:'rare',ownedCounts:owned}));input[0]='mythic:chili';owned[0]=9;
 g.advance(10000);assert.equal(g.c.snapshot().phase,'sealed');assert.equal(g.jobs.size,0);assert.equal(g.c.reveal(0),false);
 assert.ok(g.c.openPack());assert.equal(g.c.openPack(),false);assert.equal(g.c.reveal(0),false);g.advance(800);assert.equal(g.c.snapshot().phase,'cards');g.advance(10000);assert.deepEqual(plain(g.c.snapshot().revealed),[]);assert.equal(g.jobs.size,0);
 assert.deepEqual(plain(g.c.snapshot().rewards),results);assert.deepEqual(plain(g.c.snapshot().ownedCounts),[2,2,1]);
});
test('each tap reveals exactly one card, ignores rapid extra taps and waits for the next tap',()=>{
 const g=boot();g.c.show(results);g.c.openPack();g.advance(800);
 assert.ok(g.c.reveal(1));assert.equal(g.c.snapshot().revealingIndex,1);assert.equal(g.c.reveal(0),false);assert.equal(g.c.reveal(1),false);
 g.advance(599);assert.deepEqual(plain(g.c.snapshot().revealed),[]);g.advance(1);assert.deepEqual(plain(g.c.snapshot().revealed),[1]);g.advance(10000);assert.deepEqual(plain(g.c.snapshot().revealed),[1]);assert.equal(g.c.reveal(1),false);
 g.c.reveal(0);g.advance(600);assert.deepEqual(plain(g.c.snapshot().revealed),[1,0]);g.c.reveal(2);g.advance(2600);assert.equal(g.c.snapshot().phase,'complete');assert.deepEqual(plain(g.c.snapshot().revealed),[1,0,2]);assert.equal(g.jobs.size,0);assert.equal(g.c.revealAll,undefined);
});
test('every successive rarity has a longer suspense delay and finishes only its tapped card',()=>{
 let lastDelay=0;for(const rarity of ['common','uncommon','rare','epic','legendary','mythic','secret']){
  const g=boot();g.c.show([`${rarity}:spoon`,'common:spoon','common:spoon']);g.c.openPack();g.advance(800);g.c.reveal(0);
  const job=[...g.jobs.values()][0],delay=job.at-800;assert.ok(delay>lastDelay);lastDelay=delay;
  g.advance(delay-1);assert.equal(g.c.snapshot().phase,'revealing');g.advance(1);assert.deepEqual(plain(g.c.snapshot().revealed),[0]);assert.equal(g.c.snapshot().phase,'cards');
 }
});
test('closing cancels suspense; stale callbacks cannot affect a later pack',()=>{
 const g=boot();g.c.show(results);g.c.openPack();g.advance(800);g.c.reveal(2);const stale=g.history.at(-1);g.c.close();assert.equal(g.c.isOpen(),false);assert.equal(g.jobs.size,0);
 g.c.show(results);stale.fn();assert.equal(g.c.snapshot().phase,'sealed');assert.deepEqual(plain(g.c.snapshot().revealed),[]);
});
test('exactly three cards are required; concurrent openings and invalid card taps are rejected',()=>{
 const g=boot();for(const invalid of [[],['common:spoon'],['common:spoon','common:fork'],[null,...results.slice(1)],[...results,'common:fork']])assert.equal(g.c.show(invalid),false);
 assert.ok(g.c.show(results));assert.equal(g.c.show(results),false);g.c.openPack();g.advance(800);for(const index of [-1,3,1.5])assert.equal(g.c.reveal(index),false);assert.equal(g.c.snapshot().revealed.length,0);
});
test('reduced motion still requires a pack tap and one tap per card, without delays',()=>{
 const g=boot(true);g.c.show(results);assert.equal(g.c.snapshot().phase,'sealed');g.c.openPack();assert.equal(g.c.snapshot().phase,'cards');assert.equal(g.c.snapshot().revealed.length,0);
 g.c.reveal(0);assert.deepEqual(plain(g.c.snapshot().revealed),[0]);g.c.reveal(1);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1]);g.c.reveal(2);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.jobs.size,0);
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
