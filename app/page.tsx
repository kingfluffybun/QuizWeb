"use client";

import Image from "next/image";
import Link from "next/link";
import "#css/landing-page.css";
import "#css/nav.css";
import { useEffect, useState } from "react";
import PublicNav from "@/app/components/publicNav";
import * as Assets from "@/app/actions/animation/svg_assets";

export default function Home() {
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const bodyOverflow = document.body.style.overflow;
        const rootOverflow = document.documentElement.style.overflow;

        if (menuOpen) {
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        }

        return () => {
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = rootOverflow;
        };
    }, [menuOpen]);

    return (
        <>
        <PublicNav />
        <section className="hero">
            <div className="overlay"></div>
            <div className="hero-text">
                <h1>Writing Code gets easier, QuizWeb makes it stick.</h1>
                <p>Earn daily streaks, unlock new levels, and learn HTML, CSS, and JavaScript the fun way.</p>
                <div className="call-to-action row">
                    <h1>Start Learning</h1>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </div>
            
            {/* Light mode */}
            <div id="clouds-topleft" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopLeft /></div>
            <div id="clouds-topright" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopRight /></div>
            <div id="bus" className="designs" aria-hidden="true" data-hide-on-theme="dark"><Assets.Bus /></div>

            <Image src="/assets/landing-page/Clouds-left.svg" width={100} height={100} alt="" id="clouds-left" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"/>
            <Image src="/assets/landing-page/Clouds-right.svg" width={100} height={100} alt="" id="clouds-right" className="clouds designs" aria-hidden="true" data-hide-on-theme="dark"/>

            {/* dark mode */}
            <div id="clouds-topleft" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopLeftDark /></div>
            <div id="clouds-topright" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopRightDark /></div>
            <div id="bus" className="designs" aria-hidden="true" data-hide-on-theme="light"><Assets.BusDark /></div>

            <Image src="/assets/landing-page/Clouds-left-dark.svg" width={100} height={100} alt="" id="clouds-left" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"/>
            <Image src="/assets/landing-page/Clouds-right-dark.svg" width={100} height={100} alt="" id="clouds-right" className="clouds designs" aria-hidden="true" data-hide-on-theme="light"/>

            <div id="ground"></div>

        </section>
        
        <section className="section row">
            <div className="section-container row">
                <div className="section-content col ">
                    <h1>Learn By Doing</h1>
                    <p>Reading about code only gets you so far. QuizWeb puts you straight into the action with bite-sized, interactive quizzes that let you write and test real HTML, CSS, and JavaScript as you go. </p>
                </div>
                <div className="section-illustration row">
                    <Image src="/assets/landing-page/Laptop.svg" width={100} height={100} alt="" id="laptop"/>
                </div>
            </div>
        </section>

        <section className="section row">
            <div className="section-container row">
                <div className="section-illustration row pos-2">
                    <Image src="/assets/landing-page/Calendar.svg" width={100} height={100} alt="" id="calendar"/>
                </div>
                <div className="section-content col pos-1">
                    <h1>Track your progress</h1>
                    <p>Every quiz you finish adds to your daily streak, keeping you motivated to come back and level up. QuizWeb turns your learning into a game you actually want to keep playing.</p>
                </div>
            </div>
        </section>

        <section className="section row">
            <div className="section-container row">
                <div className="section-content col pos-1">
                    <h1>Built for beginners</h1>
                    <p>No experience, no jargon, no overwhelming setup — just start from zero and learn HTML, CSS, and JavaScript one small win at a time. All you need is curiosity and a few minutes a day.</p>
                </div>
                <div className="section-illustration row pos-2">
                    <Image src="/assets/landing-page/Books.svg" width={100} height={100} alt="" id="books"/>
                </div>
            </div>
        </section>
        </>
    )
}