import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, MousePointerClick, Pause, Play } from "lucide-react";
import { api } from "./api";
import type { State } from "./engine";
import { findVisibleTourTarget } from "./tutorialTargeting";
import { JOURNEY_BRIEF, journeySteps, type JourneyStep } from "./GuidedJourneyContent";
import { chooseTourPlacement, clipTourBounds, type TourPlacement } from "./guidedJourneyLayout";
import "./guided-journey.css";

type Rect={top:number;left:number;width:number;height:number;bottom:number;right:number};
type Geometry={focus:Rect|null;nav:Rect|null;found:boolean;w:number;h:number};
const emptyGeometry:Geometry={focus:null,nav:null,found:true,w:0,h:0};
function measure(el:HTMLElement|null,pad=5,slot?:{top:number;bottom:number}):Rect|null {
  if(!el)return null;
  const b=el.getBoundingClientRect();
  const w=window.innerWidth,h=window.innerHeight;
  if(b.width<8||b.height<8||b.bottom<0||b.top>h)return null;
  const left=Math.max(3,b.left-pad),top=Math.max(3,b.top-pad,slot?.top??3);
  const right=Math.min(w-3,b.right+pad),bottom=Math.min(h-3,b.bottom+pad,slot?.bottom??h-3);
  if(right<=left||bottom<=top)return null;
  return {left,top,right,bottom,width:right-left,height:bottom-top};
}
function navSelector(tab:string) {
  const requested = tab==="add"?"[data-tour='add-button'],.desktop-quick-add"
    :tab==="settings"?"[data-tour-route='settings'],.mobile-profile-trigger,.sidebar-bottom button"
    :tab==="pro"?"[data-tour-route='pro'],.wimm-pro-shortcut"
    :`[data-tour-route='${tab}']`;
  return requested;
}
function makeRect(rect:Rect|null) {
 if(!rect)return null;
 return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
}
const chapterCount=(steps:JourneyStep[],name:string)=>steps.filter(x=>x.chapter===name).length;
const chapterNumber=(steps:JourneyStep[],step:JourneyStep)=>steps.filter(x=>x.chapter===step.chapter).findIndex(x=>x.id===step.id)+1;

export default function GuidedJourney({
  route,navigate,state,enabled,proEnabled,completed,preview=false
}:{
  route:string;navigate:(route:string)=>void;state:State;enabled:boolean;proEnabled:boolean;
  completed:()=>void;preview?:boolean;
}){
  const steps=useMemo(()=>journeySteps(proEnabled),[proEnabled]);
  const [stepId,setStepId]=useState("welcome");
  const [loaded,setLoaded]=useState(false);
  const [finished,setFinished]=useState(false);
  const [paused,setPaused]=useState(false);
  const [practicing,setPracticing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [defer,setDefer]=useState(false);
  const [geometry,setGeometry]=useState<Geometry>(emptyGeometry);
  const [placement,setPlacement]=useState<TourPlacement|null>(null);
  const panelRef=useRef<HTMLDivElement|null>(null);
  const fullHeightRef=useRef(230);
  const sideRef=useRef<"top"|"bottom"|null>(null);
  const targetRef=useRef<HTMLElement|null>(null);

  const index=Math.max(0,steps.findIndex(step=>step.id===stepId));
  const stage=steps[index];
  const located=route===stage.route;
  const total=steps.length;
  const chapterAt=chapterNumber(steps,stage);
  const chapterSize=chapterCount(steps,stage.chapter);
  const active=enabled&&loaded&&!finished;
  const working=active&&!paused&&!practicing&&located;
  const budgetSet=state.categories.some(c=>Object.values(c.budgets).some(v=>v>0));
  const fixedSet=state.rules.some(r=>r.kind==="fixed");
  const wealthSet=state.accounts.some(a=>a.group!=="current"&&!a.archived&&a.allocation>0);
  const mustConfigure=(stage.id==="budget-category-list"&&!budgetSet)
    ||(stage.id==="fixed-list"&&!fixedSet&&!defer)
    ||(stage.id==="wealth-savings"&&!wealthSet&&!defer);
  const progress=(index+1)/Math.max(1,total)*100;

  useEffect(()=>{
    if(!enabled)return;
    if(preview){setLoaded(true);return;}
    let mounted=true;
    api.auth.getUser().then(({data})=>{
      if(!mounted)return;
      const saved=data.user?.user_metadata?.wimm_journey_step;
      let found=steps.find(s=>s.id===saved);
      // Migrate the previous one-step-per-chapter guide without losing progress.
      if(!found&&typeof saved==="string"){
        const old:Record<string,string>={
          budget:"budget-total",fixed:"fixed-summary",wealth:"wealth-overview",
          trips:"trips-selector",projection:"projection-horizon",add:"add-button",
          pro:"pro-overview",settings:"settings-profile",menu:"menu"
        };
        found=steps.find(s=>s.id===old[saved]);
      }
      setStepId(found?.id??"welcome");
      setLoaded(true);
    }).catch(()=>{if(mounted)setLoaded(true);});
    return()=>{mounted=false;};
  },[enabled,preview,steps]);

  useEffect(()=>{
    if(!active||paused||practicing)return;
    if(!located)navigate(stage.route);
  },[active,paused,practicing,located,stage.route,navigate]);

  useEffect(()=>{
    if(!working)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();setPaused(true);}};
    document.addEventListener("keydown",escape);
    return()=>document.removeEventListener("keydown",escape);
  },[working]);

  useLayoutEffect(()=>{
    if(!working){targetRef.current=null;setGeometry(emptyGeometry);setPlacement(null);return;}
    let cancelled=false, attempts=0, timeout=0,frame=0;
    let observer:ResizeObserver|null=null;
    // Read the natural content size, then place it without crushing the text.
    if(panelRef.current)panelRef.current.scrollTop=0;
    fullHeightRef.current=Math.max(175,panelRef.current?.scrollHeight??230);
    sideRef.current=null;
    setPlacement(null);setGeometry(emptyGeometry);
    const scrollIntoSlot=(delta:number,element:HTMLElement)=>{
      const before=window.scrollY;
      window.scrollBy({top:delta,behavior:"instant"});
      if(Math.abs(window.scrollY-before)<2){
        let parent=element.parentElement;
        while(parent){
          const style=getComputedStyle(parent);
          if(parent.scrollHeight>parent.clientHeight+3&&/auto|scroll/.test(style.overflowY)){
            parent.scrollTop+=delta;break;
          }
          parent=parent.parentElement;
        }
      }
    };
    const refresh=()=>{
      if(cancelled)return;
      const element=targetRef.current;
      const vv=window.visualViewport;
      const vt=vv?.offsetTop??0,vb=vt+(vv?.height??window.innerHeight);
      const navBar=findVisibleTourTarget(".bottom-nav");
      const navTarget=findVisibleTourTarget(navSelector(stage.nav));
      const b=element?.getBoundingClientRect();
      const pinned=stage.id==="menu"||
        !!element?.closest(".bottom-nav,.desktop-sidebar-nav,.floating-add-button,.desktop-quick-add");
      const plan=chooseTourPlacement({
        viewport:{top:vt,bottom:vb},
        headerBottom:document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect().bottom??vt,
        navigationTop:navBar?.getBoundingClientRect().top??null,
        target:b?{top:b.top,bottom:b.bottom}:{top:vt+85,bottom:vt+130},
        fullPanelHeight:fullHeightRef.current,
        compactPanelHeight:Math.min(236,Math.max(182,(vb-vt)*.34)),
        pinned,preferredSide:sideRef.current??undefined
      });
      sideRef.current??=plan.side;
      setPlacement(prev=>prev&&prev.side===plan.side&&prev.compact===plan.compact&&
        Math.abs(prev.panelTop-plan.panelTop)<1&&Math.abs(prev.panelHeight-plan.panelHeight)<1&&
        Math.abs(prev.slot.top-plan.slot.top)<1&&Math.abs(prev.slot.bottom-plan.slot.bottom)<1
        ?prev:plan);
      if(element&&!pinned&&Math.abs(plan.scrollBy)>8&&attempts<3){
        attempts++;scrollIntoSlot(plan.scrollBy,element);
        timeout=window.setTimeout(refresh,85);return;
      }
      const bounds=element?.getBoundingClientRect();
      const area=pinned?{top:vt,bottom:vb}:plan.slot;
      const clip=bounds?clipTourBounds({top:bounds.top-5,bottom:bounds.bottom+5},area):null;
      const focus=clip&&element?measure(element,5,clip):null;
      const nav=measure(navTarget,4,{top:vt,bottom:vb});
      const next:Geometry={focus,nav,found:!!element,w:window.innerWidth,h:window.innerHeight};
      setGeometry(prev=>{
        const same=(a:Rect|null,b:Rect|null)=>a===b||!!a&&!!b&&
          Math.abs(a.top-b.top)<.8&&Math.abs(a.left-b.left)<.8&&
          Math.abs(a.width-b.width)<.8&&Math.abs(a.height-b.height)<.8;
        return prev.found===next.found&&prev.w===next.w&&prev.h===next.h&&
          same(prev.focus,next.focus)&&same(prev.nav,next.nav)?prev:next;
      });
    };
    const locate=()=>{
      if(cancelled)return;
      const element=findVisibleTourTarget(stage.target);
      if(!element&&attempts++<11){timeout=window.setTimeout(locate,140);return;}
      attempts=0;targetRef.current=element;
      observer=new ResizeObserver(()=>{window.cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);});
      if(element)observer.observe(element);
      const nav=findVisibleTourTarget(navSelector(stage.nav));
      if(nav)observer.observe(nav);
      if(panelRef.current)observer.observe(panelRef.current);
      frame=requestAnimationFrame(refresh);
    };
    timeout=window.setTimeout(locate,105);
    window.addEventListener("resize",refresh);
    window.addEventListener("scroll",refresh,true);
    window.visualViewport?.addEventListener("resize",refresh);
    window.visualViewport?.addEventListener("scroll",refresh);
    return()=>{
      cancelled=true;clearTimeout(timeout);cancelAnimationFrame(frame);observer?.disconnect();
      window.removeEventListener("resize",refresh);
      window.removeEventListener("scroll",refresh,true);
      window.visualViewport?.removeEventListener("resize",refresh);
      window.visualViewport?.removeEventListener("scroll",refresh);
      targetRef.current=null;
    };
  },[working,stage.id,stage.target,stage.nav,route]);

  async function setStep(next:number){
    if(busy)return;
    const idx=Math.min(total-1,Math.max(0,next));
    if(idx===index&&next<total)return;
    setBusy(true);setError("");
    try{
      if(next>=total){
        if(!preview){
          const {error}=await api.auth.updateUser({data:{wimm_journey_done:true,wimm_journey_step:"done"}});
          if(error)throw error;
        }
        setFinished(true);completed();return;
      }
      const candidate=steps[idx];
      if(!preview){
        const {error}=await api.auth.updateUser({data:{wimm_journey_step:candidate.id}});
        if(error)throw error;
      }
      setStepId(candidate.id);
      setDefer(false);setPracticing(false);setPaused(false);
      if(route!==candidate.route)navigate(candidate.route);
    }catch(e){setError(e instanceof Error?e.message:"Impossible d'enregistrer votre progression.");}
    finally{setBusy(false);}
  }
  if(!active)return null;
  if(paused||practicing||!located){
    return <div className="wimm-journey-docked" role="status">
      <span><Compass size={17}/> Découverte Wimm · {index+1}/{total}</span>
      <strong>{stage.title}</strong>
      <button type="button" onClick={()=>{
        setPaused(false);setPracticing(false);
        if(route!==stage.route)navigate(stage.route);
      }}><Play size={15}/> Reprendre</button>
      {practicing&&<button type="button" onClick={()=>void setStep(index+1)}>J'ai compris <ArrowRight size={15}/></button>}
    </div>;
  }
  const nav=geometry.nav,focus=geometry.focus;

  const overlay=(
    <div className="wimm-journey-overlay" role="dialog" aria-modal="true" aria-label="Découverte guidée Wimm">
      <div className="wimm-journey-blocker" aria-hidden="true"/>
      <svg className="wimm-journey-scrim" viewBox={`0 0 ${geometry.w||window.innerWidth} ${geometry.h||window.innerHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <mask id="wimm-journey-window">
            <rect x="0" y="0" width="100%" height="100%" fill="white"/>
            {focus&&<rect x={focus.left} y={focus.top} width={focus.width} height={focus.height} rx="13" fill="black"/>}
            {nav&&<rect x={nav.left} y={nav.top} width={nav.width} height={nav.height} rx="10" fill="black"/>}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(13,17,30,.70)" mask="url(#wimm-journey-window)"/>
      </svg>
      {focus&&<div className="wimm-journey-ring" style={makeRect(focus)??undefined} aria-hidden="true"/>}
      {nav&&<div className="wimm-journey-ring wimm-journey-ring-nav" style={makeRect(nav)??undefined} aria-hidden="true"/>}
      <div ref={panelRef} className={"wimm-journey-flyout auto-placed"+(placement?.compact?" compact":"")+(placement?" ready":"")}
        style={placement?{top:placement.panelTop,maxHeight:placement.panelHeight}:undefined}>
        <header>
          <span>{stage.chapter} · {chapterAt}/{chapterSize}</span>
          <button type="button" onClick={()=>setPaused(true)} title="Reprendre plus tard" aria-label="Mettre en pause le tutoriel"><Pause size={17}/></button>
        </header>
        <div className="wimm-journey-progress"><span style={{width:progress+"%"}}/></div>
        <div className="wimm-journey-flyout-title"><h2>{stage.title}</h2><span>{index+1}/{total}</span></div>
        <p>{JOURNEY_BRIEF[stage.id]??stage.description}</p>
        {!geometry.found&&<small className="wimm-journey-conditional">Ce bloc apparaîtra une fois configuré.</small>}
        {(stage.id==="fixed-list"&&!fixedSet||stage.id==="wealth-savings"&&!wealthSet)&&
          <label className="wimm-journey-optional">
            <input type="checkbox" checked={defer} onChange={e=>setDefer(e.target.checked)}/>
            Je le configurerai plus tard.
          </label>}
        {stage.id==="budget-category-list"&&!budgetSet&&<small className="wimm-journey-conditional">Créez une enveloppe pour continuer.</small>}
        {!!error&&<p className="wimm-setup-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="wimm-journey-back" disabled={index===0||busy} onClick={()=>void setStep(index-1)}><ArrowLeft size={16}/><span>Retour</span></button>
          <button type="button" className="wimm-journey-try" onClick={()=>setPracticing(true)}><MousePointerClick size={15}/> Essayer</button>
          <button type="button" className="wimm-journey-next" disabled={busy||mustConfigure} onClick={()=>void setStep(index+1)}>
            {busy?"Patientez…":index===total-1?"Terminer":"Suivant"}
            {index===total-1?<Check size={16}/>:<ArrowRight size={16}/>}
          </button>
        </footer>
      </div>
    </div>
  );
  return createPortal(overlay,document.body);
}
