const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'relic-opening.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(reducedMotion=false){
 const window={};vm.runInNewContext(source,{window});
 let now=0,next=0;const jobs=new Map(),history=[],changes=[];
 const c=window.GameRelicReveal.createController(state=>changes.push(plain(state)),{reducedMotion,schedule(fn,delay){const id=++next;const job={at:now+delay,fn};jobs.set(id,job);history.push(job);return id;},cancel:id=>jobs.delete(id)});
 const advance=ms=>{now+=ms;for(const [id,job] of [...jobs].sort((a,b)=>a[1].at-b[1].at))if(job.at<=now&&jobs.delete(id))job.fn();};
 return {c,jobs,history,changes,advance};
}
test('pack opens, cards arrive, and the three purchased rewards reveal in order',()=>{
 const g=boot(),rewards=['chili','fork','wishbone'];assert.equal(g.c.show(rewards),true);rewards[0]='magnet';
 assert.equal(g.c.snapshot().phase,'opening');assert.deepEqual(plain(g.c.snapshot().rewards),['chili','fork','wishbone']);
 g.advance(799);assert.equal(g.c.snapshot().phase,'opening');g.advance(1);assert.equal(g.c.snapshot().phase,'cards');
 g.advance(400);assert.deepEqual(plain(g.c.snapshot().revealed),[0]);g.advance(550);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1]);
 g.advance(550);assert.equal(g.c.snapshot().phase,'complete');assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);assert.equal(g.jobs.size,0);
});
test('Reveal all skips the animation and cancels pending timers',()=>{
 const g=boot();g.c.show(['chili','magnet','fork']);g.c.revealAll();assert.equal(g.jobs.size,0);assert.equal(g.c.snapshot().phase,'complete');
 const before=g.changes.length;g.advance(5000);assert.equal(g.changes.length,before);assert.deepEqual(plain(g.c.snapshot().revealed),[0,1,2]);
});
test('closing cancels animation callbacks, including callbacks left over before reopening',()=>{
 const g=boot();g.c.show(['chili','chili','chili']);const stale=g.history[0];g.c.close();assert.equal(g.c.isOpen(),false);assert.equal(g.jobs.size,0);
 g.c.show(['magnet','apron','fork']);stale.fn();assert.equal(g.c.snapshot().phase,'opening');assert.deepEqual(plain(g.c.snapshot().revealed),[]);
});
test('duplicate fragments remain three separate cards and individual cards can reveal early',()=>{
 const g=boot();g.c.show(['fork','fork','fork']);g.c.reveal(2);g.c.reveal(2);assert.deepEqual(plain(g.c.snapshot().revealed),[2]);
 g.c.reveal(-1);g.c.reveal(3);assert.deepEqual(plain(g.c.snapshot().revealed),[2]);g.advance(2300);
 assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.c.snapshot().revealed.length,3);assert.deepEqual(plain(g.c.snapshot().rewards),['fork','fork','fork']);
});
test('an open reveal cannot be replaced by another purchase and malformed reward lists do not open',()=>{
 const g=boot();assert.equal(g.c.show(['fork']),false);assert.equal(g.c.show(['fork','fork',null]),false);
 assert.equal(g.c.show(['fork','chili','spoon']),true);assert.equal(g.c.show(['apron','apron','apron']),false);assert.deepEqual(plain(g.c.snapshot().rewards),['fork','chili','spoon']);
});
test('reduced-motion mode shows all rewards immediately without starting timers',()=>{
 const g=boot(true);g.c.show(['chili','fork','apron']);assert.equal(g.c.snapshot().phase,'complete');assert.equal(g.jobs.size,0);assert.equal(g.c.snapshot().revealed.length,3);
});
test('a purchase saves and animates exactly its three awarded fragments; double clicks do not charge twice',()=>{
 const window={};let rolls=0;const math=Object.create(Math);math.random=()=>[.01,.3,.9][rolls++%3];
 vm.runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window,Math:math});
 const save={diamonds:500,relics:window.GameRelics.emptySave()},shown=[],saved=[];let listener,open=false;
 window.GameRelicOpening={isOpen:()=>open,show(result){assert.equal(saved.length,shown.length+1,'outcome is saved before animation');shown.push([...result]);open=true;}};
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8'),start=game.indexOf('  document.getElementById("relic-pack").addEventListener('),end=game.indexOf('  relicListEl.addEventListener',start);
 vm.runInNewContext(game.slice(start,end),{window,save,document:{getElementById:()=>({addEventListener:(event,fn)=>{listener=fn;}})},finishRelicAction(){saved.push(plain(save));}});
 listener();listener();assert.equal(save.diamonds,250);assert.equal(rolls,3);assert.equal(shown.length,1);assert.deepEqual(shown[0],['chili','apron','wishbone']);
 assert.deepEqual(plain(save.relics.fragments),{chili:1,apron:1,wishbone:1});open=false;listener();assert.equal(save.diamonds,0);assert.equal(rolls,6);assert.equal(shown.length,2);
});
test('every relic has a vector illustration, and unknown symbol identifiers use the crest',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window});
 for(const item of window.GameRelics.definitions)assert.ok(window.GameRelics.artHtml(item.id).includes(`#${item.id}`));
 assert.ok(window.GameRelics.artHtml('<bad>').includes('#crest'));assert.ok(!window.GameRelics.artHtml('<bad>').includes('<bad>'));
});
