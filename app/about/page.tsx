"use client";

import "#css/about.css";
import "#css/nav.css";
import Image from "next/image";

export default function About() {
    return (
        <section className="about">
            <nav style={{ backgroundColor: "var(--background-color)" }}>
                <div><a href="/"><p>Logo</p></a></div>
                <div><a href="/quiz/index.html"><p>Learn</p></a></div>
                <div><a href="test.com"><p>Leaderboard</p></a></div>
                <div><a href="/"><p>Home</p></a></div>
                <div><a href="/login"><p>Log in</p></a></div>
                <div><a href="/login"><p>Sign Up</p></a></div>
            </nav>
            
            <header className="about-hero">
                <h1>About Us</h1>
                <p>Serving you fresh quizzlets since {new Date().getFullYear()}!</p>
                <small>From the team at QuizWeb, with Love.</small>
            </header>
            
            <div className="about-team">
                {[
                    { name: "Clarence Luna", role: "Team Leader" },
                    { name: "Jazmin Latoja", role: "Developer" },
                    { name: "Kevenly Luistro", role: "Developer" },
                    { name: "Cyril Maligaya", role: "Developer" },
                    { name: "Christian Panti", role: "Developer" },
                    { name: "Jhonrick Parica", role: "Developer" },
                    { name: "Rommel Patriarca", role: "Developer" },
                    { name: "Carl Adrian Tan", role: "Developer" },
                    { name: "Jomari Wamil", role: "Developer" },
                    { name: "Gwyneth Villanueva", role: "Developer" },
                ].map((member) => (
                    <article key={member.name} className="team-member">
                        <div className="avatar-placeholder"></div>
                        <small>{member.name}</small>
                        <p>{member.role}</p>
                    </article>
                ))}
            </div>
            
            <div className="about-tech">
                <h1>This website was built using</h1>
                <div className="tech-grid">
                    {[
                        { 
                            name: "Next.js", 
                            url: "https://nextjs.org/",
                            icon: <svg viewBox="0 0 128 128" width="32" height="32" fill="var(--white-text-color)"><path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64c11.2 0 21.7-2.9 30.8-7.9L48.4 55.3v36.6h-6.8V41.8h9.6l50.5 73.9c15.1-13.3 24.5-31.5 24.5-51.7 0-35.3-28.7-64-64-64zm22.7 87.2l-5.6-8.3V41.8h6.8v42.9l-1.2 2.5z"/></svg>
                        },
                        { 
                            name: "React", 
                            url: "https://react.dev/",
                            icon: <svg viewBox="-11.5 -10.23 23 20.46" width="32" height="32" fill="none" stroke="#61DAFB" strokeWidth="1"><circle cx="0" cy="0" r="2.05" fill="#61DAFB" stroke="none" /><ellipse rx="11" ry="4.2" /><ellipse rx="11" ry="4.2" transform="rotate(60)" /><ellipse rx="11" ry="4.2" transform="rotate(120)" /></svg>
                        },
                        { 
                            name: "Vercel", 
                            url: "https://vercel.com/",
                            icon: <svg viewBox="0 0 1155 1000" width="32" height="32" fill="var(--white-text-color)"><path d="M577.3 0L1154.7 1000H0L577.3 0Z" /></svg>
                        },
                        { 
                            name: "Azure", 
                            url: "https://azure.microsoft.com/en-us/products/mysql/",
                            icon: <svg viewBox="0 0 24 24" width="32" height="32" fill="#0089D6"><path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7l-6.33 17.012h5.732l2.568-7.98L13.23 2.7zM0.034 21.3h5.05L10.97 5.753l-2.072-5.74L0.034 21.3z"/></svg>
                        },
                        { 
                            name: "Name.com",
                            url: "https://www.name.com/",
                            icon: <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                        },
                        { 
                            name: "GitHub Student", 
                            url: "https://education.github.com/pack",
                            icon: <svg viewBox="0 0 24 24" width="32" height="32" fill="var(--white-text-color)"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                        },
                    ].map((tech) => (
                        <a 
                            key={tech.name} 
                            href={tech.url}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="tech-item"
                        >
                            <div className="tech-icon-placeholder">{tech.icon}</div>
                            <small>{tech.name}</small>
                        </a>
                    ))}
                </div>
            </div>
            
            <footer className="about-footer">
                <p>System Analysis and Design</p>
                <small>Created with <b>Love</b> by students of <strong>Universidad de Manila</strong></small>
                <small>&copy; {new Date().getFullYear()} QuizWeb. All rights reserved.</small>
            </footer>
        </section>
    )
}