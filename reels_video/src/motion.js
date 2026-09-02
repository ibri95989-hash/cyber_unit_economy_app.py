/* ============================================================
   АНИМИРОВАННЫЕ ИКОНКИ (Lottie).
   Файлы .json из папки assets/motion подставляются вместо
   статичных иконок: имя файла = тема или имя иконки Lucide.

   Кадр берётся по абсолютному времени ролика, а не по часам
   браузера, — иначе покадровый рендер разъехался бы с видео.
   ============================================================ */
const MOTION = (() => {
  const anims = {};        /* имя -> {anim, canvas, ctx, frames, fps} */
  let ready = false;

  async function load(list){
    if(typeof lottie === 'undefined' || !list || !list.length){ ready = true; return; }
    for(const item of list){
      const name = item.name, url = item.url;
      try{
        const data = await (await fetch(url)).json();
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-9999px;width:512px;height:512px';
        document.body.appendChild(holder);
        const anim = lottie.loadAnimation({
          container: holder, renderer: 'canvas', loop: true,
          autoplay: false, animationData: data,
          rendererSettings:{ clearCanvas:true, preserveAspectRatio:'xMidYMid meet' }
        });
        await new Promise(r => { anim.addEventListener('DOMLoaded', r); setTimeout(r, 4000); });
        const cv = holder.querySelector('canvas');
        if(!cv){ continue; }
        anims[name] = { anim, cv, frames: anim.totalFrames || 60, fps: anim.frameRate || 30 };
      }catch(e){ console.warn('motion: не загрузилось', name, e); }
    }
    ready = true;
  }

  return {
    load,
    isReady(){ return ready; },
    has(name){ return !!anims[name]; },
    names(){ return Object.keys(anims); },
    /* Рисует кадр анимации в текущий холст. t — секунды от начала показа. */
    draw(ctx2, name, x, y, size, t, alpha){
      const a = anims[name];
      if(!a) return false;
      const f = Math.floor((t * a.fps) % a.frames);
      a.anim.goToAndStop(f, true);
      ctx2.save();
      if(alpha !== undefined) ctx2.globalAlpha *= alpha;
      ctx2.drawImage(a.cv, x - size / 2, y - size / 2, size, size);
      ctx2.restore();
      return true;
    }
  };
})();
