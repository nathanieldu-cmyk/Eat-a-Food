const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'tutorial.js'),'utf8');
function boot(step='start', query='') {
 const state={step,running:false,foods:0,equipped:'Peanut',best:'Peanut',equipRevision:0,ready:true};
 const elements=new Map(),listeners={};let poll,stopped=false,prepared=0;
 const body={appendChild(el){this.child=el;}};
 function el(name){
   const classes=new Set();const events={};
   return {name,parentElement:body,style:{},hidden:false,textContent:'',innerHTML:'',offsetWidth:320,offsetHeight:180,
     rect:{left:50,top:100,right:250,bottom:160,width:200,height:60},
     classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)},
     getBoundingClientRect(){return this.rect;},scrollIntoView(){this.scrolled=true;},
     addEventListener(k,fn){events[k]=fn;},click(){events.click?.();},remove(){this.removed=true;},
     querySelector(selector){return node(selector);},
   };
 }
 function node(name){if(!elements.has(name))elements.set(name,el(name));return elements.get(name);}
 for(const id of ['inventory-modal','shop-modal','craft-modal','multi-modal','index-modal'])node('#'+id).classList.add('hidden');
 const api={snapshot:()=>({...state}),setStep:s=>{state.step=s;},prepare(){prepared++;node('#overlay').classList.add('hidden');},portalBounds:()=>({left:820,top:150,width:130,height:80}),closeMultiplayer(){node('#multi-modal').classList.add('hidden');}};
 const document={body,hidden:false,createElement:()=>node('root'),getElementById:id=>node('#'+id),querySelector:node,addEventListener(k,fn){listeners[k]=fn;},removeEventListener(){}};
 const location={href:'https://eat-a-food-eta.vercel.app/'+query};
 const ctx={URL,window:{location,history:{state:null,replaceState(state,title,url){location.href=url;}},GameTutorialApi:api,addEventListener(){},removeEventListener(){}},document,innerWidth:1280,innerHeight:720,getComputedStyle:()=>({overflowX:'visible',overflowY:'visible'}),setInterval(fn){poll=fn;return 1;},clearInterval(){stopped=true;}};
 vm.runInNewContext(source,ctx);
 return {state,node,document,api,ctx,tick(){poll?.();},open(id){node('#'+id).classList.remove('hidden');},close(id){node('#'+id).classList.add('hidden');},next(){node('.tutorial-next').click();},stopped:()=>stopped,prepared:()=>prepared};
}
function until(g,step){for(let i=0;i<5&&g.state.step!==step;i++)g.tick();assert.equal(g.state.step,step);g.tick();}
test('first-time tutorial follows actual play and menu actions through the exact final message',()=>{
 const g=boot();assert.equal(g.state.step,'start');assert.ok(g.node('.tutorial-card').style.left);assert.equal(g.node('.tutorial-highlight').hidden,false);
 g.state.running=true;until(g,'collect');g.tick();assert.equal(g.state.step,'collect');
 g.state.foods=1;until(g,'end-run');assert.match(g.node('.tutorial-copy').textContent,/End Run/);
 g.state.running=false;until(g,'inventory');g.open('inventory-modal');until(g,'equip');
 g.tick();assert.equal(g.state.step,'equip','owning the best food must not skip the equip action');
 g.state.equipRevision++;until(g,'close-inventory');g.close('inventory-modal');until(g,'shop');
 g.open('shop-modal');until(g,'bento');assert.match(g.node('.tutorial-copy').textContent,/3 foods and \+5% luck/);
 g.next();until(g,'potions');assert.match(g.node('.tutorial-copy').textContent,/500 diamonds/);
 g.next();until(g,'close-shop');g.close('shop-modal');until(g,'craft');g.open('craft-modal');until(g,'craft-info');
 assert.match(g.node('.tutorial-copy').textContent,/50 matching foods/);g.next();until(g,'close-craft');g.close('craft-modal');until(g,'multiplayer');
 g.open('multi-modal');until(g,'multiplayer-info');assert.match(g.node('.tutorial-copy').textContent,/Create a room/);
 g.next();until(g,'finish');assert.equal(g.node('h2').textContent,'Continue collecting new foods');assert.equal(g.node('#multi-modal').classList.contains('hidden'),true);
 g.next();assert.equal(g.state.step,'done');assert.equal(g.stopped(),true);assert.equal(g.node('root').removed,true);
});
test('tutorial waits for the first food, recovers from death and requires the best food to be equipped',()=>{
 const g=boot();g.state.running=true;until(g,'collect');g.state.running=false;until(g,'start');assert.ok(g.prepared()>=3);
 g.state.running=true;g.state.foods=1;until(g,'end-run');g.state.running=false;until(g,'inventory');g.open('inventory-modal');until(g,'equip');
 g.state.best='Cheese';g.state.equipRevision++;g.tick();assert.equal(g.state.step,'equip');g.state.equipped='Cheese';until(g,'close-inventory');
});
test('potions ask for scrolling and cannot advance until the potion area is visible',()=>{
 const g=boot('potions');g.open('shop-modal');g.node('#shop-list').rect={left:50,top:900,right:500,bottom:1400,width:450,height:500};
 // Start on the restored Shop step, then reopen the explanation.
 if(g.state.step==='shop'){g.tick();g.tick();g.next();}g.tick();assert.equal(g.state.step,'potions');
 assert.equal(g.node('#shop-list').scrolled,undefined);assert.equal(g.node('.tutorial-next').disabled,true);g.next();assert.equal(g.state.step,'potions');
 g.node('#shop-list').rect={left:50,top:200,right:500,bottom:600,width:450,height:400};g.document.hidden=false;g.tick();assert.equal(g.node('.tutorial-next').disabled,false);g.next();assert.equal(g.state.step,'close-shop');
});
test('returning players have no tutorial, skipping dismisses it, and closed menus can be reopened',()=>{
 const old=boot('done');assert.equal(old.document.body.child,undefined);
 const skip=boot();skip.node('.tutorial-skip').click();assert.equal(skip.state.step,'done');assert.equal(skip.stopped(),true);
 const g=boot('equip');assert.equal(g.state.step,'inventory');g.open('inventory-modal');until(g,'equip');
 g.close('inventory-modal');until(g,'inventory');
});
test('loading and background tabs do not intercept gameplay or move tutorial progress',()=>{
 const g=boot();g.state.ready=false;g.tick();assert.equal(g.node('root').hidden,true);
 g.state.running=true;g.document.hidden=true;g.tick();assert.equal(g.state.step,'start');g.document.hidden=false;g.state.ready=true;until(g,'collect');
});
let harness=fs.readFileSync(path.join(__dirname,'bento.test.cjs'),'utf8').split('const thresholds =')[0];
harness=harness.replace('globalThis.api = { save, state, net,','globalThis.api = { setTutorialStep, save, state, net,');
const gameCtx={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.gameBoot=boot;',gameCtx);
test('new saves start the tutorial, existing saves skip it, and saved steps survive reloads',()=>{
 const fresh=gameCtx.gameBoot();assert.equal(fresh.save.tutorial.step,'start');
 const legacy=JSON.parse(JSON.stringify(fresh.save));delete legacy.tutorial;assert.equal(gameCtx.gameBoot(legacy).save.tutorial.step,'done');
 for(const step of ['collect','equip','bento','potions','craft-info','multiplayer-info','finish','done']){
   fresh.setTutorialStep(step);const reloaded=gameCtx.gameBoot(JSON.parse(fresh.storage.get('sprinkleFeastSave')));assert.equal(reloaded.save.tutorial.step,step);
 }
 fresh.setTutorialStep('invalid');assert.equal(fresh.save.tutorial.step,'done');
});
test('portal highlight projects the real Start Run location and scales with the game canvas',async()=>{
 const THREE=await import(require('node:url').pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8');const start=game.indexOf('  function tutorialPortalBounds('),end=game.indexOf('\n  function ',start+1);
 const camera=new THREE.PerspectiveCamera(40,1,10,16000);camera.position.set(0,820,700);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 let width=636;const ctx={view:{THREE,camera},state:{mode:'lobby'},canvas:{getBoundingClientRect:()=>({left:470,top:70,width,height:width})},PORTAL_SPOT:{x:1440,y:1152},PORTAL_RADIUS:120,worldX:x=>x-1440,worldZ:y=>y-1440,Math};
 vm.runInNewContext(game.slice(start,end)+'\nglobalThis.bounds=tutorialPortalBounds;',ctx);const first=ctx.bounds();assert.ok(first.width>0&&first.height>0);assert.ok(first.left>=470&&first.left+first.width<=1106);
 width=318;const second=ctx.bounds();assert.ok(Math.abs(second.width*2-first.width)<1e-8);ctx.state.mode='run';assert.equal(ctx.bounds(),null);
});

test('opening an unrelated menu points to its close button before resuming the same step',()=>{
 const g=boot();g.open('shop-modal');g.tick();assert.equal(g.state.step,'start');assert.equal(g.node('h2').textContent,'Close Shop');
 assert.equal(g.node('.tutorial-next').hidden,true);g.close('shop-modal');g.tick();assert.equal(g.node('h2').textContent,'Start your first run');
 g.open('index-modal');g.tick();assert.equal(g.node('h2').textContent,'Close Food Index');
});

test('tutorial link starts a returning player guide and consumes only the tutorial URL parameter',()=>{
 const g=boot('done','?tutorial=1&room=ABCD');
 assert.equal(g.state.step,'start');assert.equal(g.state.equipped,'Peanut');assert.ok(g.document.body.child);
 assert.equal(g.ctx.window.location.href,'https://eat-a-food-eta.vercel.app/?room=ABCD');
 g.state.running=true;until(g,'collect');assert.equal(g.ctx.window.location.href,'https://eat-a-food-eta.vercel.app/?room=ABCD');
 const normal=boot('done','?tutorial=0');assert.equal(normal.document.body.child,undefined);
});
