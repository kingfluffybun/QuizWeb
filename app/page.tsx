"use client";

import Image from "next/image";
import "#css/landing-page.css";
import "#css/nav.css";

export default function Home() {
    return (
        <main>
            <section className="hero">
                <nav>
                    <div><a href="test.com"><p>Logo</p></a></div>
                    <div><a href="/quiz/index.html"><p>Learn</p></a></div>
                    <div><a href="test.com"><p>Leaderboard</p></a></div>
                    <div><a href="/about"><p>About</p></a></div>
                    <div><a href="/login"><p>Log in</p></a></div>
                    <div><a href="/login"><p>Sign Up</p></a></div>
                </nav>
                <div className="hero-text">
                    <h1>Code gets easier, QuizWeb makes it stick.</h1>
                    <p>Earn daily streaks, unlock new levels, and learn HTML, CSS, and JavaScript the fun way.</p>
                    {/* <div>
                        <h1>Start Learning</h1>
                        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                    </div> */}
                </div>
                <Image src="/assets/landing-page/Clouds-topleft.svg" width={100} height={100} alt="" id="clouds-topleft" className="clouds" />
                <Image src="/assets/landing-page/Clouds-topright.svg" width={100} height={100} alt="" id="clouds-topright" className="clouds" />
                <Image src="/assets/landing-page/Bus.svg" width={100} height={100} alt="" id="bus" />
                <Image src="/assets/landing-page/Clouds-left.svg" width={100} height={100} alt="" id="clouds-left" className="clouds" />
                <Image src="/assets/landing-page/Clouds-right.svg" width={100} height={100} alt="" id="clouds-right" className="clouds" />
                <div id="ground"></div>
            </section>
            {/* <section style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}> */}
            <section className="hero2">
                <div className="heroDescription">
                    <div>
                        {/* <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-xml-icon lucide-code-xml"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg> */}
                        <h1>Learn by doing</h1>
                        <p>Practice HTML, CSS, and JavaScript through bite-sized, interactive quizzes.</p>
                    </div>
                    <div>
                        {/* <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame-icon lucide-flame"><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/></svg> */}
                        <h1>Track your progress</h1>
                        <p>Earn streaks, unlock levels, and watch your coding skills grow every day.</p>
                    </div>
                    <div>
                        {/* <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sprout-icon lucide-sprout"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/></svg> */}
                        <h1>Built for beginners</h1>
                        <p>No experience needed — just curiosity and a few minutes a day.</p>
                    </div>
                </div>
            </section>
        </main>
    )
}
