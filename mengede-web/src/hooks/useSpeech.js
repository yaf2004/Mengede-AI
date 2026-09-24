import { useCallback, useEffect, useState } from 'react';
import { VOICES } from '../context/SettingsContext.jsx';

const MALE_HINT = /\b(male|david|mark|daniel|alex|guy|george|james|richard|fred|tom|ryan|liam|eric|paul|thomas|oliver)\b/i;
const FEMALE_HINT = /\b(female|zira|samantha|susan|aria|jenny|hazel|karen|victoria|moira|tessa|fiona|allison|linda|emma|sara|serena|kate|google us english)\b/i;

function pickVoice(key) {
  if (!('speechSynthesis' in window)) return { voice: null, matched: false };
  const all = speechSynthesis.getVoices();
  const am = all.find(v => /^am/i.test(v.lang));
  if (am) return { voice: am, matched: true };
  const en = all.filter(v => /^en/i.test(v.lang));
  const hint = key === 'abebe' ? MALE_HINT : FEMALE_HINT;
  const other = key === 'abebe' ? FEMALE_HINT : MALE_HINT;
  const m = en.find(v => hint.test(v.name) && !(other.test(v.name) && !hint.test(v.name)));
  if (m) return { voice: m, matched: true };
  return { voice: en[0] || all[0] || null, matched: false };
}

// DOMParser builds an inert document, so markup in the text (now including AI output) can't run.
function stripHTML(text) {
  return new DOMParser().parseFromString(text, 'text/html').body.textContent || '';
}

// Re-renders whenever the browser (re)loads its voice list — some browsers load it async.
export function useVoicesReady() {
  const [, force] = useState(0);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const handler = () => force(n => n + 1);
    speechSynthesis.onvoiceschanged = handler;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);
}

export function useSpeech(settings) {
  const supported = 'speechSynthesis' in window;

  const speak = useCallback((text, voiceKey) => {
    if (!supported) return;
    const key = voiceKey || settings.voice;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripHTML(text));
    const { voice, matched } = pickVoice(key);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.pitch = matched ? VOICES[key].pitch : VOICES[key].pitchFallback;
    u.rate = settings.rate;
    speechSynthesis.speak(u);
  }, [settings.voice, settings.rate, supported]);

  const stop = useCallback(() => { if (supported) speechSynthesis.cancel(); }, [supported]);

  const maybeSpeak = useCallback((text) => { if (settings.speak) speak(text); }, [settings.speak, speak]);

  const currentVoiceInfo = useCallback((key) => pickVoice(key || settings.voice), [settings.voice]);

  return { supported, speak, stop, maybeSpeak, currentVoiceInfo };
}
