"use client";

import { SessionProvider, type SessionProviderProps } from "next-auth/react";
import React from "react";

export default function SessionWrapper({
    children,
    refetchOnWindowFocus = false,
    ...props
}: SessionProviderProps) {
    return (
        <SessionProvider refetchOnWindowFocus={refetchOnWindowFocus} {...props}>
            {children}
        </SessionProvider>
    );
}
