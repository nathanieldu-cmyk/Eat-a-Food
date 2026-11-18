const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function declaration(name){const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n  function ',start+1));}
async function boot(){
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 const canvases=[];
 const document={createElement(kind){assert.equal(kind,'canvas');const calls=[];const ctx={font:'',calls,
  measureText(text){return {width:String(text).length*parseFloat(this.font.split(' ')[1])*.55};},
  clearRect(){calls.length=0;this.clears=(this.clears||0)+1;},strokeText(){},fillText(text,x,y){calls.push({text,font:this.font,x,y});}};
  const canvas={width:0,height:0,getContext:()=>ctx};canvases.push(canvas);return canvas;}};
 const view={templates:new Map(),foods:new Map(),scene:new THREE.Scene(),requestModel(){}};
 const c={document,view,Math,FOOD_MODEL_SCALE:2.15,RING_MAJOR:.73,RING_TUBE:.02,modelFileFor:()=> 'food.glb',ringColor:()=> '#fff',paintFood(){},syncFoodSparkles(){},worldX:x=>x,worldZ:y=>y};
 vm.runInNewContext(['formatCount','makeLabelSprite','writeLabel','syncFood'].map(declaration).join('\n')+'\nglobalThis.api={makeLabelSprite,writeLabel,syncFood};',c);
 return {THREE,canvases,view,...c.api};
}
function food(name='Popcorn',extra={}){return {id:'one',tier:{name,color:'#fff'},x:0,y:0,drawRadius:()=>17,displaySize:()=>12345,...extra};}
test('food names and size numbers use the same enlarged font and sit entirely above the food',async()=>{
 const g=await boot(),f=food();g.syncFood(g.THREE,f,0);const entry=g.view.foods.get(f.id),label=entry.label,calls=g.canvases[0].getContext('2d').calls;
 assert.deepEqual(calls.map(c=>c.text),['Popcorn','12,345']);assert.equal(calls[0].font,calls[1].font);assert.ok(calls[0].y<calls[1].y);
 const ordinary=g.makeLabelSprite(g.THREE);g.writeLabel(ordinary,'12,345');
 assert.ok(Math.abs(label.scale.y/2/ordinary.scale.y-64/26)<1e-9,'each text line is about 2.5 times the original size');
 assert.equal(label.center.y,0,'bottom anchored so enlarged labels extend upward');assert.ok(label.position.y>17*2.15);
});
test('every food and variant is named, including CPUs and multiplayer foods, while player names remain visible',async()=>{
 const g=await boot();const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'foods.js'),'utf8'),context);
 for(const base of context.window.FOOD_LIST)for(const prefix of ['','Golden ','Rainbow ','Shadow ']){
  const name=prefix+base.name,f=food(name,{isRival:true});g.syncFood(g.THREE,f,0);
  const label=g.view.foods.get(f.id).label,calls=label.userData.canvas.getContext('2d').calls;
  assert.equal(calls[0].text,name);assert.equal(calls[1].text,'12,345');assert.equal(calls[0].font,calls[1].font);
 }
 const f=food('Rainbow Pepper',{netName:'Friend'});g.syncFood(g.THREE,f,1);const calls=g.view.foods.get(f.id).label.userData.canvas.getContext('2d').calls;
 assert.deepEqual(calls.map(c=>c.text),['Friend','Rainbow Pepper','12,345']);assert.equal(calls[1].font,calls[2].font);
});
test('growing sizes, equipped food changes and player renames refresh labels without redrawing unchanged text',async()=>{
 const g=await boot(),f=food();g.syncFood(g.THREE,f,0);const label=g.view.foods.get(f.id).label,ctx=label.userData.canvas.getContext('2d');const clears=ctx.clears;
 g.syncFood(g.THREE,f,1);assert.equal(ctx.clears,clears);
 f.displaySize=()=>987654321;g.syncFood(g.THREE,f,2);assert.equal(ctx.calls[1].text,'987,654,321');
 f.tier={name:'Shadow Popcorn',color:'#fff'};g.syncFood(g.THREE,f,3);assert.equal(ctx.calls[0].text,'Shadow Popcorn');
 f.netName='New Name';g.syncFood(g.THREE,f,4);assert.equal(ctx.calls[0].text,'New Name');assert.equal(ctx.calls[1].font,ctx.calls[2].font);
 delete f.netName;g.syncFood(g.THREE,f,5);assert.equal(label.userData.canvas.height,128);assert.equal(ctx.calls.length,2);
});
test('large numbers fit the label texture and lobby signs retain their original size',async()=>{
 const g=await boot(),label=g.makeLabelSprite(g.THREE);
 g.writeLabel(label,'Start Run');assert.equal(label.scale.y,26);assert.equal(label.userData.canvas.height,64);
 g.writeLabel(label,'Shadow Cosmic Feast\n'+('9'.repeat(309)),{worldLineHeight:64});const ctx=label.userData.canvas.getContext('2d');
 assert.equal(ctx.calls[0].font,ctx.calls[1].font);assert.ok(label.userData.tex.repeat.x<=1);assert.ok(Number.isFinite(label.scale.x)&&label.scale.x>0);
 for(const call of ctx.calls)assert.ok(ctx.measureText(call.text).width+56<=label.userData.canvas.width);
});
