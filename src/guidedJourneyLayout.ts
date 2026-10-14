/**
 * Position a tour explanation and the element it describes in two disjoint
 * viewport slots. All coordinates use CSS viewport pixels (not document Y).
 * This deliberately takes the visual viewport, header and mobile navigation
 * as inputs so iOS Safari's variable browser chrome is accounted for.
 */
export type TourBounds = { top:number; bottom:number };
export type TourPlacement = {
  side:"top"|"bottom";
  compact:boolean;
  panelTop:number;
  panelHeight:number;
  slot:TourBounds;
  scrollBy:number;
  clipped:boolean;
  usable:TourBounds;
};
export type TourLayoutInput = {
  viewport:TourBounds;
  headerBottom:number;
  navigationTop:number | null;
  target:TourBounds;
  fullPanelHeight:number;
  compactPanelHeight?:number;
  gap?:number;
  margin?:number;
  pinned?:boolean;
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function chooseTourPlacement(input:TourLayoutInput):TourPlacement {
  const gap=input.gap??15;
  const margin=input.margin??12;
  const usableTop=Math.max(input.viewport.top+margin,input.headerBottom+margin);
  const usableBottom=Math.max(usableTop+120, Math.min(input.viewport.bottom-margin,
    input.navigationTop===null?input.viewport.bottom-margin:input.navigationTop-margin));
  const height=usableBottom-usableTop;
  const blockHeight=Math.max(0,input.target.bottom-input.target.top);
  const normalHeight=clamp(input.fullPanelHeight,110,Math.max(110,height*.68));
  const compactHeight=clamp(input.compactPanelHeight??195,125,Math.max(125,height*.48));
  // When there isn't room for both, reduce the explanation before cropping
  // the block. Longer explanations remain scrollable *inside* the panel.
  const compact=blockHeight+normalHeight+gap>height;
  const panelHeight=Math.min(height*.64,compact?compactHeight:normalHeight);
  const free=Math.max(0,height-panelHeight-gap);
  const bottomSlot={top:usableTop,bottom:Math.max(usableTop,usableBottom-panelHeight-gap)};
  const topSlot={top:Math.min(usableBottom,usableTop+panelHeight+gap),bottom:usableBottom};
  const desired=(slot:TourBounds):number=>{
    // Prefer some breathing space when the highlighted block is short.
    const slack=Math.max(0,slot.bottom-slot.top-Math.min(blockHeight,free));
    return slot.top+Math.min(18,slack*.26);
  };
  const candidates=[
    {side:"bottom" as const,slot:bottomSlot,panelTop:usableBottom-panelHeight},
    {side:"top" as const,slot:topSlot,panelTop:usableTop}
  ];
  const chosen=input.pinned
   ? candidates[1]
   : candidates.reduce((best,option)=>{
     const bestShift=Math.abs(input.target.top-desired(best.slot));
     const newShift=Math.abs(input.target.top-desired(option.slot));
     return newShift<bestShift?option:best;
   });
  const scrollBy=input.pinned?0:input.target.top-desired(chosen.slot);
  return {
    side:chosen.side,
    compact,
    panelTop:chosen.panelTop,
    panelHeight,
    slot:chosen.slot,
    scrollBy:Math.abs(scrollBy)<4?0:scrollBy,
    clipped:blockHeight>chosen.slot.bottom-chosen.slot.top,
    usable:{top:usableTop,bottom:usableBottom}
  };
}
export function clipTourBounds(bounds:TourBounds,slot:TourBounds):TourBounds|null {
  const top=Math.max(bounds.top,slot.top);
  const bottom=Math.min(bounds.bottom,slot.bottom);
  return bottom-top>=8?{top,bottom}:null;
}
export function tourRectsOverlap(a:TourBounds,b:TourBounds):boolean {
  return a.top < b.bottom && b.top < a.bottom;
}
