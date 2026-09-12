export interface RoadmapSectionDef {
    stepIndex: number;
    tier: "Beginner" | "Intermediate" | "Advanced";
    catName: string;
    secNum: number;
    title: string;
    desc: string;
    units: string[];
}

export const UNIFIED_CURRICULUM_ROADMAP: RoadmapSectionDef[] = [
    // === BEGINNER ===
    {
        stepIndex: 1,
        tier: "Beginner",
        catName: "HTML",
        secNum: 1,
        title: "Document Structure & Text Content",
        desc: "Master <!DOCTYPE html>, <html>, <head>, <body>, page skeletons, headings h1-h6, paragraphs, and lists.",
        units: [
            "Unit 1: Document Structure (doctype, html tag, head, body, title, page skeleton)",
            "Unit 2: Text Content (headings h1-h6, paragraphs, ordered/unordered lists, li, br, hr)",
        ],
    },
    {
        stepIndex: 2,
        tier: "Beginner",
        catName: "HTML",
        secNum: 2,
        title: "Hyperlinks, Media & Embeds",
        desc: "Build relative/absolute links, target blank, and embed images, audio, video, and iframes.",
        units: [
            "Unit 1: Links (a tag, href, relative/absolute paths, target _blank, mailto, tel)",
            "Unit 2: Media (img tag, src, alt, width/height, audio/video controls, iframe embed)",
        ],
    },
    {
        stepIndex: 3,
        tier: "Beginner",
        catName: "HTML",
        secNum: 3,
        title: "Semantic HTML, Divs & Spans",
        desc: "Structure accessible and SEO-friendly websites with semantic tags, divs, spans, and classes.",
        units: [
            "Unit 1: Semantic HTML (header, nav, main, section, article, footer, accessibility, seo)",
            "Unit 2: Divs & Spans (div, span, block vs inline, class and id attributes)",
        ],
    },
    {
        stepIndex: 4,
        tier: "Beginner",
        catName: "CSS",
        secNum: 1,
        title: "CSS Selectors, Cascade & Pseudo-classes",
        desc: "Learn styling rules, specificity, stylesheets, cascade principles, and interactive pseudo-classes.",
        units: [
            "Unit 1: Selectors (element, class, id, grouping selectors, specificity basics)",
            "Unit 2: Applying CSS (external stylesheets, link tag, internal/inline styles, cascade)",
            "Unit 3: Pseudo-classes & Elements (:hover, :focus, :active, :first-child, :last-child, ::before/::after)",
        ],
    },
    {
        stepIndex: 5,
        tier: "Beginner",
        catName: "CSS",
        secNum: 2,
        title: "Box Model Fundamentals & Sizing",
        desc: "Understand margins, padding, borders, box-sizing: border-box, and dimensional constraints.",
        units: [
            "Unit 1: Box Fundamentals (content, padding, border, margin, box model, margin collapsing)",
            "Unit 2: Sizing (width, height, box-sizing, border-box, content-box, min/max width)",
        ],
    },
    {
        stepIndex: 6,
        tier: "Beginner",
        catName: "CSS",
        secNum: 3,
        title: "Colors, Backgrounds & Typography",
        desc: "Design aesthetic interfaces with hex, rgb, hsl, gradients, font stacks, rem scaling, and line-height.",
        units: [
            "Unit 1: Color & Background (hex, rgb, hsl, background-color/image, gradients, opacity)",
            "Unit 2: Typography (font-family, font stack, font-size, rem vs px, font-weight, text-align, line-height)",
        ],
    },
    {
        stepIndex: 7,
        tier: "Beginner",
        catName: "CSS",
        secNum: 4,
        title: "Display, Positioning & Flexbox Basics",
        desc: "Position layout elements (block, inline, static, relative, absolute) and align items with display: flex.",
        units: [
            "Unit 1: Display & Position (block, inline, inline-block, static, relative, absolute)",
            "Unit 2: Flexbox Basics (display flex, flex-direction, justify-content, align-items)",
        ],
    },

    // === INTERMEDIATE ===
    {
        stepIndex: 8,
        tier: "Intermediate",
        catName: "JavaScript",
        secNum: 1,
        title: "JavaScript Variables, Types & Operators",
        desc: "Start coding with let, const, primitive types, arithmetic operators, strict equality, and logical operators.",
        units: [
            "Unit 1: Variables & Types (let, const, var, string, number, boolean, null, undefined, typeof)",
            "Unit 2: Operators (arithmetic, comparison, strict/loose equality, logical AND/OR/NOT)",
        ],
    },
    {
        stepIndex: 9,
        tier: "Intermediate",
        catName: "JavaScript",
        secNum: 2,
        title: "Conditionals, Logic & Iteration Loops",
        desc: "Control execution paths using if/else, switch statements, truthy/falsy logic, and while/for loops.",
        units: [
            "Unit 1: Conditionals (if else, else if, switch statement, truthy falsy)",
            "Unit 2: Loops (for loop, while loop, break, continue)",
        ],
    },
    {
        stepIndex: 10,
        tier: "Intermediate",
        catName: "JavaScript",
        secNum: 3,
        title: "Functions, Parameters & Arrow Syntax",
        desc: "Write modular code with function declarations, parameters, return statements, and arrow functions.",
        units: [
            "Unit 1: Function Basics (function declaration, parameters, arguments, return statement)",
            "Unit 2: Function Expressions & Arrows (function expression, arrow function, implicit return)",
        ],
    },
    {
        stepIndex: 11,
        tier: "Intermediate",
        catName: "HTML",
        secNum: 4,
        title: "Interactive Forms & User Controls",
        desc: "Build form controls, text inputs, radio/checkboxes, select dropdowns, buttons, and input validations.",
        units: [
            "Unit 1: Display & Position (form container, layout, control alignment, labels)",
            "Unit 2: Flexbox Basics (flex alignment of form controls, input groups, responsive buttons)",
        ],
    },
    {
        stepIndex: 12,
        tier: "Intermediate",
        catName: "JavaScript",
        secNum: 4,
        title: "Template Literals, Destructuring & Spread",
        desc: "Format multi-line interpolated strings and unpack data with array/object destructuring and spread operators.",
        units: [
            "Unit 1: Template Literals (backtick strings, string interpolation, multi-line strings)",
            "Unit 2: Destructuring & Spread (array/object destructuring, spread operator, rest parameters)",
        ],
    },
    {
        stepIndex: 13,
        tier: "Intermediate",
        catName: "JavaScript",
        secNum: 5,
        title: "Arrays, Array Methods & Object Data",
        desc: "Manage collections with push/pop, map/filter/forEach, higher-order functions, and nested object literals.",
        units: [
            "Unit 1: Arrays (creation, indexing, length, push, pop, for...of)",
            "Unit 2: Array Methods (map, filter, forEach, higher-order functions)",
            "Unit 3: Objects (object literal, dot/bracket notation, add/update/delete properties, for...in, nesting)",
        ],
    },

    // === ADVANCED ===
    {
        stepIndex: 14,
        tier: "Advanced",
        catName: "CSS",
        secNum: 5,
        title: "Flexbox in Practice, Grid & Responsive Design",
        desc: "Build production responsive layouts with flex-wrap, CSS Grid columns/rows, media queries, and mobile-first design.",
        units: [
            "Unit 1: Flexbox in Practice (flex-wrap, gap, flex-grow/shrink/basis, centering, navbar and card layouts)",
            "Unit 2: Grid Basics (grid-template-columns/rows, gap, grid-column/row, flexbox vs grid)",
            "Unit 3: Responsive Design (media queries, mobile-first, breakpoints, rem, em, vw, vh)",
        ],
    },
    {
        stepIndex: 15,
        tier: "Advanced",
        catName: "CSS",
        secNum: 6,
        title: "Transitions, Transforms & Keyframe Animations",
        desc: "Bring pages to life with cubic-bezier transitions, timing functions, @keyframes, and loading spinners.",
        units: [
            "Unit 1: Transitions (property, duration, timing-function, ease, linear, delay, hover states)",
            "Unit 2: Animations (keyframes, animation property, iteration-count, direction, fade-in, spinners)",
        ],
    },
    {
        stepIndex: 16,
        tier: "Advanced",
        catName: "JavaScript",
        secNum: 6,
        title: "DOM Manipulation & Browser Event Handling",
        desc: "Select elements with querySelector, mutate text/HTML/classList, create nodes, and handle click/submit events.",
        units: [
            "Unit 1: Selecting Elements (querySelector, querySelectorAll, getElementById, DOM tree)",
            "Unit 2: Manipulating the Page (textContent, innerHTML, classList add/remove/toggle, style, createElement)",
            "Unit 3: Events (addEventListener, click, input, submit, change, event object, preventDefault)",
        ],
    },
    {
        stepIndex: 17,
        tier: "Advanced",
        catName: "JavaScript",
        secNum: 7,
        title: "JSON, Fetch API & Asynchronous Web Apps",
        desc: "Serialize JSON, consume APIs using fetch and Promises, handle network responses, and render dynamic content.",
        units: [
            "Unit 1: JSON Basics (json, JSON.stringify, JSON.parse, data interchange)",
            "Unit 2: Fetch API (fetch, promises, then, GET requests, async/await preview)",
            "Unit 3: Putting It Together (fetch plus DOM, rendering API data, dynamic web applications)",
        ],
    },
];
