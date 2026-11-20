// The displayed marker and GPU use image space: image height = 2 world units.
export function imageFrame(width,height,aspect){const w=Math.min(width,height*aspect);return {w,h:w/aspect};}
export function worldToStage(x,y,width,height,aspect){const frame=imageFrame(width,height,aspect);return {x:width/2+x/(2*aspect)*frame.w,y:height/2-y/2*frame.h};}
export function stageDeltaToWorld(dx,dy,width,height,aspect){const frame=imageFrame(width,height,aspect);return {x:dx/frame.w*2*aspect,y:-dy/frame.h*2};}
export function lightFootprint(distance,radius){const t=Math.max(0,Math.min(1,(distance-radius*.35)/(radius*.65)));return 1-t*t*(3-2*t);}
// A finite, soft footprint. Height changes incidence/falloff, never its radius.
export const footprintGLSL=`float lightFootprint(vec2 offset,float radius){return 1.-smoothstep(radius*.35,radius,length(offset));}`;
