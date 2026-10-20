"use client";

import { useEffect } from "react";

export type QuizSound =
    | "correct-answer1"
    | "correct-answer2"
    | "correct-answer3"
    | "wrong-answer"
    | "skipped-answer"
    | "lesson-complete";

const soundFiles: QuizSound[] = [
    "correct-answer1",
    "correct-answer2",
    "correct-answer3",
    "wrong-answer",
    "skipped-answer",
    "lesson-complete",
];

const audioElements = new Map<QuizSound, HTMLAudioElement>();

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
        for (const sound of soundFiles) {
            getAudio(sound)?.load();
        }
    }, []);

    return (sound: QuizSound) => {
        const audio = getAudio(sound);
        if (!audio) return;

        audio.pause();
        audio.currentTime = 0;
        void audio.play().catch((error: unknown) => {
            console.error(`Unable to play quiz sound "${sound}":`, error);
        });
    };
}
