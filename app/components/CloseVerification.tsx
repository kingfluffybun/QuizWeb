"use client";

import { useEffect } from "react";

export default function CloseVerification() {
    // useEffect(() => {
    //     window.close();
    // }, []);

    return (
        <button
            onClick={() => window.close()}
            style={{
                border: "none",
                background: "#9966FF",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
            }}
        >
            Close Tab
        </button>
    );
}