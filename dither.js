/* ============================================================
   ORDERED DITHERING LAYER
   Stylizes the current background (image, or a synthetic noise
   field when there's no image) into a two-tone dot pattern using
   a classic 4x4 Bayer threshold matrix, tinted with the
   background's own hue. Optionally overlays a flickering
   monochrome grain on top.

   Everything is drawn on ONE canvas, at a reduced working
   resolution — never per-frame full-res pixel loops.
   ============================================================ */

const DitherLayer = (() => {
  const BAYER_4 = [
    [ 0, 8, 2, 10],
    [12, 4, 14, 6],
    [ 3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  let canvas, ctx;
  let enabled = false;
  let noiseEnabled = true;
  let intensity = 40; // 0-100 -> maps to dot cell size
  let sourceImage = null;

  let darkColor = { r: 20, g: 34, b: 50 };
  let lightColor = { r: 236, g: 240, b: 243 };

  let patternCanvas, patternCtx;
  let noiseCanvas, noiseCtx;
  let cols = 0, rows = 0, cellSize = 4;
  let reducedMotion = false;
  let noiseTimerId = null;
  let dirty = true;

  function isMobile(){ return window.innerWidth < 700; }

  function cellSizeFromIntensity(){
    const base = 2 + (intensity / 100) * 6; // 2px..8px
    return isMobile() ? base * 1.3 : base;
  }

  function sizeCanvas(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cellSize = cellSizeFromIntensity();
    cols = Math.max(2, Math.ceil(window.innerWidth / cellSize));
    rows = Math.max(2, Math.ceil(window.innerHeight / cellSize));
  }

  // ---- lightweight value-noise field, used when there is no source image ----
  function proceduralLuminance(x, y, gw, gh){
    const seedGrid = proceduralLuminance._grid || (proceduralLuminance._grid = (() => {
      const g = [];
      for (let j = 0; j < gh; j++){ const row = []; for (let i = 0; i < gw; i++) row.push(Math.random()); g.push(row); }
      return g;
    })());
    const gx = x / 5, gy = y / 5;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, gw - 1), y1 = Math.min(y0 + 1, gh - 1);
    const tx = gx - x0, ty = gy - y0;
    const smooth = t => t * t * (3 - 2 * t);
    const g = seedGrid;
    const v00 = g[y0 % g.length]?.[x0 % g[0].length] ?? .5;
    const v10 = g[y0 % g.length]?.[x1 % g[0].length] ?? .5;
    const v01 = g[y1 % g.length]?.[x0 % g[0].length] ?? .5;
    const v11 = g[y1 % g.length]?.[x1 % g[0].length] ?? .5;
    const sx = smooth(tx), sy = smooth(ty);
    const top = v00 + (v10 - v00) * sx;
    const bot = v01 + (v11 - v01) * sx;
    return top + (bot - top) * sy;
  }

  function buildLuminanceGrid(){
    if (sourceImage){
      try {
        const iw = sourceImage.naturalWidth || sourceImage.width;
        const ih = sourceImage.naturalHeight || sourceImage.height;
        const tmp = document.createElement("canvas");
        tmp.width = cols; tmp.height = rows;
        const tctx = tmp.getContext("2d", { willReadFrequently: true });
        const scale = Math.max(cols / iw, rows / ih);
        const dw = iw * scale, dh = ih * scale;
        tctx.drawImage(sourceImage, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
        const data = tctx.getImageData(0, 0, cols, rows).data;
        const grid = new Float32Array(cols * rows);
        for (let i = 0, p = 0; i < data.length; i += 4, p++){
          grid[p] = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 255;
        }
        return grid;
      } catch(e){ /* tainted canvas — fall through to procedural */ }
    }
    proceduralLuminance._grid = null;
    const gw = Math.ceil(cols / 5) + 2, gh = Math.ceil(rows / 5) + 2;
    const grid = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++){
      for (let x = 0; x < cols; x++){
        grid[y * cols + x] = proceduralLuminance(x, y, gw, gh);
      }
    }
    return grid;
  }

  function renderPattern(){
    if (!patternCanvas){
      patternCanvas = document.createElement("canvas");
      patternCtx = patternCanvas.getContext("2d", { willReadFrequently: true });
    }
    patternCanvas.width = cols;
    patternCanvas.height = rows;
    const luminance = buildLuminanceGrid();
    const img = patternCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++){
      const bayerRow = BAYER_4[y % 4];
      for (let x = 0; x < cols; x++){
        const threshold = (bayerRow[x % 4] + 0.5) / 16;
        const l = luminance[y * cols + x];
        const c = l > threshold ? lightColor : darkColor;
        const p = (y * cols + x) * 4;
        img.data[p] = c.r; img.data[p+1] = c.g; img.data[p+2] = c.b; img.data[p+3] = 255;
      }
    }
    patternCtx.putImageData(img, 0, 0);
    dirty = false;
  }

  function renderNoiseTile(){
    if (!noiseCanvas){
      noiseCanvas = document.createElement("canvas");
      noiseCtx = noiseCanvas.getContext("2d", { willReadFrequently: true });
    }
    const nw = cols, nh = rows;
    noiseCanvas.width = nw; noiseCanvas.height = nh;
    const img = noiseCtx.createImageData(nw, nh);
    for (let i = 0; i < img.data.length; i += 4){
      const v = Math.random() > 0.5 ? 255 : 0;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v;
      img.data[i+3] = Math.random() * 90;
    }
    noiseCtx.putImageData(img, 0, 0);
  }

  function draw(){
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!enabled) return;
    if (dirty || !patternCanvas) renderPattern();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(patternCanvas, 0, 0, cols, rows, 0, 0, window.innerWidth, window.innerHeight);

    if (noiseEnabled && noiseCanvas){
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.5;
      ctx.drawImage(noiseCanvas, 0, 0, cols, rows, 0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function scheduleNoiseRefresh(){
    clearInterval(noiseTimerId);
    if (!noiseEnabled || reducedMotion){
      if (enabled && noiseEnabled) renderNoiseTile(); // static single frame under reduced motion
      draw();
      return;
    }
    noiseTimerId = setInterval(() => {
      if (!enabled || !noiseEnabled) return;
      renderNoiseTile();
      draw();
    }, 140);
  }

  function init(canvasEl){
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sizeCanvas();
    draw();

    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        sizeCanvas();
        dirty = true;
        if (enabled){ renderNoiseTile(); draw(); }
      }, 150);
    });
  }

  return {
    init,
    setEnabled(v){
      enabled = v;
      canvas.classList.toggle("hidden-layer", !v);
      if (v){ dirty = true; renderNoiseTile(); scheduleNoiseRefresh(); }
      else { clearInterval(noiseTimerId); draw(); }
    },
    setIntensity(v){
      intensity = v;
      sizeCanvas();
      dirty = true;
      if (enabled) draw();
    },
    setNoiseEnabled(v){
      noiseEnabled = v;
      scheduleNoiseRefresh();
    },
    setSourceImage(imgEl){
      sourceImage = imgEl;
      dirty = true;
      if (enabled) draw();
    },
    clearImage(){
      sourceImage = null;
      dirty = true;
      if (enabled) draw();
    },
    setDuotone(dark, light){
      darkColor = dark;
      lightColor = light;
      dirty = true;
      if (enabled) draw();
    }
  };
})();
