const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const start=source.indexOf('  function finishRelicAction('),end=source.indexOf('\n  function ',start+1);
for(const action of ['relicEquip','relicCombine','relicBuy'])for(const disabled of [false,true])test(`${action} preserves collection scroll and focus when its new button is ${disabled?'disabled':'enabled'}`,()=>{
 const panel={scrollTop:875,scrollLeft:3},calls=[],selectors=[];
 const card={focus(options){calls.push(['card',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const button={disabled,closest:()=>card,focus(options){calls.push(['button',options]);if(!options?.preventScroll)panel.scrollTop=0;}};
 const context={state:{relicsOpen:true},document:{activeElement:{dataset:{[action]:'rare:spoon',relicQuantity:'3'}},getElementById:()=>({textContent:''})},
  relicModal:{querySelector:selector=>{selectors.push(selector);return selector==='.relic-panel'?panel:button;}},relicStatusEl:{textContent:''},
  persistSave(){},refreshPlayerRelics(){},renderDiamonds(){},renderRelics(){panel.scrollTop=0;panel.scrollLeft=0;},renderShop(){assert.fail('Relic actions belong in Relics, not Shop');},renderEquippedUi(){}};
 vm.runInNewContext(source.slice(start,end)+'\nfinishRelicAction("Relic updated.");',context);
 assert.equal(panel.scrollTop,875);assert.equal(panel.scrollLeft,3);assert.equal(calls.length,1);assert.equal(calls[0][0],disabled?'card':'button');assert.equal(calls[0][1].preventScroll,true);assert.equal(context.relicStatusEl.textContent,'Relic updated.');if(action==='relicBuy')assert.ok(selectors.some(selector=>selector.includes('[data-relic-quantity="3"]')));
});
