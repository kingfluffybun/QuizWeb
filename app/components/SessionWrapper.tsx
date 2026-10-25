"use client";

import { SessionProvider, type SessionProviderProps } from "next-auth/react";
import React from "react";

export default function SessionWrapper({
    children,
    ...props
}: SessionProviderProps) {
    return <SessionProvider {...props}>{children}</SessionProvider>;
}
