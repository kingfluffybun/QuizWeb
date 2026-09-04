"use client";

import { useEffect, useRef } from "react";
import { animate, spring, createTimeline } from "animejs";

export function BusDark() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const bodyParts = svg.querySelectorAll("path, rect, circle");
        const windows = svg.querySelectorAll("[fill='#FEFFC6']");
        const lights = svg.querySelectorAll("#bus-headlight, #bus-headlight-cone");
        const road = svg.querySelector("#bus-shadow");
        const awning = svg.querySelectorAll("[id^=bus-awning-]");
        const wheels = svg.querySelectorAll(".wheel");

        const anims: (() => void)[] = [];

        // Body
        if (bodyParts) {
            const runBody = () => {
                animate(bodyParts, {
                    translateY: [
                        { to: -3, duration: 400, ease: "inOutSine" },
                        { to: 0, duration: 400, ease: "inOutSine" },
                        { to: -2, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runBody();
        }

        // Road shadow
        if (road) {
            const runRoad = () => {
                animate(road, {
                    opacity: [
                        { to: 0.6, duration: 400, ease: "inOutSine" },
                        { to: 1, duration: 400, ease: "inOutSine" },
                        { to: 0.8, duration: 300, ease: "inOutSine" },
                        { to: 1, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runRoad();
        }

        // Wheels
        if (wheels) {
            const runWheels = () => {
                animate(wheels, {
                    rotate: '360deg',
                    ease: "linear",
                    duration: 1500,
                    loop: true,
                });
            };
            runWheels();
        }

        // Awning vibration
        if (awning) {
            const runAwning = () => {
                animate(awning, {
                    translateX: [
                        { to: -2, duration: 400, ease: "inOutSine" },
                        { to: 0, duration: 400, ease: "inOutSine" },
                        { to: -1, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runAwning();
        }

        // Books
        for (let i = 1; i <= 10; i++) {
            const book = svg.querySelectorAll(`#book-${i}`);
            if (!book.length) continue;

            const delay = i * 25;
            const intensity  = 0.8 + (i % 3) * 0.8;

            const runBook = () => {
                animate(book, {
                    translateY: [
                        { to: -1 * intensity, duration: 400, ease: "inOutSine" },
                        { to: 0 * intensity, duration: 400, ease: "inOutSine" },
                        { to: -0.5 * intensity, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    transformOrigin: "50% 100%",
                    delay,
                    loop: true,
                });
            };
            runBook();
        }

        // Windows flicker
        if (windows) {
            const runWindows = () => {
                animate(windows, {
                    opacity: [
                        { to: 0.8, duration: 400 },
                        { to: 1, duration: 400 },
                        { to: 0.9, duration: 300 },
                        { to: 1, duration: 300 },
                    ],
                    ease: "inOutQuad",
                    loop: true,
                });
            };
            runWindows();
        };

        // Headlights pulse
        if (lights) {
            const runLights = () => {
                animate(lights, {
                    opacity: [
                        { to: 0.9, duration: 400 },
                        { to: 1, duration: 400 },
                        { to: 0.95, duration: 300 },
                        { to: 1, duration: 300 },
                    ],
                    ease: "inOutQuad",
                    loop: true,
                });
            };
            runLights();
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 704 443" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            {/* <defs>
                <filter id="glow" x="-100%" y="-100%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation="8" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs> */}

            <defs>
                <filter id="glow" x="-100%" y="-100%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation="7" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="cone-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F3C068" stopOpacity="0.8"/>
                    <stop offset="50%" stopColor="#F3C068" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#F3C068" stopOpacity="0"/>
                </linearGradient>
            </defs>

            <ellipse id="bus-shadow" cx="355.398" cy="420.112" rx="347.994" ry="22.8294" fill="#4A3367"/>
            <path id="bus-body" d="M14 96H606.395L648.05 221.588C648.598 223.24 649.67 224.668 651.103 225.656L692.638 254.281C694.805 255.774 696.098 258.237 696.098 260.868V365.513C696.098 369.932 692.517 373.513 688.098 373.513H600.339H22C17.5817 373.513 14 369.932 14 365.513V96Z" fill="#7440A4"/>
            <rect id="bus-side" x="64.2661" y="157.672" width="314.028" height="90.557" fill="#FEFFC6"/>
            <path id="bus-signal" d="M645.948 283.284H632.803C629.778 283.284 627.326 280.831 627.326 277.806C627.326 274.781 629.778 272.329 632.803 272.329H645.948C648.973 272.329 651.426 274.781 651.426 277.806C651.426 280.831 648.973 283.284 645.948 283.284Z" fill="#EC8E48" stroke="#EC8E48" strokeWidth="2" filter="url(#glow)"/>
            <path id="bus-wheel-well-back" d="M188.417 373.84H54.042C54.042 333.507 84.1228 300.811 121.229 300.811C158.336 300.811 188.417 333.507 188.417 373.84Z" fill="#4A3367"/>
            <path id="bus-wheel-well-front" d="M645.583 373.84H511.208C511.208 333.507 541.289 300.811 578.396 300.811C615.502 300.811 645.583 333.507 645.583 373.84Z" fill="#4A3367"/>
            <path id="bus-wheel-well-front-inside" d="M632.438 373.841H524.354C524.354 341.574 548.549 315.417 578.396 315.417C608.242 315.417 632.438 341.574 632.438 373.841Z" fill="#42156C"/>
            <path id="bus-wheel-well-back-inside" d="M175.272 373.841H67.1875C67.1875 341.574 91.383 315.417 121.23 315.417C151.076 315.417 175.272 341.574 175.272 373.841Z" fill="#42156C"/>
            <circle id="bus-wheel-front" cx="578.396" cy="367.998" r="46.7391" fill="#141413"/>
            <circle id="bus-wheel-back" cx="121.229" cy="367.998" r="46.7391" fill="#141413"/>
            <path id="bus-wheel-back-shine" className="wheel" d="M92.9123 404.32C90.2655 402.278 88.942 401.257 88.6309 399.834C88.5813 399.608 88.5516 399.377 88.542 399.146C88.4816 397.69 89.5024 396.367 91.544 393.72L138.342 333.048C140.384 330.401 141.405 329.078 142.828 328.767C143.054 328.717 143.285 328.687 143.516 328.678C144.972 328.617 146.295 329.638 148.942 331.68C151.589 333.721 152.912 334.742 153.224 336.165C153.273 336.392 153.303 336.622 153.313 336.854C153.373 338.309 152.352 339.633 150.311 342.28L103.512 402.952C101.471 405.598 100.45 406.922 99.0267 407.233C98.8001 407.283 98.5697 407.312 98.338 407.322C96.8826 407.382 95.5592 406.361 92.9123 404.32Z" fill="white" fillOpacity="0.1"/>
            <path id="bus-wheel-front-shine" className="wheel" d="M534.441 353.559C535.489 350.385 536.012 348.798 537.252 348.032C537.449 347.91 537.656 347.806 537.872 347.72C539.225 347.18 540.812 347.704 543.986 348.751L616.749 372.766C619.924 373.814 621.511 374.338 622.276 375.577C622.398 375.774 622.503 375.981 622.589 376.197C623.129 377.55 622.605 379.137 621.557 382.311C620.51 385.486 619.986 387.073 618.747 387.839C618.549 387.96 618.342 388.065 618.127 388.151C616.774 388.691 615.186 388.167 612.012 387.119L539.249 363.105C536.075 362.057 534.488 361.533 533.722 360.294C533.6 360.097 533.495 359.889 533.409 359.674C532.87 358.321 533.393 356.734 534.441 353.559Z" fill="white" fillOpacity="0.1"/>
            <circle id="bus-wheel-back-rim" cx="121.23" cy="367.998" r="23.3695" fill="#CBB3DD"/>
            <circle id="bus-wheel-front-rim" cx="578.396" cy="367.998" r="23.3695" fill="#CBB3DD"/>
            <rect id="bus-bumper-back" y="338.786" width="54.0421" height="37.9755" rx="4" fill="#D9D9D9"/>
            <rect id="bus-bumper-front" x="645.584" y="338.786" width="54.0421" height="37.9755" rx="4" fill="#D9D9D9"/>
            <rect id="bus-brake-light" x="7.30273" y="292.047" width="17.5272" height="37.9755" rx="8" fill="#EE4B49" filter="url(#glow)"/>
            <rect id="bus-roof" x="7.30322" y="72.8076" width="618.245" height="23.4464" rx="8" fill="#7440A4"/>
            <path id="bus-door" d="M542.612 288.575V119.663C542.612 115.245 539.03 111.663 534.612 111.663H436.685C432.267 111.663 428.685 115.245 428.685 119.663V346.852C428.685 351.271 432.267 354.852 436.685 354.852H490.464C494.085 354.852 497.218 352.405 498.424 348.991C507.103 324.424 527.209 304.495 539.228 295.251C541.313 293.647 542.612 291.206 542.612 288.575Z" stroke="#9750DD" strokeWidth="4"/>
            <path id="bus-door-window" d="M522.545 126.999H447.291C445.082 126.999 443.291 128.79 443.291 130.999V219.398C443.291 221.608 445.082 223.398 447.291 223.398H522.545C524.754 223.398 526.545 221.608 526.545 219.398V130.999C526.545 128.79 524.754 126.999 522.545 126.999Z" fill="#FEFFC6"/>
            <path id="bus-door-handle" d="M467.756 240.927H448.038C445.416 240.927 443.291 243.052 443.291 245.674C443.291 248.295 445.416 250.421 448.038 250.421H467.756C470.378 250.421 472.503 248.295 472.503 245.674C472.503 243.052 470.378 240.927 467.756 240.927Z" fill="#9750DD"/>
            <path id="bus-windshield" d="M557.948 219.399V132.46C557.948 130.251 559.739 128.46 561.948 128.46H602.385C604.108 128.46 605.638 129.563 606.181 131.199L633.323 212.876C635.044 218.055 631.189 223.399 625.731 223.399H597.384H561.948C559.739 223.399 557.948 221.608 557.948 219.399Z" fill="#FEFFC6"/>
            <path id="bus-headlight-cone" d="M680 305 L 950 150 L 950 480 Z" fill="url(#cone-gradient)" style={{ pointerEvents: "none" }} />
            <path id="bus-headlight" d="M674.796 315.417V288.396C674.796 284.362 678.066 281.093 682.099 281.093C686.132 281.093 689.402 284.362 689.402 288.396V315.417C689.402 319.45 686.132 322.72 682.099 322.72C678.066 322.72 674.796 319.45 674.796 315.417Z" fill="#F3C068" stroke="#F3C068" strokeWidth="2" filter="url(#glow)"/>
            <path id="bus-awning-1" d="M36.7715 144.202L66.0024 112.932C66.7588 112.122 67.8168 111.663 68.9245 111.663H111.006L90.4435 144.279C90.0409 144.918 89.8272 145.657 89.8272 146.412V155.175C89.8272 155.379 89.8137 155.578 89.7777 155.778C88.628 162.184 81.3237 174.004 60.6154 172.278C40.7387 170.621 35.8199 155.355 35.7503 146.696C35.7428 145.763 36.1342 144.884 36.7715 144.202Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-2" d="M91.1075 144.319L109.116 113.638C109.834 112.415 111.147 111.663 112.565 111.663H156.284L142.01 144.494C141.791 144.997 141.678 145.54 141.678 146.089V156.514C141.678 157.271 141.472 158.016 141.027 158.627C137.501 163.458 128.299 171.548 114.59 171.548C100.655 171.548 93.2154 163.188 90.8799 158.389C90.6514 157.919 90.5571 157.403 90.5571 156.881V146.344C90.5571 145.632 90.7471 144.933 91.1075 144.319Z" fill="#592481" stroke="#592481" strokeWidth="2"/>
            <path id="bus-awning-3" d="M142.045 143.7L155.228 114.039C155.87 112.594 157.302 111.663 158.883 111.663H198.641L196.45 127.364L194.259 143.066V154.751C194.016 160.593 188.417 172.278 167.968 172.278C148.166 172.278 142.289 154.927 141.717 145.429C141.681 144.835 141.803 144.244 142.045 143.7Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-4" d="M240.462 111.663H202.098C200.113 111.663 198.428 113.119 198.14 115.084L194.301 141.317C194.273 141.509 194.259 141.71 194.26 141.904C194.436 169.657 219.089 170.817 219.089 170.817C219.089 170.817 248.123 174.446 248.301 141.906C248.302 141.712 248.287 141.509 248.259 141.317L244.42 115.084C244.133 113.119 242.448 111.663 240.462 111.663Z" fill="#592481" stroke="#592481" strokeWidth="2"/>
            <path id="bus-awning-5" d="M300.516 143.7L287.333 114.039C286.691 112.594 285.258 111.663 283.677 111.663H243.92L246.11 127.364L248.301 143.066V154.751C248.545 160.593 254.144 172.278 274.592 172.278C294.395 172.278 300.271 154.927 300.843 145.429C300.879 144.835 300.757 144.244 300.516 143.7Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-6" d="M351.454 144.319L333.445 113.638C332.727 112.415 331.414 111.663 329.996 111.663H286.277L300.551 144.494C300.77 144.997 300.883 145.54 300.883 146.089V156.514C300.883 157.271 301.089 158.016 301.534 158.627C305.06 163.458 314.262 171.548 327.971 171.548C341.906 171.548 349.346 163.188 351.681 158.389C351.91 157.919 352.004 157.403 352.004 156.881V146.344C352.004 145.632 351.814 144.933 351.454 144.319Z" fill="#592481" stroke="#592481" strokeWidth="2"/>
            <path id="bus-awning-7" d="M405.79 144.202L376.559 112.932C375.803 112.122 374.745 111.663 373.637 111.663H331.556L352.118 144.279C352.521 144.918 352.734 145.657 352.734 146.412V155.175C352.734 155.379 352.748 155.578 352.784 155.778C353.934 162.184 361.238 174.004 381.946 172.278C401.823 170.621 406.742 155.355 406.811 146.696C406.819 145.763 406.427 144.884 405.79 144.202Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="book-1" d="M92.0174 189.806H74.4902V199.543V248.23H92.0174V189.806Z" fill="#9870D9"/>
            <path id="book-1" d="M92.0174 200.03H74.4902V205.873H92.0174V200.03Z" fill="#EBE3F9"/>
            <path id="book-1" d="M92.0174 235.085H74.4902V240.927H92.0174V235.085Z" fill="#EBE3F9"/>
            <path id="book-2" d="M108.084 189.806H92.0171V199.543V248.229H108.084V189.806Z" fill="#E88C3F"/>
            <path id="book-2" d="M108.084 200.03H92.0171V205.873H108.084V200.03Z" fill="#EBE3F9"/>
            <path id="book-2" d="M108.084 235.085H92.0171V240.927H108.084V235.085Z" fill="#EBE3F9"/>
            <path id="book-3" d="M124.151 189.806H108.084V199.543V248.23H124.151V189.806Z" fill="#479CF5"/>
            <path id="book-3" d="M124.151 235.085H108.084V240.927H124.151V235.085Z" fill="#EBE3F9"/>
            <path id="book-3" d="M124.151 200.03H108.084V205.873H124.151V200.03Z" fill="#EBE3F9"/>
            <path id="book-4" d="M138.978 188.668L123.323 192.282L125.639 202.317L137.223 252.49L152.878 248.876L138.978 188.668Z" fill="#F5B56B"/>
            <path id="book-4" d="M141.266 198.297L125.611 201.911L126.926 207.604L142.58 203.99L141.266 198.297Z" fill="#EBE3F9"/>
            <path id="book-4" d="M149.299 233.623L133.645 237.237L134.959 242.93L150.614 239.316L149.299 233.623Z" fill="#EBE3F9"/>
            <path id="book-5" d="M222.01 213.174H166.126C163.917 213.174 162.126 214.965 162.126 217.174V226.701C162.126 228.91 163.917 230.701 166.126 230.701H222.01V213.174Z" fill="#90A07B"/>
            <path id="book-5" d="M169.429 223.78V223.017C169.429 220.807 171.22 219.017 173.429 219.017H219.089V227.78H173.429C171.22 227.78 169.429 225.989 169.429 223.78Z" fill="#EBE3F9"/>
            <path id="book-6" d="M222.01 230.702H166.126C163.917 230.702 162.126 232.493 162.126 234.702V244.229C162.126 246.438 163.917 248.229 166.126 248.229H222.01V230.702Z" fill="#AB6269"/>
            <path id="book-6" d="M169.429 241.308V240.544C169.429 238.335 171.22 236.544 173.429 236.544H219.089V245.308H173.429C171.22 245.308 169.429 243.517 169.429 241.308Z" fill="#EBE3F9"/>
            <path id="book-7" d="M299.282 192.646L316.616 195.242L315.091 205.427L307.463 256.352L290.129 253.756L299.282 192.646Z" fill="#9870D9"/>
            <path id="book-7" d="M296.501 211.647L313.835 214.244L314.701 208.466L297.367 205.87L296.501 211.647Z" fill="#EBE3F9"/>
            <path id="book-7" d="M292.15 241.035L309.484 243.632L310.349 237.854L293.016 235.257L292.15 241.035Z" fill="#EBE3F9"/>
            <path id="book-8" d="M328.634 189.806H312.567V199.543V248.229H328.634V189.806Z" fill="#F5B56B"/>
            <path id="book-8" d="M328.634 200.03H312.567V205.873H328.634V200.03Z" fill="#EBE3F9"/>
            <path id="book-8" d="M328.634 238.005H312.567V243.847H328.634V238.005Z" fill="#EBE3F9"/>
            <path id="book-9" d="M344.701 189.806H328.634V199.543V248.229H344.701V189.806Z" fill="#479CF5"/>
            <path id="book-9" d="M344.701 238.005H328.634V243.847H344.701V238.005Z" fill="#EBE3F9"/>
            <path id="book-9" d="M344.701 200.03H328.634V205.873H344.701V200.03Z" fill="#EBE3F9"/>
            <path id="book-10" d="M360.318 188.338L343.24 192.281L345.557 202.316L357.14 252.489L374.218 248.546L360.318 188.338Z" fill="#F7686E"/>
            <path id="book-10" d="M362.509 197.967L345.431 201.91L346.745 207.603L363.823 203.66L362.509 197.967Z" fill="#EBE3F9"/>
            <path id="book-10" d="M370.542 232.163L353.464 236.105L354.779 241.798L371.857 237.855L370.542 232.163Z" fill="#EBE3F9"/>
            <path id="bus-table" d="M383.058 248.229H60.9634C58.7542 248.229 56.9634 250.019 56.9634 252.229V263.216C56.9634 265.425 58.7542 267.216 60.9634 267.216H383.058C385.267 267.216 387.058 265.425 387.058 263.216V252.229C387.058 250.019 385.267 248.229 383.058 248.229Z" fill="#592481"/>
            <path id="bus-rooftop" d="M589.761 72.8073H48.0259V12C48.0259 5.37258 53.3984 0 60.0259 0H577.761C584.389 0 589.761 5.37257 589.761 12V72.8073Z" fill="#4A3367"/>
        </svg>
    )
}

export function Bus() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const bodyParts = svg.querySelectorAll("path, rect, circle");
        const road = svg.querySelector("#bus-shadow");
        const awning = svg.querySelectorAll("[id^=bus-awning-]");
        const wheels = svg.querySelectorAll(".wheel");

        const anims: (() => void)[] = [];

        // Body
        if (bodyParts) {
            const runBody = () => {
                animate(bodyParts, {
                    translateY: [
                        { to: -3, duration: 400, ease: "inOutSine" },
                        { to: 0, duration: 400, ease: "inOutSine" },
                        { to: -2, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runBody();
        }

        // Road shadow
        if (road) {
            const runRoad = () => {
                animate(road, {
                    opacity: [
                        { to: 0.6, duration: 400, ease: "inOutSine" },
                        { to: 1, duration: 400, ease: "inOutSine" },
                        { to: 0.8, duration: 300, ease: "inOutSine" },
                        { to: 1, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runRoad();
        }

        // Wheels
        if (wheels) {
            const runWheels = () => {
                animate(wheels, {
                    rotate: '360deg',
                    ease: "linear",
                    duration: 1500,
                    loop: true,
                });
            };
            runWheels();
        }

        // Awning vibration
        if (awning) {
            const runAwning = () => {
                animate(awning, {
                    translateX: [
                        { to: -2, duration: 400, ease: "inOutSine" },
                        { to: 0, duration: 400, ease: "inOutSine" },
                        { to: -1, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    loop: true,
                });
            };
            runAwning();
        }

        // Books
        for (let i = 1; i <= 10; i++) {
            const book = svg.querySelectorAll(`#book-${i}`);
            if (!book.length) continue;

            const delay = i * 25;
            const intensity  = 0.8 + (i % 3) * 0.8;

            const runBook = () => {
                animate(book, {
                    translateY: [
                        { to: -1 * intensity, duration: 400, ease: "inOutSine" },
                        { to: 0 * intensity, duration: 400, ease: "inOutSine" },
                        { to: -0.5 * intensity, duration: 300, ease: "inOutSine" },
                        { to: 0, duration: 300, ease: "inOutSine" },
                    ],
                    transformOrigin: "50% 100%",
                    delay,
                    loop: true,
                });
            };
            runBook();
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 704 443" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <ellipse id="bus-shadow" cx="355.398" cy="420.112" rx="347.994" ry="22.8294" fill="#E3D5F5"/>
            <path id="bus-body" d="M14.0002 96H606.395L648.05 221.588C648.598 223.24 649.67 224.668 651.104 225.656L692.638 254.281C694.805 255.774 696.099 258.237 696.099 260.868V365.513C696.099 369.932 692.517 373.513 688.099 373.513H600.34H22.0002C17.582 373.513 14.0002 369.932 14.0002 365.513V96Z" fill="#A068D3"/>
            <rect id="bus-side" x="64.2661" y="157.672" width="314.028" height="90.557" fill="#393744"/>
            <path id="bus-signal" d="M645.948 283.284H632.803C629.778 283.284 627.326 280.831 627.326 277.806C627.326 274.781 629.778 272.329 632.803 272.329H645.948C648.973 272.329 651.426 274.781 651.426 277.806C651.426 280.831 648.973 283.284 645.948 283.284Z" fill="#EC8E48" stroke="#EC8E48" strokeWidth="2"/>
            <path id="bus-wheel-well-back" d="M188.417 373.84H54.0422C54.0422 333.507 84.1231 300.811 121.23 300.811C158.336 300.811 188.417 333.507 188.417 373.84Z" fill="#C299E7"/>
            <path id="bus-wheel-well-front" d="M645.583 373.84H511.208C511.208 333.507 541.289 300.811 578.396 300.811C615.502 300.811 645.583 333.507 645.583 373.84Z" fill="#C299E7"/>
            <path id="bus-wheel-well-front-inside" d="M632.438 373.841H524.354C524.354 341.574 548.549 315.417 578.396 315.417C608.242 315.417 632.438 341.574 632.438 373.841Z" fill="#4E3867"/>
            <path id="bus-wheel-well-back-inside" d="M175.271 373.841H67.1873C67.1873 341.574 91.3827 315.417 121.229 315.417C151.076 315.417 175.271 341.574 175.271 373.841Z" fill="#4E3867"/>
            <circle id="bus-wheel-front" cx="578.396" cy="367.998" r="46.7391" fill="#141413"/>
            <circle id="bus-wheel-back" cx="121.229" cy="367.998" r="46.7391" fill="#141413"/>
            <path id="bus-wheel-back-shine" className="wheel" d="M92.9123 404.32C90.2655 402.278 88.942 401.257 88.6309 399.834C88.5813 399.608 88.5516 399.377 88.542 399.146C88.4816 397.69 89.5024 396.367 91.544 393.72L138.342 333.048C140.384 330.401 141.405 329.078 142.828 328.767C143.054 328.717 143.285 328.687 143.516 328.678C144.972 328.617 146.295 329.638 148.942 331.68C151.589 333.721 152.912 334.742 153.224 336.165C153.273 336.392 153.303 336.622 153.313 336.854C153.373 338.309 152.352 339.633 150.311 342.28L103.512 402.952C101.471 405.598 100.45 406.922 99.0267 407.233C98.8001 407.283 98.5697 407.312 98.338 407.322C96.8826 407.382 95.5592 406.361 92.9123 404.32Z" fill="white" fillOpacity="0.1"/>
            <path id="bus-wheel-front-shine" className="wheel" d="M534.441 353.559C535.489 350.385 536.012 348.798 537.252 348.032C537.449 347.91 537.656 347.806 537.872 347.72C539.225 347.18 540.812 347.704 543.986 348.751L616.749 372.766C619.924 373.814 621.511 374.338 622.276 375.577C622.398 375.774 622.503 375.981 622.589 376.197C623.129 377.55 622.605 379.137 621.557 382.311C620.51 385.486 619.986 387.073 618.747 387.839C618.549 387.96 618.342 388.065 618.127 388.151C616.774 388.691 615.186 388.167 612.012 387.119L539.249 363.105C536.075 362.057 534.488 361.533 533.722 360.294C533.6 360.097 533.495 359.889 533.409 359.674C532.87 358.321 533.393 356.734 534.441 353.559Z" fill="white" fillOpacity="0.1"/>
            <circle id="bus-wheel-back-rim" cx="121.23" cy="367.998" r="23.3695" fill="#CBB3DD"/>
            <circle id="bus-wheel-front-rim" cx="578.396" cy="367.998" r="23.3695" fill="#CBB3DD"/>
            <rect id="bus-bumper-back" y="338.786" width="54.0421" height="37.9755" rx="4" fill="#D9D9D9"/>
            <rect id="bus-bumper-front" x="645.584" y="338.786" width="54.0421" height="37.9755" rx="4" fill="#D9D9D9"/>
            <rect id="bus-brake-light" x="7.30298" y="292.047" width="17.5272" height="37.9755" rx="8" fill="#EE4B49"/>
            <rect id="bus-roof" x="7.30298" y="72.8076" width="618.245" height="23.4464" rx="8" fill="#A068D3"/>
            <path id="bus-door" d="M542.612 288.575V119.663C542.612 115.245 539.03 111.663 534.612 111.663H436.685C432.267 111.663 428.685 115.245 428.685 119.663V346.852C428.685 351.271 432.267 354.852 436.685 354.852H490.464C494.085 354.852 497.218 352.405 498.424 348.991C507.103 324.424 527.209 304.495 539.228 295.251C541.313 293.647 542.612 291.206 542.612 288.575Z" stroke="#7A41B2" strokeWidth="4"/>
            <path id="bus-door-window" d="M522.545 126.999H447.291C445.082 126.999 443.291 128.79 443.291 130.999V219.398C443.291 221.608 445.082 223.398 447.291 223.398H522.545C524.754 223.398 526.545 221.608 526.545 219.398V130.999C526.545 128.79 524.754 126.999 522.545 126.999Z" fill="#393744"/>
            <path id="bus-door-handle" d="M467.756 240.927H448.038C445.416 240.927 443.291 243.052 443.291 245.674C443.291 248.295 445.416 250.421 448.038 250.421H467.756C470.378 250.421 472.503 248.295 472.503 245.674C472.503 243.052 470.378 240.927 467.756 240.927Z" fill="#7A41B2"/>
            <path id="bus-windshield" d="M557.948 219.399V132.46C557.948 130.251 559.739 128.46 561.948 128.46H602.385C604.108 128.46 605.638 129.563 606.181 131.199L633.323 212.876C635.044 218.055 631.189 223.399 625.731 223.399H597.384H561.948C559.739 223.399 557.948 221.608 557.948 219.399Z" fill="#393744"/>
            <path id="bus-headlight" d="M674.796 315.417V288.396C674.796 284.362 678.066 281.093 682.099 281.093C686.132 281.093 689.402 284.362 689.402 288.396V315.417C689.402 319.45 686.132 322.72 682.099 322.72C678.066 322.72 674.796 319.45 674.796 315.417Z" fill="#F3C068" stroke="#F3C068" strokeWidth="2"/>
            <path id="bus-awning-1" d="M36.7713 144.202L66.0021 112.932C66.7585 112.122 67.8166 111.663 68.9243 111.663H111.006L90.4433 144.279C90.0406 144.918 89.827 145.657 89.827 146.412V155.175C89.827 155.379 89.8134 155.578 89.7775 155.778C88.6278 162.184 81.3234 174.004 60.6152 172.278C40.7384 170.621 35.8197 155.355 35.75 146.696C35.7425 145.763 36.1339 144.884 36.7713 144.202Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-2" d="M91.1077 144.319L109.116 113.638C109.834 112.415 111.147 111.663 112.566 111.663H156.284L142.01 144.494C141.791 144.997 141.678 145.54 141.678 146.089V156.514C141.678 157.271 141.473 158.016 141.027 158.627C137.502 163.458 128.299 171.548 114.591 171.548C100.655 171.548 93.2156 163.188 90.8801 158.389C90.6516 157.919 90.5574 157.403 90.5574 156.881V146.344C90.5574 145.632 90.7474 144.933 91.1077 144.319Z" fill="#EBE3F9" stroke="#EBE3F9" strokeWidth="2"/>
            <path id="bus-awning-3" d="M142.045 143.7L155.228 114.039C155.87 112.594 157.302 111.663 158.883 111.663H198.641L196.45 127.364L194.259 143.066V154.751C194.016 160.593 188.417 172.278 167.968 172.278C148.165 172.278 142.289 154.927 141.717 145.429C141.681 144.835 141.803 144.244 142.045 143.7Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-4" d="M240.462 111.663H202.098C200.113 111.663 198.428 113.119 198.14 115.084L194.301 141.317C194.273 141.509 194.259 141.71 194.26 141.904C194.436 169.657 219.089 170.817 219.089 170.817C219.089 170.817 248.123 174.446 248.3 141.906C248.301 141.712 248.287 141.509 248.259 141.317L244.42 115.084C244.132 113.119 242.447 111.663 240.462 111.663Z" fill="#EBE3F9" stroke="#EBE3F9" strokeWidth="2"/>
            <path id="bus-awning-5" d="M300.515 143.7L287.332 114.039C286.69 112.594 285.258 111.663 283.677 111.663H243.919L246.11 127.364L248.301 143.066V154.751C248.545 160.593 254.143 172.278 274.592 172.278C294.395 172.278 300.271 154.927 300.843 145.429C300.879 144.835 300.757 144.244 300.515 143.7Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="bus-awning-6" d="M351.454 144.319L333.445 113.638C332.727 112.415 331.415 111.663 329.996 111.663H286.277L300.552 144.494C300.77 144.997 300.883 145.54 300.883 146.089V156.514C300.883 157.271 301.089 158.016 301.535 158.627C305.06 163.458 314.263 171.548 327.971 171.548C341.906 171.548 349.346 163.188 351.681 158.389C351.91 157.919 352.004 157.403 352.004 156.881V146.344C352.004 145.632 351.814 144.933 351.454 144.319Z" fill="#EBE3F9" stroke="#EBE3F9" strokeWidth="2"/>
            <path id="bus-awning-7" d="M405.79 144.202L376.559 112.932C375.803 112.122 374.745 111.663 373.637 111.663H331.556L352.118 144.279C352.521 144.918 352.734 145.657 352.734 146.412V155.175C352.734 155.379 352.748 155.578 352.784 155.778C353.934 162.184 361.238 174.004 381.946 172.278C401.823 170.621 406.742 155.355 406.811 146.696C406.819 145.763 406.427 144.884 405.79 144.202Z" fill="#C4A4E7" stroke="#C4A4E7" strokeWidth="2"/>
            <path id="book-1" d="M92.0171 189.806H74.49V199.543V248.23H92.0171V189.806Z" fill="#9870D9"/>
            <path id="book-1" d="M92.0171 200.03H74.49V205.873H92.0171V200.03Z" fill="#EBE3F9"/>
            <path id="book-1" d="M92.0171 235.085H74.49V240.927H92.0171V235.085Z" fill="#EBE3F9"/>
            <path id="book-2" d="M108.084 189.806H92.0173V199.543V248.229H108.084V189.806Z" fill="#E88C3F"/>
            <path id="book-2" d="M108.084 200.03H92.0173V205.873H108.084V200.03Z" fill="#EBE3F9"/>
            <path id="book-2" d="M108.084 235.085H92.0173V240.927H108.084V235.085Z" fill="#EBE3F9"/>
            <path id="book-3" d="M124.151 189.806H108.084V199.543V248.23H124.151V189.806Z" fill="#479CF5"/>
            <path id="book-3" d="M124.151 235.085H108.084V240.927H124.151V235.085Z" fill="#EBE3F9"/>
            <path id="book-3" d="M124.151 200.03H108.084V205.873H124.151V200.03Z" fill="#EBE3F9"/>
            <path id="book-4" d="M138.978 188.668L123.323 192.282L125.64 202.317L137.223 252.49L152.878 248.876L138.978 188.668Z" fill="#F5B56B"/>
            <path id="book-4" d="M141.266 198.297L125.611 201.911L126.926 207.604L142.58 203.99L141.266 198.297Z" fill="#EBE3F9"/>
            <path id="book-4" d="M149.299 233.623L133.645 237.237L134.959 242.93L150.614 239.316L149.299 233.623Z" fill="#EBE3F9"/>
            <path id="book-5" d="M222.011 213.174H166.126C163.917 213.174 162.126 214.965 162.126 217.174V226.701C162.126 228.91 163.917 230.701 166.126 230.701H222.011V213.174Z" fill="#90A07B"/>
            <path id="book-5" d="M169.429 223.78V223.017C169.429 220.807 171.22 219.017 173.429 219.017H219.089V227.78H173.429C171.22 227.78 169.429 225.989 169.429 223.78Z" fill="#EBE3F9"/>
            <path id="book-6" d="M222.011 230.702H166.126C163.917 230.702 162.126 232.493 162.126 234.702V244.229C162.126 246.438 163.917 248.229 166.126 248.229H222.011V230.702Z" fill="#AB6269"/>
            <path id="book-6" d="M169.429 241.308V240.544C169.429 238.335 171.22 236.544 173.429 236.544H219.089V245.308H173.429C171.22 245.308 169.429 243.517 169.429 241.308Z" fill="#EBE3F9"/>
            <path id="book-7" d="M299.283 192.646L316.616 195.242L315.091 205.427L307.463 256.352L290.129 253.756L299.283 192.646Z" fill="#9870D9"/>
            <path id="book-7" d="M296.501 211.647L313.835 214.244L314.701 208.466L297.367 205.87L296.501 211.647Z" fill="#EBE3F9"/>
            <path id="book-7" d="M292.15 241.035L309.484 243.632L310.349 237.854L293.016 235.257L292.15 241.035Z" fill="#EBE3F9"/>
            <path id="book-8" d="M328.634 189.806H312.567V199.543V248.229H328.634V189.806Z" fill="#F5B56B"/>
            <path id="book-8" d="M328.634 200.03H312.567V205.873H328.634V200.03Z" fill="#EBE3F9"/>
            <path id="book-8" d="M328.634 238.005H312.567V243.847H328.634V238.005Z" fill="#EBE3F9"/>
            <path id="book-9" d="M344.701 189.806H328.635V199.543V248.229H344.701V189.806Z" fill="#479CF5"/>
            <path id="book-9" d="M344.701 238.005H328.635V243.847H344.701V238.005Z" fill="#EBE3F9"/>
            <path id="book-9" d="M344.701 200.03H328.635V205.873H344.701V200.03Z" fill="#EBE3F9"/>
            <path id="book-10" d="M360.318 188.339L343.24 192.282L345.557 202.317L357.14 252.49L374.218 248.547L360.318 188.339Z" fill="#F7686E"/>
            <path id="book-10" d="M362.509 197.968L345.431 201.911L346.745 207.604L363.823 203.661L362.509 197.968Z" fill="#EBE3F9"/>
            <path id="book-10" d="M370.542 232.163L353.464 236.105L354.778 241.798L371.856 237.855L370.542 232.163Z" fill="#EBE3F9"/>
            <path id="bus-table" d="M383.058 248.229H60.9634C58.7542 248.229 56.9634 250.019 56.9634 252.229V263.216C56.9634 265.425 58.7542 267.216 60.9634 267.216H383.058C385.267 267.216 387.058 265.425 387.058 263.216V252.229C387.058 250.019 385.267 248.229 383.058 248.229Z" fill="#EBE3F9"/>
            <path id="bus-rooftop" d="M589.761 72.8073H48.0256V12C48.0256 5.37258 53.3982 0 60.0256 0H577.761C584.388 0 589.761 5.37257 589.761 12V72.8073Z" fill="#EBE3F9"/>
        </svg>
    )
}

export function CloudsTopLeft() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const anims: (() => void)[] = [];

        // slide in clouds
        for (let i = 1; i <= 3; i++) {
            const clouds = svg.querySelectorAll(`#clouds-topleft-${i}`);
            const tl = createTimeline();
            if (!clouds) continue;

            const delay = i * 100;

            const runCloudsTopLeft = () => {
                tl.add(clouds, {
                    x: [-500, 0],
                    ease: spring({
                        bounce: 0.3,
                        duration: 500,
                    }),
                    delay,
                })
                .add(clouds, {
                    translateX: [
                        { to: -10, duration: 1800, ease: "linear" },
                        { to: 0, duration: 1800, ease: "linear" },
                        { to: -8, duration: 1500, ease: "linear" },
                        { to: 0, duration: 1500, ease: "linear" },
                    ],
                    loop: true,
                })
            };
            runCloudsTopLeft();
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 510 169" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <path id="clouds-topleft-1" d="M60.5 84.7008C94.5 -5.79911 203 41.2007 203 79.7001C226.167 66.5335 277.3 57.1002 296.5 124.7C310.667 120.2 341.7 119 352.5 150.2H60.5V84.7008Z" fill="#ECDFFD"/>
            <path id="clouds-topleft-2" d="M163.5 150.701C183.5 141.901 198.167 158.701 203 168.201H-1V106.701C38 57.2009 86.5 92.7005 97 115.7C137.8 98.1004 158.333 131.7 163.5 150.701Z" fill="white"/>
            <path id="clouds-topleft-3" d="M508 70.2004H331C333 50.6006 348.5 49.7003 356 51.7002C360 21.7002 389.333 23.5336 403.5 28.2003C424 -23.3001 480 6.20028 478.5 34.2004C511.3 31.4004 511.833 57.0337 508 70.2004Z" fill="#ECDFFD"/>
        </svg>
    );
}

export function CloudsTopLeftDark() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const anims: (() => void)[] = [];

        // slide in clouds
        for (let i = 1; i <= 3; i++) {
            const clouds = svg.querySelectorAll(`#clouds-topleft-${i}`);
            const tl = createTimeline();
            if (!clouds) continue;

            const delay = i * 100;

            const runCloudsTopLeft = () => {
                tl.add(clouds, {
                    x: [-500, 0],
                    ease: spring({
                        bounce: 0.3,
                        duration: 500,
                    }),
                    delay,
                })
                .add(clouds, {
                    translateX: [
                        { to: -10, duration: 1800, ease: "linear" },
                        { to: 0, duration: 1800, ease: "linear" },
                        { to: -8, duration: 1500, ease: "linear" },
                        { to: 0, duration: 1500, ease: "linear" },
                    ],
                    loop: true,
                })
            };
            runCloudsTopLeft();

            
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 510 169" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <path id="clouds-topleft-1" d="M60.5 84.7008C94.5 -5.79911 203 41.2007 203 79.7001C226.167 66.5335 277.3 57.1002 296.5 124.7C310.667 120.2 341.7 119 352.5 150.2H60.5V84.7008Z" fill="#6A35AD"/>
            <path id="clouds-topleft-2" d="M163.5 150.701C183.5 141.901 198.167 158.701 203 168.201H-1V106.701C38 57.2009 86.5 92.7005 97 115.7C137.8 98.1004 158.333 131.7 163.5 150.701Z" fill="#994DFF"/>
            <path id="clouds-topleft-3" d="M508 70.2004H331C333 50.6006 348.5 49.7003 356 51.7002C360 21.7002 389.333 23.5336 403.5 28.2003C424 -23.3001 480 6.20028 478.5 34.2004C511.3 31.4004 511.833 57.0337 508 70.2004Z" fill="#4C0890"/>
        </svg>
    )
}

export function CloudsTopRight() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const anims: (() => void)[] = [];

        // slide in clouds
        for (let i = 1; i <= 3; i++) {
            const clouds = svg.querySelectorAll(`#clouds-topright-${i}`);
            const tl = createTimeline();
            if (!clouds) continue;

            const delay = i * 100;

            const runCloudsTopRight = () => {
                tl.add(clouds, {
                    x: [500, 0],
                    ease: spring({
                        bounce: 0.3,
                        duration: 500,
                    }),
                    delay,
                })
                .add(clouds, {
                    translateX: [
                        { to: 10, duration: 1800, ease: "linear" },
                        { to: 0, duration: 1800, ease: "linear" },
                        { to: 8, duration: 1500, ease: "linear" },
                        { to: 0, duration: 1500, ease: "linear" },
                    ],
                    loop: true,
                })
            };
            runCloudsTopRight();
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 471 168" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <path id="clouds-topright-1" d="M60 107.174C22.8 93.9742 4.5 119.008 0 133.174H402.5C390.5 59.9745 344.5 56.674 323 64.1737C284 -45.8259 172.5 10.1739 160.5 51.6745C92.5 25.2745 65.1667 77.6743 60 107.174Z" fill="#ECDFFD"/>
            <path id="clouds-topright-2" d="M273.5 150.174C253.1 139.374 238 157.007 233 167.174H471V126.174C469.5 116.174 455.5 111.674 445.5 120.674C422.5 51.1741 346.5 79.1737 338.5 114.674C295.7 92.274 277.333 129.007 273.5 150.174Z" fill="white"/>
        </svg>
    )
}

export function CloudsTopRightDark() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;

        const anims: (() => void)[] = [];

        // slide in clouds
        for (let i = 1; i <= 3; i++) {
            const clouds = svg.querySelectorAll(`#clouds-topright-${i}`);
            const tl = createTimeline();
            if (!clouds) continue;

            const delay = i * 100;

            const runCloudsTopRight = () => {
                tl.add(clouds, {
                    x: [500, 0],
                    ease: spring({
                        bounce: 0.3,
                        duration: 500,
                    }),
                    delay,
                })
                .add(clouds, {
                    translateX: [
                        { to: 10, duration: 1800, ease: "linear" },
                        { to: 0, duration: 1800, ease: "linear" },
                        { to: 8, duration: 1500, ease: "linear" },
                        { to: 0, duration: 1500, ease: "linear" },
                    ],
                    loop: true,
                })
            };
            runCloudsTopRight();
        }

        return () => {
            anims.forEach((anim) => anim());
        };
    }, []);

    return (
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 471 168" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
            <path id="clouds-topright-1" d="M60 107.174C22.8 93.9742 4.5 119.008 0 133.174H402.5C390.5 59.9745 344.5 56.674 323 64.1737C284 -45.8259 172.5 10.1739 160.5 51.6745C92.5 25.2745 65.1667 77.6743 60 107.174Z" fill="#6A35AD"/>
            <path id="clouds-topright-2" d="M273.5 150.174C253.1 139.374 238 157.007 233 167.174H471V126.174C469.5 116.174 455.5 111.674 445.5 120.674C422.5 51.1741 346.5 79.1737 338.5 114.674C295.7 92.274 277.333 129.007 273.5 150.174Z" fill="#994DFF"/>
        </svg>
    )
}