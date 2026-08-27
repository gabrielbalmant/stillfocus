/* ============================================================
   POMODORO — APP LOGIC
   ============================================================ */
(() => {
  "use strict";

  const STORAGE_KEY = "pomodoro:v1";

  const MODE_HINTS = {
    focus: "um período de foco",
    short: "uma pausa curta",
    long: "uma pausa longa"
  };
  const DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15 }; // minutes
  const LIMITS = {
    focus: { min: 1, max: 180 },
    short: { min: 1, max: 60 },
    long:  { min: 1, max: 90 }
  };

  const GRADIENT_PRESETS = [
    { id: "aurora",  css: "radial-gradient(120% 100% at 15% 10%, #16233c 0%, transparent 55%), radial-gradient(110% 100% at 85% 20%, #241a3d 0%, transparent 55%), radial-gradient(140% 120% at 50% 100%, #0d3b3a 0%, transparent 60%), #0a0e13", avg: { r: 20, g: 34, b: 50 } },
    { id: "ember",   css: "linear-gradient(160deg, #2b0f12 0%, #4a1a1a 45%, #1c0a0d 100%)", avg: { r: 48, g: 17, b: 19 } },
    { id: "dusk",    css: "linear-gradient(160deg, #241338 0%, #3a2159 45%, #120a20 100%)", avg: { r: 37, g: 21, b: 59 } },
    { id: "forest",  css: "linear-gradient(160deg, #0f2418 0%, #1c3d2a 45%, #0a1712 100%)", avg: { r: 18, g: 40, b: 28 } },
    { id: "slate",   css: "linear-gradient(160deg, #1b2226 0%, #2c3941 45%, #10151a 100%)", avg: { r: 29, g: 37, b: 43 } },
    { id: "citrine", css: "linear-gradient(160deg, #2e2410 0%, #4a3a16 45%, #1a1508 100%)", avg: { r: 49, g: 38, b: 15 } },
    { id: "ocean",   css: "linear-gradient(160deg, #0c1f2e 0%, #123448 45%, #081521 100%)", avg: { r: 13, g: 35, b: 50 } },
    { id: "mauve",   css: "linear-gradient(160deg, #241a26 0%, #3d2940 45%, #150e17 100%)", avg: { r: 39, g: 27, b: 42 } }
  ];
  const DEFAULT_BG_AVG = { r: 20, g: 34, b: 50 };

  const MONTHS_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  /* ============================================================
     ADAPTIVE CONTRAST — computes a readable foreground color
     tinted toward the background's own hue, instead of pure
     white or pure black. Dark backgrounds get a near-white text
     tinted with the bg hue; light backgrounds get a near-black
     text tinted the same way.
     ============================================================ */
  function hexToRgb(hex){
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const int = parseInt(full, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }

  function rgbToHsl({ r, g, b }){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s; const l = (max + min) / 2;
    if (max === min){ h = 0; s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb({ h, s, l }){
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0){ r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function relativeLuminance({ r, g, b }){
    const toLinear = c => {
      const cs = c / 255;
      return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function rgbCss({ r, g, b }){ return `rgb(${r}, ${g}, ${b})`; }

  function updateAdaptiveForeground(avg){
    const hsl = rgbToHsl(avg);
    const bgIsLight = relativeLuminance(avg) > 0.5;
    // main readable text: near-white (dark bg) or near-black (light bg), tinted with bg hue
    const fg = hslToRgb({
      h: hsl.h,
      s: Math.min(hsl.s * 0.4, 26),
      l: bgIsLight ? 12 : 94
    });
    // ink for text drawn on top of a filled --color-fg surface (e.g. active mode pill)
    const ink = hslToRgb({
      h: hsl.h,
      s: Math.min(hsl.s * 1.15, 65),
      l: bgIsLight ? 92 : 16
    });
    document.documentElement.style.setProperty("--color-fg", rgbCss(fg));
    document.documentElement.style.setProperty("--color-fg-ink", rgbCss(ink));
  }

  function averageColorFromImage(imgEl){
    try {
      const c = document.createElement("canvas");
      const size = 24;
      c.width = size; c.height = size;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height;
      const scale = Math.max(size / iw, size / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(imgEl, (size - dw) / 2, (size - dh) / 2, dw, dh);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4){ r += data[i]; g += data[i+1]; b += data[i+2]; n++; }
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    } catch(e){
      return DEFAULT_BG_AVG; // tainted canvas (cross-origin) — fall back to default
    }
  }

  /* ---------- state ---------- */
  let settings = {
    durations: { ...DEFAULT_DURATIONS },
    background: { type: "default", color: "#16233c", gradientId: "aurora", image: null },
    asciiEnabled: true,
    taskText: ""
  };

  let timer = {
    mode: "focus",
    running: false,
    paused: false,
    endTime: null,     // timestamp ms, when running
    remaining: DEFAULT_DURATIONS.focus * 60, // seconds
    intervalId: null
  };

  /* ---------- persistence ---------- */
  function loadSettings(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      settings = {
        durations: { ...DEFAULT_DURATIONS, ...(parsed.durations || {}) },
        background: { type: "default", color: "#16233c", gradientId: "aurora", image: null, ...(parsed.background || {}) },
        asciiEnabled: parsed.asciiEnabled !== undefined ? parsed.asciiEnabled : true,
        taskText: typeof parsed.taskText === "string" ? parsed.taskText : ""
      };
    } catch(e){ /* corrupted or unavailable storage — keep defaults */ }
  }

  function saveSettings(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch(e){
      // likely quota exceeded (large image). Drop the image, keep the rest.
      try {
        const fallback = { ...settings, background: { ...settings.background, image: null, type: settings.background.type === "image" ? "default" : settings.background.type } };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      } catch(e2){ /* give up silently */ }
    }
  }

  /* ---------- DOM refs ---------- */
  const el = {
    bgLayer: document.getElementById("bg-layer"),
    asciiCanvas: document.getElementById("ascii-canvas"),
    modePills: Array.from(document.querySelectorAll(".mode-pill")),
    taskInput: document.getElementById("task-input"),
    dateDisplay: document.getElementById("date-display"),
    timer: document.getElementById("timer"),
    startBtn: document.getElementById("start-btn"),
    resetBtn: document.getElementById("reset-btn"),
    fullscreenBtn: document.getElementById("fullscreen-btn"),
    sessionHint: document.getElementById("session-hint"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsOverlay: document.getElementById("settings-overlay"),
    closeSettings: document.getElementById("close-settings"),
    durFocus: document.getElementById("dur-focus"),
    durShort: document.getElementById("dur-short"),
    durLong: document.getElementById("dur-long"),
    bgTabs: Array.from(document.querySelectorAll(".bg-tab")),
    bgPanels: {
      solid: document.getElementById("bg-panel-solid"),
      gradient: document.getElementById("bg-panel-gradient"),
      image: document.getElementById("bg-panel-image")
    },
    solidColorInput: document.getElementById("solid-color-input"),
    gradientPresetsWrap: document.getElementById("gradient-presets"),
    imageInput: document.getElementById("image-input"),
    resetBgBtn: document.getElementById("reset-bg-btn"),
    asciiToggle: document.getElementById("ascii-toggle")
  };

  /* ============================================================
     TIMER ENGINE — timestamp based, resistant to tab throttling
     ============================================================ */
  function durationSeconds(mode){ return settings.durations[mode] * 60; }

  function resetTimerForMode(mode, { keepRunning = false } = {}){
    timer.mode = mode;
    timer.remaining = durationSeconds(mode);
    if (keepRunning && timer.running){
      timer.endTime = Date.now() + timer.remaining * 1000;
    } else {
      timer.running = false;
      timer.paused = false;
      timer.endTime = null;
    }
    renderTimerDisplay();
    renderModeUI();
    renderControlsUI();
  }

  function tickTimer(){
    if (!timer.running) return;
    const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
    timer.remaining = remaining;
    renderTimerDisplay();
    if (remaining <= 0){
      completeSession();
    }
  }

  function startTimer(){
    if (timer.remaining <= 0) timer.remaining = durationSeconds(timer.mode);
    timer.running = true;
    timer.paused = false;
    timer.endTime = Date.now() + timer.remaining * 1000;
    clearInterval(timer.intervalId);
    timer.intervalId = setInterval(tickTimer, 250);
    AsciiLayer.setState("running");
    renderControlsUI();
  }

  function pauseTimer(){
    timer.running = false;
    timer.paused = true;
    clearInterval(timer.intervalId);
    AsciiLayer.setState("paused");
    renderControlsUI();
  }

  function resetTimer(){
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.paused = false;
    timer.remaining = durationSeconds(timer.mode);
    timer.endTime = null;
    AsciiLayer.setState("idle");
    renderTimerDisplay();
    renderControlsUI();
  }

  function completeSession(){
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.paused = false;
    timer.remaining = 0;
    timer.endTime = null;
    renderTimerDisplay();
    renderControlsUI();
    AsciiLayer.setState("completed");
    playChime();
    el.timer.classList.remove("state-completed");
    // eslint-disable-next-line no-unused-expressions
    void el.timer.offsetWidth; // restart animation
    el.timer.classList.add("state-completed");
  }

  function onVisibilityChange(){
    if (document.visibilityState === "visible" && timer.running){
      tickTimer();
    }
  }

  /* ---------- sound ---------- */
  let audioCtx = null;
  function playChime(){
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [660, 880].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch(e){ /* audio unavailable — fail silently */ }
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function formatTime(totalSeconds){
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderTimerDisplay(){
    el.timer.textContent = formatTime(timer.remaining);
  }

  function renderModeUI(){
    el.sessionHint.textContent = MODE_HINTS[timer.mode];
    el.modePills.forEach(pill => {
      pill.classList.toggle("active", pill.dataset.mode === timer.mode);
    });
  }

  function renderControlsUI(){
    const playIcon = el.startBtn.querySelector(".icon-play");
    const pauseIcon = el.startBtn.querySelector(".icon-pause");
    const label = el.startBtn.querySelector(".btn-label");
    if (timer.running){
      playIcon.hidden = true; pauseIcon.hidden = false;
      label.textContent = "Pause";
      el.startBtn.classList.add("running");
    } else {
      playIcon.hidden = false; pauseIcon.hidden = true;
      label.textContent = timer.paused ? "Resume" : "Start";
      el.startBtn.classList.remove("running");
    }
  }

  /* ============================================================
     MODE SWITCHING
     ============================================================ */
  function switchMode(mode){
    if (mode === timer.mode) return;
    resetTimerForMode(mode);
    AsciiLayer.setState("idle");
  }

  /* ============================================================
     BACKGROUND
     ============================================================ */
  let currentImageEl = null;

  function applyBackground(){
    const bg = settings.background;
    el.bgLayer.classList.remove("has-image");
    el.bgLayer.style.removeProperty("--user-bg-image");
    el.bgLayer.style.background = "";

    if (bg.type === "solid"){
      el.bgLayer.style.background = bg.color;
      AsciiLayer.clearImage();
      updateAdaptiveForeground(hexToRgb(bg.color));
    } else if (bg.type === "gradient"){
      const preset = GRADIENT_PRESETS.find(p => p.id === bg.gradientId) || GRADIENT_PRESETS[0];
      el.bgLayer.style.background = preset.css;
      AsciiLayer.clearImage();
      updateAdaptiveForeground(preset.avg);
    } else if (bg.type === "image" && bg.image){
      el.bgLayer.classList.add("has-image");
      el.bgLayer.style.setProperty("--user-bg-image", `url(${CSS.escape ? bg.image : bg.image})`);
      el.bgLayer.style.backgroundImage = `url("${bg.image}")`;
      const img = new Image();
      img.onload = () => {
        AsciiLayer.setSourceImage(img);
        updateAdaptiveForeground(averageColorFromImage(img));
      };
      img.src = bg.image;
      currentImageEl = img;
    } else {
      // default
      el.bgLayer.style.background = "";
      AsciiLayer.clearImage();
      updateAdaptiveForeground(DEFAULT_BG_AVG);
    }
  }

  function setBackgroundType(type){
    settings.background.type = type;
    saveSettings();
    applyBackground();
    renderSettingsBackgroundUI();
  }

  function renderSettingsBackgroundUI(){
    const type = settings.background.type;
    el.bgTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.bgtype === type));
    Object.entries(el.bgPanels).forEach(([key, panelEl]) => { panelEl.hidden = key !== type; });
    el.solidColorInput.value = settings.background.color;
    Array.from(el.gradientPresetsWrap.children).forEach(swatch => {
      swatch.classList.toggle("active", swatch.dataset.gid === settings.background.gradientId);
    });
  }

  function buildGradientPresetSwatches(){
    el.gradientPresetsWrap.innerHTML = "";
    GRADIENT_PRESETS.forEach(preset => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gradient-swatch";
      btn.style.background = preset.css;
      btn.dataset.gid = preset.id;
      btn.setAttribute("aria-label", `Gradiente ${preset.id}`);
      btn.addEventListener("click", () => {
        settings.background.gradientId = preset.id;
        settings.background.type = "gradient";
        saveSettings();
        applyBackground();
        renderSettingsBackgroundUI();
      });
      el.gradientPresetsWrap.appendChild(btn);
    });
  }

  /* ============================================================
     SETTINGS PANEL
     ============================================================ */
  function openSettings(){
    el.settingsOverlay.hidden = false;
    el.durFocus.value = settings.durations.focus;
    el.durShort.value = settings.durations.short;
    el.durLong.value = settings.durations.long;
    el.asciiToggle.checked = settings.asciiEnabled;
    renderSettingsBackgroundUI();
    el.closeSettings.focus();
  }

  function closeSettingsPanel(){
    el.settingsOverlay.hidden = true;
    el.settingsBtn.focus();
  }

  function clampDuration(mode, value){
    const { min, max } = LIMITS[mode];
    const n = Math.round(Number(value));
    if (Number.isNaN(n)) return settings.durations[mode];
    return Math.min(max, Math.max(min, n));
  }

  function commitDuration(mode, inputEl){
    const clamped = clampDuration(mode, inputEl.value);
    inputEl.value = clamped;
    if (settings.durations[mode] === clamped) return;
    settings.durations[mode] = clamped;
    saveSettings();
    if (mode === timer.mode && !timer.running && !timer.paused){
      timer.remaining = durationSeconds(mode);
      renderTimerDisplay();
    }
  }

  /* ============================================================
     FULLSCREEN
     ============================================================ */
  function isFullscreen(){ return !!document.fullscreenElement; }

  function updateFullscreenIcon(){
    const enterIcon = el.fullscreenBtn.querySelector(".icon-fs-enter");
    const exitIcon = el.fullscreenBtn.querySelector(".icon-fs-exit");
    const fs = isFullscreen();
    enterIcon.hidden = fs;
    exitIcon.hidden = !fs;
    el.fullscreenBtn.setAttribute("aria-label", fs ? "Sair da tela cheia" : "Entrar em tela cheia");
  }

  function toggleFullscreen(){
    if (isFullscreen()){
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  /* ============================================================
     DATE BADGE
     ============================================================ */
  function renderDateBadge(){
    const now = new Date();
    const month = MONTHS_PT[now.getMonth()];
    el.dateDisplay.textContent = `${month} ${now.getDate()} de ${now.getFullYear()}`;
  }

  /* ============================================================
     TASK INPUT
     ============================================================ */
  function initTaskInput(){
    if (settings.taskText) el.taskInput.textContent = settings.taskText;
  }

  let taskSaveTimer = null;
  function onTaskInput(){
    clearTimeout(taskSaveTimer);
    taskSaveTimer = setTimeout(() => {
      settings.taskText = el.taskInput.textContent.trim();
      saveSettings();
    }, 400);
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function wireEvents(){
    el.startBtn.addEventListener("click", () => {
      if (timer.running) pauseTimer();
      else startTimer();
    });
    el.resetBtn.addEventListener("click", resetTimer);
    el.fullscreenBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenIcon);

    el.taskInput.addEventListener("input", onTaskInput);
    el.taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){ e.preventDefault(); el.taskInput.blur(); }
    });

    el.modePills.forEach(pill => {
      pill.addEventListener("click", () => switchMode(pill.dataset.mode));
    });

    el.settingsBtn.addEventListener("click", openSettings);
    el.closeSettings.addEventListener("click", closeSettingsPanel);
    el.settingsOverlay.addEventListener("click", (e) => {
      if (e.target === el.settingsOverlay) closeSettingsPanel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.settingsOverlay.hidden) closeSettingsPanel();
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "BUTTON" || active.tagName === "INPUT" || active.isContentEditable);
      if (e.code === "Space" && el.settingsOverlay.hidden && !isTyping){
        e.preventDefault();
        if (timer.running) pauseTimer(); else startTimer();
      }
    });

    [["focus", el.durFocus], ["short", el.durShort], ["long", el.durLong]].forEach(([mode, input]) => {
      input.addEventListener("change", () => commitDuration(mode, input));
      input.addEventListener("blur", () => commitDuration(mode, input));
    });

    el.bgTabs.forEach(tab => {
      tab.addEventListener("click", () => setBackgroundType(tab.dataset.bgtype));
    });

    el.solidColorInput.addEventListener("input", () => {
      settings.background.color = el.solidColorInput.value;
      settings.background.type = "solid";
      saveSettings();
      applyBackground();
    });

    el.imageInput.addEventListener("change", () => {
      const file = el.imageInput.files && el.imageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        settings.background.image = reader.result;
        settings.background.type = "image";
        saveSettings();
        applyBackground();
        renderSettingsBackgroundUI();
      };
      reader.readAsDataURL(file);
    });

    el.resetBgBtn.addEventListener("click", () => {
      settings.background = { type: "default", color: "#16233c", gradientId: "aurora", image: null };
      saveSettings();
      applyBackground();
      renderSettingsBackgroundUI();
    });

    el.asciiToggle.addEventListener("change", () => {
      settings.asciiEnabled = el.asciiToggle.checked;
      saveSettings();
      AsciiLayer.setEnabled(settings.asciiEnabled);
    });

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init(){
    loadSettings();
    buildGradientPresetSwatches();
    wireEvents();

    timer.remaining = durationSeconds(timer.mode);
    renderTimerDisplay();
    renderModeUI();
    renderControlsUI();
    renderDateBadge();
    initTaskInput();
    updateFullscreenIcon();

    applyBackground();
    AsciiLayer.init(el.asciiCanvas);
    AsciiLayer.setEnabled(settings.asciiEnabled);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
