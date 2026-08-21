import { useEffect, useState } from "react";

export default function LoginQuiz() {
    const [activeSlide, setActiveSlide] = useState(0);

    // Quiz Carousel
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % 2);
        }, 4500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="preview-stack" aria-hidden="true">
            <div className={`preview-slide quiz-preview ${activeSlide === 0 ? 'active' : ''}`} data-slide="1">
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

            <div className={`preview-slide code-preview ${activeSlide === 1 ? 'active' : ''}`} data-slide="2">
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
    )
}