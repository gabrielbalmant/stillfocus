/* ============================================================
   ASCII ATMOSPHERIC LAYER
   Canvas-based. Draws a low-opacity ASCII texture over the
   background: procedural noise when the background is a
   solid color / gradient / default, or sampled brightness
   from the user's image when one is set.
   No DOM-per-character — everything is one canvas.
   ============================================================ */

const AsciiLayer = (() => {
  const RAMP = " .:-+*#%@";
  let canvas, ctx;
  let cols = 0, rows = 0, cell = 0;
  let charGrid = [];
  let noiseGrid = [];       // base value-noise field
  let phase = 0;            // slow drift used while running
  let sourceImage = null;   // Image element when background type = image
  let mode = "default";     // 'default' | 'image'
  let state = "idle";       // idle | running | paused | completed
  let lastRegen = 0;
  let regenInterval = 3200; // ms between grid regenerations
  let rafId = null;
  let enabled = true;
  let reducedMotion = false;
  let flashUntil = 0;

  function isMobile(){ return window.innerWidth < 700; }

  function sizeCanvas(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cell = isMobile() ? 13 : 11;
    cols = Math.ceil(window.innerWidth / cell) + 1;
    rows = Math.ceil(window.innerHeight / cell) + 1;
  }

  // ---- value noise (smooth pseudo-random field) ----
  function makeNoiseGrid(seedOffset){
    const gw = Math.ceil(cols / 3) + 2;
    const gh = Math.ceil(rows / 3) + 2;
    const grid = [];
    for (let y = 0; y < gh; y++){
      const row = [];
      for (let x = 0; x < gw; x++){
        row.push(Math.random());
      }
      grid.push(row);
    }
    return { grid, gw, gh };
  }

  function sampleNoise(nf, x, y){
    // x,y normalized to noise-grid space
    const gx = x / 3, gy = y / 3;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, nf.gw - 1), y1 = Math.min(y0 + 1, nf.gh - 1);
    const tx = gx - x0, ty = gy - y0;
    const v00 = nf.grid[y0]?.[x0] ?? 0.5;
    const v10 = nf.grid[y0]?.[x1] ?? 0.5;
    const v01 = nf.grid[y1]?.[x0] ?? 0.5;
    const v11 = nf.grid[y1]?.[x1] ?? 0.5;
    const smooth = t => t * t * (3 - 2 * t);
    const sx = smooth(tx), sy = smooth(ty);
    const top = v00 + (v10 - v00) * sx;
    const bot = v01 + (v11 - v01) * sx;
    return top + (bot - top) * sy;
  }

  function charFor(brightness){
    const i = Math.max(0, Math.min(RAMP.length - 1, Math.floor(brightness * RAMP.length)));
    return RAMP[i];
  }

  // ---- offscreen sampling of an image, for brightness map ----
  let offCanvas, offCtx;
  function sampleImageBrightness(){
    if (!sourceImage) return null;
    const sw = Math.max(cols, 8), sh = Math.max(rows, 8);
    if (!offCanvas){ offCanvas = document.createElement("canvas"); offCtx = offCanvas.getContext("2d", { willReadFrequently: true }); }
    offCanvas.width = sw; offCanvas.height = sh;
    // cover-fit the image into sw x sh
    const iw = sourceImage.naturalWidth || sourceImage.width;
    const ih = sourceImage.naturalHeight || sourceImage.height;
    const scale = Math.max(sw / iw, sh / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (sw - dw) / 2, dy = (sh - dh) / 2;
    offCtx.clearRect(0, 0, sw, sh);
    offCtx.drawImage(sourceImage, dx, dy, dw, dh);
    try {
      const data = offCtx.getImageData(0, 0, sw, sh).data;
      const out = [];
      for (let y = 0; y < sh; y++){
        const row = [];
        for (let x = 0; x < sw; x++){
          const idx = (y * sw + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          row.push((0.299*r + 0.587*g + 0.114*b) / 255);
        }
        out.push(row);
      }
      return out;
    } catch(e){
      // tainted canvas (cross-origin) fallback — treat as no image
      return null;
    }
  }

  function regenerateGrid(){
    charGrid = [];
    let brightnessMap = null;
    if (mode === "image") brightnessMap = sampleImageBrightness();

    if (brightnessMap){
      const sh = brightnessMap.length, sw = brightnessMap[0].length;
      for (let y = 0; y < rows; y++){
        const row = [];
        const sy = Math.min(sh - 1, Math.floor((y / rows) * sh));
        for (let x = 0; x < cols; x++){
          const sx = Math.min(sw - 1, Math.floor((x / cols) * sw));
          let b = brightnessMap[sy][sx];
          // sparsify: skip low-contrast cells sometimes for a lighter feel
          row.push(b > 0.06 ? charFor(b) : " ");
        }
        charGrid.push(row);
      }
    } else {
      const nf = makeNoiseGrid();
      for (let y = 0; y < rows; y++){
        const row = [];
        for (let x = 0; x < cols; x++){
          const b = sampleNoise(nf, x + phase, y);
          row.push(b > 0.34 ? charFor(b) : " ");
        }
        charGrid.push(row);
      }
    }
  }

  function draw(){
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!enabled || !charGrid.length) return;

    let alpha = 0.16;
    if (state === "running") alpha = 0.22;
    if (state === "paused") alpha = 0.12;
    if (Date.now() < flashUntil) alpha = 0.4;

    ctx.font = `${cell}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = `rgba(244,242,236,${alpha})`;

    for (let y = 0; y < rows; y++){
      const row = charGrid[y];
      if (!row) continue;
      let line = "";
      for (let x = 0; x < cols; x++) line += row[x];
      ctx.fillText(line, 0, y * cell);
    }
  }

  function tick(ts){
    if (!enabled){ rafId = requestAnimationFrame(tick); return; }
    if (ts - lastRegen > regenInterval){
      if (state === "running" && !reducedMotion) phase += 0.6;
      regenerateGrid();
      lastRegen = ts;
    }
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function init(canvasEl){
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) regenInterval = 999999; // effectively static after first render
    sizeCanvas();
    regenerateGrid();
    lastRegen = performance.now();
    draw();
    rafId = requestAnimationFrame(tick);

    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        sizeCanvas();
        regenerateGrid();
      }, 150);
    });
  }

  return {
    init,
    setState(s){ state = s; if (s === "completed"){ flashUntil = Date.now() + 700; } },
    setEnabled(v){
      enabled = v;
      canvas.classList.toggle("hidden-layer", !v);
    },
    setSourceImage(imgEl){
      sourceImage = imgEl;
      mode = imgEl ? "image" : "default";
      regenerateGrid();
    },
    clearImage(){
      sourceImage = null;
      mode = "default";
      regenerateGrid();
    }
  };
})();
