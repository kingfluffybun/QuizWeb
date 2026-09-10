import { ImageResponse } from "next/og";

// Image metadata
export const alt = "QuizWeb — Master Web Development with Interactive Quizzes";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    backgroundColor: "#0d0914",
                    backgroundImage:
                        "radial-gradient(circle at 25% 25%, rgba(153, 102, 255, 0.28) 0%, transparent 55%), radial-gradient(circle at 85% 75%, rgba(100, 50, 200, 0.2) 0%, transparent 50%)",
                    padding: "60px 80px",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Header / Brand */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "14px",
                            backgroundColor: "#9966FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            fontSize: "28px",
                            fontWeight: 800,
                            boxShadow: "0 0 30px rgba(153, 102, 255, 0.6)",
                        }}
                    >
                        ⚡
                    </div>
                    <span
                        style={{
                            fontSize: "36px",
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "#ffffff",
                        }}
                    >
                        QuizWeb
                    </span>
                    <span
                        style={{
                            marginLeft: "12px",
                            padding: "6px 14px",
                            borderRadius: "20px",
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#c4a7ff",
                            backgroundColor: "rgba(153, 102, 255, 0.15)",
                            border: "1px solid rgba(153, 102, 255, 0.3)",
                        }}
                    >
                        Interactive Learning
                    </span>
                </div>

                {/* Main Content / Headline */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "920px" }}>
                    <h1
                        style={{
                            fontSize: "54px",
                            fontWeight: 800,
                            lineHeight: 1.15,
                            color: "#ffffff",
                            margin: 0,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Writing code gets easier,{" "}
                        <span style={{ color: "#b388ff" }}>
                            QuizWeb makes it stick.
                        </span>
                    </h1>
                    <p
                        style={{
                            fontSize: "24px",
                            lineHeight: 1.45,
                            color: "#a39bb8",
                            margin: 0,
                        }}
                    >
                        Master HTML, CSS, and JavaScript with bite-sized challenges, daily streaks, and gamified progress tracking.
                    </p>
                </div>

                {/* Footer / Tech Badges */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                        paddingTop: "24px",
                    }}
                >
                    <div style={{ display: "flex", gap: "12px" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 18px",
                                borderRadius: "10px",
                                backgroundColor: "rgba(227, 79, 38, 0.18)",
                                border: "1px solid rgba(227, 79, 38, 0.35)",
                                color: "#ff8a65",
                                fontSize: "17px",
                                fontWeight: 700,
                            }}
                        >
                            HTML5
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 18px",
                                borderRadius: "10px",
                                backgroundColor: "rgba(21, 114, 182, 0.18)",
                                border: "1px solid rgba(21, 114, 182, 0.35)",
                                color: "#64b5f6",
                                fontSize: "17px",
                                fontWeight: 700,
                            }}
                        >
                            CSS3
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 18px",
                                borderRadius: "10px",
                                backgroundColor: "rgba(247, 223, 30, 0.18)",
                                border: "1px solid rgba(247, 223, 30, 0.35)",
                                color: "#ffd54f",
                                fontSize: "17px",
                                fontWeight: 700,
                            }}
                        >
                            JavaScript
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "20px",
                            fontWeight: 600,
                            color: "#8a7eab",
                        }}
                    >
                        quizweb.dev
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
