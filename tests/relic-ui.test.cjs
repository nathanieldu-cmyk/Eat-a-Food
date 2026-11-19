const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const start=source.indexOf('  function finishRelicAction('),end=source.indexOf('\n  function ',start+1);
for(const disabled of [false,true])test(`combining preserves scroll and focus when the new button is ${disabled?'disabled':'still enabled'}`,()=>{
 const panel={scrollTop:875,scrollLeft:3},calls=[];
 const card={focus(options){calls.push(['card',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const button={disabled,closest:()=>card,focus(options){calls.push(['button',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const context={document:{activeElement:{dataset:{relicCombine:'wishbone'}},getElementById:()=>null},
  relicModal:{querySelector:()=>panel},relicListEl:{querySelector:()=>button},relicStatusEl:{textContent:''},
  persistSave(){},refreshPlayerRelics(){},renderDiamonds(){},renderRelics(){panel.scrollTop=0;panel.scrollLeft=0;},renderEquippedUi(){}};
 vm.runInNewContext(source.slice(start,end)+'\nfinishRelicAction("Created Lucky Wishbone.");',context);
 assert.equal(panel.scrollTop,875);assert.equal(panel.scrollLeft,3);
 assert.equal(calls.length,1);assert.equal(calls[0][0],disabled?'card':'button');assert.equal(calls[0][1].preventScroll,true);
 assert.equal(context.relicStatusEl.textContent,'Created Lucky Wishbone.');
});
