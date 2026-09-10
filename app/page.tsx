"use client";

import Image from "next/image";
import Link from "next/link";
import "#css/landing-page.css";
import "#css/nav.css";
import PublicNav from "@/app/components/publicNav";
import * as Assets from "@/app/components/illustrations/svg_assets";

export default function Home() {
    return (
        <>
        <PublicNav />
        <section className="hero">
            <div className="overlay"></div>
            <div className="hero-text">
                <div className="logo col" id="logo-hero">
                    <Image src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt="QuizWeb Logo"/>
                    <p style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>QuizWeb</p>
                </div>
                <h1>Writing Code gets easier, QuizWeb makes it stick.</h1>
                <p>Earn daily streaks, unlock new levels, and learn HTML, CSS, and JavaScript the fun way.</p>
                <Link href="/quiz" className="call-to-action row" style={{ textDecoration: "none" }}>
                    <h2>Start Learning</h2>
                    <div className="call-to-action-icon col">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                </Link>
            </div>
            
            {/* Light mode */}
            <div id="clouds-topleft" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopLeft /></div>
            <div id="clouds-topright" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopRight /></div>
            <div id="bus" className="designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.Bus /></div>
            <div id="clouds-left" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsLeft /></div>
            <div id="clouds-right" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsRight /></div>

            {/* dark mode */}
            <div id="clouds-topleft" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopLeftDark /></div>
            <div id="clouds-topright" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopRightDark /></div>
            <div id="bus" className="designs" aria-hidden="true" data-hide-on-theme="light"><Assets.BusDark /></div>
            <div id="clouds-left" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsLeftDark /></div>
            <div id="clouds-right" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsRightDark /></div>

            <div id="ground"></div>
        </section>
        
        <section className="section row first-section">
            <div className="section-container row">
                <div className="section-content col ">
                    <h2>Learn By Doing</h2>
                    <p>Reading about code only gets you so far. QuizWeb puts you straight into the action with bite-sized, interactive quizzes that let you write and test real HTML, CSS, and JavaScript as you go. </p>
                </div>
                <div className="section-illustration row">
                    <Image src="/assets/landing-page/Laptop.svg" width={100} height={100} alt="Interactive coding on a laptop" id="laptop"/>
                </div>
            </div>
        </section>

        <section className="section row">
            <div className="section-container row">
                <div className="section-illustration row pos-2">
                    <Image src="/assets/landing-page/Calendar.svg" width={100} height={100} alt="Daily streak calendar tracking progress" id="calendar"/>
                </div>
                <div className="section-content col pos-1">
                    <h2>Track your progress</h2>
                    <p>Every quiz you finish adds to your daily streak, keeping you motivated to come back and level up. QuizWeb turns your learning into a game you actually want to keep playing.</p>
                </div>
            </div>
        </section>

        <section className="section row">
            <div className="section-container row">
                <div className="section-content col pos-1">
                    <h2>Built for beginners</h2>
                    <p>No experience, no jargon, no overwhelming setup — just start from zero and learn HTML, CSS, and JavaScript one small win at a time. All you need is curiosity and a few minutes a day.</p>
                </div>
                <div className="section-illustration row pos-2">
                    <Image src="/assets/landing-page/Books.svg" width={100} height={100} alt="Stack of educational web development books" id="books"/>
                </div>
            </div>
        </section>
        </>
    )
}