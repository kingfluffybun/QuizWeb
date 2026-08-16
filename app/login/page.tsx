"use client";

import "#css/login.css";

export default function LoginPage() {
    return (
        <div className="auth-page">
            <main className="auth-card" id="auth">
                <div className="editor-bar" aria-hidden="true">
                    <span className="editor-dots"><span></span><span></span><span></span></span>
                    <div className="editor-tabs">
                        <span className="editor-tab active"><span className="tab-dot"></span>index.html</span>
                        <span className="editor-tab"><span className="tab-dot"></span>style.css</span>
                    </div>
                </div>

                <section className="info" aria-label="Authentication info">
                    <div className="brand">
                        <div className="brand-mark" aria-hidden="true"></div>
                        <span>QuizWeb</span>
                    </div>

                    <div className="panel">
                        <p className="tag" id="panelLabel"></p>
                        <h1 id="panelTitle">Welcome back</h1>
                        <p id="panelText">Pick up your HTML, CSS, and JS quizzes where you left off.</p>
                        <a id="toggleLink" className="panel-toggle" href="#signup" data-mode="signup"><span id="toggleText">New here? Create account</span></a>
                    </div>

                    <p className="code-mark" aria-hidden="true">&lt;/&gt;</p>
                    <div className="blob" aria-hidden="true"></div>

                    <div className="preview-stack" aria-hidden="true">
                        <div className="preview-slide quiz-preview active" data-slide="1">
                            <div className="qp-header" aria-hidden="true"></div>

                            <div className="qp-toprow">
                                <button className="qp-icon-btn" type="button" tabIndex={-1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                </button>
                                <button className="qp-icon-btn" type="button" tabIndex={-1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                                <div className="cp-hearts" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                </div>
                            </div>

                            <div className="qp-progress-wrap">
                                <div className="qp-progress">
                                    <span className="qp-seg active"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                </div>
                            </div>

                            <div className="qp-body">
                                <div className="qp-content">
                                    <p className="qp-question">Which HTML element is used to define the most important heading?</p>
                                </div>
                                <div className="qp-options">
                                    <div className="qp-option"><span className="qp-letter">A</span><code>&lt;h1&gt;</code></div>
                                    <div className="qp-option"><span className="qp-letter">B</span><code>&lt;heading&gt;</code></div>
                                    <div className="qp-option"><span className="qp-letter">C</span><code>&lt;h6&gt;</code></div>
                                    <div className="qp-option"><span className="qp-letter">D</span><code>&lt;head&gt;</code></div>
                                </div>
                                <div className="qp-footer">
                                    <button className="qp-skip" type="button" tabIndex={-1}>Skip</button>
                                    <button className="qp-submit" type="button" tabIndex={-1}>Submit</button>
                                </div>
                            </div>
                        </div>

                        <div className="preview-slide code-preview" data-slide="2">
                            <div className="cp-header" aria-hidden="true"></div>

                            <div className="cp-toprow">
                                <button className="cp-icon-btn" type="button" tabIndex={-1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                </button>
                                <button className="cp-icon-btn" type="button" tabIndex={-1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                                <div className="qp-progress cp-progress">
                                    <span className="qp-seg active"></span>
                                    <span className="qp-seg active"></span>
                                    <span className="qp-seg active"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                    <span className="qp-seg"></span>
                                </div>
                                <div className="cp-hearts" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.3-9.5-8.1C.6 10.2 1.2 6.6 4 5.1c2.2-1.2 4.8-.5 6.2 1.4L12 8.3l1.8-1.8c1.4-1.9 4-2.6 6.2-1.4 2.8 1.5 3.4 5.1 1.5 7.8C18.7 16.7 12 21 12 21z"/></svg>
                                </div>
                            </div>

                            <div className="cp-body">
                                <p className="cp-instructions-title">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                    Instructions
                                </p>

                                <div className="cp-tabsbar">
                                    <div className="cp-tabs">
                                        <span className="cp-tab active">index.html</span>
                                        <span className="cp-tab">style.css</span>
                                        <span className="cp-tab">script.js</span>
                                    </div>
                                </div>

                                <div className="cp-addressbar">
                                    <button className="cp-addr-btn" type="button" tabIndex={-1}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    </button>
                                    <button className="cp-addr-btn" type="button" tabIndex={-1}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </button>
                                    <button className="cp-addr-btn" type="button" tabIndex={-1}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    </button>
                                </div>

                                <div className="cp-instructions">
                                    <ul className="cp-checklist">
                                        <li className="cp-done">
                                            <span className="cp-check"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                                            Set the page background color to purple (#B697F3).
                                        </li>
                                        <li><span className="cp-check"></span>Center all content on the page both horizontally and vertically using Flexbox.</li>
                                        <li><span className="cp-check"></span>Add a script that logs a message to the console when the page loads.</li>
                                        <li><span className="cp-check"></span>Display a heading that says &quot;hello world&quot; on the page.</li>
                                    </ul>
                                </div>

                                <div className="cp-editor">
                                    <pre className="cp-code">
                                        <span className="cp-line"><span className="cp-ln">1</span><span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">html</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">2</span>  <span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">head</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">3</span>    <span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">style</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">4</span>      body {"{"}</span>
                                        <span className="cp-line"><span className="cp-ln">5</span>        background-color: #B697F3;</span>
                                        <span className="cp-line"><span className="cp-ln">6</span>        display: flex;</span>
                                        <span className="cp-line"><span className="cp-ln">7</span>        justify-content: center;</span>
                                        <span className="cp-line"><span className="cp-ln">8</span>        align-items: center;</span>
                                        <span className="cp-line"><span className="cp-ln">9</span>        height: 100vh;</span>
                                        <span className="cp-line"><span className="cp-ln">10</span>      {"}"}</span>
                                        <span className="cp-line"><span className="cp-ln">11</span>    <span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">style</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">12</span>    <span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">script</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">13</span>      console.log(&quot;output message&quot;);</span>
                                        <span className="cp-line"><span className="cp-ln">14</span>    <span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">script</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">15</span>  <span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">head</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">16</span>  <span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">body</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">17</span>    <span className="cp-tok-punc">&lt;</span><span className="cp-tok-tag">h1</span><span className="cp-tok-punc">&gt;</span>hello world<span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">h1</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">18</span>  <span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">body</span><span className="cp-tok-punc">&gt;</span></span>
                                        <span className="cp-line"><span className="cp-ln">19</span><span className="cp-tok-punc">&lt;/</span><span className="cp-tok-tag">html</span><span className="cp-tok-punc">&gt;</span></span>
                                    </pre>
                                </div>

                                <div className="cp-preview">
                                    <div className="cp-preview-box">
                                        <span className="cp-preview-text">hello world</span>
                                    </div>
                                    <div className="cp-console">
                                        Console
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="cp-footer">
                                <button className="cp-run" type="button" tabIndex={-1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    Run Code
                                </button>
                                <button className="cp-submit" type="button" tabIndex={-1}>
                                    Submit
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="formPanel" aria-label="Authentication form">
                    <div className="formCard">
                        <header className="formHead">
                            <p className="eyebrow" id="formLabel">Access your account</p>
                            <h2 id="formTitle">Sign in</h2>
                            <p className="helper" id="formText">Use your email and password to continue.</p>
                        </header>

                        <div className="stack">
                            <form id="signIn" className="formView active" noValidate>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                    </span>
                                    <input type="email" placeholder="Email address" autoComplete="email" />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input type="password" placeholder="Password" autoComplete="current-password" />
                                    <button type="button" className="toggle-pw" aria-label="Show password">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                                    </button>
                                </label>

                                <div className="formActions">
                                    <label className="remember-row" htmlFor="remember-me">
                                        <input id="remember-me" type="checkbox" className="remember-me" />
                                        <span>Remember Me</span>
                                    </label>
                                    <a className="forgot-link" href="#forgot-password">Forgot Password?</a>
                                </div>

                                <button type="button" className="submit-btn">Sign in</button>

                                <div className="divider-row" aria-hidden="true">
                                    <span className="divider-line"></span>
                                    <span className="divider-text">OR</span>
                                    <span className="divider-line"></span>
                                </div>

                                <button type="button" className="social-btn">
                                    <span className="social-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path d="M 15.003906 3 C 8.3749062 3 3 8.373 3 15 C 3 21.627 8.3749062 27 15.003906 27 C 25.013906 27 27.269078 17.707 26.330078 13 L 25 13 L 22.732422 13 L 15 13 L 15 17 L 22.738281 17 C 21.848702 20.448251 18.725955 23 15 23 C 10.582 23 7 19.418 7 15 C 7 10.582 10.582 7 15 7 C 17.009 7 18.839141 7.74575 20.244141 8.96875 L 23.085938 6.1289062 C 20.951937 4.1849063 18.116906 3 15.003906 3 z"/></svg>
                                    </span>
                                    <span>Continue with Google</span>
                                </button>
                            </form>

                            <form id="signUp" className="formView" noValidate>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </span>
                                    <input type="text" placeholder="Username" autoComplete="name" />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                    </span>
                                    <input type="email" placeholder="Email address" autoComplete="email" />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input type="password" placeholder="Create password" autoComplete="new-password" />
                                    <button type="button" className="toggle-pw" aria-label="Show password">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                                    </button>
                                </label>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input type="password" placeholder="Confirm password" autoComplete="new-password" />
                                    <button type="button" className="toggle-pw" aria-label="Show password">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                                    </button>
                                </label>

                                <button type="button" className="submit-btn">Create account</button>
                            </form>
                        </div>
                    </div>
                </section>
            </main>

            <div id="forgot" className="modal" role="dialog" aria-modal="true" aria-label="Forgot password">
                <div className="modalBox">
                    <button type="button" className="modalClose" aria-label="Close forgot password">×</button>

                    <div className="modalHead">
                        <p className="eyebrow" id="stepLabel">Step 1</p>
                        <h3 id="stepTitle">Enter your email</h3>
                        <p className="modalCopy" id="stepText">Use the registered email address for your account.</p>
                    </div>

                    <div className="step active" id="step1">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                            </span>
                            <input type="email" placeholder="Registered email address" autoComplete="email" />
                        </label>
                        <button type="button" className="submit-btn" data-next-step="2">Send OTP</button>
                    </div>

                    <div className="step" id="step2">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input type="text" placeholder="Enter 6-digit OTP" maxLength={6} />
                        </label>
                        <button type="button" className="submit-btn" data-next-step="3">Verify OTP</button>
                    </div>

                    <div className="step" id="step3">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input type="password" placeholder="New password" autoComplete="new-password" />
                            <button type="button" className="toggle-pw" aria-label="Show password">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                            </button>
                        </label>
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input type="password" placeholder="Confirm password" autoComplete="new-password" />
                            <button type="button" className="toggle-pw" aria-label="Show password">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                            </button>
                        </label>
                        <button type="button" className="submit-btn" data-finish="true">Reset Password</button>
                    </div>

                    <div className="step" id="step4">
                        <p className="doneMsg">Password reset complete. You can now return to Sign In.</p>
                        <button type="button" className="submit-btn" data-mode="signin">Return to Sign In</button>
                    </div>

                    <a className="link" href="#signin" data-mode="signin">Back to sign in</a>
                </div>
            </div>
        </div>
    );
}