"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div style={{ minHeight: "220px", width: "100%", background: "var(--bg-card)" }} className="animate-pulse" />
    ),
});
import Sidebar from "@/app/components/Sidebar";
import "#css/dashboard.css";
import "#css/sidebar.css";
import "#css/cheatsheet.css";

const levelNames = ["Beginner", "Intermediate", "Advanced"] as const;
type LevelName = (typeof levelNames)[number];
type CodeLanguage = "html" | "css" | "javascript";
type EditorTheme = "vs" | "vs-dark";

interface Unit {
    title: string;
    topics: string[];
    description: string;
    example: string;
}

interface Section {
    id: string;
    level: LevelName;
    title: string;
    units: Unit[];
}

const sections: Section[] = [
    {
        id: "html-getting-started",
        level: "Beginner",
        title: "HTML Section 1",
        units: [
            {
                title: "Unit 1: Document Structure",
                topics: ["doctype", "html tag", "head", "body", "title", "page skeleton"],
                description: "An html element contains head information and the visible page body.",
                example: "<!DOCTYPE html>\n<html>\n  <head>\n    <title>My page</title>\n  </head>\n  <body>\n    <h1>Hello!</h1>\n  </body>\n</html>",
            },
            {
                title: "Unit 2: Text Content",
                topics: ["headings h1-h6", "paragraphs", "ordered list", "unordered list", "li", "br", "hr"],
                description: "Use headings to organize content, paragraphs for text, and lists to group related items.",
                example: "<h1>Page title</h1>\n<p>A short paragraph.</p>\n<ul>\n  <li>List item</li>\n</ul>\n<ol>\n  <li>Numbered item</li>\n</ol>\n<hr>",
            },
        ],
    },
    {
        id: "html-linking",
        level: "Beginner",
        title: "HTML Section 2",
        units: [
            {
                title: "Unit 1: Links",
                topics: ["a tag", "href", "relative path", "absolute path", "target blank", "mailto", "tel"],
                description: "The a tag links to other pages, websites, email addresses, or phone numbers. The href attribute sets the destination.",
                example: "<a href=\"/lessons\">Relative path</a>\n<a href=\"https://example.com\">Absolute path</a>\n<a\n  href=\"https://example.com\"\n  target=\"_blank\"\n  rel=\"noreferrer\"\n>\n  Open in a new tab\n</a>\n<a href=\"mailto:hello@example.com\">Email</a>\n<a href=\"tel:+15551234567\">Call</a>",
            },
            {
                title: "Unit 2: Media",
                topics: ["img tag", "src", "alt attribute", "width height", "audio tag", "video tag", "controls", "iframe embed"],
                description: "Use src for a media location, alt to describe an image, and controls to let people play audio or video.",
                example: "<img\n  src=\"photo.jpg\"\n  alt=\"A mountain at sunrise\"\n  width=\"640\"\n  height=\"400\"\n>\n<audio src=\"sound.mp3\" controls></audio>\n<video src=\"clip.mp4\" controls></video>\n<iframe\n  src=\"https://example.com\"\n  title=\"Example page\"\n></iframe>",
            },
        ],
    },
    {
        id: "html-structuring",
        level: "Beginner",
        title: "HTML Section 3",
        units: [
            {
                title: "Unit 1: Semantic HTML",
                topics: ["header", "nav", "main", "section", "article", "footer", "accessibility", "seo"],
                description: "Semantic elements describe what each part of a page does, helping people and search engines understand its structure.",
                example: "<header>Site title</header>\n<nav>Page links</nav>\n<main>\n  <section>\n    <article>Lesson content</article>\n  </section>\n</main>\n<footer>Copyright</footer>",
            },
            {
                title: "Unit 2: Divs & Spans",
                topics: ["div", "span", "block vs inline", "class attribute", "id attribute"],
                description: "A div groups block content; a span groups inline content. Add class or id names to identify elements for styling.",
                example: "<div class=\"card\" id=\"intro\">\n  Learn <span class=\"highlight\">HTML</span>\n</div>",
            },
        ],
    },
    {
        id: "css-styling-basics",
        level: "Beginner",
        title: "CSS Section 1",
        units: [
            {
                title: "Unit 1: Selectors",
                topics: ["element selector", "class selector", "id selector", "grouping selectors", "specificity basics"],
                description: "Selectors target elements by tag, class, or ID. Group selectors with commas; more specific selectors generally take priority.",
                example: "h1 {\n  color: purple;\n}\n.card {\n  padding: 16px;\n}\n#intro {\n  font-weight: 700;\n}\nh1,\np {\n  line-height: 1.5;\n}",
            },
            {
                title: "Unit 2: Applying CSS",
                topics: ["external stylesheet", "link tag", "internal style", "inline style", "cascade"],
                description: "CSS can live in an external stylesheet, a style element, or an element's style attribute. The cascade resolves competing rules.",
                example: "<link rel=\"stylesheet\" href=\"styles.css\">\n\n<style>\n  .card {\n    padding: 16px;\n  }\n</style>\n\n<p style=\"color: purple\">Inline style</p>",
            },
            {
                title: "Unit 3: Pseudo-classes & Elements",
                topics: [":hover", ":focus", ":active", ":first-child", ":last-child", "::before / ::after (intro)"],
                description: "Pseudo-classes select an element's state or position; pseudo-elements style or add a part of an element.",
                example: "a:hover {\n  text-decoration: underline;\n}\ninput:focus {\n  outline: 2px solid purple;\n}\nli:first-child {\n  font-weight: 700;\n}\nli:last-child {\n  margin-bottom: 0;\n}\n.card::before {\n  content: \"★\";\n}",
            },
        ],
    },
    {
        id: "css-box-model",
        level: "Beginner",
        title: "CSS Section 2",
        units: [
            {
                title: "Unit 1: Box Fundamentals",
                topics: ["content", "padding", "border", "margin", "box model diagram", "margin collapsing"],
                description: "An element's box is made of content, padding, border, and margin. Adjacent vertical margins can collapse into one.",
                example: "/* content → padding → border → margin */\n.card {\n  padding: 16px;\n  border: 1px solid #ddd;\n  margin: 24px;\n}",
            },
            {
                title: "Unit 2: Sizing",
                topics: ["width height", "box-sizing", "border-box", "content-box", "min-width", "max-width"],
                description: "Set an element's width and height, and limit its size with min-width or max-width. border-box includes padding and border in the set size.",
                example: ".card {\n  box-sizing: border-box;\n  width: 320px;\n  min-width: 240px;\n  max-width: 100%;\n  height: 180px;\n}\n/* content-box is the default */",
            },
        ],
    },
    {
        id: "css-visual-styling",
        level: "Beginner",
        title: "CSS Section 3",
        units: [
            {
                title: "Unit 1: Color & Background",
                topics: ["hex color", "rgb", "hsl", "background-color", "background-image", "gradient", "opacity"],
                description: "Set colors with hex, rgb, or hsl. Backgrounds can use a color, image, or gradient; opacity controls transparency.",
                example: ".banner {\n  color: #ffffff;\n  background-color: rgb(153, 102, 255);\n  background-image: linear-gradient(135deg, #9966ff, hsl(261 60% 53%));\n  opacity: 0.95;\n}",
            },
            {
                title: "Unit 2: Typography",
                topics: ["font-family", "font stack", "font-size", "rem vs px", "font-weight", "text-align", "line-height", "letter-spacing"],
                description: "Control the font, size, weight, alignment, line spacing, and letter spacing. rem scales from the root size; px is fixed.",
                example: "body {\n  font-family: Arial, sans-serif;\n  font-size: 1rem;\n  font-weight: 400;\n  text-align: left;\n  line-height: 1.5;\n  letter-spacing: 0.02em;\n}",
            },
        ],
    },
    {
        id: "css-layout",
        level: "Beginner",
        title: "CSS Section 4",
        units: [
            {
                title: "Unit 1: Display & Position",
                topics: ["display block", "display inline", "display inline-block", "position static", "position relative", "position absolute"],
                description: "Block elements start on a new line; inline elements flow with text. Positioning controls how an element sits in the page.",
                example: ".block {\n  display: block;\n}\n.label {\n  display: inline;\n}\n.badge {\n  display: inline-block;\n}\n.parent {\n  position: relative;\n}\n.badge {\n  position: absolute;\n  top: 8px;\n}\n/* static is the default position */",
            },
            {
                title: "Unit 2: Flexbox Basics",
                topics: ["display flex", "flex-direction", "justify-content", "align-items"],
                description: "Flexbox arranges items along a main axis and aligns them across the main axis.",
                example: ".row {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n}",
            },
        ],
    },
    {
        id: "js-programming-basics",
        level: "Intermediate",
        title: "JavaScript Section 1",
        units: [
            {
                title: "Unit 1: Variables & Types",
                topics: ["let", "const", "var", "string", "number", "boolean", "null", "undefined", "typeof"],
                description: "Variables store values. Use let when a value changes and const when its binding stays the same. JavaScript values have different types.",
                example: "const name = \"Ada\";\nlet score = 10;\nconst active = true;\nconst empty = null;\nlet pending;\n\nconsole.log(typeof score); // \"number\"",
            },
            {
                title: "Unit 2: Operators",
                topics: ["arithmetic operators", "comparison operators", "strict equality", "loose equality", "logical operators", "and or not"],
                description: "Operators perform calculations, compare values, and combine conditions. Prefer strict equality (===) to avoid automatic type conversion.",
                example: "const total = 4 + 3;\nconst same = total === 7;\nconst alsoSame = 7 == \"7\"; // Avoid loose equality.\nconst canStart = same && true;\nconst either = same || false;",
            },
        ],
    },
    {
        id: "js-control-flow",
        level: "Intermediate",
        title: "JavaScript Section 2",
        units: [
            {
                title: "Unit 1: Conditionals",
                topics: ["if else", "else if", "switch statement", "truthy falsy"],
                description: "Conditionals choose which code runs. Values such as 0, an empty string, null, and undefined are falsy.",
                example: "if (score >= 10) {\n  console.log(\"Great!\");\n} else if (score > 0) {\n  console.log(\"Keep going\");\n} else {\n  console.log(\"Start here\");\n}\n\nswitch (day) {\n  case \"Mon\":\n    console.log(\"Start\");\n    break;\n  default:\n    console.log(\"Another day\");\n}",
            },
            {
                title: "Unit 2: Loops",
                topics: ["for loop", "while loop", "break", "continue"],
                description: "Loops repeat code. Use break to exit a loop and continue to skip to its next iteration.",
                example: "for (let i = 0; i < 5; i++) {\n  if (i === 2) continue;\n  if (i === 4) break;\n\n  console.log(i);\n}\n\nlet count = 0;\nwhile (count < 3) {\n  count++;\n}",
            },
        ],
    },
    {
        id: "js-functions",
        level: "Intermediate",
        title: "JavaScript Section 3",
        units: [
            {
                title: "Unit 1: Function Basics",
                topics: ["function declaration", "parameters", "arguments", "return statement"],
                description: "A function declaration names reusable code. Parameters are its named inputs; arguments are the values passed when calling it.",
                example: "function add(a, b) {\n  return a + b;\n}\n\nconst total = add(2, 3); // arguments: 2, 3",
            },
            {
                title: "Unit 2: Function Expressions & Arrows",
                topics: ["function expression", "arrow function", "implicit return"],
                description: "Functions can be stored in variables. Arrow functions offer a shorter syntax, including an implicit return for a single expression.",
                example: "const greet = function (name) {\n  return `Hello, ${name}`;\n};\n\nconst double = (number) => {\n  return number * 2;\n};",
            },
        ],
    },
    {
        id: "js-modern-syntax",
        level: "Intermediate",
        title: "JavaScript Section 4",
        units: [
            {
                title: "Unit 1: Template Literals",
                topics: ["backtick strings", "string interpolation", "multi-line strings"],
                description: "Backticks create template literals. Insert values with ${...} and write multi-line strings directly.",
                example: "const name = \"Ada\";\nconst greeting = `Hello, ${name}!`;\nconst message = `First line\nSecond line`;",
            },
            {
                title: "Unit 2: Destructuring & Spread (optional)",
                topics: ["array destructuring", "object destructuring", "spread operator", "rest operator"],
                description: "Destructuring pulls values into variables. Spread expands values; rest gathers remaining values.",
                example: "const [first, ...others] = [1, 2, 3];\nconst lesson = {\n  title: \"Lesson\",\n};\nconst { title } = lesson;\nconst copy = [...others, 4];\n\nfunction show(firstArg, ...restArgs) {\n  console.log(firstArg, restArgs);\n}",
            },
        ],
    },
    {
        id: "js-collections",
        level: "Intermediate",
        title: "JavaScript Section 5",
        units: [
            {
                title: "Unit 1: Arrays",
                topics: ["array creation", "indexing", "length property", "push", "pop", "for...of"],
                description: "Arrays store ordered values. Indexes start at zero; length counts items. push adds to the end and pop removes the last item.",
                example: "const fruits = [\"apple\", \"pear\"];\nfruits.push(\"plum\");\nconst last = fruits.pop();\nconsole.log(fruits[0], fruits.length);\nfor (const fruit of fruits) {\n  console.log(fruit);\n}",
            },
            {
                title: "Unit 2: Array Methods",
                topics: ["map", "filter", "forEach", "higher-order functions"],
                description: "These methods accept a function to process array items. map transforms items, filter keeps matches, and forEach runs an action.",
                example: "const numbers = [1, 2, 3];\n\nconst doubled = numbers.map((number) => {\n  return number * 2;\n});\n\nconst big = numbers.filter((number) => number > 1);\nnumbers.forEach((number) => console.log(number));",
            },
            {
                title: "Unit 3: Objects",
                topics: ["object literal", "dot notation", "bracket notation", "add update delete property", "for...in", "nested objects"],
                description: "Objects store named properties. Read and update them with dot or bracket notation; properties can contain other objects.",
                example: "const user = {\n  name: \"Ada\",\n  profile: {\n    level: 2,\n  },\n};\n\nuser.name = \"Grace\";\nuser[\"active\"] = true;\ndelete user.active;\n\nfor (const key in user) {\n  console.log(key);\n}",
            },
        ],
    },
    {
        id: "css-advanced-layout",
        level: "Advanced",
        title: "CSS Section 5",
        units: [
            {
                title: "Unit 1: Flexbox in Practice",
                topics: ["flex-wrap", "gap", "flex-grow", "flex-shrink", "flex-basis", "nested flex", "centering div", "navbar pattern", "card layout"],
                description: "Flex items can wrap, grow, or shrink. Combine nested flex containers and gap to build common layouts.",
                example: ".cards {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 16px;\n}\n.card {\n  flex: 1 1 220px;\n}\n.center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}",
            },
            {
                title: "Unit 2: Grid Basics",
                topics: ["display grid", "grid-template-columns", "grid-template-rows", "gap", "grid-column", "grid-row", "flexbox vs grid"],
                description: "Grid lays out items in rows and columns. Use it for two-dimensional layouts; Flexbox is often simpler for one direction.",
                example: ".layout {\n  display: grid;\n  grid-template-columns: 1fr 2fr;\n  grid-template-rows: auto 1fr;\n  gap: 16px;\n}\n.feature {\n  grid-column: 1 / 3;\n  grid-row: 1;\n}",
            },
            {
                title: "Unit 3: Responsive Design",
                topics: ["media query", "mobile-first", "breakpoints", "rem", "em", "percent units", "vw vh"],
                description: "Responsive styles adapt to available space. Start with a mobile-first base and add breakpoints with media queries.",
                example: ".container {\n  width: 100%;\n  padding: 1rem;\n}\n.title {\n  font-size: 2rem;\n}\n@media (min-width: 48em) {\n  .container {\n    width: 80vw;\n  }\n}",
            },
        ],
    },
    {
        id: "css-motion-polish",
        level: "Advanced",
        title: "CSS Section 6",
        units: [
            {
                title: "Unit 1: Transitions",
                topics: ["transition property", "duration", "timing-function", "ease", "linear", "delay", "hover state"],
                description: "Transitions animate a property change over time. Choose a duration, timing function, and optional delay.",
                example: ".button {\n  transition: transform 200ms ease;\n}\n.button:hover {\n  transform: translateY(-2px);\n}\n/* Use linear for a constant speed. */",
            },
            {
                title: "Unit 2: Animations",
                topics: ["keyframes", "animation property", "iteration-count", "direction", "fade-in", "loading spinner"],
                description: "Define animation steps with keyframes, then configure its duration, repetition, and direction.",
                example: "@keyframes fade-in {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n.message {\n  animation: fade-in 400ms ease 1 normal;\n}",
            },
        ],
    },
    {
        id: "js-dom",
        level: "Advanced",
        title: "JavaScript Section 6",
        units: [
            {
                title: "Unit 1: Selecting Elements",
                topics: ["querySelector", "querySelectorAll", "getElementById", "dom tree"],
                description: "The DOM is a tree representation of a page. Select one matching element or a collection of matches.",
                example: "const title = document.querySelector(\"h1\");\nconst items = document.querySelectorAll(\"li\");\nconst app = document.getElementById(\"app\");",
            },
            {
                title: "Unit 2: Manipulating the Page",
                topics: ["textContent", "innerHTML", "classList", "add remove toggle", "style property", "createElement", "appendChild"],
                description: "Update text, classes, and styles, or create and append new elements. Use textContent for plain text.",
                example: "const item = document.createElement(\"li\");\nitem.textContent = \"New item\";\nitem.classList.add(\"active\");\nitem.classList.toggle(\"selected\");\nlist.appendChild(item);",
            },
            {
                title: "Unit 3: Events",
                topics: ["addEventListener", "click event", "input event", "submit event", "change event", "event object", "preventDefault"],
                description: "Listen for user actions with addEventListener. The event object provides details; preventDefault stops a browser's default action.",
                example: "form.addEventListener(\"submit\", event => {\n  event.preventDefault();\n  console.log(event.target);\n});\nbutton.addEventListener(\"click\", event => {\n  console.log(event.type);\n});",
            },
        ],
    },
    {
        id: "js-working-with-data",
        level: "Advanced",
        title: "JavaScript Section 7",
        units: [
            {
                title: "Unit 1: JSON Basics",
                topics: ["json", "JSON.stringify", "JSON.parse", "data interchange"],
                description: "JSON is a text format for exchanging data. Convert a JavaScript value to JSON text or parse JSON text back into a value.",
                example: "const user = {\n  name: \"Ada\",\n};\n\nconst json = JSON.stringify(user);\nconst parsed = JSON.parse(json);",
            },
            {
                title: "Unit 2: Fetch API",
                topics: ["fetch", "promises", "then", "GET request", "async preview"],
                description: "fetch makes a GET request by default and returns a promise. Use then or async/await to handle the response.",
                example: "fetch(\"/api/lessons\")\n  .then(response => response.json())\n  .then(data => console.log(data));\n\nasync function load() {\n  const response = await fetch(\"/api/lessons\");\n}",
            },
            {
                title: "Unit 3: Putting It Together",
                topics: ["fetch plus dom", "render api data", "dynamic content"],
                description: "Fetch data, then use it to create and render dynamic page content.",
                example: "const response = await fetch(\"/api/lessons\");\nconst lessons = await response.json();\nlessons.forEach(lesson => {\n  const item = document.createElement(\"li\");\n  item.textContent = lesson.title;\n  list.appendChild(item);\n});",
            },
        ],
    },
];

function getCodeLanguage(sectionTitle: string): CodeLanguage {
    if (sectionTitle.startsWith("HTML")) return "html";
    if (sectionTitle.startsWith("CSS")) return "css";
    return "javascript";
}

function CodeExample({
    title,
    sectionTitle,
    example,
    theme,
}: {
    title: string;
    sectionTitle: string;
    example: string;
    theme: EditorTheme;
}) {
    const code = example.trimEnd();
    const height = code.split("\n").length * 22 + 2;

    return (
        <Editor
            className="cheatsheet-code-editor"
            height={`${height}px`}
            width="100%"
            language={getCodeLanguage(sectionTitle)}
            theme={theme}
            value={code}
            options={{
                ariaLabel: `${title} code example`,
                automaticLayout: true,
                contextmenu: false,
                domReadOnly: true,
                fontFamily: "JetBrains Mono, 'Fira Code', monospace",
                fontSize: 14,
                lineHeight: 22,
                folding: false,
                glyphMargin: false,
                lineNumbers: "on",
                minimap: { enabled: false },
                padding: { top: 0, bottom: 0 },
                readOnly: true,
                readOnlyMessage: { value: "" },
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: {
                    horizontalScrollbarSize: 0,
                    horizontal: "hidden",
                    verticalScrollbarSize: 0,
                    vertical: "hidden",
                },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                wordWrap: "on",
                wrappingIndent: "indent",
            }}
        />
    );
}

function UnitCard({ unit, sectionTitle, theme }: { unit: Unit; sectionTitle: string; theme: EditorTheme }) {
    return (
        <article className="cheatsheet-card">
            <h3>{unit.title}</h3>
            <p>{unit.description}</p>
            <ul className="cheatsheet-topics" aria-label={`${unit.title} topics`}>
                {unit.topics.map((topic) => <li key={topic}>{topic}</li>)}
            </ul>
            <CodeExample title={unit.title} sectionTitle={sectionTitle} example={unit.example} theme={theme} />
        </article>
    );
}

function CurriculumSection({
    section,
    searchTerm,
    theme,
}: {
    section: Section;
    searchTerm: string;
    theme: EditorTheme;
}) {
    const title = searchTerm ? section.title.replace(/^(HTML|CSS|JavaScript) /, "") : section.title;

    return (
        <section className="cheatsheet-section" id={section.id} aria-labelledby={`${section.id}-title`}>
            <div className="cheatsheet-section-heading">
                <h2 id={`${section.id}-title`}>{title}</h2>
            </div>
            <div className="cheatsheet-card-grid">
                {section.units.map((unit) => (
                    <UnitCard key={unit.title} unit={unit} sectionTitle={section.title} theme={theme} />
                ))}
            </div>
        </section>
    );
}

export default function CheatSheetPage() {
    const [activeLevel, setActiveLevel] = useState<LevelName>("Beginner");
    const [unitSearch, setUnitSearch] = useState("");
    const [editorTheme, setEditorTheme] = useState<EditorTheme>("vs");

    useEffect(() => {
        const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
        const updateEditorTheme = () => {
            const selectedTheme = document.documentElement.dataset.theme;
            const isDark = selectedTheme === "dark" || (selectedTheme !== "light" && colorScheme.matches);
            setEditorTheme(isDark ? "vs-dark" : "vs");
        };

        updateEditorTheme();
        colorScheme.addEventListener("change", updateEditorTheme);

        const themeObserver = new MutationObserver(updateEditorTheme);
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => {
            colorScheme.removeEventListener("change", updateEditorTheme);
            themeObserver.disconnect();
        };
    }, []);

    const searchTerm = unitSearch.trim().toLowerCase();
    const matchingSections = searchTerm
        ? sections
            .map((section) => ({
                ...section,
                units: section.units.filter((unit) => unit.title.toLowerCase().includes(searchTerm)),
            }))
            .filter((section) => section.units.length > 0)
        : sections.filter((section) => section.level === activeLevel);
    const visibleLevelGroups = searchTerm
        ? levelNames
            .map((level) => ({
                name: level,
                sections: matchingSections.filter((section) => section.level === level),
            }))
            .filter((group) => group.sections.length > 0)
        : [{ name: activeLevel, sections: matchingSections }];
    const visibleSections = visibleLevelGroups.flatMap((group) => group.sections);
    const visibleUnitCount = visibleSections.reduce((total, section) => total + section.units.length, 0);

    return (
        <div className="dashboard-page cheatsheet-page">
            <Sidebar />
            <main>
                <div className="cheatsheet-content">
                    <header className="cheatsheet-heading">
                        <h1>Cheat Sheet</h1>
                        <p>Browse lessons and examples by difficulty.</p>
                    </header>

                    <div className="cheatsheet-toolbar">
                        <nav className="cheatsheet-level-tabs" aria-label="Choose a difficulty">
                            {levelNames.map((level) => (
                                <button
                                    type="button"
                                    className="cheatsheet-level-tab"
                                    aria-pressed={activeLevel === level}
                                    key={level}
                                    onClick={() => setActiveLevel(level)}
                                >
                                    {level}
                                </button>
                            ))}
                        </nav>

                        <label className="cheatsheet-search">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-4-4" />
                            </svg>
                            <input
                                type="search"
                                value={unitSearch}
                                onChange={(event) => setUnitSearch(event.target.value)}
                                placeholder="Search units..."
                                aria-label="Search unit names across all difficulty levels"
                            />
                        </label>
                    </div>

                    <section className="cheatsheet-level" aria-labelledby="cheatsheet-active-level">
                        <header className="cheatsheet-level-heading">
                            <h2 id="cheatsheet-active-level">{searchTerm ? "Search results" : activeLevel}</h2>
                            <span>
                                {searchTerm
                                    ? `${visibleUnitCount} ${visibleUnitCount === 1 ? "unit" : "units"}`
                                    : `${visibleSections.length} ${visibleSections.length === 1 ? "section" : "sections"}`}
                            </span>
                        </header>

                        {visibleSections.length > 0 ? (
                            <div className={searchTerm ? "cheatsheet-search-groups" : "cheatsheet-sections"}>
                                {visibleLevelGroups.map((group) => (
                                    <div
                                        className={`cheatsheet-search-group${searchTerm ? " is-search-result-group" : ""}`}
                                        key={group.name}
                                    >
                                        {searchTerm && (
                                            <header className="cheatsheet-search-group-heading">
                                                <h3>{group.name}</h3>
                                            </header>
                                        )}
                                        {!searchTerm && (
                                            <nav className="cheatsheet-navigation" aria-label={`${group.name} sections`}>
                                                {group.sections.map((section) => (
                                                    <a href={`#${section.id}`} key={section.id}>{section.title}</a>
                                                ))}
                                            </nav>
                                        )}
                                        <div className="cheatsheet-sections">
                                            {group.sections.map((section) => (
                                                <CurriculumSection
                                                    key={section.id}
                                                    section={section}
                                                    searchTerm={searchTerm}
                                                    theme={editorTheme}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="cheatsheet-no-results" role="status">
                                No unit names match “{unitSearch}” in the curriculum.
                            </p>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}