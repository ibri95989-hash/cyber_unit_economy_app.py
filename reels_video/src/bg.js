/* ============================================================
   ФОНЫ НА ШЕЙДЕРЕ — считаются видеокартой прямо во время рендера.
   Ничего не скачивается и не стоит денег: вместо статичной картинки
   живой объёмный градиент, который течёт и меняется всю сцену.

   Кадр считается в половинном разрешении и растягивается на холст —
   вчетверо дешевле и даёт естественную мягкость, как расфокус.
   ============================================================ */
const BG = (() => {
  /* Разрешение фона. Он мягкий по своей природе, поэтому считать его
     в полном размере незачем — растягивание добавляет естественный расфокус. */
  let RW = 432, RH = 768;
  let gl = null, prog = null, cv = null, U = {}, ok = false;

  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FS = `#version 300 es
  precision highp float;
  out vec4 o;
  uniform vec2  uRes;
  uniform float uTime, uSeed, uStyle, uAmt;
  uniform vec3  uC1, uC2, uC3;

  /* --- шум --- */
  vec2 hash2(vec2 p){
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
                   dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
               mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
                   dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for(int i = 0; i < 4; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 q = uv; q.x *= uRes.x / uRes.y;          /* без искажения по вертикали */
    float t = uTime * 0.09 + uSeed * 13.7;

    /* искажение области — от него течение становится органическим */
    vec2 w = vec2(fbm(q * 1.7 + t), fbm(q * 1.7 - t + 4.3));
    float f = fbm(q * 2.1 + w * 1.4 + t * 0.6);
    float f2 = fbm(q * 3.6 - w * 0.9 - t * 0.4);

    /* палитра: три цвета смешиваются полем шума */
    vec3 col = mix(uC1, uC2, smoothstep(-0.25, 0.45, f));
    col = mix(col, uC3, smoothstep(0.05, 0.6, f2) * 0.75);

    /* объёмный свет: мягкое ядро, смещающееся со временем */
    vec2 lp = vec2(0.5 + 0.22 * sin(t * 1.3 + uSeed), 0.42 + 0.18 * cos(t * 1.1));
    float d = distance(uv, lp);
    col += (uC2 * 0.55 + uC3 * 0.25) * exp(-d * d * 9.0) * (0.55 + 0.25 * sin(uTime * 0.7));

    /* световой луч наискось — только у части стилей */
    if(uStyle > 0.5){
      float ang = 0.6;
      vec2 r = vec2(uv.x * cos(ang) - uv.y * sin(ang), uv.x * sin(ang) + uv.y * cos(ang));
      float beam = exp(-pow((r.x - 0.35 - 0.1 * sin(t * 2.0)) * 6.0, 2.0));
      col += uC3 * beam * 0.16;
    }
    /* сетка глубины — у третьего стиля */
    if(uStyle > 1.5){
      vec2 g = fract(uv * vec2(9.0, 16.0) + vec2(0.0, uTime * 0.05));
      float line = smoothstep(0.0, 0.02, min(g.x, g.y));
      col += uC2 * (1.0 - line) * 0.05;
    }

    col *= uAmt;
    /* виньетка и лёгкое зерно, чтобы не было плоской заливки */
    col *= 1.0 - 0.55 * pow(distance(uv, vec2(0.5, 0.46)) * 1.35, 2.0);
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5) - 0.5) * 0.012;
    o = vec4(max(col, 0.0), 1.0);
  }`;

  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.error('shader:', gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }

  function init(){
    if(gl !== null) return ok;
    cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
    gl = cv.getContext('webgl2', {antialias:false, preserveDrawingBuffer:true});
    if(!gl){ ok = false; return false; }
    const vs = compile(VS, gl.VERTEX_SHADER), fs = compile(FS, gl.FRAGMENT_SHADER);
    if(!vs || !fs){ ok = false; return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
      console.error('link:', gl.getProgramInfoLog(prog)); ok = false; return false;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for(const n of ['uRes','uTime','uSeed','uStyle','uAmt','uC1','uC2','uC3'])
      U[n] = gl.getUniformLocation(prog, n);
    gl.viewport(0, 0, RW, RH);
    ok = true; return true;
  }

  const hex = h => {
    const n = parseInt(h.replace('#',''), 16);
    return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
  };

  /* Палитры под настроение сцены. Тёмные, чтобы текст поверх читался. */
  const PALETTES = {
    tech:    ['#050A18', '#123A6B', '#7C3AED'],
    warm:    ['#160814', '#5B1B3A', '#FF6B3D'],
    danger:  ['#14060A', '#5C1226', '#FF2D55'],
    money:   ['#04140F', '#0C4F3A', '#22C55E'],
    violet:  ['#0A0620', '#3A1E7A', '#C026D3'],
    ice:     ['#03121A', '#0E4A63', '#22D3EE'],
    night:   ['#06070E', '#1B2340', '#5B6CFF']
  };

  return {
    /* Качество: 'high' — полное, 'fast' — вчетверо дешевле, 'off' — выключить. */
    setQuality(q){
      if(gl) return;                       /* размер задаётся до первой отрисовки */
      if(q === 'high'){ RW = 540; RH = 960; }
      else if(q === 'fast'){ RW = 320; RH = 568; }
    },
    /* Рисует фон прямо в переданный контекст холста. */
    draw(ctx2, W, H, t, opt){
      if(!init()) return false;
      const o = opt || {};
      const pal = PALETTES[o.palette] || PALETTES.tech;
      gl.uniform2f(U.uRes, RW, RH);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uSeed, (o.seed || 0) * 0.137);
      gl.uniform1f(U.uStyle, o.style === undefined ? 1 : o.style);
      gl.uniform1f(U.uAmt, o.amount === undefined ? 1 : o.amount);
      gl.uniform3fv(U.uC1, hex(pal[0]));
      gl.uniform3fv(U.uC2, hex(pal[1]));
      gl.uniform3fv(U.uC3, hex(pal[2]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ctx2.save();
      ctx2.imageSmoothingEnabled = true;
      ctx2.imageSmoothingQuality = 'high';
      ctx2.drawImage(cv, 0, 0, W, H);
      ctx2.restore();
      return true;
    },
    palettes: Object.keys(PALETTES)
  };
})();
