import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, Lightbulb, LockKeyhole, MousePointerClick, Pause, Play, X } from "lucide-react";
import { api } from "./api";
import type { State } from "./engine";
import { findVisibleTourTarget } from "./tutorialTargeting";
import { journeySteps, type JourneyStep } from "./GuidedJourneyContent";
import "./guided-journey.css";

type Rect={top:number;left:number;width:number;height:number;bottom:number;right:number};
type Geometry={focus:Rect|null;nav:Rect|null;found:boolean;w:number;h:number};
const emptyGeometry:Geometry={focus:null,nav:null,found:true,w:0,h:0};
function measure(el:HTMLElement|null,pad=5):Rect|null {
  if(!el)return null;
  const b=el.getBoundingClientRect();
  const w=window.innerWidth,h=window.innerHeight;
  if(b.width<8||b.height<8||b.bottom<0||b.top>h)return null;
  const left=Math.max(3,b.left-pad),top=Math.max(3,b.top-pad);
  const right=Math.min(w-3,b.right+pad),bottom=Math.min(h-3,b.bottom+pad);
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
  const [topPanel,setTopPanel]=useState(false);
  const targetRef=useRef<HTMLElement|null>(null);
  const scrollKey=useRef("");
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
    if(!working){targetRef.current=null;setGeometry(emptyGeometry);return;}
    let cancelled=false;
    let tries=0;
    let timeout=0;
    let frame=0;
    let resizeObserver:ResizeObserver|null=null;
    scrollKey.current="";
    const refresh=()=>{
      if(cancelled)return;
      const focus=measure(targetRef.current);
      const nav=measure(findVisibleTourTarget(navSelector(stage.nav)),4);
      setGeometry({focus,nav,found:!!targetRef.current,w:window.innerWidth,h:window.innerHeight});
      if(focus) setTopPanel(focus.top>window.innerHeight*.52);
    };
    const locate=()=>{
      if(cancelled)return;
      const element=findVisibleTourTarget(stage.target);
      const nav=findVisibleTourTarget(navSelector(stage.nav));
      if(!element&&tries++<9){timeout=window.setTimeout(locate,145);return;}
      targetRef.current=element;
      if(element){
        const key=stage.id;
        if(scrollKey.current!==key){
          scrollKey.current=key;
          const rect=element.getBoundingClientRect();
          const top=document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect().bottom??80;
          // Scroll the target into the visible area, clear of header and bottom navigation.
          if(rect.top<top+12||rect.bottom>window.innerHeight-120||
             rect.top>window.innerHeight*.65)element.scrollIntoView({block:"center",behavior:"instant"});
        }
        resizeObserver=new ResizeObserver(refresh);
        resizeObserver.observe(element);
      }
      if(nav)resizeObserver?.observe(nav);
      frame=window.requestAnimationFrame(refresh);
    };
    timeout=window.setTimeout(locate,110);
    window.addEventListener("resize",refresh);
    window.addEventListener("scroll",refresh,true);
    return()=>{
      cancelled=true;
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize",refresh);
      window.removeEventListener("scroll",refresh,true);
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
  const bottomNav=!!document.querySelector(".bottom-nav") && !!findVisibleTourTarget(".bottom-nav");
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
      <div className={`wimm-journey-flyout ${topPanel?"at-top":"at-bottom"} ${bottomNav?"has-mobile-nav":""}`}>
        <header>
          <span><Compass size={15}/> {stage.chapter.toUpperCase()} · {chapterAt}/{chapterSize}</span>
          <button type="button" onClick={()=>setPaused(true)} title="Mettre en pause" aria-label="Mettre en pause la visite"><Pause size={18}/></button>
        </header>
        <div className="wimm-journey-progress"><span style={{width:progress+"%"}}/></div>
        <div className="wimm-journey-flyout-title"><span>{index+1}/{total}</span><h2>{stage.title}</h2></div>
        <p>{stage.description}</p>
        <div className="wimm-journey-usage"><Lightbulb size={16}/><span>{stage.action}</span></div>
        {!geometry.found&&<small className="wimm-journey-conditional">Ce bloc n'est pas affiché avec les données actuelles. Il apparaîtra lorsque la fonctionnalité sera configurée.</small>}
        {(stage.id==="fixed-list"&&!fixedSet||stage.id==="wealth-savings"&&!wealthSet)&&
          <label className="wimm-journey-optional">
            <input type="checkbox" checked={defer} onChange={e=>setDefer(e.target.checked)}/>
            Je configurerai cette fonctionnalité plus tard.
          </label>}
        {stage.id==="budget-category-list"&&!budgetSet&&<small className="wimm-journey-conditional">Créez au moins un budget pour poursuivre. Utilisez « Essayer » pour intervenir sur la page.</small>}
        {!!error&&<p className="wimm-setup-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="wimm-journey-back" disabled={index===0||busy} onClick={()=>void setStep(index-1)}><ArrowLeft size={15}/> Retour</button>
          <button type="button" className="wimm-journey-try" onClick={()=>setPracticing(true)}><MousePointerClick size={15}/> Essayer</button>
          <button type="button" className="wimm-journey-next" disabled={busy||mustConfigure} onClick={()=>void setStep(index+1)}>
            {busy?"Enregistrement…":index===total-1?"Terminer":"Suivant"}
            {index===total-1?<Check size={15}/>:<ArrowRight size={15}/>}
          </button>
        </footer>
        <button type="button" className="wimm-journey-later" onClick={()=>setPaused(true)}><X size={13}/> Reprendre plus tard</button>
      </div>
    </div>
  );
  return createPortal(overlay,document.body);
}
