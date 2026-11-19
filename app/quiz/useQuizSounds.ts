"use client";

import { useCallback, useEffect } from "react";

export type QuizSound =
  | "correct-answer1"
  | "correct-answer2"
  | "correct-answer3"
  | "wrong-answer"
  | "skipped-answer"
  | "lesson-complete";

const SOUND_FILES: QuizSound[] = [
  "correct-answer1",
  "correct-answer2",
  "correct-answer3",
  "wrong-answer",
  "skipped-answer",
  "lesson-complete",
];

const audioElements = new Map<QuizSound, HTMLAudioElement>();
let hasPreloadedSounds = false;

function getAudio(sound: QuizSound): HTMLAudioElement | undefined {
  if (typeof Audio === "undefined") return undefined;

  let audio = audioElements.get(sound);
  if (!audio) {
    audio = new Audio(`/assets/sounds/${sound}.wav`);
    audio.preload = "auto";
    audioElements.set(sound, audio);
  }

  return audio;
}

export function useQuizSounds() {
  useEffect(() => {
    if (hasPreloadedSounds) return;
    hasPreloadedSounds = true;
    for (const sound of SOUND_FILES) {
      getAudio(sound)?.load();
    }
  }, []);

  return useCallback((sound: QuizSound) => {
    const audio = getAudio(sound);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch((error: unknown) => {
      console.error(`Unable to play quiz sound "${sound}":`, error);
    });
  }, []);
}
