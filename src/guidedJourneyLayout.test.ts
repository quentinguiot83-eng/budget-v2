import test from "node:test";
import assert from "node:assert/strict";
import { chooseTourPlacement,clipTourBounds,tourRectsOverlap } from "./guidedJourneyLayout";

test("iPhone Safari viewport and bottom menu: panel and highlighted card never overlap",()=>{
  for(const target of [
    {top:280,bottom:430}, // top summary
    {top:520,bottom:650}, // savings panel, old screenshot
    {top:655,bottom:830}, // near navigation
    {top:130,bottom:280}  // close to header
  ]){
    const p=chooseTourPlacement({
      viewport:{top:0,bottom:790},headerBottom:177,navigationTop:695,
      target,fullPanelHeight:305,compactPanelHeight:165
    });
    assert.ok(p.panelTop>=p.usable.top);
    assert.ok(p.panelTop+p.panelHeight<=p.usable.bottom+.1);
    const after={top:target.top-p.scrollBy,bottom:target.bottom-p.scrollBy};
    const clipped=clipTourBounds(after,p.slot);
    if(clipped)assert.ok(!tourRectsOverlap(clipped,{top:p.panelTop,bottom:p.panelTop+p.panelHeight}));
  }
});
test("a large card uses the compact explanation instead of hiding it",()=>{
  const p=chooseTourPlacement({
    viewport:{top:0,bottom:760},headerBottom:160,navigationTop:680,
    target:{top:340,bottom:625},fullPanelHeight:330,compactPanelHeight:175
  });
  assert.equal(p.compact,true);
  assert.ok(p.panelHeight<=175);
  assert.ok(p.slot.bottom-p.slot.top>=280);
});
test("Safari chrome reduced visual viewport is respected",()=>{
  const p=chooseTourPlacement({
    viewport:{top:42,bottom:602},headerBottom:165,navigationTop:557,
    target:{top:330,bottom:425},fullPanelHeight:300,compactPanelHeight:145
  });
  assert.ok(p.panelTop>=177);
  assert.ok(p.panelTop+p.panelHeight<=545);
});
test("fixed navigation targets are not scrolled",()=>{
  const p=chooseTourPlacement({viewport:{top:0,bottom:700},headerBottom:155,
    navigationTop:590,target:{top:590,bottom:660},fullPanelHeight:260,pinned:true});
  assert.equal(p.scrollBy,0);
  assert.equal(p.side,"top");
});
test("oversized block yields a non-overlapping visible slice",()=>{
  const p=chooseTourPlacement({viewport:{top:0,bottom:680},headerBottom:175,navigationTop:590,
    target:{top:250,bottom:890},fullPanelHeight:305,compactPanelHeight:140});
  const adjusted={top:250-p.scrollBy,bottom:890-p.scrollBy};
  const clipped=clipTourBounds(adjusted,p.slot);
  assert.ok(clipped);
  assert.ok(!tourRectsOverlap(clipped!,{top:p.panelTop,bottom:p.panelTop+p.panelHeight}));
  assert.equal(p.clipped,true);
});
