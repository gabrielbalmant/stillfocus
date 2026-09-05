/* ============================================================
   I18N — simple dictionary-based translation.
   Elements tagged with data-i18n get their textContent set;
   data-i18n-aria sets aria-label; data-i18n-placeholder sets
   the data-placeholder attribute (used by the task input's
   CSS ::before content).
   ============================================================ */

const I18N = (() => {
  const STRINGS = {
    pt: {
      modeFocus: "Focus",
      modeShort: "Short Break",
      modeLong: "Long Break",
      hintFocus: "um período de foco",
      hintShort: "uma pausa curta",
      hintLong: "uma pausa longa",
      hintClock: "agora",
      hintStopwatch: "cronometrando",
      taskPlaceholder: "O que você quer focar...",
      taskAria: "O que você quer focar",
      startLabel: "Start",
      pauseLabel: "Pause",
      resumeLabel: "Resume",
      resetAria: "Reiniciar timer",
      fullscreenEnterAria: "Entrar em tela cheia",
      fullscreenExitAria: "Sair da tela cheia",
      settingsAria: "Abrir configurações",
      closeSettingsAria: "Fechar configurações",
      galleryAria: "Abrir galeria de wallpapers",
      closeGalleryAria: "Fechar galeria",
      galleryTitle: "Galeria",
      galleryHint: "Wallpapers originais, já incluídos no projeto. Toque para aplicar.",
      settingsTitle: "Configurações",
      sectionFormat: "Formato",
      formatCronometro: "Cronômetro",
      formatPomodoro: "Pomodoro",
      formatRelogio: "Relógio",
      formatContador: "Contador",
      sectionDurations: "Durações",
      unitMin: "min",
      sectionEnvironment: "Ambiente",
      tabDefault: "Padrão",
      tabSolid: "Cor",
      tabGradient: "Gradiente",
      tabImage: "Imagem",
      chooseImage: "Escolher imagem",
      resetBg: "Restaurar background padrão",
      solidColorAria: "Escolher cor sólida",
      sectionTypography: "Tipografia",
      weightLight: "Light",
      weightRegular: "Regular",
      weightExtrabold: "Extrabold",
      sectionEffects: "Efeitos",
      labelAsciiLayer: "Camada ASCII",
      labelDither: "Ordered Dithering",
      labelDitherIntensity: "Quantidade",
      labelDitherNoise: "Ruído monocromático",
      labelDitherColor: "Manter cores originais",
      sectionAudio: "Áudio",
      labelSoundPlayPause: "Som de início/pausa",
      labelSoundTick: "Tique-taque",
      labelSoundCompletion: "Som de conclusão",
      sectionLanguage: "Idioma",
      dateConnector: "de",
      months: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]
    },
    en: {
      modeFocus: "Focus",
      modeShort: "Short Break",
      modeLong: "Long Break",
      hintFocus: "a focus period",
      hintShort: "a short break",
      hintLong: "a long break",
      hintClock: "now",
      hintStopwatch: "timing",
      taskPlaceholder: "What you want to focus on...",
      taskAria: "What you want to focus on",
      startLabel: "Start",
      pauseLabel: "Pause",
      resumeLabel: "Resume",
      resetAria: "Reset timer",
      fullscreenEnterAria: "Enter fullscreen",
      fullscreenExitAria: "Exit fullscreen",
      settingsAria: "Open settings",
      closeSettingsAria: "Close settings",
      galleryAria: "Open wallpaper gallery",
      closeGalleryAria: "Close gallery",
      galleryTitle: "Gallery",
      galleryHint: "Original wallpapers, bundled with the project. Tap to apply.",
      settingsTitle: "Settings",
      sectionFormat: "Format",
      formatCronometro: "Timer",
      formatPomodoro: "Pomodoro",
      formatRelogio: "Clock",
      formatContador: "Stopwatch",
      sectionDurations: "Durations",
      unitMin: "min",
      sectionEnvironment: "Environment",
      tabDefault: "Default",
      tabSolid: "Color",
      tabGradient: "Gradient",
      tabImage: "Image",
      chooseImage: "Choose image",
      resetBg: "Restore default background",
      solidColorAria: "Choose solid color",
      sectionTypography: "Typography",
      weightLight: "Light",
      weightRegular: "Regular",
      weightExtrabold: "Extrabold",
      sectionEffects: "Effects",
      labelAsciiLayer: "ASCII layer",
      labelDither: "Ordered Dithering",
      labelDitherIntensity: "Amount",
      labelDitherNoise: "Monochrome noise",
      labelDitherColor: "Keep original colors",
      sectionAudio: "Audio",
      labelSoundPlayPause: "Start/pause sound",
      labelSoundTick: "Ticking",
      labelSoundCompletion: "Completion sound",
      sectionLanguage: "Language",
      dateConnector: "of",
      months: ["january","february","march","april","may","june","july","august","september","october","november","december"]
    }
  };

  let locale = "pt";

  function t(key){
    return (STRINGS[locale] && STRINGS[locale][key]) || STRINGS.pt[key] || key;
  }

  function setLocale(l){
    locale = STRINGS[l] ? l : "pt";
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
  }

  function getLocale(){ return locale; }

  function apply(root){
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.setAttribute("data-placeholder", t(el.dataset.i18nPlaceholder));
    });
  }

  return { t, setLocale, getLocale, apply };
})();
