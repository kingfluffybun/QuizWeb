"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useIsReducedMotion } from "@/lib/accessibility-store";

interface AnimHandle {
  pause: () => void;
}

type CloudAnimationConfig =
  | { mode: "slide"; idPrefix: string; count: number; targetX: number; swayDelta: number }
  | { mode: "pop"; idPrefix: string; count: number; origin: string };

function useCloudAnimation(
  svgRef: RefObject<SVGSVGElement | null>,
  config: CloudAnimationConfig,
) {
  const reducedMotion = useIsReducedMotion();
  const { mode, idPrefix, count } = config;
  const targetX = mode === "slide" ? config.targetX : 0;
  const swayDelta = mode === "slide" ? config.swayDelta : 0;
  const origin = mode === "pop" ? config.origin : "";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const resetStatic = () => {
      for (let i = 1; i <= count; i++) {
        svg.querySelectorAll(`#${idPrefix}-${i}`).forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (mode === "slide") {
            htmlEl.style.transform = `translateX(${targetX}px)`;
          } else {
            htmlEl.style.transform = "scale(1)";
            htmlEl.style.transformOrigin = origin;
          }
        });
      }
    };

    if (reducedMotion) {
      resetStatic();
      return;
    }

    let cancelled = false;
    const anims: AnimHandle[] = [];

    void import("animejs").then(({ createTimeline, spring }) => {
      if (cancelled || !svgRef.current) return;

      for (let i = 1; i <= count; i++) {
        const clouds = svg.querySelectorAll(`#${idPrefix}-${i}`);
        if (!clouds.length) continue;

        const tl = createTimeline();
        const delay = i * 100;

        if (mode === "slide") {
          tl.add(clouds, {
            x: [0, targetX],
            ease: spring({ bounce: 0.3, duration: 500 }),
            delay,
          }).add(clouds, {
            translateX: [
              { to: targetX + swayDelta, duration: 1800, ease: "linear" },
              { to: targetX, duration: 1800, ease: "linear" },
              { to: targetX + swayDelta * 0.8, duration: 1500, ease: "linear" },
              { to: targetX, duration: 1500, ease: "linear" },
            ],
            loop: true,
          });
        } else {
          tl.add(clouds, {
            scale: [0, 1],
            transformOrigin: origin,
            ease: spring({ bounce: 0.3, duration: 500 }),
            delay,
          }).add(clouds, {
            scale: [
              { to: 1.025, duration: 1800, ease: "inOutSine" },
              { to: 1, duration: 1800, ease: "inOutSine" },
              { to: 1.015, duration: 1600, ease: "inOutSine" },
              { to: 1, duration: 1600, ease: "inOutSine" },
            ],
            loop: true,
          });
        }

        anims.push(tl);
      }
    });

    return () => {
      cancelled = true;
      anims.forEach((anim) => anim.pause());
      resetStatic();
    };
  }, [reducedMotion, svgRef, mode, idPrefix, count, targetX, swayDelta, origin]);
}

const TOP_LEFT_PATHS = {
  light: ["#ECDFFD", "white", "#ECDFFD"],
  dark: ["#6A35AD", "#994DFF", "#4C0890"],
};

const TOP_RIGHT_PATHS = {
  light: ["#ECDFFD", "white"],
  dark: ["#6A35AD", "#994DFF"],
};

function CloudsTopLeftBase({ fills }: { fills: string[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useCloudAnimation(svgRef, {
    mode: "slide",
    idPrefix: "clouds-topleft",
    count: 3,
    targetX: 500,
    swayDelta: 10,
  });

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 510 169" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <path id="clouds-topleft-1" d="M60.5 84.7008C94.5 -5.79911 203 41.2007 203 79.7001C226.167 66.5335 277.3 57.1002 296.5 124.7C310.667 120.2 341.7 119 352.5 150.2H60.5V84.7008Z" fill={fills[0]} />
      <path id="clouds-topleft-2" d="M163.5 150.701C183.5 141.901 198.167 158.701 203 168.201H-1V106.701C38 57.2009 86.5 92.7005 97 115.7C137.8 98.1004 158.333 131.7 163.5 150.701Z" fill={fills[1]} />
      <path id="clouds-topleft-3" d="M508 70.2004H331C333 50.6006 348.5 49.7003 356 51.7002C360 21.7002 389.333 23.5336 403.5 28.2003C424 -23.3001 480 6.20028 478.5 34.2004C511.3 31.4004 511.833 57.0337 508 70.2004Z" fill={fills[2]} />
    </svg>
  );
}

export function CloudsTopLeft() {
  return <CloudsTopLeftBase fills={TOP_LEFT_PATHS.light} />;
}

export function CloudsTopLeftDark() {
  return <CloudsTopLeftBase fills={TOP_LEFT_PATHS.dark} />;
}

function CloudsTopRightBase({ fills }: { fills: string[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useCloudAnimation(svgRef, {
    mode: "slide",
    idPrefix: "clouds-topright",
    count: 3,
    targetX: -450,
    swayDelta: -10,
  });

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 471 168" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <path id="clouds-topright-1" d="M60 107.174C22.8 93.9742 4.5 119.008 0 133.174H402.5C390.5 59.9745 344.5 56.674 323 64.1737C284 -45.8259 172.5 10.1739 160.5 51.6745C92.5 25.2745 65.1667 77.6743 60 107.174Z" fill={fills[0]} />
      <path id="clouds-topright-2" d="M273.5 150.174C253.1 139.374 238 157.007 233 167.174H471V126.174C469.5 116.174 455.5 111.674 445.5 120.674C422.5 51.1741 346.5 79.1737 338.5 114.674C295.7 92.274 277.333 129.007 273.5 150.174Z" fill={fills[1]} />
    </svg>
  );
}

export function CloudsTopRight() {
  return <CloudsTopRightBase fills={TOP_RIGHT_PATHS.light} />;
}

export function CloudsTopRightDark() {
  return <CloudsTopRightBase fills={TOP_RIGHT_PATHS.dark} />;
}

export function CloudsLeft() {
  const svgRef = useRef<SVGSVGElement>(null);
  useCloudAnimation(svgRef, {
    mode: "pop",
    idPrefix: "clouds-left",
    count: 4,
    origin: "0px 537px",
  });

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 1077 537" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <path id="clouds-left-4" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M917.123 447.016C953.666 447.016 977.303 467.677 984.554 478.007C1050.68 478.007 1073.74 516.792 1077 536.185H0.81958V-76.5765C131.767 -103.98 207.282 2.62369 228.672 59.3507C266.955 44.9967 296.466 73.6684 306.435 89.7985C352.984 65.8752 379.667 91.9734 388.005 109.916C560.559 10.3079 655.011 151.238 663.712 223.008C751.808 200.172 768.122 274.66 751.808 310.545C824.894 302.716 851.685 365.64 856.761 396.994C901.57 384.38 915.673 425.086 917.123 447.016Z" fill="white" />
      <path id="clouds-left-3" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M855.669 477.979C924.427 461.443 960.837 509.893 970.448 536.185H6.10352e-05V160.299C125.331 101.115 212.512 192.938 240.436 246.247C282.648 229.711 312.784 253.138 322.576 266.918C427.889 204.252 481.779 275.259 495.559 318.596C631.77 272.902 686.131 354.317 696.285 400.736C789.413 378.542 841.345 442.984 855.669 477.979Z" fill="#EFE2FC" />
      <path id="clouds-left-2" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M790.232 504.311C841.536 484.694 857.985 517.933 859.797 537.004H3.27863V310.871C78.4957 200.584 165.778 275.453 184.256 317.955C219.908 295.724 249.836 316.684 260.343 329.943C315.56 282.428 348.567 327.945 358.168 356.643C429.907 323.513 461.248 388.247 467.951 424.755C524.907 392.061 553.639 438.377 560.885 465.622C585.233 456.903 600.015 469.255 604.363 476.52C655.667 421.159 699.653 464.714 715.232 493.412C748.276 466.385 779 489.417 790.232 504.311Z" fill="#D0B2F7" />
      <path id="clouds-left-1" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M569.977 512.757C610.005 494.016 633.427 520.566 640.135 536.184H3.27856V338.96C87.6851 297.554 142.143 356.213 158.822 390.718C231.916 344.518 266.868 409.968 275.207 448.468C326.982 418.394 369.294 460.999 383.978 486.061C423.571 464.704 455.949 492.417 467.188 508.944C507.651 464.051 552.574 492.781 569.977 512.757Z" fill="#FCFBFF" />
    </svg>
  );
}

export function CloudsLeftDark() {
  const svgRef = useRef<SVGSVGElement>(null);
  useCloudAnimation(svgRef, {
    mode: "pop",
    idPrefix: "clouds-left",
    count: 4,
    origin: "0px 537px",
  });

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 729 418" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <path id="clouds-left-4" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M620.314 357.134C645.031 357.134 661.019 371.109 665.923 378.096C710.649 378.096 726.244 404.329 728.451 417.445H0.554321V2.9919C89.123 -15.5427 140.2 56.5606 154.667 94.929C180.561 85.2204 200.521 104.613 207.264 115.523C238.748 99.342 256.795 116.994 262.435 129.13C379.146 61.758 443.03 157.079 448.915 205.622C508.5 190.176 519.534 240.558 508.5 264.829C557.934 259.534 576.055 302.094 579.488 323.301C609.795 314.769 619.334 342.302 620.314 357.134Z" fill="#994DFF" />
      <path id="clouds-left-3" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M578.749 378.078C625.255 366.893 649.881 399.663 656.381 417.446H-0.000427246V163.208C84.77 123.178 143.736 185.284 162.623 221.341C191.174 210.156 211.558 226.001 218.18 235.322C289.411 192.937 325.86 240.964 335.181 270.275C427.31 239.369 464.078 294.436 470.946 325.832C533.935 310.821 569.06 354.408 578.749 378.078Z" fill="#6A35AD" />
      <path id="clouds-left-2" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M534.489 395.887C569.19 382.619 580.316 405.101 581.541 418H2.21759V265.05C53.0922 190.455 112.127 241.095 124.625 269.842C148.739 254.805 168.981 268.982 176.088 277.95C213.435 245.812 235.76 276.598 242.254 296.009C290.777 273.601 311.974 317.385 316.508 342.078C355.031 319.965 374.465 351.291 379.366 369.719C395.834 363.822 405.833 372.176 408.773 377.09C443.474 339.646 473.224 369.105 483.762 388.516C506.111 370.235 526.892 385.813 534.489 395.887Z" fill="#4C0890" />
      <path id="clouds-left-1" style={{ transform: "scale(0)", transformOrigin: "0px 537px", transformBox: "view-box" }} d="M385.515 401.6C412.589 388.924 428.431 406.882 432.968 417.446H2.21725V284.049C59.3073 256.043 96.1412 295.718 107.422 319.056C156.861 287.808 180.501 332.077 186.141 358.117C221.161 337.776 249.779 366.593 259.711 383.544C286.491 369.098 308.39 387.843 315.992 399.021C343.36 368.657 373.744 388.089 385.515 401.6Z" fill="#994DFF" />
    </svg>
  );
}

const RIGHT_PATHS = {
  light: ["white", "#EFE2FC", "#D0B2F7", "#FCFBFF"],
  dark: ["#994DFF", "#6A35AD", "#4C0890", "#994DFF"],
};

function CloudsRightBase({ fills }: { fills: string[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useCloudAnimation(svgRef, {
    mode: "pop",
    idPrefix: "clouds-right",
    count: 4,
    origin: "788px 452px",
  });

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 788 452" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <path id="clouds-right-4" style={{ transform: "scale(0)", transformOrigin: "788px 452px", transformBox: "view-box" }} d="M116.932 386.183C90.2047 386.183 72.9168 401.294 67.6137 408.85C19.25 408.85 2.38637 437.217 0 451.4H787.103V3.23526C691.33 -16.8069 636.099 61.1612 620.455 102.651C592.455 92.1522 570.872 113.122 563.58 124.92C529.535 107.422 510.02 126.51 503.921 139.633C377.717 66.7813 308.637 169.855 302.273 222.347C237.841 205.645 225.909 260.125 237.841 286.37C184.387 280.644 164.792 326.667 161.08 349.598C128.307 340.373 117.993 370.144 116.932 386.183Z" fill={fills[0]} />
      <path id="clouds-right-3" style={{ transform: "scale(0)", transformOrigin: "788px 452px", transformBox: "view-box" }} d="M161.878 408.83C111.59 396.735 84.9599 432.171 77.9312 451.4H787.703V176.483C696.037 133.197 632.274 200.354 611.851 239.344C580.978 227.25 558.937 244.384 551.775 254.462C474.751 208.63 435.337 260.563 425.258 292.259C325.635 258.839 285.876 318.385 278.45 352.335C210.337 336.102 172.355 383.235 161.878 408.83Z" fill={fills[1]} />
      <path id="clouds-right-2" style={{ transform: "scale(0)", transformOrigin: "788px 452px", transformBox: "view-box" }} d="M209.738 428.088C172.215 413.741 160.184 438.051 158.859 452H785.305V286.609C730.292 205.947 666.455 260.705 652.94 291.791C626.865 275.531 604.977 290.861 597.292 300.558C556.907 265.807 532.766 299.097 525.743 320.086C473.275 295.856 450.353 343.201 445.45 369.902C403.793 345.991 382.779 379.865 377.479 399.792C359.672 393.415 348.86 402.449 345.68 407.763C308.157 367.272 275.987 399.128 264.592 420.117C240.424 400.35 217.953 417.195 209.738 428.088Z" fill={fills[2]} />
      <path id="clouds-right-1" style={{ transform: "scale(0)", transformOrigin: "788px 452px", transformBox: "view-box" }} d="M370.829 434.267C341.553 420.559 324.423 439.978 319.517 451.401H785.305V307.154C723.571 276.87 683.741 319.772 671.543 345.009C618.083 311.218 592.519 359.088 586.42 387.246C548.553 365.251 517.606 396.411 506.866 414.741C477.909 399.121 454.228 419.39 446.008 431.477C416.414 398.643 383.558 419.656 370.829 434.267Z" fill={fills[3]} />
    </svg>
  );
}

export function CloudsRight() {
  return <CloudsRightBase fills={RIGHT_PATHS.light} />;
}

export function CloudsRightDark() {
  return <CloudsRightBase fills={RIGHT_PATHS.dark} />;
}
