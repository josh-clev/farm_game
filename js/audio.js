(function defineGameAudio() {
  "use strict";

  let context;
  const clips = new Map();

  function getContext() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function tone(frequency, duration, type = "sine", volume = 0.045, delay = 0) {
    const audioContext = getContext();
    if (!audioContext) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playSound(name) {
    if (name === "water" || name === "harvest") {
      let clip = clips.get(name);
      if (!clip) {
        clip = new Audio(`assets/${name}.mp3`);
        clip.preload = "auto";
        clips.set(name, clip);
      }
      clip.currentTime = 0;
      clip.play().catch(() => {});
      return;
    }
    const sounds = {
      "order-click": () => tone(330, 0.09, "triangle", 0.035),
      "confirm-click": () => { tone(520, 0.08, "sine", 0.04); tone(780, 0.12, "sine", 0.025, 0.045); },
      "cancel-click": () => tone(180, 0.12, "triangle", 0.035),
      "shop-click": () => tone(420, 0.07, "square", 0.022),
      "place-shop-item": () => { tone(440, 0.08, "triangle", 0.04); tone(660, 0.14, "sine", 0.03, 0.055); },
      "next-turn": () => { tone(280, 0.09, "triangle", 0.035); tone(560, 0.16, "sine", 0.03, 0.06); },
    };
    sounds[name]?.();
  }

  window.FarmGameAudio = { playSound };
}());
