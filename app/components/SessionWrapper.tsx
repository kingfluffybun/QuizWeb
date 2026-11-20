"use client";

import { SessionProvider, type SessionProviderProps } from "next-auth/react";
import React from "react";
import LearnPreloadSync from "@/app/components/LearnPreloadSync";
import SystemTutorialOrchestrator from "@/app/components/SystemTutorialOrchestrator";

export default function SessionWrapper({
    children,
    refetchOnWindowFocus = false,
    ...props
}: SessionProviderProps) {
    return (
        <SessionProvider refetchOnWindowFocus={refetchOnWindowFocus} {...props}>
            <LearnPreloadSync />
            <SystemTutorialOrchestrator />
            {children}
        </SessionProvider>
    );
}
