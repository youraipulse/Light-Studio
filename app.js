import {exportNativePNG} from './export-image.js';
import {imageFrame,worldToStage,stageDeltaToWorld,footprintGLSL} from './lighting-math.js';
// Depth gradients and height-field shadow tracing adapted from Dominik Fojcik's
// codrops-relightning-images (MIT declared in its README). See THIRD-PARTY-NOTICES.md.
// Multi-light rig, WebGL2 port, spatial view and editor are local prototype work.
const startupPreset=await (await fetch('./presets/amir-studio.json')).json();
const $=s=>document.querySelector(s), canvas=$('#render'),stage=$('#stage');
const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true,alpha:false});
if(!gl){$('#status').textContent='This browser needs WebGL 2 to render the image.';throw Error('WebGL2 unavailable');}
const vertex=`#version 300 es
in vec2 position;out vec2 screenUV;void main(){screenUV=position*.5+.5;gl_Position=vec4(position,0,1);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 screenUV;out vec4 frag;uniform vec2 imageFit;uniform vec4 uvRegion;
uniform sampler2D photo;uniform sampler2D depth;uniform sampler2D subjectMask;
uniform vec2 texel;uniform float aspect;uniform float relief;uniform float ambient;uniform int finish;uniform bool invertDepth;uniform bool original;
uniform vec3 lights[6];uniform vec3 colors[6];uniform float power[6];uniform float softness[6];uniform float spread[6];uniform int count;
float heightAt(vec2 p){float h=texture(depth,clamp(p,vec2(0),vec2(1))).r;return invertDepth?1.-h:h;}
vec3 linearize(vec3 c){return pow(c,vec3(2.2));}
${footprintGLSL}
void main(){vec2 uv=(mix(uvRegion.xy,uvRegion.zw,screenUV)-.5)/imageFit+.5;bool inside=all(greaterThanEqual(uv,vec2(0)))&&all(lessThanEqual(uv,vec2(1)));vec3 src=inside?texture(photo,uv).rgb:vec3(0);if(original){frag=vec4(src,1);return;}
float mask=inside?texture(subjectMask,uv).r:0.;float h=heightAt(uv);vec2 e=max(texel*3.,vec2(.002));
vec2 xp=uv+vec2(e.x,0),xm=uv-vec2(e.x,0),yp=uv+vec2(0,e.y),ym=uv-vec2(0,e.y);
// Estimate slopes only from samples on the same visible surface. Background
// colour/depth discontinuities are not geometry and must never become a bevel.
vec3 centerColor=texture(photo,uv).rgb;
vec3 cx1=texture(photo,xp).rgb-centerColor,cx0=texture(photo,xm).rgb-centerColor;
vec3 cy1=texture(photo,yp).rgb-centerColor,cy0=texture(photo,ym).rgb-centerColor;
float vx1=heightAt(xp)-h,vx0=h-heightAt(xm),vy1=heightAt(yp)-h,vy0=h-heightAt(ym);
float wx1=exp(-dot(cx1,cx1)/.025)*(1.-smoothstep(.025,.1,abs(vx1)));
float wx0=exp(-dot(cx0,cx0)/.025)*(1.-smoothstep(.025,.1,abs(vx0)));
float wy1=exp(-dot(cy1,cy1)/.025)*(1.-smoothstep(.025,.1,abs(vy1)));
float wy0=exp(-dot(cy0,cy0)/.025)*(1.-smoothstep(.025,.1,abs(vy0)));
float dx=(vx1*wx1+vx0*wx0)/max(wx1+wx0,.001)/(e.x*2.*aspect);
float dy=(vy1*wy1+vy0*wy0)/max(wy1+wy0,.001)/(e.y*2.);
float interior=inside?texture(subjectMask,uv).g:0.;vec2 slope=vec2(dx,dy)*relief*interior;slope/=1.+length(slope)*.65;vec3 n=normalize(vec3(-slope,1));
vec3 p=vec3((uv*2.-1.)*vec2(aspect,1),(h-.5)*relief);
vec3 albedo=linearize(src);if(finish==1)albedo=vec3(.63);if(finish==2)albedo=vec3(.035);
vec3 sum=albedo*ambient*interior;
for(int i=0;i<6;i++){if(i>=count)break;vec3 delta=lights[i]-p;float dist=length(delta);vec3 l=delta/max(dist,.001);float occ=0.;
if(lights[i].z>=0. && relief>.001){for(int j=1;j<=16;j++){float t=float(j)/16.;vec3 q=p+delta*t;vec2 quv=q.xy/vec2(aspect,1)*.5+.5;if(any(lessThan(quv,vec2(.002)))||any(greaterThan(quv,vec2(.998))))break;if(texture(subjectMask,quv).r<.95)continue;float blocker=(heightAt(quv)-.5)*relief;float o=clamp((blocker-q.z-.008)/(softness[i]*.12+.008),0.,1.);occ=max(occ,o);}}
float diffuse=max(dot(n,l),0.);float highlight=pow(max(dot(n,normalize(l+vec3(0,0,1))),0.),mix(75.,8.,softness[i]));
bool backgroundLight=lights[i].z<0.;if(backgroundLight){diffuse=1.;highlight=0.;occ=0.;}
float pool=lightFootprint(delta.xy,spread[i]);float attenuation=1.65*pool/(.65+dist*dist*.65);vec3 radiance=linearize(colors[i])*power[i]*attenuation;
if(backgroundLight){sum+=vec3(.035)*radiance*(1.-mask);}else{sum+=(albedo*diffuse+vec3(highlight*(finish==0?0.:finish==2?.5:.08)))*radiance*(1.-occ*.55*interior);}
}vec3 mapped=finish==0?min(sum,vec3(1)):vec3(1)-exp(-sum*1.25);frag=vec4(pow(max(mapped,vec3(0)),vec3(1./2.2)),1);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
const loc=n=>gl.getUniformLocation(program,n);const uniforms={};for(const n of ['photo','depth','subjectMask','imageFit','uvRegion','texel','aspect','relief','ambient','finish','invertDepth','original','lights[0]','colors[0]','power[0]','softness[0]','spread[0]','count'])uniforms[n]=loc(n);
const floatFiltering=gl.getExtension('OES_texture_float_linear');
let depthSize=[1,1];
let subjectMatte=null,maskTexture=null,photoTexture=null,depthTexture=null,image=null,depthImage=null,imageVersion=0,selected=1,nextId=4,view='image',handlesVisible=true,original=false,dirty=true,model=null,estimating=false;
let exporting=false;
let currentDepthKind='empty',currentSample=null,queuedDepth=false;
let state={relief:1,ambient:.35,finish:0,invert:false,lights:[]};
const light=(id,name,x,y,z,color,intensity=2,softness=.5)=>({id,name,x,y,z,color,intensity,softness:1,spread:1.15,enabled:true});
const rigs={soft:()=>[light(1,'Key light',-.55,.45,.85,'#fff8ef',1.8,.75),light(2,'Fill light',.8,.25,1.2,'#f0f4ff',.35,.95)],sculpt:()=>[light(1,'Key light',-1,.55,.65,'#fff0d5',3.1,.25),light(2,'Fill light',.9,-.25,1.5,'#dfe9ff',.45,.65),light(3,'Backdrop light',.7,.8,-.6,'#fff5e6',3.5,.3)],split:()=>[light(1,'Warm light',-1,.3,1,'#ff755c',3.4,.5),light(2,'Cool light',1,.4,.8,'#738cff',3.8,.5),light(3,'Backdrop light',.3,-.8,-.5,'#c6d7ff',3,.5)],rim:()=>[light(1,'Key light',-.8,.4,.5,'#ededdd',.7,.2),light(2,'Backdrop light',.9,.7,-.5,'#9bbcff',5,.3),light(3,'Low light',-.4,-1,.3,'#ffb782',1.6,.3)]};
rigs.rembrandt=()=>[light(1,'Key light',-.9,.85,.75,'#fff4e5',2.1),light(2,'Fill light',.8,.2,1.3,'#eaf0ff',.25)];
rigs.butterfly=()=>[light(1,'Beauty light',0,.85,1.05,'#fff9f2',2),light(2,'Bounce light',0,-.7,1.5,'#ffffff',.35)];
rigs.threepoint=()=>[light(1,'Key light',-.8,.6,.9,'#fff5e8',1.9),light(2,'Fill light',.85,.2,1.25,'#edf2ff',.45),light(3,'Backdrop light',.7,.65,-.5,'#dce8ff',2.5)];
rigs.amir=()=>structuredClone(startupPreset.lights);
function setRig(name){state.lights=rigs[name]();for(const b of document.querySelectorAll('[data-look]'))b.classList.toggle('active',b.dataset.look===name);selected=name==='amir'?startupPreset.selected:1;nextId=Math.max(0,...state.lights.map(l=>l.id))+1;state.ambient=name==='amir'?startupPreset.ambient:name==='rim'?.025:name==='soft'?.16:.08;if(name==='amir'){state.relief=startupPreset.relief;state.finish=startupPreset.finish;state.invert=startupPreset.invert;}syncSurface();renderEditor();dirty=true;}
function createSubjectMask(source){
 const c=document.createElement('canvas');c.width=Math.min(1024,source.width);c.height=Math.max(1,Math.round(c.width*source.height/source.width));const ctx=c.getContext('2d');ctx.drawImage(source,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,d=pixels.data;
 const dark=i=>Math.max(d[i*4],d[i*4+1],d[i*4+2])<16;
 let border=0,total=0;for(let x=0;x<w;x++){border+=dark(x)+dark((h-1)*w+x);total+=2;}for(let y=0;y<h;y++){border+=dark(y*w)+dark(y*w+w-1);total+=2;}
 const background=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const add=i=>{if(!background[i]&&dark(i)){background[i]=1;queue[tail++]=i;}};
 if(border/total>.8){for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w);}}
 const distance=new Float32Array(w*h);for(let i=0;i<w*h;i++)distance[i]=background[i]?0:10000;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y)distance[i]=Math.min(distance[i],distance[i-w]+1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x<w-1)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y<h-1)distance[i]=Math.min(distance[i],distance[i+w]+1);}
 const coverage=new Float32Array(w*h);for(let i=0;i<w*h;i++)coverage[i]=background[i]?0:1;
 // Subpixel-scale convolution gives a continuous backdrop matte without a
 // brightness-dependent hard ring. It never modifies the source image RGB.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,weight=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){const wt=(xx===0?2:1)*(yy===0?2:1);sum+=coverage[Math.max(0,Math.min(h-1,y+yy))*w+Math.max(0,Math.min(w-1,x+xx))]*wt;weight+=wt;}const i=y*w+x,v=Math.round(sum/weight*255);d[i*4]=v;const t=Math.max(0,Math.min(1,(distance[i]-1)/8));d[i*4+1]=Math.round(t*t*(3-2*t)*255);d[i*4+2]=v;d[i*4+3]=255;}ctx.putImageData(pixels,0,0);return c;
}
function texture(source,old,unit){if(unit===0){subjectMatte=createSubjectMask(source);maskTexture=texture(subjectMatte,maskTexture,2);}if(old)gl.deleteTexture(old);const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
if(unit===1 && floatFiltering){
 const c=document.createElement('canvas');c.width=Math.min(1024,source.width);c.height=Math.max(1,Math.round(c.width*source.height/source.width));const ctx=c.getContext('2d');ctx.drawImage(source,0,0,c.width,c.height);const bytes=ctx.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;let values=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)values[y*w+x]=bytes[((h-1-y)*w+x)*4]/255;
 // Extend subject depth through the empty backdrop before computing normals.
 // The mask handles compositing; the invisible depth continuation prevents a
 // silhouette height cliff from turning into an illuminated bevel.
 if(subjectMatte){const mc=document.createElement('canvas');mc.width=w;mc.height=h;const mx=mc.getContext('2d');mx.drawImage(subjectMatte,0,0,w,h);const md=mx.getImageData(0,0,w,h).data,known=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(md[((h-1-y)*w+x)*4]>250){known[i]=1;q[tail++]=i;}}while(head<tail){const i=q[head++],x=i%w;const offer=j=>{if(!known[j]){known[j]=1;values[j]=values[i];q[tail++]=j;}};if(x)offer(i-1);if(x<w-1)offer(i+1);if(i>=w)offer(i-w);if(i<w*(h-1))offer(i+w);}}
 // Bilateral filtering keeps the sculptural detail without background cliffs.
 for(let pass=0;pass<2;pass++){for(const axis of [0,1]){const out=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,center=values[i];let sum=0,weight=0;for(let k=-4;k<=4;k++){const xx=Math.max(0,Math.min(w-1,x+(axis===0?k:0))),yy=Math.max(0,Math.min(h-1,y+(axis===1?k:0)));const v=values[yy*w+xx],diff=v-center;const wt=Math.exp(-k*k/12-diff*diff/.0016);sum+=v*wt;weight+=wt;}out[i]=sum/weight;}values=out;}}
 const pixels=new Float32Array(w*h*4);for(let i=0;i<values.length;i++){pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=values[i];pixels[i*4+3]=1;}gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,pixels);depthSize=[w,h];
}else{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);if(unit===1)depthSize=[source.width,source.height];} gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('The image could not be decoded. Try a PNG, JPG or WebP.'));im.src=src;});}
function depthLabel(kind){currentDepthKind=kind;syncEmptyState();stage.classList.toggle('processing',kind==='relief');renderHandles();$('#depthBadge').textContent={empty:'',prepared:'Depth map included',imported:'Custom depth map',relief:'Original · preparing depth',estimated:'Estimated scene depth'}[kind];$('#depthInfo').textContent={empty:'Upload an image to begin.',prepared:'This sample includes a prepared depth map.',imported:'Your depth map controls the surface. White is near; black is far.',relief:'Your original image stays unchanged until a real depth map is ready.',estimated:'Depth estimated locally from your image. It remains an approximation.'}[kind];}
function resize(){if(!image||exporting)return;const maxW=stage.clientWidth,maxH=stage.clientHeight;const a=image.width/image.height;let w=maxW,h=maxH;canvas.style.width=w+'px';canvas.style.height=h+'px';const ratio=Math.min(devicePixelRatio,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);dirty=true;}
function status(s){$('#status').textContent=s;}
function syncEmptyState(){stage.classList.toggle('empty',!image);for(const id of ['export','imageView','spaceView','compare','showHandles'])$('#'+id).disabled=!image;}

function neutralDepth(){const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,1,1);return c;}
async function upload(file,isDepth=false){if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){status('Choose a PNG, JPG or WebP image.');return;}const url=URL.createObjectURL(file);let version=imageVersion;if(!isDepth)version=++imageVersion;try{const im=await loadImage(url);if(version!==imageVersion)return;const maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);if(im.width>maxTexture||im.height>maxTexture)throw Error('This device supports images up to '+maxTexture+' px per side. The image was not resized.');if(isDepth){if(!image)return;const a=im.width/im.height,b=image.width/image.height;if(Math.abs(a/b-1)>.03){status('Depth map proportions must match your image.');return;}depthImage=im;depthTexture=texture(im,depthTexture,1);depthLabel('imported');status('Depth map applied. Drag a light to explore the surface.');}else{image=im;currentSample=null;photoTexture=texture(im,photoTexture,0);depthImage=neutralDepth();depthTexture=texture(depthImage,depthTexture,1);depthLabel('relief');setRig('amir');state.relief=1;state.finish=0;state.invert=false;$('#finish').value='0';$('#invert').checked=false;syncSurface();$('#filename').textContent=file.name;status('Image loaded. Preparing scene depth on your device…');resize();window.dispatchEvent(new Event('lightstudio:image-loaded'));estimateDepth();}dirty=true;}catch(e){status(e.message);}finally{URL.revokeObjectURL(url);}}
function colorRGB(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function draw(options={}){if(!image||!depthTexture)return;gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,photoTexture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,depthTexture);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,maskTexture);const u=uniforms;gl.uniform1i(u.photo,0);gl.uniform1i(u.depth,1);gl.uniform1i(u.subjectMask,2);const imageAspect=image.width/image.height,renderAspect=canvas.width/canvas.height;gl.uniform2f(u.imageFit,options.region?1:Math.min(1,imageAspect/renderAspect),options.region?1:Math.min(1,renderAspect/imageAspect));gl.uniform4fv(u.uvRegion,options.region||[0,0,1,1]);gl.uniform2f(u.texel,1/depthSize[0],1/depthSize[1]);gl.uniform1f(u.aspect,image.width/image.height);gl.uniform1f(u.relief,state.relief);gl.uniform1f(u.ambient,state.ambient);gl.uniform1i(u.finish,state.finish);gl.uniform1i(u.invertDepth,state.invert);gl.uniform1i(u.original,original||currentDepthKind==='relief');const active=state.lights.filter(l=>l.enabled);gl.uniform1i(u.count,active.length);const pos=new Float32Array(18),colors=new Float32Array(18),power=new Float32Array(6),soft=new Float32Array(6),spread=new Float32Array(6);active.forEach((l,i)=>{pos.set([l.x,l.y,l.z],i*3);colors.set(colorRGB(l.color),i*3);power[i]=l.intensity;soft[i]=l.softness;spread[i]=l.spread;});gl.uniform3fv(u['lights[0]'],pos);gl.uniform3fv(u['colors[0]'],colors);gl.uniform1fv(u['power[0]'],power);gl.uniform1fv(u['softness[0]'],soft);gl.uniform1fv(u['spread[0]'],spread);gl.drawArrays(gl.TRIANGLES,0,6);}
function current(){return state.lights.find(l=>l.id===selected);}
function slider(id,label,min,max,step,value,unit=''){return `<label>${label}<output id="${id}Value">${Number(value).toFixed(2)}${unit}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;}
function renderEditor(){const list=$('#lightList');list.replaceChildren();for(const l of state.lights){const row=document.createElement('div');row.className='light-row'+(l.id===selected?' active':'');row.innerHTML=`<i class="dot" style="background:${l.color}"></i><strong>${l.name}</strong><span>${l.z<0?'Back':'Front'}</span>`;const toggle=document.createElement('button');toggle.textContent=l.enabled?'◉':'○';toggle.setAttribute('aria-label',(l.enabled?'Disable ':'Enable ')+l.name);toggle.onclick=e=>{e.stopPropagation();l.enabled=!l.enabled;renderEditor();dirty=true;};row.append(toggle);row.onclick=()=>{selected=l.id;renderEditor();};list.append(row);}
const l=current();if(!l){$('#lightEditor').replaceChildren();renderHandles();return;}$('#lightEditor').innerHTML=`<div class="editor-title"><span>${l.name}</span><input id="color" aria-label="Light color" type="color" value="${l.color}"></div>${slider('intensity','Intensity',0,7,.05,l.intensity)}${slider('height','Height · back ↔ front',-2,3,.02,l.z)}${slider('spread','Light spread',.25,3,.05,l.spread)}<button id="deleteLight" class="delete">Remove light</button>`;
$('#color').oninput=e=>{l.color=e.target.value;const row=list.children[state.lights.indexOf(l)];row.querySelector('.dot').style.background=l.color;renderHandles();dirty=true;};for(const [id,key] of [['intensity','intensity'],['height','z'],['spread','spread']])$('#'+id).oninput=e=>{l[key]=+e.target.value;$('#'+id+'Value').textContent=l[key].toFixed(2);if(key==='z'){list.children[state.lights.indexOf(l)].querySelector('span').textContent=l.z<0?'Back':'Front';}renderHandles();dirty=true;};$('#deleteLight').onclick=()=>{state.lights=state.lights.filter(x=>x.id!==l.id);selected=state.lights[0]?.id;renderEditor();dirty=true;};$('#addLight').disabled=state.lights.length>=6;renderHandles();}
function imageDisplaySize(){return imageFrame(stage.clientWidth,stage.clientHeight,image?image.width/image.height:1);}
function projected(l){if(view==='space'){return {x:stage.clientWidth*.5+l.x*stage.clientWidth*.17-l.z*stage.clientWidth*.09,y:stage.clientHeight*.48-l.y*stage.clientHeight*.23-l.z*stage.clientHeight*.12};}return worldToStage(l.x,l.y,stage.clientWidth,stage.clientHeight,image?image.width/image.height:1);}
function renderHandles(){const parent=$('#handles');parent.replaceChildren();if(!image||!handlesVisible||currentDepthKind==='relief')return;for(const l of state.lights){if(!l.enabled)continue;const p=projected(l);const b=document.createElement('button');b.className='handle'+(selected===l.id?' selected':'')+(l.z<0?' back':'');b.textContent=String(state.lights.indexOf(l)+1);b.style.setProperty('--light',l.color);b.style.left=Math.max(24,Math.min(stage.clientWidth-24,p.x))+'px';b.style.top=Math.max(24,Math.min(stage.clientHeight-55,p.y))+'px';b.title=l.name+' · '+(l.z<0?'Back':'Front');b.setAttribute('aria-label','Move '+l.name);b.onpointerdown=e=>{e.preventDefault();selected=l.id;const start={x:e.clientX,y:e.clientY,lx:l.x,ly:l.y};b.setPointerCapture(e.pointerId);b.classList.add('selected');b.onpointermove=ev=>{const dx=ev.clientX-start.x,dy=ev.clientY-start.y;if(view==='space'){l.x=start.lx+dx/(stage.clientWidth*.17);l.y=start.ly-dy/(stage.clientHeight*.23);}else{const delta=stageDeltaToWorld(dx,dy,stage.clientWidth,stage.clientHeight,image.width/image.height);l.x=start.lx+delta.x;l.y=start.ly+delta.y;}l.x=Math.max(-3,Math.min(3,l.x));l.y=Math.max(-2,Math.min(2,l.y));const point=projected(l);b.style.left=Math.max(24,Math.min(stage.clientWidth-24,point.x))+'px';b.style.top=Math.max(24,Math.min(stage.clientHeight-55,point.y))+'px';dirty=true;};b.onpointerup=b.onpointercancel=()=>{b.onpointermove=null;renderEditor();};};b.onkeydown=e=>{let moved=true;if(e.key==='ArrowLeft')l.x-=.05;else if(e.key==='ArrowRight')l.x+=.05;else if(e.key==='ArrowUp')l.y+=.05;else if(e.key==='ArrowDown')l.y-=.05;else moved=false;if(moved){e.preventDefault();renderHandles();dirty=true;}};parent.append(b);}}
function spaceDraw(){const c=$('#space'),w=stage.clientWidth,h=stage.clientHeight;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;const ctx=c.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);const map=(x,y,z)=>({x:w*.5+x*w*.17-z*w*.09,y:h*.48-y*h*.23-z*h*.12});const a=Math.min(image?.width/image?.height||1,1.7);const corners=[map(-a,1,0),map(a,1,0),map(a,-1,0),map(-a,-1,0)];ctx.fillStyle='#deded8';ctx.strokeStyle='#aaa';ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
// Textured oblique plane. This view is a placement diagram, not invented 3D layers.
if(image){ctx.save();ctx.transform((corners[1].x-corners[0].x)/canvas.width,(corners[1].y-corners[0].y)/canvas.width,(corners[3].x-corners[0].x)/canvas.height,(corners[3].y-corners[0].y)/canvas.height,corners[0].x,corners[0].y);ctx.drawImage(canvas,0,0);ctx.restore();}
ctx.font='11px Manrope';ctx.fillStyle='#777';ctx.fillText('Image surface',corners[3].x,corners[3].y+25);const front=map(-a,1,1.8),back=map(-a,1,-1.6);ctx.fillText('Front',front.x-10,front.y-20);ctx.fillText('Back',back.x-10,back.y-20);for(const l of state.lights){if(!l.enabled)continue;const p=map(l.x,l.y,l.z),target=map(0,0,0);ctx.strokeStyle=l.id===selected?'#777':'#bcbcb7';ctx.setLineDash(l.z<0?[4,5]:[2,5]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(target.x,target.y);ctx.stroke();}ctx.setLineDash([]);}
function syncSurface(){for(const k of ['relief','ambient']){$('#'+k).value=state[k];$('#'+k+'Value').textContent=Math.round(state[k]*100)+'%';}}
for(const key of ['relief','ambient'])$('#'+key).oninput=e=>{state[key]=+e.target.value;syncSurface();dirty=true;};$('#finish').onchange=e=>{state.finish=+e.target.value;dirty=true;};$('#invert').onchange=e=>{state.invert=e.target.checked;dirty=true;};
$('#addLight').onclick=()=>{if(state.lights.length>=6)return;const id=nextId++;state.lights.push(light(id,'Light '+id,.2,.2,1.2,'#ffffff',2));selected=id;renderEditor();dirty=true;};
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>setRig(b.dataset.look);
$('#upload').onclick=$('#emptyUpload').onclick=()=>$('#imageFile').click();$('#uploadDepth').onclick=()=>$('#depthFile').click();$('#imageFile').onchange=e=>{upload(e.target.files[0]);e.target.value='';};$('#depthFile').onchange=e=>{upload(e.target.files[0],true);e.target.value='';};
let dragCounter=0;stage.ondragenter=e=>{e.preventDefault();dragCounter++;stage.classList.add('dragging');};stage.ondragover=e=>e.preventDefault();stage.ondragleave=()=>{if(--dragCounter<=0)stage.classList.remove('dragging');};stage.ondrop=e=>{e.preventDefault();dragCounter=0;stage.classList.remove('dragging');upload(e.dataTransfer.files[0]);};
function changeView(v){if(!image)return;view=v;canvas.hidden=v==='space';$('#space').hidden=v!=='space';$('#imageView').classList.toggle('active',v==='image');$('#spaceView').classList.toggle('active',v==='space');$('#hint').textContent=v==='space'?'Drag to place · Height for front / back':'Drag a light to place it';renderHandles();dirty=true;}
$('#imageView').onclick=()=>changeView('image');$('#spaceView').onclick=()=>changeView('space');$('#showHandles').onclick=()=>{handlesVisible=!handlesVisible;$('#showHandles').textContent=handlesVisible?'Hide lights':'Show lights';$('#showHandles').setAttribute('aria-pressed',String(handlesVisible));renderHandles();};
function compareOn(){original=true;dirty=true;}function compareOff(){original=false;dirty=true;}$('#compare').onpointerdown=e=>{e.target.setPointerCapture(e.pointerId);compareOn();};$('#compare').onpointerup=compareOff;$('#compare').onpointercancel=compareOff;$('#compare').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();compareOn();}};$('#compare').onkeyup=compareOff;$('#compare').onblur=compareOff;window.addEventListener('blur',compareOff);
$('#export').onclick=async()=>{
 if(!image||exporting)return;
 const button=$('#export'),old=[canvas.width,canvas.height],previous=original,width=image.width,height=image.height;
 exporting=true;button.disabled=true;document.body.inert=true;original=false;
 try{
  status('Exporting '+width+' × '+height+' PNG…');
  const blob=await exportNativePNG({width,height,renderTile:tile=>{
   canvas.width=tile.width;canvas.height=tile.height;draw({region:tile.region});
   if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('The graphics device could not render the full-resolution image.');
   return canvas;
  },onProgress:(done,total)=>status('Exporting '+width+' × '+height+' · '+Math.round(done/total*100)+'%')});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='light-studio-'+width+'x'+height+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
  status('PNG exported · '+width+' × '+height+' · original resolution');
 }catch(e){console.error(e);status('Export failed. '+e.message+' No smaller image was substituted.');}
 finally{[canvas.width,canvas.height]=old;original=previous;exporting=false;button.disabled=false;document.body.inert=false;resize();dirty=true;}
};
let modelPromise=null;
async function prepareModel(){
 if(model)return model;if(modelPromise)return modelPromise;
 $('#retryDepth').hidden=true;
 modelPromise=(async()=>{const {pipeline,env}=await import('./vendor/transformers/transformers.min.js');env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath='./models/';env.backends.onnx.wasm.wasmPaths=new URL('./vendor/transformers/',location.href).href;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
 return pipeline('depth-estimation','onnx-community/depth-anything-v2-small',{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')status('Preparing depth model · '+Math.round(p.progress||0)+'%');}});})();
 try{model=await modelPromise;return model;}catch(e){modelPromise=null;throw e;}
}
async function estimateDepth(){if(!image)return;if(estimating){queuedDepth=true;return;}estimating=true;$('#estimate').disabled=true;$('#retryDepth').hidden=true;const version=imageVersion,source=image;status('Preparing scene depth on this device…');try{
 await prepareModel();const c=document.createElement('canvas');c.width=Math.min(768,source.width);c.height=Math.max(1,Math.round(c.width*source.height/source.width));c.getContext('2d').drawImage(source,0,0,c.width,c.height);status('Estimating depth on this device…');const result=await model(c.toDataURL('image/png'));if(version!==imageVersion)return;while(exporting)await new Promise(resolve=>setTimeout(resolve,50));if(version!==imageVersion)return;depthImage=result.depth.toCanvas();depthTexture=texture(depthImage,depthTexture,1);depthLabel('estimated');window.dispatchEvent(new Event('lightstudio:depth-ready'));status('');dirty=true;
 }catch(e){console.error(e);if(version===imageVersion){status('Depth estimation could not finish. Your original image is unchanged. Try again or restart the app.');$('#retryDepth').hidden=false;}}
 finally{estimating=false;$('#estimate').disabled=false;if(queuedDepth){queuedDepth=false;estimateDepth();}}}
$('#retryDepth').onclick=()=>image?estimateDepth():prepareModel().then(()=>status('Ready. Upload an image to begin.')).catch(e=>{status('Could not prepare depth estimation. Restart the app to repair dependencies.');$('#retryDepth').hidden=false;});
$('#estimate').onclick=estimateDepth;
new ResizeObserver(()=>{resize();renderHandles();}).observe(stage);function frame(){if(dirty&&!exporting){draw();if(image&&view==='space')spaceDraw();dirty=false;}requestAnimationFrame(frame);}setRig('amir');syncEmptyState();renderHandles();frame();initializeHistory();status('Preparing local depth model…');prepareModel().then(()=>{if(!image)status('Ready. Upload an image to begin.');}).catch(e=>{console.error(e);if(!image){status('Could not prepare depth estimation. Restart the app to repair dependencies.');$('#retryDepth').hidden=false;}});
// Read-only diagnostics for local verification.
window.lightStudio={getState:()=>structuredClone({...state,depthKind:currentDepthKind,view,imageSize:image?[image.width,image.height]:null}),getRenderError:()=>gl.getError(),getDepthDataURL:()=>{if(!depthImage)return null;const c=document.createElement('canvas');c.width=depthImage.width;c.height=depthImage.height;c.getContext('2d').drawImage(depthImage,0,0);return c.toDataURL('image/png');}};

function initializeHistory(){
 const capture=()=>({state:structuredClone(state),selected,image,depthImage,currentSample,kind:currentDepthKind,filename:$('#filename').textContent});
 const same=(a,b)=>JSON.stringify(a.state)===JSON.stringify(b.state)&&a.image===b.image;
 let entries=[capture()],cursor=0,restoring=false;
 const buttons=()=>{$('#undo').disabled=cursor===0;$('#redo').disabled=cursor===entries.length-1;};
 const commit=()=>{if(restoring)return;const snapshot=capture();if(same(entries[cursor],snapshot))return;entries.splice(cursor+1);entries.push(snapshot);if(entries.length>60)entries.shift();cursor=entries.length-1;for(const b of document.querySelectorAll('[data-look]'))b.classList.toggle('active',JSON.stringify(rigs[b.dataset.look]())===JSON.stringify(state.lights));buttons();};
 const restore=direction=>{commit();const next=cursor+direction;if(next<0||next>=entries.length)return;restoring=true;cursor=next;const snap=entries[cursor];imageVersion++;state=structuredClone(snap.state);selected=snap.selected;nextId=Math.max(0,...state.lights.map(l=>l.id))+1;image=snap.image;depthImage=snap.depthImage;currentSample=snap.currentSample;$('#filename').textContent=snap.filename;if(image){photoTexture=texture(image,photoTexture,0);depthTexture=texture(depthImage,depthTexture,1);}depthLabel(snap.kind);$('#finish').value=String(state.finish);$('#invert').checked=state.invert;syncSurface();renderEditor();syncEmptyState();resize();dirty=true;for(const b of document.querySelectorAll('[data-look]'))b.classList.toggle('active',JSON.stringify(rigs[b.dataset.look]())===JSON.stringify(state.lights));restoring=false;buttons();};
 $('#undo').onclick=()=>restore(-1);$('#redo').onclick=()=>restore(1);
 document.addEventListener('change',e=>{if(e.target.matches('input:not([type=file]),select'))commit();});
 document.addEventListener('pointerup',e=>{if(e.target.closest('.handle'))commit();});
 document.addEventListener('click',e=>{if(e.target.closest('[data-look],#addLight,#deleteLight,.light-row button'))commit();});
 document.addEventListener('keydown',e=>{const editing=e.target.matches('input[type=text],textarea,[contenteditable=true]');if(editing)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?1:-1);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(1);}else if(e.target.closest('.handle')&&e.key.startsWith('Arrow'))commit();});
 // File loading is asynchronous; register explicit completed-edit checkpoints.
 window.addEventListener('lightstudio:image-loaded',commit);
 window.addEventListener('lightstudio:depth-ready',()=>{if(entries[cursor].image===image){entries[cursor].depthImage=depthImage;entries[cursor].kind=currentDepthKind;}});
 buttons();
}
