const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function declaration(name){const match=new RegExp('  (?:async )?function '+name+'\\(').exec(source);assert.ok(match,name);const rest=source.slice(match.index+match[0].length);const next=/\n  (?:async )?function /.exec(rest);return source.slice(match.index,next?match.index+match[0].length+next.index:source.length);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function modelLoader(load,now=()=>0){const templates=new Map(),ready=[];const ctx={Map,Set,Promise,Date,console:{warn(){}},now,templates,ready,load};vm.runInNewContext(declaration('createFoodModelLoader')+'\nglobalThis.request=createFoodModelLoader(load,templates,file=>ready.push(file),now);',ctx);return ctx;}
test('model requests are lazy, deduplicated, capped at two, and cached after completion',async()=>{
 const starts=[],resolvers=new Map();const g=modelLoader(file=>{starts.push(file);return new Promise(resolve=>resolvers.set(file,resolve));});
 assert.equal(starts.length,0);for(const name of ['peanut','peanut','pizza','ramen','peanut'])g.request(name);
 await flush();assert.deepEqual(starts,['peanut','pizza']);resolvers.get('peanut')({name:'peanut'});await flush();assert.deepEqual(starts,['peanut','pizza','ramen']);
 resolvers.get('pizza')({name:'pizza'});resolvers.get('ramen')({name:'ramen'});await flush();g.request('peanut');await flush();assert.equal(starts.length,3);assert.equal(g.templates.size,3);assert.equal(g.ready.length,3);
});
test('model failures do not block other foods and retry once after a cooldown',async()=>{
 let now=0,failures=0;const g=modelLoader(async file=>{if(file==='bad'){failures++;throw Error('offline');}return {file};},()=>now);
 g.request('bad');g.request('good');await flush();assert.ok(g.templates.has('good'));assert.equal(failures,1);
 for(let i=0;i<100;i++)g.request('bad');await flush();assert.equal(failures,1);
 now=15000;g.request('bad');await flush();assert.equal(failures,2);now=100000;g.request('bad');await flush();assert.equal(failures,2);
});
test('model fetches have an abort timeout and reject missing files without hanging startup',async()=>{
 let timeout,cleared=0;const ctx={AbortController,URL,window:{location:{href:'https://example.test/'}},setTimeout(fn,ms){assert.equal(ms,20000);timeout=fn;return 1;},clearTimeout(){cleared++;},fetch:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))};
 vm.runInNewContext(declaration('loadFoodModel')+'\nglobalThis.load=loadFoodModel;',ctx);
 const pending=ctx.load({},'slow.glb');timeout();await assert.rejects(pending,/aborted/);assert.equal(cleared,1);
 ctx.fetch=async()=>({ok:false,status:404});await assert.rejects(ctx.load({},'missing.glb'),/404/);assert.equal(cleared,2);
 let parsed;ctx.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await ctx.load({parseAsync:async(data,base)=>{parsed=base;return {scene:{}};}},'good.glb');assert.equal(parsed,'https://example.test/models/');assert.equal(cleared,3);
});
test('renderer starts without waiting for any food model download',async()=>{
 const real=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);let started=0,loads=0;
 const THREE={...real,WebGLRenderer:class{setPixelRatio(){}setClearColor(){}}};
 let init=declaration('initView').replace('const THREE = await import("./vendor/three.module.js");','const THREE = testTHREE;').replace('const { GLTFLoader } = await import("./vendor/GLTFLoader.js?v=3");','const GLTFLoader = testLoader;');
 const ctx={testTHREE:THREE,testLoader:class{},canvas:{},window:{devicePixelRatio:1,addEventListener(){}},ARENA:2880,MAP_SCALE:4,MAX_SPRINKLES:4000,SPRINKLE_TYPES:[],state:{running:false},RUN_CAMERA_DISTANCE:480,LOBBY_CAMERA_DISTANCE:1150,view:null,Map,Set,Promise,Date,console,
 buildLobby:()=>({group:new real.Group()}),makeFoodSparkleTexture:()=>new real.Texture(),resizeView(){},startLobbyLoop(){started++;},loadFoodModel(){loads++;return new Promise(()=>{});},normalizeModel:()=>new real.Group()};
 vm.runInNewContext(declaration('createFoodModelLoader')+'\n'+init+'\nglobalThis.start=initView;',ctx);await ctx.start();assert.equal(started,1);assert.equal(loads,0);assert.ok(ctx.view.scene);ctx.view.requestModel('peanut.glb');await flush();assert.equal(loads,1);
});
test('temporary food shapes are replaced when their model arrives and their resources are released',async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href),requests=[];
 const view={templates:new Map(),foods:new Map(),scene:new THREE.Scene(),requestModel:file=>requests.push(file)};
 const ctx={view,Math,FOOD_MODEL_SCALE:1,RING_MAJOR:.5,RING_TUBE:.02,modelFileFor:()=> 'peanut.glb',ringColor:()=> '#fff',makeLabelSprite:()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial());s.userData.tex=new THREE.Texture();return s;},foodLabelColor:()=>'#d7d7d7',writeLabel(sprite){sprite.userData.baseWidth=32;sprite.userData.baseHeight=128;},paintFood(){},syncFoodSparkles(){},disposeFoodSparkles(){},worldX:x=>x,worldZ:y=>y,formatCount:String};
 vm.runInNewContext(declaration('disposeFoodEntry')+'\n'+declaration('syncFood')+'\nglobalThis.sync=syncFood;',ctx);
 const food={id:'player',tier:{color:'#fff'},x:0,y:0,drawRadius:()=>12,displaySize:()=>10};ctx.sync(THREE,food,0);const before=view.foods.get('player');assert.equal(before.hasTemplate,false);assert.deepEqual(requests,['peanut.glb']);let disposed=0;before.holder.children[0].geometry.addEventListener('dispose',()=>disposed++);
 const model=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());model.add(mesh);view.templates.set('peanut.glb',model);ctx.sync(THREE,food,1);const after=view.foods.get('player');assert.equal(after.hasTemplate,true);assert.notEqual(after,before);assert.equal(disposed,1);assert.equal(view.scene.children.length,1);assert.notEqual(after.materials[0],mesh.material);
});
test('renderer modules resolve locally without requiring an import map',()=>{
 const loader=fs.readFileSync(path.join(root,'vendor/GLTFLoader.js'),'utf8'),utils=fs.readFileSync(path.join(root,'vendor/utils/BufferGeometryUtils.js'),'utf8');assert.match(loader,/from '\.\/three\.module\.js'/);assert.match(utils,/from '\.\.\/three\.module\.js'/);assert.ok(!loader.includes("from 'three'"));assert.ok(!utils.includes("from 'three'"));
});
