"use client";

import { useEffect, useRef, ReactNode } from "react";
import "#css/about.css";
import "#css/nav.css";
import Image from "next/image";
import PublicNav from "@/app/components/publicNav";

interface TeamMember {
    name: string;
    role: string;
}

interface TechItem {
    name: string;
    url: string;
    icon: ReactNode;
}

export default function About() {
    const revealRefs = useRef<HTMLElement[]>([]);

    const addToRefs = (el: HTMLElement | null) => {
        if (el && !revealRefs.current.includes(el)) {
            revealRefs.current.push(el);
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries, observerInstance) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observerInstance.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 } 
        );

        revealRefs.current.forEach((ref) => observer.observe(ref));

        return () => observer.disconnect();
    }, []);

    const teamLeader: TeamMember = {name:"Clarence Luna", role:"Team Leader"};

    const teamMembers: TeamMember[] = [
        { name: "Harvy Bautista", role: "Developer" },
        { name: "Jazmin Latoja", role: "Developer" },
        { name: "Kevenly Luistro", role: "Developer" },
        { name: "Cyril Maligaya", role: "Developer" },
        { name: "Christian Panti", role: "Developer" },
        { name: "Jhonrick Parica", role: "Developer" },
        { name: "Rommel Patriarca", role: "Developer" },
        { name: "Carl Adrian Tan", role: "Developer" },
        { name: "Jomari Wamil", role: "Developer" },
        { name: "Gwyneth Villanueva", role: "Developer" },
    ];

    const techStack: TechItem[] = [
        { name: "Next.js", url: "https://nextjs.org/", icon: <svg width="48" height="48" fill="var(--text-inverse)" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Next.js</title><path d="M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z"/></svg>},
        { name: "React", url: "https://react.dev/", icon: <svg role="img" fill="var(--text-inverse)" height="48" width="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>React</title><path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/></svg> },
        { name: "Vercel", url: "https://vercel.com/", icon: <svg role="img" width="48" height="48" fill="var(--text-inverse)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Vercel</title><path d="m12 1.608 12 20.784H0Z"/></svg>},
        { name: "AzureDB", url: "https://azure.microsoft.com/en-us/products/mysql/", icon:
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 96 96">
                <defs>
                    <linearGradient id="e399c19f-b68f-429d-b176-18c2117ff73c" x1="-1032.172" x2="-1059.213" y1="145.312" y2="65.426" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#bababa"/>
                        <stop offset="1" stopColor="#e6e6e6"/>
                    </linearGradient>
                    <linearGradient id="ac2a6fc2-ca48-4327-9a3c-d4dcc3256e15" x1="-1023.725" x2="-1029.98" y1="108.083" y2="105.968" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopOpacity=".3"/>
                        <stop offset=".071" stopOpacity=".2"/>
                        <stop offset=".321" stopOpacity=".1"/>
                        <stop offset=".623" stopOpacity=".05"/>
                        <stop offset="1" stopOpacity="0"/>
                    </linearGradient>
                    <linearGradient id="a7fee970-a784-4bb1-af8d-63d18e5f7db9" x1="-1027.165" x2="-997.482" y1="147.642" y2="68.561" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="var(--text-inverse)"/>
                        <stop offset="1" stopColor="#eeeeee"/>
                    </linearGradient>
                </defs>
                <path fill="url(#e399c19f-b68f-429d-b176-18c2117ff73c)" d="M33.338 6.544h26.038l-27.03 80.087a4.152 4.152 0 0 1-3.933 2.824H8.149a4.145 4.145 0 0 1-3.928-5.47L29.404 9.368a4.152 4.152 0 0 1 3.934-2.825z"/>
                <path fill="#ededed" d="M71.175 60.261h-41.29a1.911 1.911 0 0 0-1.305 3.309l26.532 24.764a4.171 4.171 0 0 0 2.846 1.121h23.38z"/>
                <path fill="url(#ac2a6fc2-ca48-4327-9a3c-d4dcc3256e15)" d="M33.338 6.544a4.118 4.118 0 0 0-3.943 2.879L4.252 83.917a4.14 4.14 0 0 0 3.908 5.538h20.787a4.443 4.443 0 0 0 3.41-2.9l5.014-14.777 17.91 16.705a4.237 4.237 0 0 0 2.666.972H81.24L71.024 60.261l-29.781.007L59.47 6.544z"/>
                <path fill="url(#a7fee970-a784-4bb1-af8d-63d18e5f7db9)" d="M66.595 9.364a4.145 4.145 0 0 0-3.928-2.82H33.648a4.146 4.146 0 0 1 3.928 2.82l25.184 74.62a4.146 4.146 0 0 1-3.928 5.472h29.02a4.146 4.146 0 0 0 3.927-5.472z"/>
            </svg>
        },
        { name: "Name.com", url: "https://www.name.com/", icon: <Image src="/assets/about/name-com.png" className="designs" width={64} height={64} alt="" /> },
        { name: "GitHub Student", url: "https://education.github.com/pack", icon: <svg height="48" width="48" fill="var(--text-inverse)" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>},
    ];

    return (
        <>
        <PublicNav />
        <section className="about">
            
            <Image src="/assets/landing-page/Clouds-topleft.svg" width={100} height={100} alt="" id="clouds-topleft" className="designs" priority aria-hidden="true" />
            <Image src="/assets/landing-page/Clouds-topright.svg" width={100} height={100} alt="" id="clouds-topright" className="designs" priority aria-hidden="true" />

            
            <Image src="/assets/landing-page/Clouds-topright.svg" width={100} height={100} alt="" id="clouds-middleright" className="designs" priority aria-hidden="true" />
            <Image src="/assets/landing-page/Clouds-topleft.svg" width={100} height={100} alt="" id="clouds-middleleft" className="designs" priority aria-hidden="true" />
            
            <div className="spacer"></div>

            <Image src="/assets/about/Hotair-baloon.svg" width={200} height={200} alt="" id="hotair-baloon" className="designs" priority aria-hidden="true" />

            <header className="about-hero scroll-section" ref={addToRefs}>
                <h1>About Us</h1>
                <p>Serving you fresh quizzlets since 2026!</p>
                <small>From the team at QuizWeb, with Love.</small>
            </header>

            <div className="spacer"></div>
            <div className="spacer"></div>

            <div className="about-description scroll-section" ref={addToRefs}>
                <div className="column">
                    <h1>Our Mission</h1>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                </div>
                <div className="column">
                    <h1>Our Vision</h1>
                    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                </div>
            </div>

            <div className="spacer"></div>

            <Image src="/assets/about/Plane-banner.svg" width={600} height={100} alt="" id="plane-banner" className="designs" priority aria-hidden="true" />

            <div className="about-values">
                <h1>Our Core Values</h1>
                <div className="values-grid">
                    <article className="value-card">
                        <p>Ethics and Integrity</p>
                    </article>
                    <article className="value-card">
                        <p>Quality and Excellence</p>
                    </article>
                    <article className="value-card">
                        <p>Unity and Collaboration</p>
                    </article>
                    <article className="value-card">
                        <p>Achievement and Passion</p>
                    </article>
                    <article className="value-card">
                        <p>Leadership and Innovation</p>
                    </article>
                </div>
            </div>

            <div className="spacer"></div>

            <div className="about-team scroll-section" ref={addToRefs}>
                <h1>Meet the Team</h1>
                <article className="team-member team-leader-card">
                    <div className="avatar-placeholder"></div>
                    <small>{teamLeader.name}</small>
                    <p>{teamLeader.role}</p>
                </article>

                <div className="team-grid">
                    {teamMembers.map((member) => (
                        <article key={member.name} className="team-member">
                            <div className="avatar-placeholder"></div>
                            <small>{member.name}</small>
                            <p>{member.role}</p>
                        </article>
                    ))}
                </div>
            </div>

            <div className="spacer"></div>
            
            <div className="about-tech scroll-section" ref={addToRefs}>
                <h1>This website was built using</h1>
                <div className="tech-grid">
                    {techStack.map((tech) => (
                        <a key={tech.name} href={tech.url} target="_blank" rel="noopener noreferrer" className="tech-item">
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
            
            <Image src="/assets/about/Sun-cloud.svg" width={200} height={200} alt="" id="sun-cloud" className="designs" priority aria-hidden="true" />
            <Image src="/assets/landing-page/Clouds-left.svg" width={100} height={100} alt="" id="clouds-left" className="designs" aria-hidden="true" />
            <Image src="/assets/landing-page/Clouds-right.svg" width={100} height={100} alt="" id="clouds-right" className="designs" aria-hidden="true" />
        </section>
        </>
    );
}