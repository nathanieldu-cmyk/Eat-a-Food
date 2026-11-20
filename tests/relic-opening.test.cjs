const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'relic-opening.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(reducedMotion=false){
 const window={};vm.runInNewContext(source,{window});let now=0,next=0;const jobs=new Map(),history=[],changes=[];
 const c=window.GameRelicReveal.createController(state=>changes.push(plain(state)),{reducedMotion,schedule(fn,delay){const id=++next,job={at:now+delay,fn};jobs.set(id,job);history.push(job);return id;},cancel:id=>jobs.delete(id)});
 const advance=ms=>{now+=ms;for(const[id,job]of [...jobs].sort((a,b)=>a[1].at-b[1].at))if(job.at<=now&&jobs.delete(id))job.fn();};return{c,jobs,history,changes,advance};
}
test('one card reveals exactly one purchased relic, with its pack and ownership metadata',()=>{
 const g=boot(),result=['rare:spoon'];assert.ok(g.c.show(result,{packId:'common',ownedCount:2}));result[0]='mythic:chili';
 g.advance(799);assert.equal(g.c.snapshot().phase,'opening');g.advance(1);assert.equal(g.c.snapshot().phase,'cards');g.advance(400);const state=g.c.snapshot();
 assert.equal(state.phase,'complete');assert.deepEqual(plain(state.rewards),['rare:spoon']);assert.deepEqual(plain(state.revealed),[0]);assert.equal(state.packId,'common');assert.equal(state.ownedCount,2);assert.equal(g.jobs.size,0);
});
test('Reveal all cancels timers and cannot award or reroll another relic',()=>{
 const g=boot();g.c.show(['epic:badge']);g.c.revealAll();assert.equal(g.jobs.size,0);const before=g.changes.length;g.advance(5000);assert.equal(g.changes.length,before);assert.deepEqual(plain(g.c.snapshot().rewards),['epic:badge']);
});
test('closing cancels callbacks and stale callbacks cannot affect a later pack',()=>{
 const g=boot();g.c.show(['common:spoon']);const stale=g.history[0];g.c.close();assert.equal(g.c.isOpen(),false);assert.equal(g.jobs.size,0);g.c.show(['mythic:dish']);stale.fn();assert.equal(g.c.snapshot().phase,'opening');assert.deepEqual(plain(g.c.snapshot().revealed),[]);
});
test('only one card is valid, individual reveal works and concurrent openings are rejected',()=>{
 const g=boot();assert.equal(g.c.show(['common:spoon','common:fork']),false);assert.equal(g.c.show([]),false);assert.equal(g.c.show([null]),false);
 assert.ok(g.c.show(['common:crown']));assert.equal(g.c.show(['rare:fork']),false);g.c.reveal(-1);g.c.reveal(1);assert.equal(g.c.snapshot().revealed.length,0);g.c.reveal(0);g.c.reveal(0);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.c.snapshot().revealed.length,1);
});
test('reduced motion reveals the permanent relic immediately without timers',()=>{
 const g=boot(true);g.c.show(['mythic:tooth']);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.jobs.size,0);assert.equal(g.c.snapshot().rewards.length,1);
});
test('the actual purchase handler saves one award before animation, blocks duplicate clicks and rejects runs',()=>{
 const window={};let rolls=0,open=false;const math=Object.create(Math);math.random=()=>{rolls++;return 0;};vm.runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window,Math:math});
 const save={diamonds:200,relics:window.GameRelics.emptySave()},shown=[],saved=[];
 window.GameRelicOpening={isOpen:()=>open,show(key,packId,count){assert.equal(saved.length,shown.length+1);shown.push({key,packId,count});open=true;}};
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8'),start=game.indexOf('  function purchaseRelicPack('),end=game.indexOf('\n  function ',start+1);
 const context={window,save,state:{running:false},relicPurchaseBusy:false,finishRelicAction(){saved.push(plain(save));}};
 vm.runInNewContext(game.slice(start,end)+'\nglobalThis.buy=purchaseRelicPack;',context);
 context.buy('common');context.buy('common');assert.equal(save.diamonds,100);assert.equal(rolls,2);assert.equal(shown.length,1);assert.deepEqual(shown[0],{key:'common:spoon',packId:'common',count:1});
 open=false;context.state.running=true;assert.equal(context.buy('common'),null);assert.equal(save.diamonds,100);context.state.running=false;context.buy('common');assert.equal(save.diamonds,0);assert.equal(save.relics.items['common:spoon'],2);assert.equal(rolls,4);
});
