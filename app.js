/* ============================================================
   POMODORO — APP LOGIC
   ============================================================ */
(() => {
  "use strict";

  const STORAGE_KEY = "pomodoro:v1";

  const MODE_LABELS = { focus: "Focus", short: "Short Break", long: "Long Break" };
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
    { id: "aurora",  css: "radial-gradient(120% 100% at 15% 10%, #16233c 0%, transparent 55%), radial-gradient(110% 100% at 85% 20%, #241a3d 0%, transparent 55%), radial-gradient(140% 120% at 50% 100%, #0d3b3a 0%, transparent 60%), #0a0e13" },
    { id: "ember",   css: "linear-gradient(160deg, #2b0f12 0%, #4a1a1a 45%, #1c0a0d 100%)" },
    { id: "dusk",    css: "linear-gradient(160deg, #241338 0%, #3a2159 45%, #120a20 100%)" },
    { id: "forest",  css: "linear-gradient(160deg, #0f2418 0%, #1c3d2a 45%, #0a1712 100%)" },
    { id: "slate",   css: "linear-gradient(160deg, #1b2226 0%, #2c3941 45%, #10151a 100%)" },
    { id: "citrine", css: "linear-gradient(160deg, #2e2410 0%, #4a3a16 45%, #1a1508 100%)" },
    { id: "ocean",   css: "linear-gradient(160deg, #0c1f2e 0%, #123448 45%, #081521 100%)" },
    { id: "mauve",   css: "linear-gradient(160deg, #241a26 0%, #3d2940 45%, #150e17 100%)" }
  ];

  /* ---------- state ---------- */
  let settings = {
    durations: { ...DEFAULT_DURATIONS },
    background: { type: "default", color: "#16233c", gradientId: "aurora", image: null },
    asciiEnabled: true
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
        asciiEnabled: parsed.asciiEnabled !== undefined ? parsed.asciiEnabled : true
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
    modePrimary: document.getElementById("mode-primary"),
    modePills: Array.from(document.querySelectorAll(".mode-pill")),
    timer: document.getElementById("timer"),
    startBtn: document.getElementById("start-btn"),
    resetBtn: document.getElementById("reset-btn"),
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
    el.modePrimary.textContent = MODE_LABELS[timer.mode];
    el.sessionHint.textContent = MODE_HINTS[timer.mode];
    el.modePills.forEach(pill => {
      const isActive = pill.dataset.mode === timer.mode;
      pill.classList.toggle("active", isActive);
      pill.hidden = isActive; // the active mode is shown big above, not duplicated below
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
    } else if (bg.type === "gradient"){
      const preset = GRADIENT_PRESETS.find(p => p.id === bg.gradientId) || GRADIENT_PRESETS[0];
      el.bgLayer.style.background = preset.css;
      AsciiLayer.clearImage();
    } else if (bg.type === "image" && bg.image){
      el.bgLayer.classList.add("has-image");
      el.bgLayer.style.setProperty("--user-bg-image", `url(${CSS.escape ? bg.image : bg.image})`);
      el.bgLayer.style.backgroundImage = `url("${bg.image}")`;
      const img = new Image();
      img.onload = () => AsciiLayer.setSourceImage(img);
      img.src = bg.image;
      currentImageEl = img;
    } else {
      // default
      el.bgLayer.style.background = "";
      AsciiLayer.clearImage();
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
     EVENTS
     ============================================================ */
  function wireEvents(){
    el.startBtn.addEventListener("click", () => {
      if (timer.running) pauseTimer();
      else startTimer();
    });
    el.resetBtn.addEventListener("click", resetTimer);

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
      if (e.code === "Space" && el.settingsOverlay.hidden && document.activeElement.tagName !== "BUTTON" && document.activeElement.tagName !== "INPUT"){
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
