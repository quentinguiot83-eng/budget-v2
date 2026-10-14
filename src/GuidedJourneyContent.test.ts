import test from "node:test";
import assert from "node:assert/strict";
import { JOURNEY_BRIEF, JOURNEY_STEPS, journeySteps } from "./GuidedJourneyContent";

test("every explained block has a unique stable identity, text and ordered target",()=>{
  assert.ok(JOURNEY_STEPS.length>=50,"each page should explain its blocks, not just its title");
  assert.equal(new Set(JOURNEY_STEPS.map(x=>x.id)).size,JOURNEY_STEPS.length);
  for(const x of JOURNEY_STEPS){
    assert.ok(x.chapter&&x.title&&x.route&&x.nav&&x.action.length>25&&x.description.length>40&&x.target);
    assert.ok(/^[a-z-]+$/.test(x.id));
  }
});
test("chapters appear in strict sequence without reopening old chapters",()=>{
  const chapters=JOURNEY_STEPS.map(x=>x.chapter);
  const compressed=chapters.filter((x,i)=>i===0||chapters[i-1]!==x);
  assert.equal(new Set(compressed).size,compressed.length);
  assert.deepEqual(compressed,["Découverte","Accueil","Budget","Dépenses fixes","Patrimoine","Projets","Projections","Ajouter","Mode Pro","Réglages","Fin"]);
});
test("Pro explanation is conditional and last step remains completion",()=>{
  const pro=journeySteps(true);
  const standard=journeySteps(false);
  assert.ok(pro.some(x=>x.chapter==="Mode Pro"));
  assert.ok(standard.every(x=>x.chapter!=="Mode Pro"));
  assert.equal(standard.at(-1)?.id,"complete");
  assert.equal(pro.at(-1)?.id,"complete");
  assert.ok(pro.length>standard.length);
});
test("each main tab and required budget subpage is represented",()=>{
  const routes=new Set(JOURNEY_STEPS.map(x=>x.route));
  for(const name of ["home","budget","fixed","calendar","wealth","trips","projection","add","pro","settings"])
    assert.ok(routes.has(name),name);
  const navs=new Set(JOURNEY_STEPS.map(x=>x.nav));
  for(const tab of ["home","budget","wealth","trips","projection","add","pro","settings"])
    assert.ok(navs.has(tab),tab);
});

test("each of the 58 onboarding explanations is brief, helpful and non-redundant",()=>{
  for(const step of JOURNEY_STEPS){
    const copy=JOURNEY_BRIEF[step.id];
    assert.ok(copy,step.id+" has no short explanation");
    assert.ok(copy.length<=160,step.id+" is too long: "+copy.length);
    assert.ok(copy.length>=30,step.id+" is not explanatory enough");
    assert.ok(!/ce bloc est grand|partie visible|utilisez .essayer. pour le parcourir/i.test(copy));
  }
});
