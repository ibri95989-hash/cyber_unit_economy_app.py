/* ============================================================
   REELS PROMO — 1080x1920 deterministic canvas motion engine
   ============================================================ */
const W = 1080, H = 1920;
const cv = document.getElementById('c');
let ctx = cv.getContext('2d', { alpha: false });
let NOW = 0;   /* абсолютное время кадра — по нему живут Lottie-анимации */

/* ---------- palette ---------- */
const P = {
  bg:'#04060B', bg2:'#080C15',
  ink:'#FFFFFF', dim:'#8A94A8',
  cyan:'#22D3EE', blue:'#3B82F6', violet:'#8B5CF6',
  magenta:'#F0338A', pink:'#FF4D8D',
  green:'#34D399', lime:'#A3E635',
  red:'#FF3B5C', amber:'#FFB020',
  grey:'#2A313F'
};

/* ---------- math / easing ---------- */
const cl=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>a+(b-a)*cl(t);
const TAU=Math.PI*2;
const E={
  linear:t=>t,
  outExpo:t=>t>=1?1:1-Math.pow(2,-10*t),
  inExpo:t=>t<=0?0:Math.pow(2,10*t-10),
  outQuint:t=>1-Math.pow(1-t,5),
  outQuart:t=>1-Math.pow(1-t,4),
  outCubic:t=>1-Math.pow(1-t,3),
  inOutCubic:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  inOutQuint:t=>t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2,
  outBack:t=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2)},
  outBackS:t=>{const c=1.16,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2)},
  outElastic:t=>{if(t===0||t===1)return t;const p=.34;return Math.pow(2,-10*t)*Math.sin((t*10-.75)*(TAU/p))+1},
  inQuad:t=>t*t, outQuad:t=>1-(1-t)*(1-t)
};
/* progress of a sub-animation */
function pr(lt,start,dur,ease){ const t=cl((lt-start)/Math.max(dur,1e-6)); return ease?ease(t):t; }
/* pulse: 0->1->0 */
function pls(lt,start,dur){ const t=cl((lt-start)/dur); return Math.sin(t*Math.PI); }

/* deterministic RNG */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- color helpers ---------- */
function rgba(hex,a){const h=hex.replace('#','');const n=parseInt(h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
function lgrad(x0,y0,x1,y1,stops){const g=ctx.createLinearGradient(x0,y0,x1,y1);
  for(const s of stops)g.addColorStop(s[0],s[1]);return g;}
function rgrad(x,y,r0,r1,stops){const g=ctx.createRadialGradient(x,y,r0,x,y,r1);
  for(const s of stops)g.addColorStop(s[0],s[1]);return g;}

/* ---------- shape helpers ---------- */
function rr(x,y,w,h,r){ctx.beginPath();
  if(typeof r==='number')r=[r,r,r,r];
  const [a,b,c,d]=r;
  ctx.moveTo(x+a,y);ctx.lineTo(x+w-b,y);ctx.quadraticCurveTo(x+w,y,x+w,y+b);
  ctx.lineTo(x+w,y+h-c);ctx.quadraticCurveTo(x+w,y+h,x+w-c,y+h);
  ctx.lineTo(x+d,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-d);
  ctx.lineTo(x,y+a);ctx.quadraticCurveTo(x,y,x+a,y);ctx.closePath();}
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);}
function glow(color,blur,fn){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;fn();ctx.restore();}

/* ---------- text ---------- */
function setFont(weight,size,fam='Mont',ls=0){ctx.font=`${weight} ${size}px ${fam}`;ctx.letterSpacing=`${ls}px`;}
function tw(txt){return ctx.measureText(txt).width;}
/* draw text with optional gradient / glow / stroke */
function text(txt,x,y,o={}){
  const {weight=900,size=100,fam='Mont',ls=0,align='center',base='middle',
    fill=P.ink,alpha=1,glowc=null,glowb=0,stroke=null,strokew=0,shadow=0}=o;
  ctx.save();ctx.globalAlpha*=alpha;setFont(weight,size,fam,ls);
  ctx.textAlign=align;ctx.textBaseline=base;
  if(shadow){ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=shadow;ctx.shadowOffsetY=shadow*.25;}
  if(glowc){ctx.shadowColor=glowc;ctx.shadowBlur=glowb;}
  if(stroke){ctx.lineWidth=strokew;ctx.strokeStyle=stroke;ctx.lineJoin='round';ctx.strokeText(txt,x,y);}
  ctx.fillStyle=fill;ctx.fillText(txt,x,y);
  ctx.restore();
}
/* gradient text helper: builds gradient across measured width */
function gtext(txt,x,y,o={}){
  const {weight=900,size=100,fam='Mont',ls=0,align='center',stops=[[0,P.cyan],[.5,P.violet],[1,P.magenta]]}=o;
  ctx.save();setFont(weight,size,fam,ls);
  const w=tw(txt);
  let x0=x-w/2; if(align==='left')x0=x; if(align==='right')x0=x-w;
  const g=lgrad(x0,y-size*.5,x0+w,y+size*.5,stops);
  ctx.restore();
  return text(txt,x,y,Object.assign({},o,{fill:g}));
}

/* ---------- global film grain + vignette (cheap, cached noise tiles) ---------- */
const NOISE=[];
(function(){
  for(let k=0;k<4;k++){
    const n=document.createElement('canvas');n.width=n.height=256;
    const nc=n.getContext('2d');const id=nc.createImageData(256,256);
    const rnd=mulberry32(1337+k*97);
    for(let i=0;i<256*256;i++){const v=200+rnd()*55;id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v;id.data[i*4+3]=255;}
    nc.putImageData(id,0,0);NOISE.push(n);
  }
})();
function grain(t,amt=0.045){
  ctx.save();ctx.globalCompositeOperation='overlay';ctx.globalAlpha=amt;
  const n=NOISE[Math.floor(t*24)%4];
  const rnd=mulberry32(Math.floor(t*24));
  ctx.translate(-rnd()*256,-rnd()*256);
  const pat=ctx.createPattern(n,'repeat');ctx.fillStyle=pat;
  ctx.fillRect(0,0,W+256,H+256);ctx.restore();
}
function vignette(strength=.75){
  ctx.save();
  ctx.fillStyle=rgrad(W/2,H*.46,H*.22,H*.72,[[0,'rgba(0,0,0,0)'],[.65,'rgba(0,0,0,'+(strength*.35)+')'],[1,'rgba(0,0,0,'+strength+')']]);
  ctx.fillRect(0,0,W,H);ctx.restore();
}

/* ============================================================
   BACKGROUND SYSTEMS
   ============================================================ */
/* Палитра фона под настроение сцены. */
const BG_PALETTE={hook:'violet',boring:'night',comp:'tech',scroll:'night',pipe:'ice',
  offer:'money',costs:'danger',noeff:'night',result:'ice',cta:'violet'};
const BG_KINETIC=['tech','violet','ice'];

function bgBase(t,c1='#0A1226',c2='#04060B'){
  /* Фон считает шейдер: живой объёмный градиент вместо плоской заливки.
     Если WebGL недоступен — тихо откатываемся на прежний градиент. */
  const sc=(typeof CUR!=='undefined'&&CUR)?CUR:null;
  let pal=sc?BG_PALETTE[sc.n]:'tech';
  if(sc&&sc.n==='kinetic') pal=BG_KINETIC[(sc.p&&sc.p.variant||0)%3];
  const drawn = (typeof BG!=='undefined') && window.__bgQuality!=='off' && BG.draw(ctx,W,H,t,
      {palette:pal||'tech', seed:(sc&&sc.seed)||1, style:(sc&&sc.seed||1)%3, amount:1});
  if(!drawn){
    ctx.fillStyle=c2;ctx.fillRect(0,0,W,H);
    ctx.save();
    ctx.fillStyle=rgrad(W*.5,H*.35,0,H*.75,[[0,c1],[1,'rgba(4,6,11,0)']]);
    ctx.fillRect(0,0,W,H);ctx.restore();
  }
}
/* slow drifting aurora blobs */
function aurora(t,cols=[P.violet,P.cyan,P.magenta],amp=1,speed=1){
  ctx.save();ctx.globalCompositeOperation='screen';
  const rnd=mulberry32(7);
  for(let i=0;i<cols.length;i++){
    const ph=rnd()*10, sp=(.09+rnd()*.07)*speed;
    const x=W*(.2+.6*(.5+.5*Math.sin(t*sp+ph)));
    const y=H*(.18+.62*(.5+.5*Math.cos(t*sp*.83+ph*1.7)));
    const r=(320+130*Math.sin(t*.35+i))*amp;
    ctx.fillStyle=rgrad(x,y,0,r,[[0,rgba(cols[i],.30*amp)],[.45,rgba(cols[i],.10*amp)],[1,rgba(cols[i],0)]]);
    ctx.fillRect(0,0,W,H);
  }
  ctx.restore();
}
/* perspective tech grid */
function grid(t,o={}){
  const {alpha=.22,color=P.cyan,speed=.35,size=90,yTop=H*.5,persp=false}=o;
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=1.4;
  if(!persp){
    const off=(t*speed*size)%size;
    ctx.beginPath();
    for(let x=-size;x<=W+size;x+=size){ctx.moveTo(x+off,0);ctx.lineTo(x+off,H);}
    for(let y=-size;y<=H+size;y+=size){ctx.moveTo(0,y+off);ctx.lineTo(W,y+off);}
    ctx.stroke();
  }else{
    const hz=yTop, vpx=W/2;
    ctx.beginPath();
    for(let i=-14;i<=14;i++){const x=vpx+i*130;ctx.moveTo(vpx,hz);ctx.lineTo(x*4-vpx*3,H);}
    let z=(t*speed)%1;
    for(let i=0;i<22;i++){const k=(i+z)/22;const y=hz+(H-hz)*Math.pow(k,2.6);
      ctx.moveTo(0,y);ctx.lineTo(W,y);}
    ctx.stroke();
  }
  ctx.restore();
}
/* floating particles / dust */
function particles(t,o={}){
  const {n=90,color='#9FD8FF',alpha=.5,speed=26,seed=3,size=2.2,spread=1}=o;
  const rnd=mulberry32(seed);ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<n;i++){
    const bx=rnd()*W, by=rnd()*H, sp=.4+rnd()*1.6, ph=rnd()*10, s=size*(.4+rnd()*1.2);
    const y=(by-t*speed*sp)%H; const yy=y<0?y+H:y;
    const x=bx+Math.sin(t*.6*sp+ph)*40*spread;
    const a=alpha*(.25+.75*(.5+.5*Math.sin(t*1.7+ph)));
    ctx.fillStyle=rgba(color.replace('#',''),a);
    ctx.fillStyle=color;ctx.globalAlpha=a;
    circle(x,yy,s);ctx.fill();
  }
  ctx.restore();
}
/* scanline sweep */
function scan(t,o={}){
  const {alpha=.1,h=260,speed=520,color='#FFFFFF'}=o;
  const y=((t*speed)%(H+h*2))-h;
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle=lgrad(0,y,0,y+h,[[0,rgba(color,0)],[.5,rgba(color,alpha)],[1,rgba(color,0)]]);
  ctx.fillRect(0,y,W,h);ctx.restore();
}
/* horizontal light beam */
function beam(x,y,w,h,color,a=.5,ang=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.globalCompositeOperation='screen';
  ctx.fillStyle=lgrad(-w/2,0,w/2,0,[[0,rgba(color,0)],[.5,rgba(color,a)],[1,rgba(color,0)]]);
  ctx.fillRect(-w/2,-h/2,w,h);ctx.restore();
}

/* ============================================================
   UI PRIMITIVES
   ============================================================ */
function glass(x,y,w,h,r,o={}){
  const {fillA=.055,border=.16,bcol='#FFFFFF',shadow=true,tint=null}=o;
  ctx.save();
  if(shadow){ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=48;ctx.shadowOffsetY=18;}
  rr(x,y,w,h,r);
  ctx.fillStyle=tint?tint:lgrad(x,y,x,y+h,[[0,`rgba(255,255,255,${fillA+.03})`],[1,`rgba(255,255,255,${fillA*.35})`]]);
  ctx.fill();ctx.restore();
  ctx.save();rr(x,y,w,h,r);ctx.strokeStyle=rgba(bcol,border);ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
}
function chip(x,y,label,o={}){
  const {size=26,pad=22,hgt=54,col=P.cyan,alpha=1,fillA=.12,weight=800,fam='Inter',ls=1.5}=o;
  ctx.save();ctx.globalAlpha*=alpha;setFont(weight,size,fam,ls);
  const w=tw(label)-ls+pad*2;
  rr(x-w/2,y-hgt/2,w,hgt,hgt/2);
  ctx.fillStyle=rgba(col,fillA);ctx.fill();
  ctx.strokeStyle=rgba(col,.55);ctx.lineWidth=1.5;ctx.stroke();
  text(label,x-ls/2,y+1,{weight,size,fam,ls,fill:col});
  ctx.restore();return w;
}
/* phone frame */
function phone(x,y,w,h,o={}){
  const {r=54,border=P.grey,glowc=null,glowb=0,alpha=1}=o;
  ctx.save();ctx.globalAlpha*=alpha;
  if(glowc){ctx.shadowColor=glowc;ctx.shadowBlur=glowb;}
  rr(x-w/2,y-h/2,w,h,r);ctx.fillStyle='#0A0D14';ctx.fill();
  ctx.restore();
  ctx.save();ctx.globalAlpha*=alpha;
  rr(x-w/2,y-h/2,w,h,r);ctx.lineWidth=5;ctx.strokeStyle=border;ctx.stroke();
  ctx.restore();
}
/* animated line chart. pts normalized 0..1 */
function chartLine(x,y,w,h,pts,prog,o={}){
  const {col=P.green,lw=7,fillA=.20,dot=true,glowb=26}=o;
  const n=pts.length;const P2=[];
  for(let i=0;i<n;i++)P2.push([x+w*(i/(n-1)), y+h-h*pts[i]]);
  const total=n-1;const fp=cl(prog)*total;const seg=Math.floor(fp);const fr=fp-seg;
  const path=[];for(let i=0;i<=Math.min(seg,total);i++)path.push(P2[i]);
  if(seg<total)path.push([lerp(P2[seg][0],P2[seg+1][0],fr),lerp(P2[seg][1],P2[seg+1][1],fr)]);
  if(path.length<2)return path[path.length-1];
  ctx.save();
  ctx.beginPath();ctx.moveTo(path[0][0],path[0][1]);
  for(let i=1;i<path.length;i++){const p0=path[i-1],p1=path[i];
    const cx=(p0[0]+p1[0])/2;ctx.bezierCurveTo(cx,p0[1],cx,p1[1],p1[0],p1[1]);}
  const strokePath=new Path2D();
  ctx.save();ctx.lineTo(path[path.length-1][0],y+h);ctx.lineTo(path[0][0],y+h);ctx.closePath();
  ctx.fillStyle=lgrad(0,y,0,y+h,[[0,rgba(col,fillA)],[1,rgba(col,0)]]);ctx.fill();ctx.restore();
  ctx.beginPath();ctx.moveTo(path[0][0],path[0][1]);
  for(let i=1;i<path.length;i++){const p0=path[i-1],p1=path[i];
    const cx=(p0[0]+p1[0])/2;ctx.bezierCurveTo(cx,p0[1],cx,p1[1],p1[0],p1[1]);}
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor=col;ctx.shadowBlur=glowb;ctx.stroke();ctx.stroke();
  ctx.restore();
  const last=path[path.length-1];
  if(dot){ctx.save();ctx.shadowColor=col;ctx.shadowBlur=30;
    circle(last[0],last[1],13);ctx.fillStyle='#fff';ctx.fill();
    circle(last[0],last[1],20);ctx.strokeStyle=rgba(col,.8);ctx.lineWidth=4;ctx.stroke();ctx.restore();}
  return last;
}
/* animated bars */
function bars(x,y,w,h,vals,prog,o={}){
  const {col=P.cyan,gap=14,rad=8,stagger=.06,glowb=18,col2=null}=o;
  const n=vals.length;const bw=(w-gap*(n-1))/n;
  for(let i=0;i<n;i++){
    const p=cl((prog-i*stagger)/(1-stagger*n+.001));
    const e=E.outBackS(cl(p));
    const bh=Math.max(4,h*vals[i]*e);
    const bx=x+i*(bw+gap);
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=glowb;
    rr(bx,y+h-bh,bw,bh,rad);
    ctx.fillStyle=col2?lgrad(0,y+h-bh,0,y+h,[[0,col],[1,col2]]):col;ctx.fill();ctx.restore();
  }
}
/* number counter formatting */
function fmt(n,sep=' '){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,sep);}
/* icon: stroke path in a box of size s centered at x,y */
/* ============================================================
   ИКОНКИ. Сначала ищем в наборе Lucide (1792 штук), и только
   если там нет — рисуем встроенную рукописную. Набор идёт
   в системе 24x24, поэтому масштабируем и центрируем.
   progress<1 включает прорисовку штрихом — иконка «пишется».
   ============================================================ */
const _P2D = {};
function iconPath(name){
  const key = (typeof ICON_ALIAS!=='undefined' && ICON_ALIAS[name]) || name;
  if(typeof ICONS==='undefined' || !ICONS[key]) return null;
  if(!_P2D[key]){
    /* Каждый подпуть разбирается отдельно: у Lucide они начинаются
       с относительной команды, и склейка увела бы фигуру в сторону. */
    const p=new Path2D();
    for(const d of ICONS[key][0]) p.addPath(new Path2D(d));
    _P2D[key]={p, len:ICONS[key][1]||120};
  }
  return _P2D[key];
}
function icv(name,x,y,size,col,lw=4,progress=1,fillA=0){
  const rec = iconPath(name);
  if(!rec) return false;
  const k = size/24;
  ctx.save();
  ctx.translate(x,y);ctx.scale(k,k);ctx.translate(-12,-12);
  ctx.strokeStyle=col;ctx.fillStyle=col;
  ctx.lineWidth=lw/k;ctx.lineCap='round';ctx.lineJoin='round';
  if(progress<0.999){
    const L=rec.len;
    ctx.setLineDash([L,L]);
    ctx.lineDashOffset=L*(1-cl(progress));
  }
  ctx.stroke(rec.p);
  if(fillA){ctx.globalAlpha*=fillA;ctx.fill(rec.p,'evenodd');}
  ctx.restore();
  return true;
}
/* Заливные и двухцветные начертания (Phosphor, система 256x256). */
const _P2F={};
function iconFill(name,duo){
  const src = duo ? (typeof ICONS_DUO!=='undefined'?ICONS_DUO:null)
                  : (typeof ICONS_FILL!=='undefined'?ICONS_FILL:null);
  if(!src || !src[name]) return null;
  const key=(duo?'d:':'f:')+name;
  if(!_P2F[key]) _P2F[key]=src[name].map(([d,op])=>[new Path2D(d),op]);
  return _P2F[key];
}
function icf(name,x,y,size,col,duo){
  const rec=iconFill(name,duo);
  if(!rec) return false;
  const k=size/256;
  ctx.save();
  ctx.translate(x,y);ctx.scale(k,k);ctx.translate(-128,-128);
  for(const [p,op] of rec){
    ctx.save();ctx.globalAlpha*=op;ctx.fillStyle=col;ctx.fill(p);ctx.restore();
  }
  ctx.restore();
  return true;
}

/* Стиль иконок задаётся в brand.json: stroke (по умолчанию), fill или duo. */
function iconStyle(){
  return (typeof PLAN!=='undefined' && PLAN.iconStyle) || 'stroke';
}

function ic(kind,x,y,s,col,lw=4,fillA=0){
  /* Если для темы положили анимацию Lottie — играем её вместо статичной иконки. */
  if(typeof MOTION!=='undefined' && MOTION.has(kind)){
    if(MOTION.draw(ctx,kind,x,y,s*1.5,NOW-(CUR?CUR.s:0))) return;
  }
  const st=iconStyle();
  if(st==='fill' || st==='duo'){
    if(icf(kind,x,y,s*1.08,col,st==='duo')) return;
  }
  if(icv(kind,x,y,s,col,lw,1,fillA)) return;
  icLegacy(kind,x,y,s,col,lw,fillA);
}
function icLegacy(kind,x,y,s,col,lw=4,fillA=0){
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=col;ctx.fillStyle=col;
  ctx.lineWidth=lw;ctx.lineCap='round';ctx.lineJoin='round';
  const u=s/2;
  const B=()=>ctx.beginPath();
  switch(kind){
    case 'play': B();ctx.moveTo(-u*.4,-u*.65);ctx.lineTo(u*.75,0);ctx.lineTo(-u*.4,u*.65);ctx.closePath();ctx.fill();break;
    case 'heart': B();ctx.moveTo(0,u*.75);ctx.bezierCurveTo(-u*1.5,-u*.15,-u*.55,-u*1.05,0,-u*.35);
      ctx.bezierCurveTo(u*.55,-u*1.05,u*1.5,-u*.15,0,u*.75);ctx.closePath();fillA?ctx.fill():ctx.stroke();break;
    case 'eye': B();ctx.moveTo(-u,0);ctx.quadraticCurveTo(0,-u*.95,u,0);ctx.quadraticCurveTo(0,u*.95,-u,0);ctx.stroke();
      B();ctx.arc(0,0,u*.33,0,TAU);ctx.stroke();break;
    case 'bolt': B();ctx.moveTo(u*.25,-u);ctx.lineTo(-u*.55,u*.12);ctx.lineTo(-u*.02,u*.12);ctx.lineTo(-u*.25,u);
      ctx.lineTo(u*.6,-u*.14);ctx.lineTo(u*.04,-u*.14);ctx.closePath();ctx.fill();break;
    case 'bulb': B();ctx.arc(0,-u*.25,u*.55,Math.PI*.15,Math.PI*.85,true);ctx.stroke();
      B();ctx.moveTo(-u*.42,u*.16);ctx.lineTo(-u*.28,u*.55);ctx.lineTo(u*.28,u*.55);ctx.lineTo(u*.42,u*.16);ctx.stroke();
      B();ctx.moveTo(-u*.26,u*.78);ctx.lineTo(u*.26,u*.78);ctx.stroke();break;
    case 'doc': B();ctx.moveTo(-u*.55,-u*.85);ctx.lineTo(u*.22,-u*.85);ctx.lineTo(u*.58,-u*.45);
      ctx.lineTo(u*.58,u*.85);ctx.lineTo(-u*.55,u*.85);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.28,-u*.2);ctx.lineTo(u*.3,-u*.2);ctx.moveTo(-u*.28,u*.12);ctx.lineTo(u*.3,u*.12);
      ctx.moveTo(-u*.28,u*.44);ctx.lineTo(u*.05,u*.44);ctx.stroke();break;
    case 'chip': B();rrp(-u*.5,-u*.5,u,u,u*.18);ctx.stroke();
      B();rrp(-u*.2,-u*.2,u*.4,u*.4,u*.08);ctx.stroke();
      B();for(let i=-1;i<=1;i++){ctx.moveTo(i*u*.3,-u*.5);ctx.lineTo(i*u*.3,-u*.82);
        ctx.moveTo(i*u*.3,u*.5);ctx.lineTo(i*u*.3,u*.82);
        ctx.moveTo(-u*.5,i*u*.3);ctx.lineTo(-u*.82,i*u*.3);
        ctx.moveTo(u*.5,i*u*.3);ctx.lineTo(u*.82,i*u*.3);}ctx.stroke();break;
    case 'img': B();rrp(-u*.8,-u*.62,u*1.6,u*1.24,u*.16);ctx.stroke();
      B();ctx.moveTo(-u*.7,u*.4);ctx.lineTo(-u*.16,-u*.2);ctx.lineTo(u*.2,u*.16);ctx.lineTo(u*.42,-u*.04);ctx.lineTo(u*.72,u*.4);ctx.stroke();
      B();ctx.arc(u*.36,-u*.3,u*.14,0,TAU);ctx.fill();break;
    case 'mic': B();rrp(-u*.26,-u*.9,u*.52,u*1.05,u*.26);ctx.stroke();
      B();ctx.arc(0,u*.05,u*.55,0,Math.PI);ctx.stroke();
      B();ctx.moveTo(0,u*.6);ctx.lineTo(0,u*.9);ctx.stroke();break;
    case 'cut': B();ctx.moveTo(-u*.75,-u*.75);ctx.lineTo(u*.45,u*.55);ctx.moveTo(u*.75,-u*.75);ctx.lineTo(-u*.45,u*.55);ctx.stroke();
      B();ctx.arc(-u*.55,u*.62,u*.28,0,TAU);ctx.stroke();B();ctx.arc(u*.55,u*.62,u*.28,0,TAU);ctx.stroke();break;
    case 'cc': B();rrp(-u*.85,-u*.6,u*1.7,u*1.2,u*.2);ctx.stroke();
      B();ctx.moveTo(-u*.5,-u*.1);ctx.lineTo(u*.05,-u*.1);ctx.moveTo(-u*.5,u*.25);ctx.lineTo(u*.5,u*.25);ctx.stroke();break;
    case 'cam': B();rrp(-u*.85,-u*.5,u*1.25,u,u*.16);ctx.stroke();
      B();ctx.moveTo(u*.42,-u*.14);ctx.lineTo(u*.85,-u*.42);ctx.lineTo(u*.85,u*.42);ctx.lineTo(u*.42,u*.14);ctx.closePath();ctx.stroke();break;
    case 'clock': B();ctx.arc(0,0,u*.82,0,TAU);ctx.stroke();
      B();ctx.moveTo(0,-u*.48);ctx.lineTo(0,0);ctx.lineTo(u*.36,u*.2);ctx.stroke();break;
    case 'brain': B();
      ctx.moveTo(-u*.06,-u*.78);
      ctx.bezierCurveTo(-u*.55,-u*.95,-u*.92,-u*.5,-u*.72,-u*.16);
      ctx.bezierCurveTo(-u*.98,u*.16,-u*.66,u*.66,-u*.28,u*.6);
      ctx.bezierCurveTo(-u*.2,u*.86,u*.16,u*.9,u*.3,u*.66);
      ctx.bezierCurveTo(u*.72,u*.72,u*.96,u*.2,u*.7,-u*.12);
      ctx.bezierCurveTo(u*.92,-u*.5,u*.52,-u*.96,u*.06,-u*.78);
      ctx.closePath();ctx.stroke();
      B();ctx.moveTo(0,-u*.76);ctx.lineTo(0,u*.76);ctx.stroke();
      B();ctx.moveTo(-u*.34,-u*.42);ctx.quadraticCurveTo(-u*.1,-u*.2,-u*.36,u*.06);
      ctx.moveTo(u*.34,-u*.3);ctx.quadraticCurveTo(u*.08,-u*.06,u*.36,u*.24);ctx.stroke();break;
    case 'check': B();ctx.moveTo(-u*.6,0);ctx.lineTo(-u*.15,u*.45);ctx.lineTo(u*.62,-u*.5);ctx.stroke();break;
    case 'x': B();ctx.moveTo(-u*.55,-u*.55);ctx.lineTo(u*.55,u*.55);ctx.moveTo(u*.55,-u*.55);ctx.lineTo(-u*.55,u*.55);ctx.stroke();break;
    case 'send': B();ctx.moveTo(-u*.85,-u*.6);ctx.lineTo(u*.85,0);ctx.lineTo(-u*.85,u*.6);ctx.lineTo(-u*.55,0);ctx.closePath();ctx.fill();break;
    case 'msg': B();rrp(-u*.85,-u*.7,u*1.7,u*1.2,u*.3);ctx.stroke();
      B();ctx.moveTo(-u*.35,u*.5);ctx.lineTo(-u*.15,u*.92);ctx.lineTo(u*.1,u*.5);ctx.closePath();ctx.fill();
      B();ctx.arc(-u*.38,-u*.1,u*.1,0,TAU);ctx.arc(0,-u*.1,u*.1,0,TAU);ctx.arc(u*.38,-u*.1,u*.1,0,TAU);ctx.fill();break;
    case 'arrowUp': B();ctx.moveTo(0,u*.8);ctx.lineTo(0,-u*.7);ctx.moveTo(-u*.45,-u*.25);ctx.lineTo(0,-u*.8);ctx.lineTo(u*.45,-u*.25);ctx.stroke();break;
    case 'arrowR': B();ctx.moveTo(-u*.8,0);ctx.lineTo(u*.7,0);ctx.moveTo(u*.25,-u*.45);ctx.lineTo(u*.8,0);ctx.lineTo(u*.25,u*.45);ctx.stroke();break;
    /* ---- расширенный набор: ниши вне медиа ---- */
    case 'cart': B();ctx.moveTo(-u*.85,-u*.6);ctx.lineTo(-u*.55,-u*.6);ctx.lineTo(-u*.28,u*.28);
      ctx.lineTo(u*.62,u*.28);ctx.lineTo(u*.82,-u*.32);ctx.lineTo(-u*.44,-u*.32);ctx.stroke();
      B();ctx.arc(-u*.16,u*.62,u*.15,0,TAU);ctx.arc(u*.52,u*.62,u*.15,0,TAU);ctx.fill();break;
    case 'truck': B();rrp(-u*.9,-u*.42,u*1.05,u*.84,u*.1);ctx.stroke();
      B();ctx.moveTo(u*.15,-u*.14);ctx.lineTo(u*.55,-u*.14);ctx.lineTo(u*.85,u*.16);ctx.lineTo(u*.85,u*.42);
      ctx.lineTo(u*.15,u*.42);ctx.closePath();ctx.stroke();
      B();ctx.arc(-u*.45,u*.6,u*.18,0,TAU);ctx.arc(u*.5,u*.6,u*.18,0,TAU);ctx.stroke();break;
    case 'box': B();ctx.moveTo(-u*.8,-u*.35);ctx.lineTo(0,-u*.75);ctx.lineTo(u*.8,-u*.35);
      ctx.lineTo(u*.8,u*.5);ctx.lineTo(0,u*.9);ctx.lineTo(-u*.8,u*.5);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.8,-u*.35);ctx.lineTo(0,u*.05);ctx.lineTo(u*.8,-u*.35);
      ctx.moveTo(0,u*.05);ctx.lineTo(0,u*.9);ctx.stroke();break;
    case 'pin': B();ctx.moveTo(0,u*.88);ctx.bezierCurveTo(-u*.75,u*.05,-u*.62,-u*.85,0,-u*.85);
      ctx.bezierCurveTo(u*.62,-u*.85,u*.75,u*.05,0,u*.88);ctx.closePath();ctx.stroke();
      B();ctx.arc(0,-u*.28,u*.24,0,TAU);ctx.stroke();break;
    case 'calendar': B();rrp(-u*.8,-u*.62,u*1.6,u*1.4,u*.14);ctx.stroke();
      B();ctx.moveTo(-u*.8,-u*.2);ctx.lineTo(u*.8,-u*.2);
      ctx.moveTo(-u*.42,-u*.62);ctx.lineTo(-u*.42,-u*.9);
      ctx.moveTo(u*.42,-u*.62);ctx.lineTo(u*.42,-u*.9);ctx.stroke();
      B();ctx.arc(-u*.34,u*.24,u*.11,0,TAU);ctx.arc(u*.06,u*.24,u*.11,0,TAU);ctx.arc(u*.46,u*.24,u*.11,0,TAU);ctx.fill();break;
    case 'star': B();for(let i=0;i<10;i++){const r2=i%2?u*.36:u*.88,a2=-Math.PI/2+i*Math.PI/5;
      const x2=Math.cos(a2)*r2,y2=Math.sin(a2)*r2;i?ctx.lineTo(x2,y2):ctx.moveTo(x2,y2);}
      ctx.closePath();fillA?ctx.fill():ctx.stroke();break;
    case 'shield': B();ctx.moveTo(0,-u*.88);ctx.lineTo(u*.72,-u*.55);ctx.lineTo(u*.72,u*.12);
      ctx.quadraticCurveTo(u*.72,u*.62,0,u*.9);ctx.quadraticCurveTo(-u*.72,u*.62,-u*.72,u*.12);
      ctx.lineTo(-u*.72,-u*.55);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.3,0);ctx.lineTo(-u*.06,u*.26);ctx.lineTo(u*.34,-u*.24);ctx.stroke();break;
    case 'wrench': case 'gear': {
      const teeth=8, r1=u*.86, r0=u*.60, tw2=0.20;
      B();
      for(let i=0;i<teeth;i++){
        const a0=TAU*i/teeth;
        ctx.lineTo(Math.cos(a0-tw2)*r0,Math.sin(a0-tw2)*r0);
        ctx.lineTo(Math.cos(a0-tw2*.62)*r1,Math.sin(a0-tw2*.62)*r1);
        ctx.lineTo(Math.cos(a0+tw2*.62)*r1,Math.sin(a0+tw2*.62)*r1);
        ctx.lineTo(Math.cos(a0+tw2)*r0,Math.sin(a0+tw2)*r0);
        const a1=TAU*(i+1)/teeth;
        ctx.arc(0,0,r0,a0+tw2,a1-tw2);
      }
      ctx.closePath();ctx.stroke();
      B();ctx.arc(0,0,u*.28,0,TAU);ctx.stroke();break; }
    case 'dumbbell': B();ctx.moveTo(-u*.42,0);ctx.lineTo(u*.42,0);ctx.stroke();
      B();rrp(-u*.86,-u*.4,u*.3,u*.8,u*.08);rrp(u*.56,-u*.4,u*.3,u*.8,u*.08);ctx.stroke();
      B();rrp(-u*.56,-u*.56,u*.18,u*1.12,u*.06);rrp(u*.38,-u*.56,u*.18,u*1.12,u*.06);ctx.stroke();break;
    case 'house': B();ctx.moveTo(-u*.85,-u*.02);ctx.lineTo(0,-u*.82);ctx.lineTo(u*.85,-u*.02);ctx.stroke();
      B();ctx.moveTo(-u*.62,-u*.18);ctx.lineTo(-u*.62,u*.82);ctx.lineTo(u*.62,u*.82);ctx.lineTo(u*.62,-u*.18);ctx.stroke();
      B();rrp(-u*.2,u*.26,u*.4,u*.56,u*.04);ctx.stroke();break;
    case 'car': B();ctx.moveTo(-u*.88,u*.2);ctx.lineTo(-u*.7,-u*.2);ctx.lineTo(-u*.42,-u*.55);
      ctx.lineTo(u*.42,-u*.55);ctx.lineTo(u*.7,-u*.2);ctx.lineTo(u*.88,u*.2);ctx.lineTo(u*.88,u*.5);
      ctx.lineTo(-u*.88,u*.5);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.7,-u*.2);ctx.lineTo(u*.7,-u*.2);ctx.stroke();
      B();ctx.arc(-u*.48,u*.5,u*.17,0,TAU);ctx.arc(u*.48,u*.5,u*.17,0,TAU);ctx.stroke();break;
    case 'cap': B();ctx.moveTo(-u*.9,-u*.18);ctx.lineTo(0,-u*.62);ctx.lineTo(u*.9,-u*.18);
      ctx.lineTo(0,u*.26);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.5,u*.02);ctx.lineTo(-u*.5,u*.55);ctx.quadraticCurveTo(0,u*.86,u*.5,u*.55);
      ctx.lineTo(u*.5,u*.02);ctx.stroke();break;
    case 'case': B();rrp(-u*.85,-u*.35,u*1.7,u*1.1,u*.12);ctx.stroke();
      B();ctx.moveTo(-u*.34,-u*.35);ctx.lineTo(-u*.34,-u*.66);ctx.lineTo(u*.34,-u*.66);
      ctx.lineTo(u*.34,-u*.35);ctx.stroke();
      B();ctx.moveTo(-u*.85,u*.14);ctx.lineTo(u*.85,u*.14);ctx.stroke();break;
    case 'wallet': B();rrp(-u*.85,-u*.55,u*1.7,u*1.15,u*.14);ctx.stroke();
      B();rrp(u*.24,-u*.14,u*.75,u*.44,u*.1);ctx.stroke();
      B();ctx.arc(u*.55,u*.08,u*.1,0,TAU);ctx.fill();break;
    case 'coin': B();ctx.arc(0,0,u*.82,0,TAU);ctx.stroke();
      B();ctx.moveTo(0,-u*.5);ctx.lineTo(0,u*.5);ctx.stroke();
      B();ctx.moveTo(u*.24,-u*.3);ctx.quadraticCurveTo(-u*.28,-u*.42,-u*.26,-u*.1);
      ctx.quadraticCurveTo(-u*.24,u*.14,u*.24,u*.3);ctx.stroke();break;
    case 'percent': B();ctx.arc(-u*.4,-u*.4,u*.26,0,TAU);ctx.arc(u*.4,u*.4,u*.26,0,TAU);ctx.stroke();
      B();ctx.moveTo(u*.72,-u*.72);ctx.lineTo(-u*.72,u*.72);ctx.stroke();break;
    case 'users': B();ctx.arc(-u*.3,-u*.3,u*.3,0,TAU);ctx.stroke();
      B();ctx.moveTo(-u*.82,u*.66);ctx.quadraticCurveTo(-u*.3,u*.06,u*.22,u*.66);ctx.stroke();
      B();ctx.arc(u*.44,-u*.4,u*.24,0,TAU);ctx.stroke();
      B();ctx.moveTo(u*.24,u*.5);ctx.quadraticCurveTo(u*.56,u*.14,u*.86,u*.5);ctx.stroke();break;
    case 'phone': B();rrp(-u*.42,-u*.85,u*.84,u*1.7,u*.16);ctx.stroke();
      B();ctx.moveTo(-u*.14,-u*.62);ctx.lineTo(u*.14,-u*.62);ctx.stroke();
      B();ctx.arc(0,u*.56,u*.08,0,TAU);ctx.fill();break;
    case 'globe': B();ctx.arc(0,0,u*.82,0,TAU);ctx.stroke();
      B();ctx.ellipse(0,0,u*.36,u*.82,0,0,TAU);ctx.stroke();
      B();ctx.moveTo(-u*.82,0);ctx.lineTo(u*.82,0);
      ctx.moveTo(-u*.7,-u*.4);ctx.lineTo(u*.7,-u*.4);
      ctx.moveTo(-u*.7,u*.4);ctx.lineTo(u*.7,u*.4);ctx.stroke();break;
    case 'search': B();ctx.arc(-u*.16,-u*.16,u*.5,0,TAU);ctx.stroke();
      B();ctx.moveTo(u*.22,u*.22);ctx.lineTo(u*.78,u*.78);ctx.stroke();break;
    case 'target': B();ctx.arc(0,0,u*.84,0,TAU);ctx.arc(0,0,u*.5,0,TAU);ctx.stroke();
      B();ctx.arc(0,0,u*.16,0,TAU);ctx.fill();break;
    case 'rocket': B();ctx.moveTo(0,-u*.9);ctx.quadraticCurveTo(u*.46,-u*.2,u*.36,u*.46);
      ctx.lineTo(-u*.36,u*.46);ctx.quadraticCurveTo(-u*.46,-u*.2,0,-u*.9);ctx.closePath();ctx.stroke();
      B();ctx.arc(0,-u*.24,u*.19,0,TAU);ctx.stroke();
      B();ctx.moveTo(-u*.36,u*.2);ctx.lineTo(-u*.76,u*.62);ctx.lineTo(-u*.3,u*.56);
      ctx.moveTo(u*.36,u*.2);ctx.lineTo(u*.76,u*.62);ctx.lineTo(u*.3,u*.56);ctx.stroke();
      B();ctx.moveTo(-u*.14,u*.56);ctx.lineTo(0,u*.92);ctx.lineTo(u*.14,u*.56);ctx.stroke();break;
    case 'fire': B();
      ctx.moveTo(u*.04,-u*.92);
      ctx.bezierCurveTo(u*.5,-u*.34,u*.86,-u*.06,u*.78,u*.28);
      ctx.bezierCurveTo(u*.7,u*.72,u*.32,u*.92,0,u*.92);
      ctx.bezierCurveTo(-u*.34,u*.92,-u*.76,u*.7,-u*.78,u*.24);
      ctx.bezierCurveTo(-u*.8,-u*.08,-u*.5,-u*.2,-u*.36,-u*.56);
      ctx.bezierCurveTo(-u*.18,-u*.3,-u*.1,-u*.42,u*.04,-u*.92);
      ctx.closePath();ctx.stroke();
      B();ctx.moveTo(u*.02,-u*.1);ctx.bezierCurveTo(u*.34,u*.18,u*.3,u*.62,0,u*.66);
      ctx.bezierCurveTo(-u*.3,u*.62,-u*.34,u*.2,u*.02,-u*.1);ctx.closePath();ctx.stroke();break;
    case 'lock': B();rrp(-u*.6,-u*.12,u*1.2,u*.94,u*.12);ctx.stroke();
      B();ctx.arc(0,-u*.16,u*.36,Math.PI,0);ctx.stroke();
      B();ctx.arc(0,u*.32,u*.11,0,TAU);ctx.fill();break;
    case 'gift': B();rrp(-u*.8,-u*.28,u*1.6,u*1.1,u*.1);ctx.stroke();
      B();rrp(-u*.9,-u*.62,u*1.8,u*.36,u*.08);ctx.stroke();
      B();ctx.moveTo(0,-u*.62);ctx.lineTo(0,u*.82);ctx.stroke();
      B();ctx.arc(-u*.24,-u*.74,u*.2,0,TAU);ctx.arc(u*.24,-u*.74,u*.2,0,TAU);ctx.stroke();break;
    case 'ticket': B();ctx.moveTo(-u*.88,-u*.5);ctx.lineTo(u*.88,-u*.5);ctx.lineTo(u*.88,-u*.14);
      ctx.arc(u*.88,0,u*.14,-Math.PI/2,Math.PI/2,true);ctx.lineTo(u*.88,u*.5);ctx.lineTo(-u*.88,u*.5);
      ctx.lineTo(-u*.88,u*.14);ctx.arc(-u*.88,0,u*.14,Math.PI/2,-Math.PI/2,true);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(u*.16,-u*.5);ctx.lineTo(u*.16,-u*.3);ctx.moveTo(u*.16,-u*.08);ctx.lineTo(u*.16,u*.08);
      ctx.moveTo(u*.16,u*.3);ctx.lineTo(u*.16,u*.5);ctx.stroke();break;
    case 'pulse': B();ctx.moveTo(-u*.88,0);ctx.lineTo(-u*.38,0);ctx.lineTo(-u*.18,-u*.6);
      ctx.lineTo(u*.06,u*.62);ctx.lineTo(u*.3,-u*.22);ctx.lineTo(u*.46,0);ctx.lineTo(u*.88,0);ctx.stroke();break;
    case 'leaf': B();ctx.moveTo(-u*.7,u*.7);ctx.quadraticCurveTo(-u*.1,u*.5,u*.34,u*.06);
      ctx.quadraticCurveTo(u*.8,-u*.4,u*.72,-u*.82);ctx.quadraticCurveTo(u*.2,-u*.8,-u*.22,-u*.34);
      ctx.quadraticCurveTo(-u*.68,u*.12,-u*.7,u*.7);ctx.closePath();ctx.stroke();
      B();ctx.moveTo(-u*.5,u*.5);ctx.quadraticCurveTo(0,0,u*.6,-u*.66);ctx.stroke();break;
    case 'sparkle': B();for(let k2=0;k2<2;k2++){const sc2=k2?0.5:1,ox=k2?u*.5:0,oy=k2?-u*.5:0;
      ctx.moveTo(ox,oy-u*.85*sc2);
      ctx.quadraticCurveTo(ox+u*.12*sc2,oy-u*.12*sc2,ox+u*.85*sc2,oy);
      ctx.quadraticCurveTo(ox+u*.12*sc2,oy+u*.12*sc2,ox,oy+u*.85*sc2);
      ctx.quadraticCurveTo(ox-u*.12*sc2,oy+u*.12*sc2,ox-u*.85*sc2,oy);
      ctx.quadraticCurveTo(ox-u*.12*sc2,oy-u*.12*sc2,ox,oy-u*.85*sc2);}
      ctx.fill();break;
  }
  ctx.restore();
}
function rrp(x,y,w,h,r){const c=ctx;c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);
  c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}

/* ============================================================
   SUBTITLE ENGINE — 1..3 key words, active word emphasised
   ============================================================ */
const SUB_Y = 1508;
const SUB_HIDE = PLAN.subHide || [];   // ranges where big type replaces subs
function subsHidden(t){for(const r of SUB_HIDE)if(t>=r[0]&&t<r[1])return true;return false;}

function drawSubs(t){
  if(subsHidden(t))return;
  let c=null;
  for(const s of SUBS){ if(t>=s.s-0.16 && t<=s.e+0.34){ c=s; break; } }
  if(!c)return;
  const inP=E.outExpo(cl((t-(c.s-0.14))/0.24));
  const outP=1-cl((t-(c.e+0.16))/0.18);
  const a=cl(inP*outP);
  if(a<=0.01)return;

  /* layout */
  const base=68, bigMul=1.24;
  const sizes=c.words.map(w=>(w.big?base*bigMul:base));
  const gaps=36;
  const measured=c.words.map((w,i)=>{setFont(900,sizes[i],'Mont',1);return tw(w.w);});
  /* wrap into lines <= 940px */
  const lines=[];let line=[],lw=0;
  for(let i=0;i<c.words.length;i++){
    const add=measured[i]+(line.length?gaps:0);
    if(lw+add>960&&line.length){lines.push({idx:line,w:lw});line=[];lw=0;}
    line.push(i);lw+=(line.length>1?gaps:0)+measured[i];
  }
  if(line.length)lines.push({idx:line,w:lw});
  const lh=92;
  const totalH=lines.length*lh;
  const yTop=SUB_Y-totalH/2+lh/2;

  ctx.save();
  ctx.globalAlpha=a;
  ctx.translate(W/2,SUB_Y);
  ctx.translate(0,(1-inP)*46);
  ctx.scale(lerp(.9,1,inP),lerp(.9,1,inP));
  ctx.translate(-W/2,-SUB_Y);

  lines.forEach((L,li)=>{
    let x=W/2-L.w/2;
    const y=yTop+li*lh;
    for(const i of L.idx){
      const w=c.words[i];
      const act=t>=w.s-0.03 && t<=w.e+0.16;
      const pop=E.outBack(cl((t-w.s)/0.16));
      const spoken=t>=w.s-0.03;
      const sc=act?lerp(1,1.06,pop):1;
      const cx=x+measured[i]/2;
      ctx.save();ctx.translate(cx,y);ctx.scale(sc,sc);
      if(act){
        /* accent pill glow behind the live word */
        ctx.save();ctx.globalAlpha=0.30*pop;
        rr(-measured[i]/2-24,-sizes[i]*.62,measured[i]+48,sizes[i]*1.24,20);
        ctx.fillStyle=lgrad(-measured[i]/2,0,measured[i]/2,0,[[0,rgba(P.cyan,.55)],[1,rgba(P.magenta,.55)]]);
        ctx.filter='blur(14px)';ctx.fill();ctx.restore();
      }
      const col = act ? '#FFFFFF' : (spoken? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.34)');
      text(w.w,0,0,{weight:900,size:sizes[i],ls:1,fill:col,
        stroke:'rgba(0,0,0,.55)',strokew:act?9:7,shadow:0});
      if(act){
        text(w.w,0,0,{weight:900,size:sizes[i],ls:1,
          fill:lgrad(-measured[i]/2,0,measured[i]/2,0,[[0,P.cyan],[.55,'#FFFFFF'],[1,P.pink]]),
          glowc:rgba(P.cyan,.9),glowb:26});
      }
      ctx.restore();
      x+=measured[i]+gaps;
    }
  });
  ctx.restore();
}

/* ============================================================
   SCENE FRAMEWORK
   ============================================================ */
/* Scene table, beat times and per-scene texts all come from PLAN (plan.js),
   which is generated from the voice-over by pipeline/plan.py.               */
const SC=PLAN.scenes;
const DURATION=PLAN.duration;
let CUR=SC[0];
/* beat time (absolute seconds) for the scene currently being drawn */
function B(k,dflt){const v=CUR.b?CUR.b[k]:undefined;
  return (v===undefined||v===null)?(dflt===undefined?null:dflt):v;}
/* per-scene text / number parameter */
function PA(k,dflt){const v=CUR.p?CUR.p[k]:undefined;return v===undefined?dflt:v;}
/* fraction of the current scene, as an absolute time */
function F(x){return CUR.s+(CUR.e-CUR.s)*x;}

/* camera shake helper */
function shake(t,amt,freq=42,seed=11){
  const r=mulberry32(seed+Math.floor(t*freq));
  const r2=mulberry32(seed+999+Math.floor(t*freq));
  ctx.translate((r()-.5)*amt,(r2()-.5)*amt);
}

/* ============================================================
   OFFSCREEN + TRANSITION COMPOSITOR
   ============================================================ */
const MAIN=ctx;
const OCV=[0,1].map(()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;});
const OCX=OCV.map(c=>c.getContext('2d',{alpha:false}));
const TRDUR={none:0,glitch:.20,whip:.22,ramp:.24,iris:.30,match:.24,streak:.24,punch:.20};

function renderTo(target,i,t){ const old=ctx; ctx=target; drawScene(i,t); ctx=old; }

function composite(kind,p,i,t,b){
  const A=OCV[0], B2=OCV[1];   /* A = outgoing, B = incoming */
  const q=E.inOutCubic(p);
  ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(kind==='whip'){
    const bl=Math.sin(p*Math.PI)*46;
    ctx.save();ctx.filter=`blur(${bl}px)`;
    ctx.drawImage(A,-W*E.inOutCubic(p),0);
    ctx.drawImage(B2,W*(1-E.inOutCubic(p)),0);
    ctx.restore();
    beam(W*(1-p),H/2,340,H,'#CFF6FF',.45*Math.sin(p*Math.PI));
  }else if(kind==='glitch'){
    ctx.drawImage(B2,0,0);
    const n=9;const rnd=mulberry32(Math.floor(t*90));
    ctx.save();ctx.globalAlpha=1-p;
    for(let k=0;k<n;k++){
      const y=rnd()*H, h=30+rnd()*180, dx=(rnd()-.5)*230*(1-p);
      ctx.drawImage(A,0,y,W,h,dx,y,W,h);
    }
    ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55*(1-p);
    ctx.drawImage(B2,-14*(1-p),0);ctx.globalAlpha=.4*(1-p);ctx.drawImage(A,16*(1-p),0);ctx.restore();
    ctx.save();ctx.globalAlpha=.55*Math.sin(p*Math.PI);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.restore();
  }else if(kind==='ramp'){
    const sa=1+E.inExpo(p)*.9, sb=lerp(.72,1,E.outQuint(p));
    ctx.save();ctx.filter=`blur(${E.inQuad(p)*34}px)`;ctx.globalAlpha=1-E.inQuad(p);
    ctx.translate(W/2,H/2);ctx.scale(sa,sa);ctx.drawImage(A,-W/2,-H/2);ctx.restore();
    ctx.save();ctx.filter=`blur(${(1-E.outQuint(p))*26}px)`;ctx.globalAlpha=E.outQuad(p);
    ctx.translate(W/2,H/2);ctx.scale(sb,sb);ctx.drawImage(B2,-W/2,-H/2);ctx.restore();
  }else if(kind==='iris'){
    ctx.drawImage(A,0,0);
    const r=E.outCubic(p)*Math.hypot(W,H)*.60;
    ctx.save();circle(W/2,H*.5,r);ctx.clip();
    ctx.save();const s=lerp(1.14,1,E.outCubic(p));ctx.translate(W/2,H/2);ctx.scale(s,s);ctx.drawImage(B2,-W/2,-H/2);ctx.restore();
    ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';circle(W/2,H*.5,r);
    ctx.strokeStyle=rgba(P.cyan,.9*(1-p*.6));ctx.lineWidth=10;ctx.shadowColor=P.cyan;ctx.shadowBlur=40;ctx.stroke();ctx.restore();
  }else if(kind==='match'){
    const sa=lerp(1,3.4,E.inExpo(p)), sb=lerp(.34,1,E.outQuint(p));
    ctx.save();ctx.filter=`blur(${E.inQuad(p)*26}px)`;ctx.globalAlpha=1-E.inQuad(p*1.05);
    ctx.translate(W/2,H*.46);ctx.scale(sa,sa);ctx.drawImage(A,-W/2,-H*.46);ctx.restore();
    ctx.save();ctx.globalAlpha=E.outQuad(p);ctx.filter=`blur(${(1-E.outQuint(p))*18}px)`;
    ctx.translate(W/2,H*.46);ctx.scale(sb,sb);ctx.drawImage(B2,-W/2,-H*.46);ctx.restore();
  }else if(kind==='streak'){
    const x=E.inOutQuint(p)*W*1.4-W*.2;
    ctx.drawImage(A,0,0);
    ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(x,0);ctx.lineTo(x-160,H);ctx.lineTo(0,H);ctx.closePath();ctx.clip();
    ctx.drawImage(B2,0,0);ctx.restore();
    ctx.save();ctx.globalCompositeOperation='screen';ctx.translate(x-80,0);ctx.rotate(0);
    ctx.fillStyle=lgrad(-150,0,150,0,[[0,'rgba(120,220,255,0)'],[.5,'rgba(200,245,255,.95)'],[1,'rgba(120,220,255,0)']]);
    ctx.transform(1,0,-160/H,1,0,0);ctx.fillRect(-150,0,300,H);ctx.restore();
  }else if(kind==='punch'){
    const sb=lerp(1.35,1,E.outQuint(p));
    ctx.save();ctx.globalAlpha=1-E.outQuad(p);ctx.translate(W/2,H/2);
    const sa=lerp(1,.82,E.outQuint(p));ctx.scale(sa,sa);ctx.drawImage(A,-W/2,-H/2);ctx.restore();
    ctx.save();ctx.globalAlpha=E.outQuad(p*1.3);ctx.translate(W/2,H/2);ctx.scale(sb,sb);
    ctx.filter=`blur(${(1-E.outQuint(p))*20}px)`;ctx.drawImage(B2,-W/2,-H/2);ctx.restore();
    ctx.save();ctx.globalAlpha=.85*Math.pow(1-p,1.6);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.restore();
  }else{ ctx.drawImage(B2,0,0); }
}

window.render=function(t){
  NOW=t;
  let i=0;
  for(let k=0;k<SC.length;k++){ if(t>=SC[k].s){ i=k; } }
  const b=SC[i].s, kind=i>0?(SC[i].tr||'punch'):'none', dur=TRDUR[kind]||0;
  ctx=MAIN;
  if(i>0 && t<b+dur && dur>0){
    renderTo(OCX[0],i-1,t);
    renderTo(OCX[1],i,t);
    composite(kind,cl((t-b)/dur),i,t,b);
  }else{
    drawScene(i,t);
  }
  ctx=MAIN;
  drawSubs(t);
  grain(t,0.05);
  vignette(.8);
};

function drawScene(i,t){
  /* slow cinematic camera move so nothing ever sits perfectly still */
  const d=SC[i].e-SC[i].s, k=cl((t-SC[i].s)/d), dir=(i%2)?-1:1;
  ctx.save();
  const zoom=1+0.045*(dir>0?k:1-k);
  ctx.translate(W/2,H*0.46);ctx.scale(zoom,zoom);ctx.translate(-W/2,-H*0.46);
  ctx.translate(dir*10*Math.sin(k*Math.PI), 8*Math.sin(k*Math.PI*1.3+1));
  drawSceneInner(i,t);
  ctx.restore();
}
function drawSceneInner(i,t){
  CUR=SC[i];
  const lt=t-SC[i].s;
  switch(SC[i].n){
    case 'hook': scHook(lt,t); break;
    case 'boring': scBoring(lt,t); break;
    case 'comp': scComp(lt,t); break;
    case 'scroll': scScroll(lt,t); break;
    case 'pipe': scPipe(lt,t); break;
    case 'noeff': scNoeff(lt,t); break;
    case 'result': scResult(lt,t); break;
    case 'cta': scCta(lt,t); break;
    case 'kinetic': scKinetic(lt,t); break;
    case 'offer': scOffer(lt,t); break;
    case 'costs': scCosts(lt,t); break;
  }
}

/* ---------- shared helpers for scenes ---------- */
function fitText(txt,maxW,weight,ls,start,fam='Mont'){
  let s=start;
  for(let k=0;k<40;k++){setFont(weight,s,fam,ls);if(tw(txt)<=maxW)break;s-=6;}
  return s;
}
/* impact word: slams in with blur + overshoot */
function slam(txt,x,y,size,t0,t,o={}){
  const {ls=2,weight=900,grad=null,col='#FFFFFF',glowc=null,glowb=0,hold=99,rot=0,stroke=null,strokew=0}=o;
  const p=cl((t-t0)/0.20);
  if(p<=0)return;
  const e=E.outExpo(p), eb=E.outBack(cl((t-t0)/0.34));
  const sc=lerp(2.35,1,e)*lerp(1.06,1,cl((t-t0)/0.34));
  const bl=(1-e)*30;
  const a=cl(p*3);
  ctx.save();ctx.globalAlpha*=a*cl((t0+hold+0.2-t)/0.2);
  ctx.translate(x,y);ctx.rotate(rot*(1-e*0.7));ctx.scale(sc,sc);
  if(bl>0.6)ctx.filter=`blur(${bl}px)`;
  setFont(weight,size,'Mont',ls);
  const w=tw(txt);
  const fill=grad?lgrad(-w/2,-size*.5,w/2,size*.5,grad):col;
  if(stroke){ctx.lineWidth=strokew;ctx.strokeStyle=stroke;ctx.lineJoin='round';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeText(txt,0,0);}
  text(txt,0,0,{weight,size,ls,fill,glowc,glowb});
  ctx.restore();
}
/* shock ring */
function ring(x,y,t0,t,o={}){
  const {dur=.55,r0=40,r1=760,col=P.cyan,lw=10,a=.85}=o;
  const p=cl((t-t0)/dur); if(p<=0||p>=1)return;
  const e=E.outQuint(p);
  ctx.save();ctx.globalCompositeOperation='screen';
  circle(x,y,lerp(r0,r1,e));ctx.strokeStyle=rgba(col,a*(1-p));ctx.lineWidth=lw*(1-p*.7);
  ctx.shadowColor=col;ctx.shadowBlur=34;ctx.stroke();ctx.restore();
}
/* radial speed lines */
function speedLines(t,o={}){
  const {n=64,col='#FFFFFF',a=.20,rot=.12,seed=5,inner=280,len=1100}=o;
  const rnd=mulberry32(seed);ctx.save();ctx.translate(W/2,H*.5);ctx.rotate(t*rot);
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<n;i++){
    const ang=rnd()*TAU, l=len*(.35+rnd()*.9), w0=1+rnd()*4;
    ctx.save();ctx.rotate(ang);
    ctx.fillStyle=lgrad(inner,0,inner+l,0,[[0,rgba(col,0)],[.4,rgba(col,a*(.4+rnd()*.6))],[1,rgba(col,0)]]);
    ctx.fillRect(inner,-w0/2,l,w0);ctx.restore();
  }
  ctx.restore();
}
function flash(t,t0,dur=.10,a=.9,col='#FFFFFF'){
  const p=cl((t-t0)/dur);if(p<=0||p>=1)return;
  ctx.save();ctx.globalAlpha=a*Math.pow(1-p,1.8);ctx.fillStyle=col;ctx.fillRect(0,0,W,H);ctx.restore();
}

/* ============================================================
   SCENE 0 — HOOK  (0.00 – 1.45)
   ============================================================ */
function scHook(lt,t){
  /* charged black background */
  ctx.fillStyle='#020306';ctx.fillRect(0,0,W,H);
  const burst=E.outQuint(cl((lt+0.22)/0.9));
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle=rgrad(W/2,H*.5,0,lerp(200,1200,burst),
    [[0,rgba(P.magenta,.35)],[.35,rgba(P.violet,.22)],[.75,rgba(P.blue,.10)],[1,'rgba(0,0,0,0)']]);
  ctx.fillRect(0,0,W,H);ctx.restore();
  speedLines(t,{a:.13+.10*Math.sin(t*9),n:70,inner:300,len:1200,rot:.10});
  grid(t,{alpha:.07,color:'#7FE9FF',size:120,speed:.9});

  /* shake on beats */
  ctx.save();
  const W1=B('w1',F(.03)), W2=B('w2',F(.30)), W3=B('w3',F(.62));
  const beats=[W1,W2,W3];
  let sh=0;beats.forEach(b=>{sh+=Math.max(0,1-(t-b)/0.16)*(t>=b?1:0)*16;});
  if(sh>0){shake(t,sh,55,3);}

  const y0=H*0.395, y1=H*0.505, y2=H*0.612;
  /* line 1 */
  const L1=PA('l1','ВАШИ'), L2=PA('l2','REELS'), L3=PA('l3','ПРОЛИСТЫВАЮТ?');
  const s0=fitText(L1,900,900,4,168);
  slam(L1,W/2,y0,s0,W1,t,{ls:4,col:'#FFFFFF',glowc:'rgba(255,255,255,.5)',glowb:24});
  /* line 2 — hero */
  const s1=fitText(L2,960,900,2,268);
  slam(L2,W/2,y1,s1,W2,t,{ls:2,
    grad:[[0,'#7FF3FF'],[.35,'#B58CFF'],[.7,'#FF5FA8'],[1,'#FFD36E']],
    glowc:'rgba(160,120,255,.85)',glowb:46,stroke:'rgba(255,255,255,.10)',strokew:2});
  /* line 3 */
  const s2=fitText(L3,960,900,2,112);
  slam(L3,W/2,y2,s2,W3,t,{ls:2,col:'#FF5470',
    glowc:'rgba(255,60,90,.8)',glowb:38});
  ctx.restore();

  /* shock rings on each beat */
  ring(W/2,y0,W1,t,{col:'#FFFFFF',r1:620,dur:.45,a:.5});
  ring(W/2,y1,W2,t,{col:P.violet,r1:900,dur:.6,lw:14});
  ring(W/2,y2,W3,t,{col:P.red,r1:820,dur:.55,lw:12});

  /* swipe-away streak implying the scroll */
  if(t>W3+0.02){
    const p=cl((t-(W3+0.02))/0.42), e=E.outQuint(p);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-p)*.9;
    const yy=lerp(H*1.0,H*.12,e);
    ctx.fillStyle=lgrad(0,yy-260,0,yy+80,[[0,'rgba(255,255,255,0)'],[.75,'rgba(190,235,255,.75)'],[1,'rgba(255,255,255,0)']]);
    ctx.fillRect(W*.14,yy-260,W*.72,340);ctx.restore();
  }
  flash(t,CUR.s,.09,.5);flash(t,W1,.10,.55);flash(t,W2,.12,.7);flash(t,W3,.10,.6);
  /* corner ticks */
  hud(t,0.35);
}
/* thin HUD frame — premium technical feel */
function hud(t,a=.5,col='#9FE8FF'){
  ctx.save();ctx.globalAlpha=a;ctx.strokeStyle=col;ctx.lineWidth=3;ctx.lineCap='square';
  const m=54,L=64;
  const c=[[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]];
  for(const [x,y,sx,sy] of c){ctx.beginPath();ctx.moveTo(x+sx*L,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*L);ctx.stroke();}
  ctx.restore();
}

/* ============================================================
   SCENE 1 — BORING FEED  (1.45 – 3.88)
   ============================================================ */
function boringCard(x,y,w,h,seed,dull){
  const rnd=mulberry32(seed);
  ctx.save();
  rr(x,y,w,h,18);ctx.fillStyle=dull?'#141821':'#171C27';ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1.5;ctx.stroke();
  /* fake thumbnail */
  rr(x+16,y+16,w-32,h*.52,12);ctx.fillStyle='#1E2431';ctx.fill();
  ctx.save();rr(x+16,y+16,w-32,h*.52,12);ctx.clip();
  for(let i=0;i<5;i++){const bx=x+16+rnd()*(w-32),by=y+16+rnd()*(h*.52);
    ctx.fillStyle=`rgba(255,255,255,${.02+rnd()*.03})`;ctx.fillRect(bx,by,60+rnd()*130,10+rnd()*40);}
  ctx.restore();
  /* grey text lines */
  for(let i=0;i<3;i++){rr(x+18,y+h*.52+40+i*26,(w-56)*(1-i*.22),12,6);
    ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();}
  ctx.restore();
}
function scBoring(lt,t){
  const DUP=B('dupes',F(.27)), STAMP=B('stamp',F(.52)), FLICK=B('flick',F(.76)),
        MET=B('metrics',F(.10)), OUT=B('outro',FLICK!==null?FLICK+0.14:F(.82)), END=CUR.e;
  bgBase(t,'#0B1018','#05070C');
  ctx.save();ctx.globalAlpha=.5;grid(t,{alpha:.10,color:'#5C6C86',size:110,speed:.10});ctx.restore();
  /* slow desaturated drift */
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle=rgrad(W*.5,H*.42,0,760,[[0,'rgba(80,100,130,.20)'],[1,'rgba(0,0,0,0)']]);
  ctx.fillRect(0,0,W,H);ctx.restore();

  /* label */
  const lp=E.outExpo(cl(lt/.35));
  ctx.save();ctx.globalAlpha=lp*cl((FLICK-t)/.2);
  chip(W/2,H*.155,PA('chip','ВАШ КОНТЕНТ СЕЙЧАС'),{col:'#7C8AA3',size:26,fillA:.06});
  ctx.restore();

  /* flick-away of the whole feed at 3.33 */
  const fp=cl((t-FLICK)/0.46), fe=E.inOutQuint(fp);
  ctx.save();
  ctx.translate(0,-fe*H*1.25);
  if(fp>0){ctx.filter=`blur(${Math.sin(fp*Math.PI)*26}px)`;}

  /* main phone */
  const px=W/2, py=H*.475, pw=560, ph=980;
  const ep=E.outBack(cl(lt/.42));
  ctx.save();ctx.translate(px,py);ctx.scale(lerp(.86,1,ep),lerp(.86,1,ep));ctx.globalAlpha=cl(lt/.25);
  ctx.translate(-px,-py);
  phone(px,py,pw,ph,{border:'#232A38'});
  ctx.save();rr(px-pw/2+9,py-ph/2+9,pw-18,ph-18,46);ctx.clip();
  ctx.fillStyle='#0C1017';ctx.fillRect(px-pw/2,py-ph/2,pw,ph);
  /* static boring feed inside */
  const off=(Math.sin(t*.5)*10);
  boringCard(px-pw/2+30,py-ph/2+40+off,pw-60,430,21,true);
  boringCard(px-pw/2+30,py-ph/2+500+off,pw-60,430,22,true);
  /* flat engagement line */
  ctx.save();ctx.globalAlpha=.9;
  ctx.beginPath();ctx.moveTo(px-pw/2+40,py+ph/2-90);ctx.lineTo(px+pw/2-40,py+ph/2-88);
  ctx.strokeStyle='#3C4658';ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();ctx.restore();
  ctx.restore();
  ctx.restore();

  /* "ОДИНАКОВО" duplicate cards fanning out at 2.13 */
  const dp=cl((t-DUP)/0.5);
  if(dp>0){
    for(let i=0;i<3;i++){
      const e=E.outBack(cl((dp-i*.10)/.5));
      ctx.save();ctx.globalAlpha=e*.55*cl((FLICK-t)/.25);
      ctx.translate(px,py);ctx.rotate((i-1)*0.10*e);ctx.translate(0,-30*e);
      ctx.scale(lerp(1,1.0,e),1);
      const sw=pw*.62,sh=ph*.62;
      ctx.translate((i-1)*300*e,0);
      rr(-sw/2,-sh/2,sw,sh,30);ctx.fillStyle='rgba(20,25,34,.92)';ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;ctx.stroke();
      rr(-sw/2+22,-sh/2+22,sw-44,sh*.42,16);ctx.fillStyle='rgba(255,255,255,.05)';ctx.fill();
      for(let k=0;k<3;k++){rr(-sw/2+24,-sh/2+sh*.5+k*30,(sw-60)*(1-k*.2),12,6);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();}
      ctx.restore();
    }
  }

  /* СКУЧНО stamp at 2.73 */
  const sp=cl((t-STAMP)/0.30);
  if(sp>0){
    const e=E.outBack(sp);
    ctx.save();
    ctx.translate(W/2,H*.475);ctx.rotate(-0.19*lerp(1.6,1,e));ctx.scale(lerp(2.1,1,E.outExpo(sp)),lerp(2.1,1,E.outExpo(sp)));
    ctx.globalAlpha=cl(sp*3)*cl((FLICK+.32-t)/.22);
    const STXT=PA('stamp','СКУЧНО');
    const s=fitText(STXT,820,900,6,150);
    setFont(900,s,'Mont',6);const wS=tw(STXT);
    rr(-wS/2-40,-96,wS+80,192,14);ctx.strokeStyle='#FF3B5C';ctx.lineWidth=9;ctx.stroke();
    ctx.fillStyle='rgba(255,59,92,.10)';ctx.fill();
    text(STXT,0,4,{weight:900,size:s,ls:6,fill:'#FF4D66',glowc:'rgba(255,59,92,.75)',glowb:34});
    ctx.restore();
    ring(W/2,H*.475,STAMP+.02,t,{col:P.red,r1:700,dur:.5,lw:10,a:.6});
  }
  ctx.restore();  /* end flick group */

  /* metric drop readout */
  const mp=cl((t-MET)/0.9);
  if(mp>0&&t<FLICK+.25){
    ctx.save();ctx.globalAlpha=cl(mp*2)*cl((FLICK+.25-t)/.25);
    const val=Math.round(lerp(PA('metricFrom',214),PA('metricTo',9),E.outQuint(cl((t-MET-.2)/1.1))));
    ctx.textAlign='center';
    text(PA('metricLabel','ПРОСМОТРЫ'),W/2-2.5,H*.700,{weight:800,size:24,fam:'Inter',ls:5,fill:'rgba(255,255,255,.42)'});
    text(fmt(val),W/2-24,H*.752,{weight:900,size:78,fill:'#7E8AA0'});
    ctx.save();ctx.translate(W/2+96,H*.752);ctx.rotate(Math.PI);
    ic('arrowUp',0,0,50,'#FF3B5C',7);ctx.restore();
    ctx.restore();
  }
  /* fast thumb swipe at 3.33 */
  if(t>FLICK-.02&&t<FLICK+.45){
    const p=cl((t-(FLICK-.02))/.4),e=E.inOutQuint(p);
    ctx.save();ctx.globalAlpha=(1-p)*.9;ctx.globalCompositeOperation='screen';
    const yy=lerp(H*1.02,H*.05,e);
    const gr=lgrad(0,yy-320,0,yy+70,[[0,'rgba(255,255,255,0)'],[.82,'rgba(210,235,255,.62)'],[1,'rgba(255,255,255,0)']]);
    ctx.save();ctx.beginPath();ctx.ellipse(W/2,yy-130,W*.46,240,0,0,TAU);ctx.clip();
    ctx.fillStyle=gr;ctx.fillRect(0,yy-320,W,400);ctx.restore();ctx.restore();
  }
  boringOutro(t,OUT,END);
}


/* post-flick beat for the boring scene: "пролистали" */
function boringOutro(t,OUT,END){
  if(t<OUT)return;
  const p=cl((t-OUT)/0.30), e=E.outBack(p);
  ctx.save();ctx.globalAlpha=cl(p*3)*cl((END+.36-t)/.12);
  ctx.translate(W/2,H*.47);ctx.scale(lerp(1.5,1,E.outExpo(p)),lerp(1.5,1,E.outExpo(p)));
  ctx.save();ctx.translate(0,-130);ctx.rotate(Math.PI);ic('arrowUp',0,0,150,'#FF3B5C',12);ctx.restore();
  const O1=PA('outro1','ПРОЛИСТАЛИ'), O2=PA('outro2','ЗА 1.2 СЕКУНДЫ');
  const s=fitText(O1,900,900,3,120);
  text(O1,0,40,{weight:900,size:s,ls:3,fill:'#FF5470',glowc:'rgba(255,60,90,.7)',glowb:34});
  text(O2,0,130,{weight:800,size:38,fam:'Inter',ls:8,fill:'rgba(255,255,255,.55)'});
  ctx.restore();
  ring(W/2,H*.47,OUT+.02,t,{col:P.red,r1:700,dur:.5,lw:8,a:.5});
}

/* ============================================================
   SCENE 2 — COMPETITORS (3.88 – 11.72)  multi-beat
   ============================================================ */
/* sub-beats: the plan supplies whichever of these it found in the speech;
   missing ones are dropped and the rest spread over the scene.             */
function compBeats(){
  const names=['split','timer','graphics','dynamic','ai'];
  let out=names.map(n=>({name:n,s:B(n,null)})).filter(o=>o.s!==null);
  if(!out.length) out=[{name:'split',s:CUR.s}];
  out.sort((a,b2)=>a.s-b2.s);
  for(let i=0;i<out.length;i++) out[i].e=out[i+1]?out[i+1].s:CUR.e;
  return out;
}
function beatOf(t){
  const cb=compBeats();
  let i=0;for(let k=0;k<cb.length;k++)if(t>=cb[k].s)i=k;
  return {i,name:cb[i].name,s:cb[i].s,lt:t-cb[i].s,e:cb[i].e,all:cb};
}
function scComp(lt,t){
  bgBase(t,'#0B1430','#04060B');
  aurora(t,[P.violet,P.cyan,P.magenta],.85,1);
  grid(t,{alpha:.10,color:'#6FE3FF',size:96,speed:.55});
  particles(t,{n:70,color:'#9FD8FF',alpha:.35,speed:34,seed:9});
  const b=beatOf(t);
  /* entry pop for each sub-beat */
  const ep=E.outQuint(cl(b.lt/0.30));
  ctx.save();
  ctx.translate(W/2,H*.46);ctx.scale(lerp(1.10,1,ep),lerp(1.10,1,ep));ctx.translate(-W/2,-H*.46);
  ctx.globalAlpha=cl(b.lt/0.10);
  if(b.name==='split')    cbSplit(b.lt,t,b);
  if(b.name==='timer')    cbTimer(b.lt,t,b);
  if(b.name==='graphics') cbGraphics(b.lt,t,b);
  if(b.name==='dynamic')  cbDynamic(b.lt,t,b);
  if(b.name==='ai')       cbAI(b.lt,t,b);
  ctx.restore();
  for(const c of b.all) flash(t,c.s,.09,.35,'#CFF3FF');
  scan(t,{alpha:.05,h:420,speed:640});
  hud(t,.20);
}

/* --- beat A: split ВЫ / КОНКУРЕНТЫ --- */
function cbSplit(lt,t,BE){
  const topY=248, botY=772, TOPH=468, BOTH=584, DIV=740;
  /* divider */
  const dp=E.outExpo(cl(lt/.35));
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=dp;
  ctx.beginPath();ctx.moveTo(0,DIV+16);ctx.lineTo(W*dp,DIV-16*dp);
  ctx.strokeStyle=rgba(P.cyan,.75);ctx.lineWidth=3;ctx.shadowColor=P.cyan;ctx.shadowBlur=26;ctx.stroke();ctx.restore();

  /* TOP — ВЫ (dull) */
  ctx.save();ctx.globalAlpha=cl(lt/.25)*.98;
  glass(70,topY,W-140,TOPH,28,{fillA:.03,border:.10});
  text(PA('you','ВЫ'),118,topY+62,{align:'left',weight:900,size:56,ls:2,fill:'rgba(255,255,255,.55)'});
  chip(W-215,topY+62,'СТАТИКА',{col:'#6B7689',size:22,fillA:.05});
  /* flat line */
  const fx=130,fy=topY+120,fw=W-260,fh=300;
  ctx.beginPath();ctx.moveTo(fx,fy+fh*.72);
  for(let i=0;i<=40;i++)ctx.lineTo(fx+fw*i/40,fy+fh*.72+Math.sin(i*.7+t)*3);
  ctx.strokeStyle='#48536A';ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();
  text('0.8%',fx+8,fy+fh*.28,{align:'left',weight:900,size:60,fill:'#5D6879'});
  text('ВОВЛЕЧЁННОСТЬ',fx+8,fy+fh*.62,{align:'left',weight:700,size:24,fam:'Inter',ls:4,fill:'rgba(255,255,255,.28)'});
  ctx.restore();

  /* BOTTOM — КОНКУРЕНТЫ (vivid) */
  const kp=cl((lt-.28)/.35), ke=E.outBack(cl(kp));
  ctx.save();ctx.globalAlpha=cl(kp*2.2);
  ctx.translate(W/2,botY+BOTH/2);ctx.scale(lerp(.94,1,ke),lerp(.94,1,ke));ctx.translate(-W/2,-(botY+BOTH/2));
  glass(70,botY,W-140,BOTH,28,{fillA:.07,border:.22,bcol:'#7FE9FF'});
  ctx.save();rr(70,botY,W-140,BOTH,28);ctx.clip();
  ctx.fillStyle=lgrad(70,botY,W-70,botY+BOTH,[[0,rgba(P.violet,.16)],[.6,rgba(P.cyan,.10)],[1,rgba(P.magenta,.14)]]);
  ctx.fillRect(70,botY,W-140,BOTH);ctx.restore();
  const RIV=PA('rival','КОНКУРЕНТЫ');
  const s=fitText(RIV,700,900,2,58);
  gtext(RIV,118,botY+62,{align:'left',weight:900,size:s,ls:2,
    stops:[[0,'#7FF3FF'],[1,'#FF6FB0']]});
  chip(W-215,botY+62,'ДИНАМИКА',{col:P.cyan,size:22,fillA:.14});
  const cx=130,cy=botY+118,cw=W-260,ch=300;
  chartLine(cx,cy,cw,ch,[.06,.12,.10,.26,.34,.52,.66,.86,1.0],E.outQuint(cl((lt-.40)/1.25)),
    {col:P.cyan,lw:9,fillA:.22,glowb:30});
  /* «+340%» или «×5.4» — зависит от того, как об этом сказали в озвучке */
  const gTarget=PA('growth',340), gUnit=PA('growthUnit','%');
  const gp=E.outQuint(cl((lt-.47)/1.2));
  const growVal = gUnit==='x' ? '×'+(gTarget*gp).toFixed(1)
                              : '+'+Math.round(gTarget*gp)+'%';
  text(growVal,cx+8,cy+42,{align:'left',weight:900,size:74,
    fill:lgrad(cx,cy,cx+340,cy+80,[[0,'#7FF3FF'],[1,'#B58CFF']]),glowc:rgba(P.cyan,.7),glowb:26});
  text('ОХВАТ И ВОВЛЕЧЁННОСТЬ',cx+8,cy+96,{align:'left',weight:700,size:24,fam:'Inter',ls:4,fill:'rgba(255,255,255,.5)'});
  ctx.restore();

  /* attention rings + eye on the "grabs attention" beat */
  const ATT=B('attention',BE.s+.96);
  if(t>ATT-.04 && ATT<BE.e-.35){
    const ax=W/2, ay=DIV;
    for(let k=0;k<3;k++) ring(ax,ay,ATT+k*.22,t,{col:k%2?P.magenta:P.cyan,r0:30,r1:560,dur:.85,lw:7,a:.5});
    const p=E.outBack(cl((t-ATT)/.4));
    ctx.save();ctx.globalAlpha=cl((t-(ATT-.02))/.15)*cl((BE.e-t)/.2);
    ctx.translate(ax,ay);ctx.scale(p,p);
    circle(0,0,74);ctx.fillStyle='rgba(6,10,18,.9)';ctx.fill();
    ctx.strokeStyle=P.cyan;ctx.lineWidth=4;ctx.shadowColor=P.cyan;ctx.shadowBlur=26;ctx.stroke();
    ic('eye',0,0,86,'#EAFBFF',6);
    ctx.restore();
    ctx.save();ctx.globalAlpha=cl((t-(ATT+.42))/.2)*cl((BE.e-t)/.2);
    chip(W/2,DIV+150,PA('attentionChip','ВНИМАНИЕ ЗАХВАЧЕНО'),{col:P.magenta,size:24,fillA:.16});
    ctx.restore();
  }
}

/* --- beat B: first 3 seconds timer --- */
function cbTimer(lt,t,BE){
  const cx=W/2, cy=H*.375, R=250;
  const p=cl(lt/0.95);
  ctx.save();
  /* dial */
  circle(cx,cy,R);ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=20;ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+TAU*p);
  ctx.strokeStyle=lgrad(cx-R,cy-R,cx+R,cy+R,[[0,'#7FF3FF'],[.5,'#B58CFF'],[1,'#FF5FA8']]);
  ctx.lineWidth=20;ctx.lineCap='round';ctx.shadowColor=P.violet;ctx.shadowBlur=38;ctx.stroke();
  /* ticks */
  for(let i=0;i<60;i++){const a=-Math.PI/2+TAU*i/60;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(a);
    ctx.globalAlpha=(i/60<p)?.85:.22;ctx.fillStyle=(i/60<p)?'#BFE9FF':'#5A6478';
    ctx.fillRect(R-52,-2,(i%5===0)?26:14,4);ctx.restore();}
  ctx.restore();
  const secs=(p*3).toFixed(1);
  text(secs,cx,cy-14,{weight:900,size:150,fill:'#FFFFFF',glowc:'rgba(180,220,255,.6)',glowb:30});
  text('СЕКУНДЫ',cx-3,cy+90,{weight:800,size:30,fam:'Inter',ls:9,fill:'rgba(255,255,255,.5)'});
  ring(cx,cy,BE.s+.04,t,{col:P.cyan,r0:200,r1:820,dur:.7,lw:8,a:.45});

  const T1=PA('timerTop','ПЕРВЫЕ 3 СЕКУНДЫ'), T2=PA('timerBottom','РЕШАЮТ ВСЁ');
  const s=fitText(T1,940,900,2,86);
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.18)/.3));
  ctx.translate(0,(1-E.outExpo(cl((lt-.18)/.3)))*30);
  text(T1,W/2,1130,{weight:900,size:s,ls:2,fill:'#FFFFFF',shadow:20});
  ctx.restore();
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.38)/.3));
  gtext(T2,W/2,1226,{weight:900,size:fitText(T2,900,900,3,74),ls:3,stops:[[0,'#7FF3FF'],[1,'#FF6FB0']]});
  ctx.restore();
  /* retention bar */
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.5)/.35));
  const bx=190,by=1320,bw=W-380,bh=20;
  rr(bx,by,bw,bh,bh/2);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();
  const rp=E.outQuint(cl((lt-.5)/.7));
  rr(bx,by,bw*rp,bh,bh/2);ctx.fillStyle=lgrad(bx,0,bx+bw,0,[[0,'#7FF3FF'],[1,'#FF5FA8']]);
  ctx.shadowColor=P.cyan;ctx.shadowBlur=22;ctx.fill();ctx.restore();
}

/* --- beat C: powerful motion graphics --- */
function cbGraphics(lt,t,BE){
  const cx=W/2, cy=H*.40;
  /* big background word */
  ctx.save();ctx.globalAlpha=.075+.03*Math.sin(t*6);
  const bs=fitText('GRAPHICS',1000,900,10,210);
  text('GRAPHICS',cx,cy,{weight:900,size:bs,ls:10,fill:'#FFFFFF'});
  ctx.restore();
  /* rotating geometric core */
  ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='screen';
  for(let k=0;k<3;k++){
    const a=t*(0.5+k*0.35)*(k%2?-1:1), r=140+k*66;
    ctx.save();ctx.rotate(a);
    ctx.strokeStyle=rgba([P.cyan,P.violet,P.magenta][k],.45);ctx.lineWidth=3;
    ctx.shadowColor=[P.cyan,P.violet,P.magenta][k];ctx.shadowBlur=22;
    ctx.beginPath();
    const sides=3+k*2;
    for(let i=0;i<=sides;i++){const ang=TAU*i/sides;const x=Math.cos(ang)*r,y=Math.sin(ang)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.stroke();ctx.restore();
  }
  ctx.restore();
  /* orbiting mini-graphic cards */
  const rnd=mulberry32(41);
  const cards=[
    {t:'bars',x:-282,y:-268,w:300,h:206,c:P.cyan},
    {t:'wave',x:282,y:-206,w:308,h:190,c:P.magenta},
    {t:'chart',x:-266,y:246,w:330,h:226,c:P.violet},
    {t:'kinetic',x:288,y:266,w:300,h:206,c:P.amber},
  ];
  cards.forEach((c,i)=>{
    const p=E.outBack(cl((lt-i*.09)/.42));
    if(p<=0)return;
    ctx.save();ctx.globalAlpha=cl(p*1.6);
    const fx=Math.sin(t*1.3+i*2)*16, fy=Math.cos(t*1.1+i*3)*14;
    ctx.translate(cx+c.x*p+fx,cy+c.y*p+fy);
    ctx.rotate(Math.sin(t*.8+i)*0.035);
    ctx.scale(p,p);
    glass(-c.w/2,-c.h/2,c.w,c.h,22,{fillA:.07,border:.2,bcol:'#BFE9FF'});
    ctx.save();rr(-c.w/2,-c.h/2,c.w,c.h,22);ctx.clip();
    if(c.t==='bars'){const v=[.4,.7,.5,.9,.65,1.0];
      bars(-c.w/2+26,-c.h/2+30,c.w-52,c.h-60,v.map((x,k)=>x*(.6+.4*Math.abs(Math.sin(t*3+k)))),1,{col:c.c,gap:10,rad:5,glowb:14});}
    if(c.t==='wave'){ctx.beginPath();
      for(let k=0;k<=60;k++){const x=-c.w/2+16+(c.w-32)*k/60;
        const y=Math.sin(k*.35+t*7)*Math.sin(k*.08)*(c.h*.28);
        k?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle=c.c;ctx.lineWidth=5;ctx.lineCap='round';ctx.shadowColor=c.c;ctx.shadowBlur=20;ctx.stroke();}
    if(c.t==='chart'){chartLine(-c.w/2+22,-c.h/2+28,c.w-44,c.h-56,[.1,.3,.2,.5,.45,.75,1],cl((lt-.14)/.9),{col:c.c,lw:5,glowb:18});}
    if(c.t==='kinetic'){
      for(let k=0;k<4;k++){const o=(t*90+k*40)%(c.w+120)-60;
        rr(-c.w/2+o,-c.h/2+26+k*40,70,20,10);ctx.fillStyle=rgba(c.c,.75-k*.13);ctx.fill();}
    }
    ctx.restore();ctx.restore();
  });
  /* center label */
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.28)/.3));
  const GT=PA('graphicsLabel','МОЩНАЯ ГРАФИКА');
  const s=fitText(GT,900,900,2,86);
  ctx.translate(0,(1-E.outExpo(cl((lt-.28)/.3)))*24);
  text(GT,cx,1300,{weight:900,size:s,ls:2,fill:'#FFFFFF',shadow:22});
  ctx.restore();
  ring(cx,cy,BE.s+.04,t,{col:P.violet,r1:900,dur:.8,lw:8,a:.4});
}

/* --- beat D: dynamics / speed --- */
function cbDynamic(lt,t,BE){
  const cx=W/2, cy=H*.40;
  /* motion stripes */
  ctx.save();ctx.globalCompositeOperation='screen';
  const rnd=mulberry32(77);
  for(let i=0;i<26;i++){
    const y=rnd()*H, sp=600+rnd()*1900, h=3+rnd()*10;
    const x=((t*sp)%(W+900))-450;
    ctx.fillStyle=lgrad(x-260,0,x+120,0,[[0,'rgba(120,225,255,0)'],[1,rgba(i%3?P.cyan:P.magenta,.5)]]);
    ctx.fillRect(x-260,y,380,h);
  }
  ctx.restore();
  /* speedometer */
  const p=E.outQuint(cl(lt/.55));
  const R=230, a0=Math.PI*.78, a1=Math.PI*2.22;
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,R,a0,a1);ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=26;ctx.lineCap='round';ctx.stroke();
  const val=p*(0.86+0.10*Math.abs(Math.sin(t*9)));
  ctx.beginPath();ctx.arc(cx,cy,R,a0,a0+(a1-a0)*val);
  ctx.strokeStyle=lgrad(cx-R,cy,cx+R,cy,[[0,'#7FF3FF'],[.55,'#B58CFF'],[1,'#FF5FA8']]);
  ctx.lineWidth=26;ctx.lineCap='round';ctx.shadowColor=P.magenta;ctx.shadowBlur=40;ctx.stroke();
  /* needle */
  const na=a0+(a1-a0)*val;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(na);
  ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(R-46,-8);ctx.lineTo(R-46,8);ctx.closePath();
  ctx.fillStyle='#FFFFFF';ctx.shadowColor='#fff';ctx.shadowBlur=22;ctx.fill();ctx.restore();
  circle(cx,cy,26);ctx.fillStyle='#0A0E16';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=4;ctx.stroke();
  ctx.restore();
  text(Math.round(val*120)+'',cx,cy+118,{weight:900,size:78,fill:'#FFFFFF',glowc:'rgba(180,230,255,.6)',glowb:24});
  text(PA('dynamicUnit','FPS ЭНЕРГИИ'),cx-4,cy+178,{weight:800,size:24,fam:'Inter',ls:8,fill:'rgba(255,255,255,.45)'});
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.16)/.28));
  const DT=PA('dynamicLabel','ДИНАМИКА');
  const s=fitText(DT,900,900,6,120);
  gtext(DT,cx,1288,{weight:900,size:s,ls:6,stops:[[0,'#7FF3FF'],[.5,'#B58CFF'],[1,'#FF6FB0']]});
  ctx.restore();
  ring(cx,cy,BE.s+.04,t,{col:P.magenta,r0:180,r1:880,dur:.7,lw:9,a:.45});
}

/* --- beat E: AI technologies --- */
const AIPTS=(()=>{const r=mulberry32(2024);const a=[];
  for(let i=0;i<74;i++){const u=r()*2-1,th=r()*TAU,s=Math.sqrt(1-u*u);
    a.push([s*Math.cos(th),s*Math.sin(th),u]);}return a;})();
function cbAI(lt,t,BE){
  const cx=W/2, cy=H*.385, R=300;
  const rot=t*.55, rot2=t*.32;
  const pts=AIPTS.map(p=>{
    let [x,y,z]=p;
    let x1=x*Math.cos(rot)-z*Math.sin(rot), z1=x*Math.sin(rot)+z*Math.cos(rot);
    let y1=y*Math.cos(rot2)-z1*Math.sin(rot2), z2=y*Math.sin(rot2)+z1*Math.cos(rot2);
    const per=1/(1.9-z2*.75);
    return [cx+x1*R*per*1.5, cy+y1*R*per*1.5, z2, per];
  });
  const grow=E.outQuint(cl(lt/.6));
  ctx.save();ctx.globalAlpha=grow;
  /* connections */
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    const dx=pts[i][0]-pts[j][0],dy=pts[i][1]-pts[j][1];
    const d=Math.hypot(dx,dy);
    if(d<160){const a=(1-d/160)*.32*Math.min(pts[i][3],pts[j][3]);
      ctx.beginPath();ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[j][0],pts[j][1]);
      ctx.strokeStyle=rgba(i%3?P.cyan:P.violet,a);ctx.lineWidth=1.6;ctx.stroke();}
  }
  ctx.restore();
  /* nodes */
  ctx.save();ctx.globalCompositeOperation='screen';
  pts.forEach((p,i)=>{
    const s=(2.2+p[3]*4.2)*(.7+.5*Math.abs(Math.sin(t*3+i)));
    ctx.fillStyle=rgba(i%4===0?P.magenta:(i%3?P.cyan:'#FFFFFF'),.35+p[3]*.55);
    circle(p[0],p[1],s);ctx.fill();
  });
  ctx.restore();
  /* core */
  const pulse=.5+.5*Math.sin(t*4);
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle=rgrad(cx,cy,0,240,[[0,rgba(P.violet,.55)],[.4,rgba(P.cyan,.20)],[1,'rgba(0,0,0,0)']]);
  ctx.fillRect(0,0,W,H);ctx.restore();
  ctx.save();ctx.translate(cx,cy);ctx.scale(1+pulse*.05,1+pulse*.05);
  circle(0,0,96);ctx.fillStyle='rgba(6,10,20,.92)';ctx.fill();
  ctx.strokeStyle=rgba(P.cyan,.9);ctx.lineWidth=4;ctx.shadowColor=P.cyan;ctx.shadowBlur=34;ctx.stroke();
  ic('chip',0,0,110,'#DFF7FF',5);
  ctx.restore();
  ctx.restore();
  /* labels */
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.25)/.3));
  const AT=PA('aiLabel','AI ТЕХНОЛОГИИ');
  const s=fitText(AT,940,900,4,104);
  gtext(AT,cx,1200,{weight:900,size:s,ls:4,stops:[[0,'#7FF3FF'],[.5,'#FFFFFF'],[1,'#B58CFF']]});
  ctx.restore();
  ctx.save();ctx.globalAlpha=E.outExpo(cl((lt-.45)/.3));
  chipRow(PA('aiTags',['ГЕНЕРАЦИЯ','АНАЛИЗ','СКОРОСТЬ']),W/2,1310,{size:22,fillA:.12,cols:[P.cyan,P.magenta,P.violet]});
  ctx.restore();
  ring(cx,cy,BE.s+.04,t,{col:P.cyan,r0:60,r1:900,dur:.9,lw:8,a:.4});
  ring(cx,cy,BE.s+1.35,t,{col:P.violet,r0:60,r1:820,dur:.8,lw:7,a:.35});
}

/* evenly spaced chip row, measured */
function chipRow(labels,cx,y,o={}){
  const {size=22,fillA=.12,gap=20,cols=null,fam='Inter',ls=1.5,weight=800,pad=22,hgt=52}=o;
  setFont(weight,size,fam,ls);
  const ws=labels.map(l=>tw(l)-ls+pad*2);
  const total=ws.reduce((a,b)=>a+b,0)+gap*(labels.length-1);
  let x=cx-total/2;
  labels.forEach((l,i)=>{
    chip(x+ws[i]/2,y,l,{size,fillA,col:cols?cols[i%cols.length]:P.cyan,fam,ls,weight,pad,hgt});
    x+=ws[i]+gap;
  });
}

/* ============================================================
   SCENE 3 — CLIENTS SCROLL AWAY (11.72 – 15.22)
   ============================================================ */
function avatar(x,y,r,seed,col){
  const rnd=mulberry32(seed);
  ctx.save();
  circle(x,y,r);
  ctx.fillStyle=lgrad(x-r,y-r,x+r,y+r,[[0,rgba(col,.30)],[1,'rgba(255,255,255,.05)']]);ctx.fill();
  ctx.strokeStyle=rgba(col,.45);ctx.lineWidth=2.5;ctx.stroke();
  ctx.save();circle(x,y,r);ctx.clip();
  circle(x,y-r*.22,r*.34);ctx.fillStyle=rgba(col,.55);ctx.fill();
  circle(x,y+r*.72,r*.56);ctx.fillStyle=rgba(col,.42);ctx.fill();
  ctx.restore();ctx.restore();
}
function scScroll(lt,t){
  const GRID=B('grid',F(.05)), CNT=B('counter',F(.12)),
        AWAY=B('away',F(.52)), VERD=B('verdict',AWAY!==null?AWAY+.47:F(.66));
  bgBase(t,'#0D0A18','#05060B');
  aurora(t,[P.violet,'#5B6C8F',P.red],.55,.7);
  grid(t,{alpha:.07,color:'#8FA6C8',size:110,speed:.25});
  particles(t,{n:50,color:'#9AA8C4',alpha:.25,speed:26,seed:14});

  const away=cl((t-AWAY)/1.05);           /* the scroll-away progress */
  const ae=E.inOutQuint(away);

  ctx.save();ctx.globalAlpha=cl(lt/.22);
  chip(W/2,240,PA('chip','ВАША ПОТЕНЦИАЛЬНАЯ АУДИТОРИЯ'),{col:'#8FA6C8',size:24,fillA:.06});
  ctx.restore();

  /* avatar grid */
  const cols=4, rows=3, gap=190, x0=W/2-(cols-1)*gap/2, y0=560;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c;
    const rnd=mulberry32(100+i);
    const ep=E.outBack(cl((t-GRID-i*0.045)/.45));
    if(ep<=0)continue;
    const fly=cl((away-i*0.03)/.6);
    const fe=E.inQuad(fly);
    ctx.save();
    ctx.globalAlpha=cl(ep*1.6)*(1-fe);
    ctx.translate(x0+c*gap, y0+r*gap - fe*1500);
    if(fly>0.02)ctx.filter=`blur(${fe*22}px)`;
    ctx.scale(ep,ep);
    avatar(0,0,66,100+i, i%3===0?P.violet:(i%3===1?P.cyan:'#8FA6C8'));
    ctx.restore();
  }
  /* counter */
  ctx.save();ctx.globalAlpha=cl((t-CNT)/.3);
  const target=PA('audience',12480);
  const shown=away>0? Math.round(lerp(target,0,E.outQuint(cl(away/.7)))) : Math.round(lerp(0,target,E.outQuint(cl((t-CNT)/1.0))));
  text(fmt(shown),W/2,1190,{weight:900,size:120,
    fill: away>0.05? '#FF5470' : lgrad(W/2-300,0,W/2+300,0,[[0,'#7FF3FF'],[1,'#B58CFF']]),
    glowc: away>0.05?'rgba(255,60,90,.6)':'rgba(120,200,255,.5)', glowb:30});
  text(PA('audienceLabel','ПОТЕНЦИАЛЬНЫХ КЛИЕНТОВ'),W/2-4,1268,{weight:800,size:26,fam:'Inter',ls:6,fill:'rgba(255,255,255,.45)'});
  ctx.restore();

  /* swipe streaks + verdict */
  if(away>0){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let k=0;k<5;k++){
      const p=cl((away-k*.08)/.5);if(p<=0)continue;
      const yy=lerp(H*1.05,-H*.15,E.inOutQuint(p));
      ctx.globalAlpha=(1-p)*.45;
      ctx.fillStyle=lgrad(0,yy-280,0,yy+60,[[0,'rgba(255,255,255,0)'],[.85,'rgba(200,225,255,.6)'],[1,'rgba(255,255,255,0)']]);
      ctx.save();ctx.beginPath();ctx.ellipse(W/2,yy-120,W*.44,230,0,0,TAU);ctx.clip();
      ctx.fillRect(0,yy-280,W,340);ctx.restore();
    }
    ctx.restore();
  }
  if(t>VERD){
    const p=cl((t-VERD)/.32),e=E.outBack(p);
    ctx.save();ctx.globalAlpha=cl(p*3);
    ctx.translate(W/2,860);ctx.scale(lerp(1.6,1,E.outExpo(p)),lerp(1.6,1,E.outExpo(p)));
    const VT=PA('verdict','ЛИСТАЮТ ДАЛЬШЕ');
    const sz=fitText(VT,960,900,2,110);
    text(VT,0,0,{weight:900,size:sz,ls:2,fill:'#FF5470',glowc:'rgba(255,60,90,.75)',glowb:40});
    ctx.save();ctx.translate(0,-190);ctx.rotate(Math.PI);ic('arrowUp',0,0,130,'#FF3B5C',11);ctx.restore();
    ctx.restore();
    ring(W/2,860,VERD+.03,t,{col:P.red,r1:900,dur:.7,lw:9,a:.45});
  }
  hud(t,.16,'#FF6B84');
}

/* ============================================================
   SCENE 4 — PRODUCTION PIPELINE (15.22 – 26.45)
   ============================================================ */
/* Steps come from the plan: each is {k,ic,t,c}. */
function steps(){return PA('steps',[]);}
function activeStep(t){const S=steps();let i=-1;for(let k=0;k<S.length;k++)if(t>=S[k].t)i=k;return i;}

function scPipe(lt,t){
  bgBase(t,'#0A1128','#04060B');
  aurora(t,[P.violet,P.cyan,P.blue],.75,.8);
  grid(t,{alpha:.09,color:'#6FE3FF',size:100,speed:.4});
  particles(t,{n:60,color:'#AFE6FF',alpha:.30,speed:30,seed:31});

  const S=steps();
  const CHAIN=B('chain', S.length?S[0].t-0.15:F(.16));
  const INTRO=B('intro',CUR.s+.02), TITLE=B('title',CUR.s+.18),
        SUBT=B('subtitle',CUR.s+1.20), CHIPS=B('chips',CUR.s+.73);
  /* --- intro title --- */
  const introOut=cl((t-(CHAIN-0.05))/.35);
  if(introOut<1){
    ctx.save();ctx.globalAlpha=1-E.inOutCubic(introOut);
    ctx.translate(W/2,H*.46);
    ctx.scale(lerp(1,1.18,E.inOutCubic(introOut)),lerp(1,1.18,E.inOutCubic(introOut)));
    ctx.translate(-W/2,-H*.46);
    const p1=E.outExpo(cl((t-INTRO)/.30));
    ctx.save();ctx.globalAlpha*=p1;ctx.translate(0,(1-p1)*40);
    chip(W/2,H*.335,PA('chip','ПОЛНЫЙ ЦИКЛ ПРОИЗВОДСТВА'),{col:P.cyan,size:24,fillA:.12});
    ctx.restore();
    const TT=PA('title','REELS'), TS=PA('subtitle','ПОД КЛЮЧ');
    slam(TT,W/2,H*.435,fitText(TT,900,900,4,230),TITLE,t,
      {ls:4,grad:[[0,'#7FF3FF'],[.5,'#B58CFF'],[1,'#FF6FB0']],glowc:'rgba(150,120,255,.8)',glowb:44});
    slam(TS,W/2,H*.545,fitText(TS,900,900,6,132),SUBT,t,
      {ls:6,col:'#FFFFFF',glowc:'rgba(255,255,255,.4)',glowb:26});
    ctx.save();ctx.globalAlpha*=E.outExpo(cl((t-CHIPS)/.4));
    const names=S.slice(0,-1).map(x=>x.k), cols=S.slice(0,-1).map(x=>x.c);
    const half=Math.ceil(names.length/2);
    if(names.length) chipRow(names.slice(0,half),W/2,H*.645,{size:20,fillA:.09,gap:14,cols:cols.slice(0,half)});
    if(names.length>half) chipRow(names.slice(half),W/2,H*.645+70,{size:20,fillA:.09,gap:14,cols:cols.slice(half)});
    ctx.restore();
    ring(W/2,H*.435,TITLE+.02,t,{col:P.violet,r1:940,dur:.8,lw:10,a:.45});
    ctx.restore();
    if(introOut<=0)  { hud(t,.18); return; }
  }
  if(t<CHAIN){ hud(t,.18); return; }

  /* --- chain --- */
  const ai=activeStep(t);
  if(ai<0)return;
  const st=S[ai];
  const stp=cl((t-st.t)/0.42);           /* step entry progress */

  /* header */
  ctx.save();ctx.globalAlpha=E.outExpo(cl((t-CHAIN-.03)/.35));
  chip(W/2,172,PA('header','ПРОЦЕСС ПРОИЗВОДСТВА'),{col:P.cyan,size:23,fillA:.10});
  ctx.restore();
  /* stage panel */
  const sx=70, sy=250, sw=W-140, sh=760;
  ctx.save();
  const ep=E.outQuint(cl((t-CHAIN-.03)/.4));
  ctx.globalAlpha=ep;
  glass(sx,sy,sw,sh,32,{fillA:.05,border:.16,bcol:'#9FE8FF'});
  ctx.save();rr(sx,sy,sw,sh,32);ctx.clip();
  ctx.fillStyle=lgrad(sx,sy,sx+sw,sy+sh,[[0,rgba(st.c,.10)],[1,'rgba(0,0,0,0)']]);ctx.fillRect(sx,sy,sw,sh);
  /* per-step stage art */
  stageArt(st.art!==undefined?st.art:ai,t,st,sx,sy,sw,sh);
  ctx.restore();
  /* step number + name */
  ctx.save();ctx.globalAlpha=cl(stp*3);
  const num=('0'+(ai+1)).slice(-2);
  text(num,sx+42,sy+58,{align:'left',weight:900,size:40,fam:'Mono',ls:2,fill:rgba(st.c,.85)});
  text('/ '+('0'+S.length).slice(-2),sx+112,sy+60,{align:'left',weight:700,size:26,fam:'Mono',ls:2,fill:'rgba(255,255,255,.30)'});
  ctx.restore();
  ctx.restore();

  /* big step label under the stage */
  ctx.save();
  const lp=E.outBack(cl((t-st.t)/.30));
  ctx.globalAlpha=cl((t-st.t)/.10);
  ctx.translate(W/2,1108);ctx.scale(lerp(1.35,1,E.outExpo(cl((t-st.t)/.28))),lerp(1.35,1,E.outExpo(cl((t-st.t)/.28))));
  const ls=fitText(st.k,940,900,3,st.k.length>10?96:112);
  text(st.k,0,0,{weight:900,size:ls,ls:3,fill:'#FFFFFF',glowc:rgba(st.c,.8),glowb:34});
  ctx.restore();
  ring(W/2,1108,st.t,t,{col:st.c,r1:820,dur:.6,lw:8,a:.4});

  /* rail */
  drawRail(t,ai,S);
  hud(t,.18);
}

function drawRail(t,ai,STEPS){
  const y=1300, gap=232;
  /* smooth centering */
  let cur=0;
  for(let i=0;i<STEPS.length;i++){
    if(t>=STEPS[i].t){ const nx=STEPS[i+1]?STEPS[i+1].t:99;
      cur=i+E.inOutCubic(cl((t-STEPS[i].t)/0.45))*0; }
  }
  /* interpolate index for smooth scroll */
  let fi=0;
  for(let i=0;i<STEPS.length;i++){
    if(t>=STEPS[i].t){ fi=i; if(STEPS[i+1]) fi=i+E.inOutCubic(cl((t-STEPS[i].t-0.30)/0.45)); }
  }
  const ox=W/2-fi*gap;
  ctx.save();
  /* connector line */
  ctx.beginPath();ctx.moveTo(ox-gap,y);ctx.lineTo(ox+gap*(STEPS.length-1)+gap,y);
  ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=5;ctx.stroke();
  const prog=cl(fi/(STEPS.length-1));
  ctx.beginPath();ctx.moveTo(ox,y);ctx.lineTo(ox+gap*fi,y);
  ctx.strokeStyle=lgrad(ox,0,ox+gap*(STEPS.length-1),0,[[0,'#FFB020'],[.4,'#7FF3FF'],[.75,'#B58CFF'],[1,'#FF6FB0']]);
  ctx.lineWidth=6;ctx.lineCap='round';ctx.shadowColor=P.cyan;ctx.shadowBlur=26;ctx.stroke();
  /* travelling pulse */
  for(let k=0;k<3;k++){
    const pp=((t*0.55+k/3)%1);
    const px=ox+gap*fi*pp;
    if(pp<1&&fi>0.02){ctx.save();ctx.globalCompositeOperation='screen';
      circle(px,y,7);ctx.fillStyle='rgba(255,255,255,.9)';ctx.shadowColor='#fff';ctx.shadowBlur=20;ctx.fill();ctx.restore();}
  }
  STEPS.forEach((s,i)=>{
    const x=ox+i*gap;
    if(x<-160||x>W+160)return;
    /* Гасим узел у самого края кадра: обрезанная наполовину подпись
       читается как дефект, а не как прокрутка. */
    const edgeA=cl(Math.min(x-60,W-60-x)/200);
    if(edgeA<=0)return;
    const done=t>=s.t;
    const act=i===Math.round(fi)&&done;
    const pop=E.outBack(cl((t-s.t)/.35));
    const r=act?54:40;
    const sc=done?lerp(.8,1,cl(pop)):.8;
    ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);
    ctx.globalAlpha=(done?1:.35)*edgeA;
    circle(0,0,r);ctx.fillStyle='rgba(8,12,22,.95)';ctx.fill();
    if(done){ctx.strokeStyle=s.c;ctx.lineWidth=3.5;ctx.shadowColor=s.c;ctx.shadowBlur=act?30:14;ctx.stroke();}
    else{ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2.5;ctx.stroke();}
    ic(s.ic,0,0,r*1.05,done?s.c:'rgba(255,255,255,.35)',3.4);
    ctx.restore();
    /* tiny label */
    if(done){ctx.save();ctx.globalAlpha=(act?.95:.4)*edgeA;
      const lbl=s.short||s.k;
      text(lbl,x,y+82,{weight:800,size:19,fam:'Inter',ls:2,fill:act?'#FFFFFF':'rgba(255,255,255,.55)'});
      ctx.restore();}
  });
  ctx.restore();
}

/* ---------- per-step stage art (clipped inside the panel) ---------- */
function stageArt(i,t,st,sx,sy,sw,sh){
  const cx=sx+sw/2, cy=sy+sh/2;
  const lt=t-st.t;
  const P0=E.outQuint(cl(lt/.5));
  ctx.save();
  /* soft key light */
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle=rgrad(cx,cy-40,0,520,[[0,rgba(st.c,.20)],[1,'rgba(0,0,0,0)']]);
  ctx.fillRect(sx,sy,sw,sh);ctx.restore();

  if(i===0){ /* ИДЕЯ */
    const pu=.5+.5*Math.sin(t*4);
    ctx.save();ctx.translate(cx,cy-40);
    for(let k=0;k<14;k++){
      const a=TAU*k/14+t*.5, r0=210+pu*16, r1=r0+70+Math.sin(t*3+k)*26;
      ctx.save();ctx.rotate(a);ctx.globalCompositeOperation='screen';
      ctx.strokeStyle=rgba(st.c,.35+.3*Math.abs(Math.sin(t*2+k)));ctx.lineWidth=5;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(r0,0);ctx.lineTo(r1,0);ctx.stroke();ctx.restore();
    }
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.fillStyle=rgrad(0,0,0,240,[[0,rgba(st.c,.55*pu+.25)],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(-sw/2,-sh/2,sw,sh);ctx.restore();
    ctx.scale(lerp(.6,1,P0),lerp(.6,1,P0));
    ic('bulb',0,0,300,'#FFE7B0',12);
    ctx.restore();
    /* floating idea fragments */
    const frag=['ХУК','ЭМОЦИЯ','ПОЛЬЗА','ИНТРИГА'];
    frag.forEach((f,k)=>{
      const p=E.outBack(cl((lt-.25-k*.13)/.5));if(p<=0)return;
      const a=TAU*k/4-0.6+Math.sin(t*.7+k)*.06, r=300;
      ctx.save();ctx.globalAlpha=cl(p*1.6)*.95;
      ctx.translate(cx+Math.cos(a)*r*p, cy-40+Math.sin(a)*r*.62*p);
      ctx.scale(p,p);chip(0,0,f,{col:st.c,size:22,fillA:.16});ctx.restore();
    });
    text(st.cap||'ЦЕПЛЯЮЩАЯ ИДЕЯ ПОД ВАШУ НИШУ',cx-3,sy+sh-58,{weight:700,size:24,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===1){ /* СЦЕНАРИЙ */
    const px=cx-330, py=sy+120, pw=660, ph=520;
    glass(px,py,pw,ph,22,{fillA:.05,border:.18,bcol:'#9FE8FF',shadow:false});
    const rows=[['00:00','ХУК — ПЕРВЫЕ 3 СЕК',1],['00:03','ПРОБЛЕМА',.86],['00:09','РЕШЕНИЕ',.94],
                ['00:18','ДОКАЗАТЕЛЬСТВО',.78],['00:28','ПРИЗЫВ К ДЕЙСТВИЮ',.9]];
    rows.forEach((r,k)=>{
      const p=E.outQuart(cl((lt-.12-k*.13)/.45));if(p<=0)return;
      const y=py+56+k*94;
      ctx.save();ctx.globalAlpha=cl(p*2);
      text(r[0],px+30,y,{align:'left',weight:700,size:26,fam:'Mono',ls:1,fill:rgba(st.c,.8)});
      /* typing line */
      const full=r[1], n=Math.max(1,Math.round(full.length*cl(p*1.25)));
      text(full.slice(0,n),px+150,y,{align:'left',weight:800,size:28,fam:'Inter',ls:1,fill:'rgba(255,255,255,.9)'});
      setFont(800,28,'Inter',1);
      if(p<.98&&Math.floor(t*8)%2===0){const wct=tw(full.slice(0,n));
        ctx.fillStyle=st.c;ctx.fillRect(px+152+wct,y-16,3,32);}
      rr(px+30,y+26,(pw-60)*r[2]*cl(p*1.2),6,3);ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();
      ctx.restore();
    });
    text(st.cap||'СЦЕНАРИЙ С ЧЁТКОЙ СТРУКТУРОЙ УДЕРЖАНИЯ',cx-3,sy+sh-58,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===2){ /* AI */
    const R=200;
    const pts=AIPTS.slice(0,44).map(p=>{
      let [x,y,z]=p;const rot=t*.9;
      const x1=x*Math.cos(rot)-z*Math.sin(rot), z1=x*Math.sin(rot)+z*Math.cos(rot);
      const per=1/(1.9-z1*.8);
      return [cx+x1*R*per*1.35, cy-60+y*R*per*1.35, per];
    });
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let a=0;a<pts.length;a++)for(let b2=a+1;b2<pts.length;b2++){
      const d=Math.hypot(pts[a][0]-pts[b2][0],pts[a][1]-pts[b2][1]);
      if(d<130){ctx.beginPath();ctx.moveTo(pts[a][0],pts[a][1]);ctx.lineTo(pts[b2][0],pts[b2][1]);
        ctx.strokeStyle=rgba(st.c,(1-d/130)*.35);ctx.lineWidth=1.5;ctx.stroke();}
    }
    pts.forEach((p,k)=>{circle(p[0],p[1],2+p[2]*3.4);ctx.fillStyle=rgba(k%3?st.c:'#FFFFFF',.4+p[2]*.5);ctx.fill();});
    ctx.restore();
    ctx.save();ctx.translate(cx,cy-60);ctx.scale(lerp(.5,1,P0),lerp(.5,1,P0));
    circle(0,0,86);ctx.fillStyle='rgba(6,10,20,.92)';ctx.fill();
    ctx.strokeStyle=st.c;ctx.lineWidth=4;ctx.shadowColor=st.c;ctx.shadowBlur=32;ctx.stroke();
    ic('chip',0,0,100,'#EFE6FF',5);ctx.restore();
    /* progress */
    const gp=cl(lt/.95);
    const bx=cx-300, by=sy+sh-150, bw=600;
    rr(bx,by,bw,14,7);ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();
    rr(bx,by,bw*E.outQuart(gp),14,7);ctx.fillStyle=lgrad(bx,0,bx+bw,0,[[0,'#7FF3FF'],[1,'#FF6FB0']]);
    ctx.shadowColor=st.c;ctx.shadowBlur=20;ctx.fill();
    text(st.cap||'НЕЙРОСЕТИ · ГЕНЕРАЦИЯ',bx,by-32,{align:'left',weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.5)'});
    text(Math.round(E.outQuart(gp)*100)+'%',bx+bw,by-32,{align:'right',weight:800,size:24,fam:'Mono',ls:1,fill:st.c});
  }
  else if(i===3){ /* ВИЗУАЛ */
    const gw=280, gh=200, gx=cx-gw*1.5-24, gy=sy+130;
    for(let k=0;k<6;k++){
      const r=Math.floor(k/3), c=k%3;
      const p=E.outBack(cl((lt-k*.075)/.42));if(p<=0)continue;
      const x=gx+c*(gw+24), y=gy+r*(gh+24);
      ctx.save();ctx.globalAlpha=cl(p*1.8);
      ctx.translate(x+gw/2,y+gh/2);ctx.scale(lerp(.7,1,p),lerp(.7,1,p));
      rr(-gw/2,-gh/2,gw,gh,16);
      const cols=[['#123','#7FF3FF'],['#213','#FF6FB0'],['#132','#B58CFF'],['#122','#5FD4FF'],['#231','#FFB020'],['#122','#34D399']][k];
      ctx.fillStyle=lgrad(-gw/2,-gh/2,gw/2,gh/2,[[0,rgba(cols[1],.30)],[1,'rgba(10,14,24,.9)']]);ctx.fill();
      ctx.strokeStyle=rgba(cols[1],.5);ctx.lineWidth=2;ctx.stroke();
      ctx.save();rr(-gw/2,-gh/2,gw,gh,16);ctx.clip();
      const rr2=mulberry32(200+k);
      for(let q=0;q<4;q++){ctx.globalAlpha=.28;
        ctx.fillStyle=cols[1];
        const bw2=40+rr2()*160,bh2=8+rr2()*70;
        ctx.fillRect(-gw/2+rr2()*gw*.8, -gh/2+rr2()*gh*.8, bw2,bh2);}
      /* generation shimmer */
      const sh2=((t*1.4+k*.2)%1);ctx.globalAlpha=.45*(1-Math.abs(sh2*2-1));
      ctx.fillStyle=lgrad(-gw/2+gw*sh2-70,0,-gw/2+gw*sh2+70,0,[[0,'rgba(255,255,255,0)'],[.5,'rgba(255,255,255,.7)'],[1,'rgba(255,255,255,0)']]);
      ctx.fillRect(-gw/2,-gh/2,gw,gh);
      ctx.restore();ctx.restore();
    }
    text(st.cap||'УНИКАЛЬНЫЙ ВИЗУАЛ ПОД ВАШ БРЕНД',cx-3,sy+sh-58,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===4){ /* ОЗВУЧКА */
    ctx.save();ctx.translate(cx,cy-110);ctx.scale(lerp(.6,1,P0),lerp(.6,1,P0));
    circle(0,0,108);ctx.fillStyle='rgba(8,12,22,.9)';ctx.fill();
    ctx.strokeStyle=st.c;ctx.lineWidth=4;ctx.shadowColor=st.c;ctx.shadowBlur=30;ctx.stroke();
    ic('mic',0,0,130,'#FFE3F1',6);ctx.restore();
    for(let k=0;k<3;k++)ring(cx,cy-110,st.t+.1+k*.45,t,{col:st.c,r0:110,r1:340,dur:1.2,lw:5,a:.35});
    /* waveform */
    const n=54, bw=12, gp2=6, tot=n*(bw+gp2)-gp2;
    const bx=cx-tot/2, by=cy+150;
    for(let k=0;k<n;k++){
      const p=cl((lt-k*.012)/.4);if(p<=0)continue;
      const env=Math.sin(Math.PI*k/n);
      const h=(18+Math.abs(Math.sin(k*.7+t*7))*140*env+Math.abs(Math.sin(k*2.1+t*4))*40*env)*p;
      ctx.save();ctx.globalAlpha=.95;
      rr(bx+k*(bw+gp2),by-h/2,bw,h,bw/2);
      ctx.fillStyle=lgrad(0,by-h/2,0,by+h/2,[[0,st.c],[1,rgba(st.c,.35)]]);
      ctx.shadowColor=st.c;ctx.shadowBlur=14;ctx.fill();ctx.restore();
    }
    text(st.cap||'ПРОФЕССИОНАЛЬНЫЙ ГОЛОС И ЗВУК',cx-3,sy+sh-58,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===5){ /* МОНТАЖ */
    const tx=cx-390, ty=sy+150, twd=780;
    /* preview */
    ctx.save();rr(cx-200,ty-10,400,224,14);ctx.fillStyle='rgba(255,255,255,.05)';ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=2;ctx.stroke();
    ctx.save();rr(cx-200,ty-10,400,224,14);ctx.clip();
    ctx.fillStyle=lgrad(cx-200,ty,cx+200,ty+224,[[0,rgba(st.c,.30)],[1,'rgba(10,16,26,.9)']]);
    ctx.fillRect(cx-200,ty-10,400,224);
    ic('play',cx,ty+102,74,'#FFFFFF',0);ctx.restore();ctx.restore();
    /* tracks */
    const trk=[[st.c,[[0,.22],[.24,.18],[.44,.3],[.76,.24]]],
               ['#7FF3FF',[[0,.4],[.42,.26],[.7,.3]]],
               ['#B58CFF',[[.05,.3],[.38,.5],[.9,.1]]]];
    trk.forEach((tr,k)=>{
      const y=ty+276+k*72;
      rr(tx,y,twd,54,10);ctx.fillStyle='rgba(255,255,255,.04)';ctx.fill();
      tr[1].forEach((c,q)=>{
        const p=E.outQuart(cl((lt-.1-k*.1-q*.06)/.4));if(p<=0)return;
        ctx.save();ctx.globalAlpha=cl(p*2);
        rr(tx+twd*c[0]+3,y+5,twd*c[1]*p-6,44,8);
        ctx.fillStyle=rgba(tr[0],.55);ctx.fill();
        ctx.strokeStyle=rgba(tr[0],.9);ctx.lineWidth=2;ctx.stroke();ctx.restore();
      });
    });
    /* playhead */
    const ph=tx+twd*((t*0.30)%1);
    ctx.save();ctx.beginPath();ctx.moveTo(ph,ty+262);ctx.lineTo(ph,ty+276+3*72-6);
    ctx.strokeStyle='#FFFFFF';ctx.lineWidth=3;ctx.shadowColor='#fff';ctx.shadowBlur=16;ctx.stroke();
    circle(ph,ty+262,8);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
    text(st.cap||'ДИНАМИЧНЫЙ МОНТАЖ БЕЗ ПРОВИСАНИЙ',cx-3,sy+sh-46,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===6){ /* СУБТИТРЫ */
    const words=['СЛОВО','ЗА','СЛОВОМ'];
    const aidx=Math.floor((t-st.t)*4.2)%words.length;
    ctx.save();
    /* mini phone */
    phone(cx,cy-30,430,600,{r:40,border:'#2A3purple'.replace('purple','44'),glowc:rgba(st.c,.6),glowb:40});
    ctx.save();rr(cx-206,cy-330,412,582,34);ctx.clip();
    ctx.fillStyle=lgrad(cx-206,cy-330,cx+206,cy+252,[[0,rgba(st.c,.22)],[1,'rgba(8,12,20,.95)']]);
    ctx.fillRect(cx-206,cy-330,412,582);
    const rnd=mulberry32(9);
    for(let k=0;k<5;k++){ctx.globalAlpha=.16;ctx.fillStyle=st.c;
      ctx.fillRect(cx-206+rnd()*380,cy-330+rnd()*520,60+rnd()*150,10+rnd()*60);}
    ctx.globalAlpha=1;
    let x=cx-160;
    setFont(900,34,'Mont',1);
    const wsz=words.map(w=>tw(w));
    const tot=wsz.reduce((a,b2)=>a+b2,0)+(words.length-1)*16;
    x=cx-tot/2;
    words.forEach((w,k)=>{
      const on=k===aidx;
      text(w,x+wsz[k]/2,cy+150,{weight:900,size:34,ls:1,fill:on?'#FFFFFF':'rgba(255,255,255,.35)',
        stroke:'rgba(0,0,0,.6)',strokew:5});
      if(on)text(w,x+wsz[k]/2,cy+150,{weight:900,size:34,ls:1,fill:st.c,glowc:rgba(st.c,.9),glowb:20});
      x+=wsz[k]+16;
    });
    ctx.restore();ctx.restore();
    text(st.cap||'ДИНАМИЧЕСКИЕ СУБТИТРЫ ДЛЯ УДЕРЖАНИЯ',cx-3,sy+sh-46,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else if(i===8){ /* универсальный этап: крупная иконка и кольца */
    const pu=.5+.5*Math.sin(t*3.4);
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.fillStyle=rgrad(cx,cy-40,0,340,[[0,rgba(st.c,.28+pu*.10)],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(sx,sy,sw,sh);ctx.restore();
    for(let k=0;k<3;k++){
      const a2=t*(.30+k*.22)*(k%2?-1:1), r=150+k*74, sides=6;
      ctx.save();ctx.translate(cx,cy-40);ctx.rotate(a2);ctx.globalCompositeOperation='screen';
      ctx.strokeStyle=rgba(st.c,.30);ctx.lineWidth=2.5;
      ctx.beginPath();
      for(let q=0;q<=sides;q++){const g=TAU*q/sides;q?ctx.lineTo(Math.cos(g)*r,Math.sin(g)*r):ctx.moveTo(Math.cos(g)*r,Math.sin(g)*r);}
      ctx.stroke();ctx.restore();
    }
    ctx.save();ctx.translate(cx,cy-40);
    const gp=E.outBack(cl(lt/.45));ctx.scale(lerp(.55,1,gp),lerp(.55,1,gp));
    circle(0,0,116);ctx.fillStyle='rgba(6,10,20,.92)';ctx.fill();
    ctx.strokeStyle=st.c;ctx.lineWidth=4;ctx.shadowColor=st.c;ctx.shadowBlur=34;ctx.stroke();
    ic(st.ic,0,0,132,'#FFFFFF',5);
    ctx.restore();
    for(let k=0;k<2;k++)ring(cx,cy-40,st.t+k*.35,t,{col:st.c,r0:120,r1:420,dur:1.0,lw:5,a:.35});
    if(st.cap) text(st.cap,cx-3,sy+sh-58,{weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
  }
  else { /* ГОТОВЫЙ REELS */
    const pu=.5+.5*Math.sin(t*5);
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.fillStyle=rgrad(cx,cy-30,0,420,[[0,`rgba(160,220,255,${.22+pu*.12})`],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(sx,sy,sw,sh);ctx.restore();
    ctx.save();ctx.translate(cx,cy-20);ctx.scale(lerp(.72,1,E.outBack(cl(lt/.4))),lerp(.72,1,E.outBack(cl(lt/.4))));
    phone(0,0,400,600,{r:40,border:'#3A4considered'.replace('considered','A5A'),glowc:'#9FE8FF',glowb:60});
    ctx.save();rr(-190,-290,380,580,32);ctx.clip();
    ctx.fillStyle=lgrad(-190,-290,190,290,[[0,rgba(P.violet,.5)],[.5,rgba(P.cyan,.35)],[1,rgba(P.magenta,.45)]]);
    ctx.fillRect(-190,-290,380,580);
    ctx.restore();
    circle(0,0,66);ctx.fillStyle='rgba(255,255,255,.92)';ctx.fill();
    ic('play',6,0,60,'#0A0E18',0);
    ctx.restore();
    for(let k=0;k<2;k++)ring(cx,cy-20,st.t+k*.3,t,{col:'#9FE8FF',r0:180,r1:600,dur:.9,lw:7,a:.45});
  }
  ctx.restore();
}

/* ============================================================
   SCENE 5 — NO EFFORT NEEDED (26.45 – 30.25)
   ============================================================ */
function scNoeff(lt,t){
  const NOE=PA('items',[]);
  const HEAD=B('head',CUR.s+.11), BADGE=B('badge',CUR.e-.63);
  bgBase(t,'#0B0F1E','#04060B');
  aurora(t,[P.blue,P.violet,'#2B3A55'],.55,.6);
  grid(t,{alpha:.08,color:'#7FB6FF',size:100,speed:.3});
  particles(t,{n:45,color:'#BFD8FF',alpha:.25,speed:24,seed:52});

  /* headline */
  const HT=PA('head','ВАМ НЕ НУЖНО');
  slam(HT,W/2,392,fitText(HT,920,900,3,116),HEAD,t,
    {ls:3,col:'#FFFFFF',glowc:'rgba(255,255,255,.35)',glowb:24});

  NOE.forEach((n,i)=>{
    const p=E.outBack(cl((t-n.t)/.40));if(p<=0)return;
    const y=580+i*250;
    ctx.save();ctx.globalAlpha=cl(p*2);
    ctx.translate(W/2,y);ctx.scale(lerp(.9,1,p),lerp(.9,1,p));
    ctx.translate(lerp(70,0,p),0);
    glass(-455,-98,910,196,26,{fillA:.05,border:.14});
    /* icon */
    ctx.save();ctx.translate(-340,0);
    circle(0,0,62);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.stroke();
    ic(n.ic,0,0,72,'rgba(255,255,255,.75)',4.5);ctx.restore();
    text(n.k,-250,-18,{align:'left',weight:900,size:56,ls:1,fill:'rgba(255,255,255,.92)'});
    text(n.sub,-250,36,{align:'left',weight:700,size:24,fam:'Inter',ls:3,fill:'rgba(255,255,255,.38)'});
    /* strike-through + X stamp */
    const sp=E.outQuint(cl((t-n.t-.22)/.30));
    if(sp>0){
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.beginPath();ctx.moveTo(-420,26);ctx.lineTo(-420+840*sp,-30);
      ctx.strokeStyle=P.red;ctx.lineWidth=9;ctx.lineCap='round';
      ctx.shadowColor=P.red;ctx.shadowBlur=26;ctx.stroke();ctx.restore();
      const xp=E.outBack(cl((t-n.t-.34)/.28));
      if(xp>0){ctx.save();ctx.translate(372,0);ctx.scale(xp,xp);ctx.globalAlpha=cl(xp*2);
        circle(0,0,52);ctx.fillStyle='rgba(255,59,92,.16)';ctx.fill();
        ctx.strokeStyle=P.red;ctx.lineWidth=4;ctx.shadowColor=P.red;ctx.shadowBlur=22;ctx.stroke();
        ic('x',0,0,52,P.red,7);ctx.restore();}
    }
    ctx.restore();
  });
  /* payoff badge */
  if(t>BADGE){
    const BT=PA('badge','0 УСИЛИЙ С ВАШЕЙ СТОРОНЫ');
    const p=E.outBack(cl((t-BADGE)/.34));
    ctx.save();ctx.globalAlpha=cl(p*2.4);
    ctx.translate(W/2,1330);ctx.scale(lerp(1.4,1,E.outExpo(cl((t-BADGE)/.3))),lerp(1.4,1,E.outExpo(cl((t-BADGE)/.3))));
    const sz=fitText(BT,900,900,2,64);
    setFont(900,sz,'Mont',2);const wI=tw(BT);
    rr(-wI/2-38,-52,wI+76,104,52);
    ctx.fillStyle=lgrad(-wI/2,0,wI/2,0,[[0,rgba(P.cyan,.20)],[1,rgba(P.magenta,.20)]]);ctx.fill();
    ctx.strokeStyle=rgba(P.cyan,.6);ctx.lineWidth=2.5;ctx.shadowColor=P.cyan;ctx.shadowBlur=24;ctx.stroke();
    text(BT,-1,2,{weight:900,size:sz,ls:2,fill:'#FFFFFF'});
    ctx.restore();
    ring(W/2,1330,BADGE+.02,t,{col:P.cyan,r1:760,dur:.6,lw:7,a:.4});
  }
  hud(t,.16);
}

/* ============================================================
   SCENE 6 — RESULT (30.25 – 35.65)
   ============================================================ */
function scResult(lt,t){
  const HERO=B('hero',CUR.s+.11), RISE=B('rise',F(.28)), MET=B('metrics',F(.71)),
        LBL=HERO+0.06;
  bgBase(t,'#0A1430','#04060B');
  aurora(t,[P.cyan,P.violet,P.magenta],.95,.9);
  grid(t,{alpha:.10,color:'#7FE9FF',size:96,speed:.5});
  particles(t,{n:80,color:'#CFF3FF',alpha:.4,speed:38,seed:63});

  const metricsMode=cl((t-MET)/.4);   /* 0 = hero phone, 1 = metrics */
  const heroA=1-E.inOutCubic(metricsMode);

  /* ---- hero: finished reel rising above the grey crowd ---- */
  if(heroA>0.01){
    ctx.save();ctx.globalAlpha=heroA;
    ctx.translate(W/2,H*.46);
    ctx.scale(lerp(1,1.18,E.inOutCubic(metricsMode)),lerp(1,1.18,E.inOutCubic(metricsMode)));
    ctx.translate(-W/2,-H*.46);
    /* grey competitor cards behind */
    const rp=E.outQuint(cl((t-RISE)/.7));
    for(let k=0;k<4;k++){
      const p=E.outBack(cl((t-(HERO+.14)-k*.07)/.5));if(p<=0)continue;
      const side=k<2?-1:1, idx=k%2;
      ctx.save();ctx.globalAlpha=cl(p*1.6)*(1-rp*.45);
      const x=W/2+side*(250+idx*168), y=800+idx*40+rp*150;
      ctx.translate(x,y);ctx.rotate(side*(0.06+idx*0.05));ctx.scale(lerp(.85,1,p)*(1-rp*.12),lerp(.85,1,p)*(1-rp*.12));
      rr(-135,-215,270,430,24);ctx.fillStyle='rgba(22,28,40,.95)';ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=2;ctx.stroke();
      rr(-112,-190,224,190,14);ctx.fillStyle='rgba(255,255,255,.05)';ctx.fill();
      for(let q=0;q<3;q++){rr(-112,20+q*32,224*(1-q*.2),12,6);ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill();}
      ctx.restore();
    }
    /* hero phone */
    const hp=E.outBack(cl((t-HERO)/.5));
    ctx.save();ctx.globalAlpha=cl(hp*2);
    const hy=790-rp*90+Math.sin(t*1.6)*8;
    ctx.translate(W/2,hy);ctx.scale(lerp(.75,1,hp),lerp(.75,1,hp));
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.fillStyle=rgrad(0,0,0,520,[[0,'rgba(120,200,255,.34)'],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(-540,-620,1080,1240);ctx.restore();
    phone(0,0,430,700,{r:44,border:'#3E4A62',glowc:'#9FE8FF',glowb:60});
    ctx.save();rr(-205,-340,410,680,36);ctx.clip();
    ctx.fillStyle=lgrad(-205,-340,205,340,[[0,rgba(P.violet,.65)],[.5,rgba(P.cyan,.42)],[1,rgba(P.magenta,.6)]]);
    ctx.fillRect(-205,-340,410,680);
    /* moving light + graphic bits */
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let k=0;k<5;k++){const o=((t*.35+k*.2)%1);
      ctx.fillStyle=`rgba(255,255,255,${.10+.05*k})`;
      ctx.fillRect(-205,-340+o*680,410,4);}
    ctx.restore();
    bars(-150,60,300,180,[.5,.72,.6,.9,.78],1,{col:'#FFFFFF',gap:14,rad:6,glowb:12});
    ctx.globalAlpha=.9;
    text(PA('phoneWord','REELS'),0,-200,{weight:900,size:64,ls:4,fill:'rgba(255,255,255,.95)',glowc:'rgba(255,255,255,.6)',glowb:20});
    ctx.restore();
    /* check badge */
    const cp=E.outBack(cl((t-HERO-.54)/.4));
    if(cp>0){ctx.save();ctx.translate(160,-300);ctx.scale(cp,cp);
      circle(0,0,50);ctx.fillStyle='#34D399';ctx.shadowColor='#34D399';ctx.shadowBlur=28;ctx.fill();
      ic('check',0,0,52,'#04121A',8);ctx.restore();}
    ctx.restore();
    /* label */
    ctx.save();ctx.globalAlpha=E.outExpo(cl((t-LBL)/.35));
    const HL=PA('heroLabel','ГОТОВЫЕ REELS');
    const sz=fitText(HL,940,900,3,116);
    gtext(HL,W/2,1270,{weight:900,size:sz,ls:3,stops:[[0,'#7FF3FF'],[.5,'#FFFFFF'],[1,'#FF6FB0']]});
    ctx.restore();
    if(t>RISE){
      ctx.save();ctx.globalAlpha=E.outExpo(cl((t-RISE-.04)/.35));
      chip(W/2,1350,PA('riseChip','ВЫДЕЛЯЮТ ВАШ БИЗНЕС'),{col:P.cyan,size:24,fillA:.14});
      ctx.restore();
      for(let k=0;k<2;k++)ring(W/2,780,RISE+.04+k*.35,t,{col:P.cyan,r0:200,r1:900,dur:.9,lw:8,a:.4});
    }
    ctx.restore();
  }
  /* ---- metrics dashboard ---- */
  if(metricsMode>0.01){
    ctx.save();ctx.globalAlpha=E.outQuint(metricsMode);
    ctx.translate(W/2,H*.46);
    const ms=lerp(.88,1,E.outQuint(metricsMode));ctx.scale(ms,ms);ctx.translate(-W/2,-H*.46);
    glass(70,330,W-140,560,30,{fillA:.055,border:.18,bcol:'#9FE8FF'});
    text(PA('metricTitle','УДЕРЖАНИЕ ВНИМАНИЯ'),118,392,{align:'left',weight:800,size:26,fam:'Inter',ls:4,fill:'rgba(255,255,255,.55)'});
    const rp2=E.outQuint(cl((t-MET-.12)/1.0));
    chartLine(130,440,W-260,380,[.16,.55,.78,.86,.9,.88,.93,.9,.95],rp2,{col:P.cyan,lw:9,fillA:.24,glowb:34});
    const pctv=Math.round(lerp(0,PA('pct',87),rp2));
    text(pctv+'%',W-126,392,{align:'right',weight:900,size:74,
      fill:lgrad(W-420,0,W-126,0,[[0,'#7FF3FF'],[1,'#B58CFF']]),glowc:rgba(P.cyan,.6),glowb:26});
    /* metric tiles */
    const tiles=(PA('tiles',[['ОХВАТ','×5.4'],['СОХРАНЕНИЯ','+218%'],['ЗАЯВКИ','+37']])).map((x,i)=>[x[0],x[1],[P.cyan,P.violet,P.magenta][i%3]]);
    tiles.forEach((tl,i)=>{
      const p=E.outBack(cl((t-MET-.26-i*.10)/.4));if(p<=0)return;
      ctx.save();ctx.globalAlpha=cl(p*2);
      const tw2=268, x=W/2-tw2*1.5-20+i*(tw2+20), y=940;
      ctx.translate(x+tw2/2,y+90);ctx.scale(lerp(.86,1,p),lerp(.86,1,p));
      glass(-tw2/2,-90,tw2,180,22,{fillA:.06,border:.16,bcol:tl[2]});
      text(tl[0],0,-34,{weight:700,size:22,fam:'Inter',ls:3,fill:'rgba(255,255,255,.45)'});
      text(tl[1],0,26,{weight:900,size:fitText(tl[1],tw2-46,900,0,58),fill:tl[2],glowc:rgba(tl[2],.6),glowb:22});
      ctx.restore();
    });
    ctx.save();ctx.globalAlpha=E.outExpo(cl((t-MET-.54)/.35));
    const FL=PA('finalLabel','УДЕРЖИВАЮТ ВНИМАНИЕ');
    const sz2=fitText(FL,940,900,3,96);
    text(FL,W/2,1250,{weight:900,size:sz2,ls:3,fill:'#FFFFFF',glowc:'rgba(140,220,255,.6)',glowb:30});
    ctx.restore();
    ctx.restore();
  }
  scan(t,{alpha:.05,h:400,speed:700});
  hud(t,.2);
}

/* ============================================================
   SCENE 7 — CTA (35.65 – 45.60)
   ============================================================ */
function bubble(x,y,w,h,txt,col,p,o={}){
  const {mine=false,size=28,tail=true}=o;
  ctx.save();ctx.globalAlpha=cl(p*2);
  ctx.translate(x,y+ (1-E.outBack(cl(p)))*40);
  const s=lerp(.86,1,E.outBack(cl(p)));ctx.scale(s,s);
  rr(-w/2,-h/2,w,h,[26,26,mine?6:26,mine?26:6]);
  ctx.fillStyle=mine?lgrad(-w/2,0,w/2,0,[[0,rgba(P.cyan,.85)],[1,rgba(P.violet,.85)]]):'rgba(255,255,255,.10)';
  ctx.shadowColor=mine?rgba(P.cyan,.5):'rgba(0,0,0,.4)';ctx.shadowBlur=mine?30:20;ctx.fill();
  if(!mine){ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1.6;ctx.stroke();}
  text(txt,0,2,{weight:800,size,fam:'Inter',ls:0,fill:mine?'#04121A':'rgba(255,255,255,.92)'});
  ctx.restore();
}
function scCta(lt,t){
  const Q1=B('q1',CUR.s+.13), Q2=B('q2',CUR.s+.59), Q3=B('q3',CUR.s+1.13),
        ICONS=B('icons',Q1+1.52),
        WR1=B('write1',F(.41)), WR2=B('write2',WR1+.42),
        COMP=B('composer',WR1+.66), TYPE=B('typing',WR1+.84),
        M1=B('msg1',WR1+1.56), M2=B('msg2',WR1+1.96), M3=B('msg3',WR1+2.28),
        VIR=B('viral',F(.69)), VIRT=B('viralText',VIR+.16),
        LOCK=B('lockup',F(.80));
  const SEC_B=WR1-0.08;
  bgBase(t,'#0C1230','#04060B');
  aurora(t,[P.violet,P.cyan,P.magenta],1.05,1.1);
  grid(t,{alpha:.11,color:'#8FEBFF',size:92,speed:.6});
  particles(t,{n:95,color:'#DFF6FF',alpha:.45,speed:44,seed:88});
  speedLines(t,{a:.05,n:44,inner:420,len:900,rot:.05});

  /* ---------- A: the question (35.65 – 39.70) ---------- */
  if(t<SEC_B+.16){
    const out=cl((t-(SEC_B-.08))/.24);
    ctx.save();ctx.globalAlpha=1-out;
    ctx.translate(W/2,H*.46);const zs=lerp(1,1.16,E.inQuad(out))*lerp(1,1.035,cl((t-37.4)/2.2));
    ctx.scale(zs,zs);ctx.translate(-W/2,-H*.46);
    /* converging engagement icons */
    const ic3=['heart','eye','play','bolt'];
    ic3.forEach((k,i)=>{
      const p=cl((t-ICONS-i*.16)/1.5);if(p<=0)return;
      const a=TAU*i/4+t*.35, r=lerp(760,190,E.outQuint(p));
      ctx.save();ctx.globalAlpha=cl(p*3)*(1-cl((p-.82)/.18))*.85;
      ctx.translate(W/2+Math.cos(a)*r,H*.455+Math.sin(a)*r*.75);
      const cc=[P.magenta,P.cyan,P.violet,P.amber][i];
      circle(0,0,46);ctx.fillStyle='rgba(8,12,22,.8)';ctx.fill();
      ctx.strokeStyle=rgba(cc,.7);ctx.lineWidth=3;ctx.shadowColor=cc;ctx.shadowBlur=22;ctx.stroke();
      ic(k,0,0,50,cc,4,1);ctx.restore();
    });
    const A1=PA('q1','ХОТИТЕ'), A2=PA('q2','REELS'), A3=PA('q3','КОТОРЫЕ ЦЕПЛЯЮТ?');
    slam(A1,W/2,H*.335,fitText(A1,900,900,6,124),Q1,t,
      {ls:6,col:'#FFFFFF',glowc:'rgba(255,255,255,.4)',glowb:26});
    slam(A2,W/2,H*.455,fitText(A2,960,900,4,250),Q2,t,
      {ls:4,grad:[[0,'#7FF3FF'],[.35,'#B58CFF'],[.7,'#FF5FA8'],[1,'#FFD36E']],
       glowc:'rgba(150,120,255,.85)',glowb:48});
    slam(A3,W/2,H*.565,fitText(A3,960,900,2,104),Q3,t,
      {ls:2,col:'#FFFFFF',glowc:'rgba(180,230,255,.55)',glowb:30});
    ring(W/2,H*.455,Q2+.02,t,{col:P.violet,r1:980,dur:.9,lw:12,a:.5});
    ring(W/2,H*.565,Q3+.02,t,{col:P.cyan,r1:900,dur:.8,lw:9,a:.42});
    ctx.restore();
    flash(t,Q1,.10,.5);flash(t,Q2,.12,.6);flash(t,Q3,.10,.5);
  }

  /* ---------- B: НАПИШИТЕ МНЕ (39.70 – 42.50) ---------- */
  if(t>=SEC_B&&t<VIR+.22){
    const out=cl((t-(VIR-.04))/.26);
    ctx.save();ctx.globalAlpha=cl((t-SEC_B)/.14)*(1-out);
    ctx.translate(W/2,H*.44);const zs=lerp(1,1.14,E.inQuad(out));ctx.scale(zs,zs);ctx.translate(-W/2,-H*.44);
    const C1=PA('cta1','НАПИШИТЕ'), C2=PA('cta2','МНЕ');
    slam(C1,W/2,432,fitText(C1,960,900,4,146),WR1,t,
      {ls:4,col:'#FFFFFF',glowc:'rgba(255,255,255,.45)',glowb:30});
    slam(C2,W/2,608,fitText(C2,900,900,8,196),WR2,t,
      {ls:8,grad:[[0,'#7FF3FF'],[.5,'#B58CFF'],[1,'#FF6FB0']],glowc:'rgba(160,130,255,.85)',glowb:46});
    ring(W/2,608,WR2+.02,t,{col:P.violet,r1:900,dur:.85,lw:11,a:.45});
    /* DM composer */
    const cp=E.outBack(cl((t-COMP)/.42));
    if(cp>0){
      ctx.save();ctx.globalAlpha=cl(cp*2);
      ctx.translate(W/2,842);ctx.scale(lerp(.9,1,cp),lerp(.9,1,cp));
      glass(-430,-72,860,144,40,{fillA:.07,border:.2,bcol:'#9FE8FF'});
      const typed=PA('dmText','Хочу такие Reels для бизнеса');
      const n=Math.round(typed.length*cl((t-TYPE)/.85));
      text(typed.slice(0,n),-380,2,{align:'left',weight:700,size:30,fam:'Inter',fill:'rgba(255,255,255,.9)'});
      setFont(700,30,'Inter',0);
      if(t<TYPE+.9&&Math.floor(t*8)%2===0){ctx.fillStyle=P.cyan;ctx.fillRect(-376+tw(typed.slice(0,n)),-18,3,36);}
      /* send button */
      const sp=.5+.5*Math.sin(t*7);
      ctx.save();ctx.translate(345,0);
      circle(0,0,52);ctx.fillStyle=lgrad(-52,-52,52,52,[[0,'#7FF3FF'],[1,'#B58CFF']]);
      ctx.shadowColor=P.cyan;ctx.shadowBlur=20+sp*22;ctx.fill();
      ic('send',3,0,50,'#06121E',0);ctx.restore();
      ctx.restore();
    }
    /* sent bubble + replies */
    const MSG=PA('messages',['Хочу такие Reels 🔥','Сколько стоит?','Когда начнём? 🚀']);
    bubble(W/2+150,1052,600,104,MSG[0]||'',null,MSG[0]?cl((t-M1)/.34):0,{mine:true,size:30});
    bubble(W/2-170,1188,540,100,MSG[1]||'',null,MSG[1]?cl((t-M2)/.34):0,{size:28});
    bubble(W/2+180,1320,560,100,MSG[2]||'',null,MSG[2]?cl((t-M3)/.34):0,{mine:true,size:28});
    /* notification pop */
    const np=cl((t-(M1+.06))/.3);
    if(np>0&&np<1.9){
      ctx.save();ctx.globalAlpha=cl(np*2)*cl((VIR-.1-t)/.3);
      const e=E.outBack(cl(np));
      ctx.translate(W/2+330,988);ctx.scale(e,e);
      circle(0,0,34);ctx.fillStyle=P.red;ctx.shadowColor=P.red;ctx.shadowBlur=24;ctx.fill();
      text('1',0,2,{weight:900,size:34,fill:'#fff'});ctx.restore();
    }
    ctx.restore();
    flash(t,WR1,.10,.55);flash(t,WR2,.12,.6);
  }

  /* ---------- C: ВИРУСНЫЙ РОЛИК (42.50 – 43.66) ---------- */
  if(t>=VIR&&t<LOCK+.20){
    const l=t-VIR, out=cl((t-(LOCK-.06))/.26);
    ctx.save();ctx.globalAlpha=cl(l/.14)*(1-out);
    ctx.translate(W/2,H*.44);const zs=lerp(1,1.12,E.inQuad(out));ctx.scale(zs,zs);ctx.translate(-W/2,-H*.44);
    /* explosive chart */
    const cp=E.outQuint(cl(l/.85));
    const views=Math.round(lerp(0,PA('views',1240000),E.outQuint(cl(l/1.0))));
    text(fmt(views),W/2,352,{weight:900,size:104,
      fill:lgrad(W/2-360,0,W/2+360,0,[[0,'#7FF3FF'],[1,'#FF6FB0']]),glowc:rgba(P.magenta,.6),glowb:30});
    text(PA('viewsLabel','ПРОСМОТРОВ'),W/2-4,424,{weight:800,size:26,fam:'Inter',ls:8,fill:'rgba(255,255,255,.5)'});
    glass(70,470,W-140,470,30,{fillA:.05,border:.16,bcol:'#9FE8FF'});
    chartLine(130,520,W-260,370,[.04,.08,.14,.22,.38,.62,.9,1.0],cp,{col:P.magenta,lw:11,fillA:.28,glowb:40});
    /* burst particles */
    const rnd=mulberry32(404);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let k=0;k<50;k++){
      const a=rnd()*TAU, sp2=300+rnd()*760, p=cl((l-.12-rnd()*.25)/.9);
      if(p<=0)continue;
      const e=E.outQuint(p);
      ctx.globalAlpha=(1-p)*.85;
      const cc=[P.cyan,P.violet,P.magenta,P.amber][k%4];
      ctx.fillStyle=cc;
      circle(W/2+Math.cos(a)*sp2*e, 700+Math.sin(a)*sp2*e*.8, 3+rnd()*6);ctx.fill();
    }
    ctx.restore();
    const VT=PA('viralLabel','ВИРУСНЫЙ РОЛИК');
    slam(VT,W/2,1075,fitText(VT,960,900,3,116),VIRT,t,
      {ls:3,grad:[[0,'#7FF3FF'],[.5,'#FFFFFF'],[1,'#FF6FB0']],glowc:'rgba(160,130,255,.8)',glowb:40});
    ring(W/2,700,VIRT+.02,t,{col:P.magenta,r1:1000,dur:.9,lw:12,a:.5});
    ctx.restore();
    flash(t,VIRT,.11,.55);
  }

  /* ---------- D: final lockup (43.66 – 45.60) ---------- */
  if(t>=LOCK){
    const l=t-LOCK;
    ctx.save();ctx.globalAlpha=cl(l/.22);
    ctx.translate(W/2,H*.46);const zs=lerp(1.06,1,E.outQuint(cl(l/1.0)))*lerp(1,1.02,cl(l/2));
    ctx.scale(zs,zs);ctx.translate(-W/2,-H*.46);
    /* send badge */
    const pu=.5+.5*Math.sin(t*4.2);
    ctx.save();ctx.translate(W/2,560);
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.fillStyle=rgrad(0,0,0,300,[[0,`rgba(140,200,255,${.22+pu*.14})`],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(-400,-400,800,800);ctx.restore();
    const bp=E.outBack(cl(l/.5));ctx.scale(bp,bp);
    circle(0,0,104);ctx.fillStyle=lgrad(-104,-104,104,104,[[0,'#7FF3FF'],[1,'#B58CFF']]);
    ctx.shadowColor=P.cyan;ctx.shadowBlur=30+pu*30;ctx.fill();
    ic('send',6,0,96,'#06121E',0);ctx.restore();
    for(let k=0;k<3;k++){const rt=LOCK+.2+k*.55+Math.floor((t-(LOCK+.2))/1.65)*1.65;
      ring(W/2,560,rt,t,{col:P.cyan,r0:104,r1:420,dur:1.1,lw:6,a:.4});}
    const LK=PA('lockup','НАПИШИТЕ МНЕ');
    slam(LK,W/2,830,fitText(LK,960,900,4,142),LOCK+.06,t,
      {ls:4,grad:[[0,'#7FF3FF'],[.5,'#FFFFFF'],[1,'#FF6FB0']],glowc:'rgba(160,200,255,.8)',glowb:44});
    ctx.save();ctx.globalAlpha=E.outExpo(cl((l-.36)/.4));
    ctx.translate(0,(1-E.outExpo(cl((l-.36)/.4)))*26);
    const S1=PA('lockSub1','И СОЗДАДИМ ВАШ СЛЕДУЮЩИЙ'), S2T=PA('lockSub2','ВИРУСНЫЙ REELS');
    const s2=fitText(S1,920,800,4,54);
    text(S1,W/2,950,{weight:800,size:s2,ls:4,fill:'rgba(255,255,255,.72)'});
    text(S2T,W/2,1026,{weight:900,size:fitText(S2T,900,900,3,66),ls:3,
      fill:lgrad(W/2-320,0,W/2+320,0,[[0,'#7FF3FF'],[1,'#FF6FB0']]),glowc:'rgba(140,200,255,.5)',glowb:24});
    ctx.restore();
    ctx.save();ctx.globalAlpha=E.outExpo(cl((l-.62)/.4))*(.75+.25*pu);
    const LT=PA('lockChips',['ИДЕЯ','СЦЕНАРИЙ','AI','ОЗВУЧКА','МОНТАЖ']);
    if(LT.length) chipRow(LT,W/2,1180,
      {size:19,fillA:.10,gap:12,cols:[P.amber,P.cyan,P.violet,P.pink,P.green]});
    ctx.restore();
    /* pulsing arrow down to profile */
    ctx.save();ctx.globalAlpha=E.outExpo(cl((l-.8)/.4))*(.55+.45*pu);
    ctx.translate(W/2,1310);ctx.rotate(Math.PI);ic('arrowUp',0,0,74,'#9FE8FF',6);ctx.restore();
    ctx.restore();
  }
  hud(t,.24);
}

/* ============================================================
   FALLBACK SCENE — kinetic typography for any phrase that does
   not match one of the specialised scene templates.
   params: {chip, lines:[{txt,t,accent}]}
   ============================================================ */
function scKinetic(lt,t){
  const V=PA('variant',0);                 /* три компоновки, чтобы соседние части не повторялись */
  const seed=CUR.seed||5;
  bgBase(t,['#0A1026','#160C22','#07161F'][V],'#04060B');
  aurora(t,[[P.violet,P.cyan,P.magenta],[P.magenta,P.amber,P.violet],[P.cyan,P.green,P.blue]][V],.85,.9);
  grid(t,{alpha:.10,color:['#7FE9FF','#FFB0D8','#8FF6D8'][V],size:96,speed:.5,persp:V===2});
  particles(t,{n:70,color:'#CFF3FF',alpha:.35,speed:34,seed});
  if(V!==2) speedLines(t,{a:.05,n:40,inner:420,len:900,rot:.06,seed});

  /* фоновая геометрия — своя для каждой компоновки */
  ctx.save();ctx.translate(W/2,H*.44);ctx.globalCompositeOperation='screen';
  for(let k=0;k<3;k++){
    const a=t*(0.35+k*0.28)*(k%2?-1:1), r=200+k*118, sides=V===0?(3+k*2):(V===1?4:6);
    ctx.save();ctx.rotate(a);
    ctx.strokeStyle=rgba([P.cyan,P.violet,P.magenta][(k+V)%3],.28);ctx.lineWidth=3;
    ctx.shadowColor=[P.cyan,P.violet,P.magenta][(k+V)%3];ctx.shadowBlur=20;
    ctx.beginPath();
    for(let i=0;i<=sides;i++){const g=TAU*i/sides;i?ctx.lineTo(Math.cos(g)*r,Math.sin(g)*r):ctx.moveTo(Math.cos(g)*r,Math.sin(g)*r);}
    ctx.stroke();ctx.restore();
  }
  ctx.restore();

  const chipTxt=PA('chip',null);
  if(chipTxt){
    ctx.save();ctx.globalAlpha=E.outExpo(cl(lt/.3));
    chip(W/2,238,chipTxt,{col:P.cyan,size:23,fillA:.10});ctx.restore();
  }

  const lines=PA('lines',[]);
  const n=Math.max(1,lines.length);
  lines.forEach((L,i)=>{
    /* компоновка 0 — столбик; 1 — со сдвигом; 2 — по одному крупно, сменяя друг друга */
    let x=W/2, y, size, alpha=1;
    if(V===2){
      const nxt=lines[i+1]?lines[i+1].t:CUR.e;
      alpha=cl((t-L.t)/0.12)*cl((nxt+0.28-t)/0.22);
      if(alpha<=0.01)return;
      y=H*.44; size=fitText(L.txt,960,900,3,215);
    }else{
      const step=Math.min(196,780/n), y0=H*.44-(n-1)*step/2;
      y=y0+i*step;
      size=fitText(L.txt,940,900,3,n<=2?190:150);
      if(V===1) x=W/2+(i%2?1:-1)*Math.min(120,(940-size*L.txt.length*0.34)/6);
    }
    ctx.save();ctx.globalAlpha*=alpha;
    if(L.accent){
      slam(L.txt,x,y,size,L.t,t,
        {ls:3,grad:[[0,'#7FF3FF'],[.5,'#B58CFF'],[1,'#FF6FB0']],glowc:'rgba(150,120,255,.8)',glowb:42});
      ring(x,y,L.t+.02,t,{col:P.violet,r1:920,dur:.8,lw:10,a:.42});
    }else{
      slam(L.txt,x,y,size,L.t,t,{ls:3,col:'#FFFFFF',glowc:'rgba(200,235,255,.45)',glowb:26});
    }
    ctx.restore();
    flash(t,L.t,.10,.42,'#CFF3FF');
  });
  scan(t,{alpha:.05,h:400,speed:660});
  hud(t,.20);
}

/* ============================================================
   СЦЕНА ПРЕИМУЩЕСТВ — строки «иконка + слово» с галочками.
   params: {head, items:[{t,ic,k,sub}], badge}
   ============================================================ */
function scOffer(lt,t){
  const items=PA('items',[]);
  const HEAD=B('head',CUR.s+.11), BADGE=B('badge',null);
  bgBase(t,'#08122A','#04060B');
  aurora(t,[P.cyan,P.green,P.violet],.7,.7);
  grid(t,{alpha:.09,color:'#7FE9FF',size:100,speed:.35});
  particles(t,{n:55,color:'#CFF3FF',alpha:.3,speed:28,seed:(CUR.seed||17)});

  const HT=PA('head',null);
  if(HT) slam(HT,W/2,392,fitText(HT,920,900,3,104),HEAD,t,
    {ls:3,col:'#FFFFFF',glowc:'rgba(160,230,255,.4)',glowb:26});

  const n=Math.max(1,items.length);
  const gap=Math.min(250,760/n), y0=592+(3-n)*40;
  items.forEach((it,i)=>{
    const p=E.outBack(cl((t-it.t)/.40));if(p<=0)return;
    const col=[P.cyan,P.green,P.violet,P.amber][i%4];
    ctx.save();ctx.globalAlpha=cl(p*2);
    ctx.translate(W/2,y0+i*gap);ctx.scale(lerp(.9,1,p),lerp(.9,1,p));
    ctx.translate(lerp(-70,0,p),0);
    glass(-455,-90,910,180,26,{fillA:.05,border:.16,bcol:col});
    ctx.save();ctx.translate(-340,0);
    circle(0,0,60);ctx.fillStyle=rgba(col,.12);ctx.fill();
    ctx.strokeStyle=rgba(col,.55);ctx.lineWidth=2.5;ctx.stroke();
    ic(it.ic,0,0,70,col,4.5);ctx.restore();
    const ks=fitText(it.k,540,900,1,54);
    text(it.k,-250,it.sub?-16:0,{align:'left',weight:900,size:ks,ls:1,fill:'#FFFFFF'});
    if(it.sub) text(it.sub,-250,34,{align:'left',weight:700,size:23,fam:'Inter',ls:3,fill:'rgba(255,255,255,.42)'});
    /* галочка */
    const cp=E.outBack(cl((t-it.t-.20)/.28));
    if(cp>0){ctx.save();ctx.translate(372,0);ctx.scale(cp,cp);ctx.globalAlpha=cl(cp*2);
      circle(0,0,48);ctx.fillStyle=rgba(P.green,.16);ctx.fill();
      ctx.strokeStyle=P.green;ctx.lineWidth=3.5;ctx.shadowColor=P.green;ctx.shadowBlur=20;ctx.stroke();
      ic('check',0,0,48,P.green,6);ctx.restore();}
    ctx.restore();
    ring(W/2-340,y0+i*gap,it.t,t,{col,r0:60,r1:300,dur:.7,lw:5,a:.35});
  });

  const BT=PA('badge',null);
  if(BT&&BADGE!==null&&t>BADGE){
    const p=E.outBack(cl((t-BADGE)/.34));
    ctx.save();ctx.globalAlpha=cl(p*2.4);
    ctx.translate(W/2,1330);ctx.scale(lerp(1.35,1,E.outExpo(cl((t-BADGE)/.3))),lerp(1.35,1,E.outExpo(cl((t-BADGE)/.3))));
    const sz=fitText(BT,900,900,2,60);
    setFont(900,sz,'Mont',2);const wI=tw(BT);
    rr(-wI/2-38,-52,wI+76,104,52);
    ctx.fillStyle=lgrad(-wI/2,0,wI/2,0,[[0,rgba(P.green,.18)],[1,rgba(P.cyan,.18)]]);ctx.fill();
    ctx.strokeStyle=rgba(P.green,.6);ctx.lineWidth=2.5;ctx.shadowColor=P.green;ctx.shadowBlur=22;ctx.stroke();
    text(BT,-1,2,{weight:900,size:sz,ls:2,fill:'#FFFFFF'});
    ctx.restore();
  }
  hud(t,.18);
}

/* ============================================================
   СЦЕНА РАСХОДОВ — из выручки по очереди вычитаются статьи затрат,
   и на глазах тает остаток прибыли.
   params: {head, items:[{t,ic,k,pct}], profitLabel, restLabel}
   ============================================================ */
function scCosts(lt,t){
  const items=PA('items',[]);
  const HEAD=B('head',CUR.s+.11);
  bgBase(t,'#1A0A12','#05060B');
  aurora(t,[P.red,P.amber,P.magenta],.6,.6);
  grid(t,{alpha:.08,color:'#FF9FB4',size:100,speed:.3});
  particles(t,{n:45,color:'#FFC7D4',alpha:.22,speed:24,seed:(CUR.seed||23)});

  const HT=PA('head','КУДА УХОДЯТ ДЕНЬГИ');
  slam(HT,W/2,352,fitText(HT,920,900,3,92),HEAD,t,
    {ls:3,col:'#FFFFFF',glowc:'rgba(255,150,170,.4)',glowb:26});

  /* полоса выручки: слева накапливаются расходы, справа тает остаток */
  const bx=110, by=470, bw=W-220, bh=76;
  const ap=E.outQuint(cl((t-HEAD-.25)/.5));
  ctx.save();ctx.globalAlpha=ap;
  rr(bx,by,bw,bh,14);ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1.6;ctx.stroke();
  let acc=0;
  items.forEach((it,i)=>{
    const p=E.outQuart(cl((t-it.t)/.45));if(p<=0)return;
    const col=[P.red,P.amber,P.magenta,P.violet,'#FF7A45'][i%5];
    const seg=bw*(it.pct/100)*p;
    ctx.save();rr(bx,by,bw,bh,14);ctx.clip();
    ctx.fillStyle=rgba(col,.75);ctx.fillRect(bx+bw*acc/100,by,seg,bh);
    ctx.restore();
    acc+=it.pct*p;
  });
  /* остаток — прибыль */
  const restPct=Math.max(0,100-acc);
  ctx.save();rr(bx,by,bw,bh,14);ctx.clip();
  ctx.fillStyle=rgba(P.green,.55);
  ctx.fillRect(bx+bw*(100-restPct)/100,by,bw*restPct/100,bh);ctx.restore();
  text(PA('profitLabel','ВЫРУЧКА'),bx,by-28,{align:'left',weight:800,size:24,fam:'Inter',ls:4,fill:'rgba(255,255,255,.5)'});
  text(Math.round(restPct)+'%',bx+bw,by-26,{align:'right',weight:900,size:38,
    fill: restPct<25?P.red:P.green, glowc:restPct<25?rgba(P.red,.6):rgba(P.green,.5), glowb:20});
  text(PA('restLabel','ОСТАЁТСЯ ВАМ'),bx+bw,by+bh+34,{align:'right',weight:700,size:22,fam:'Inter',ls:3,fill:'rgba(255,255,255,.4)'});
  ctx.restore();

  /* статьи расходов */
  const n=Math.max(1,items.length);
  const gap=Math.min(150,620/n), y0=700;
  items.forEach((it,i)=>{
    const p=E.outBack(cl((t-it.t)/.38));if(p<=0)return;
    const col=[P.red,P.amber,P.magenta,P.violet,'#FF7A45'][i%5];
    ctx.save();ctx.globalAlpha=cl(p*2);
    ctx.translate(W/2,y0+i*gap);ctx.scale(lerp(.92,1,p),lerp(.92,1,p));
    ctx.translate(lerp(60,0,p),0);
    glass(-455,-58,910,116,20,{fillA:.05,border:.14,bcol:col});
    ctx.save();ctx.translate(-380,0);
    circle(0,0,40);ctx.fillStyle=rgba(col,.14);ctx.fill();
    ctx.strokeStyle=rgba(col,.5);ctx.lineWidth=2;ctx.stroke();
    ic(it.ic,0,0,46,col,3.4);ctx.restore();
    text(it.k,-318,0,{align:'left',weight:900,size:fitText(it.k,470,900,1,44),ls:1,fill:'#FFFFFF'});
    text('−'+it.pct+'%',395,0,{align:'right',weight:900,size:44,fill:col,glowc:rgba(col,.6),glowb:18});
    ctx.restore();
    ring(W/2-380,y0+i*gap,it.t,t,{col,r0:40,r1:240,dur:.6,lw:4,a:.3});
  });
  hud(t,.16,'#FF8FA4');
}
