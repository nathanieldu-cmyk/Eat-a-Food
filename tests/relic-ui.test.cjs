const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const start=source.indexOf('  function finishRelicAction('),end=source.indexOf('\n  function ',start+1);
for(const disabled of [false,true])test(`relic updates preserve inventory/shop scroll and focus when the action is ${disabled?'disabled':'enabled'}`,()=>{
 const panel={scrollTop:875,scrollLeft:3},shopPanel={scrollTop:375,scrollLeft:0},calls=[];
 const card={focus(options){calls.push(['card',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const button={disabled,closest:()=>card,focus(options){calls.push(['button',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const context={state:{relicsOpen:true},document:{activeElement:{dataset:{relicEquip:'rare:spoon'}},getElementById:()=>({textContent:''})},
  relicModal:{querySelector:selector=>selector==='.relic-panel'?panel:button},shopModal:{querySelector:()=>shopPanel,classList:{contains:()=>true}},relicStatusEl:{textContent:''},
  persistSave(){},refreshPlayerRelics(){},renderDiamonds(){},renderRelics(){panel.scrollTop=0;panel.scrollLeft=0;shopPanel.scrollTop=0;},renderShop(){},renderEquippedUi(){}};
 vm.runInNewContext(source.slice(start,end)+'\nfinishRelicAction("Rare Spoon equipped.");',context);
 assert.equal(panel.scrollTop,875);assert.equal(panel.scrollLeft,3);assert.equal(shopPanel.scrollTop,375);assert.equal(calls.length,1);assert.equal(calls[0][0],disabled?'card':'button');assert.equal(calls[0][1].preventScroll,true);assert.equal(context.relicStatusEl.textContent,'Rare Spoon equipped.');
});
