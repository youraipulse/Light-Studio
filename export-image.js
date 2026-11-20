// Render native source pixels in small tiles, independent of preview dimensions
// and GPU drawing-buffer limits. Tile coordinates are in top-left image space.
export function* exportTiles(width,height,size=1024){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!Number.isInteger(size)||size<1)throw Error('Invalid export dimensions.');
 for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){const w=Math.min(size,width-x),h=Math.min(size,height-y);yield {x,y,width:w,height:h,region:[x/width,1-(y+h)/height,(x+w)/width,1-y/height]};}
}
export async function exportNativePNG({width,height,renderTile,onProgress=()=>{},tileSize=1024}){
 const output=document.createElement('canvas');output.width=width;output.height=height;
 const ctx=output.getContext('2d');if(!ctx||output.width!==width||output.height!==height)throw Error('This browser cannot allocate the full-resolution image.');
 ctx.imageSmoothingEnabled=false;
 const total=Math.ceil(width/tileSize)*Math.ceil(height/tileSize);let done=0;
 try{
  for(const tile of exportTiles(width,height,tileSize)){
   const rendered=renderTile(tile);ctx.drawImage(rendered,0,0,tile.width,tile.height,tile.x,tile.y,tile.width,tile.height);
   onProgress(++done,total);await new Promise(resolve=>setTimeout(resolve,0));
  }
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
  if(!blob)throw Error('The browser could not encode the full-resolution PNG.');
  return blob;
 }finally{output.width=output.height=1;}
}
