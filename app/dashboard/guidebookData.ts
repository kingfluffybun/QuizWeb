export interface GuidebookSection {
    title: string;
    summary: string;
    keyPoints: string[];
    codeExample: string;
}

export const GUIDEBOOK_DATA: Record<string, Record<number, GuidebookSection>> = {
    HTML: {
        1: {
            title: "HTML Foundations & Structure",
            summary: "Every HTML document begins with <!DOCTYPE html> which forces modern standards mode in browsers. The root <html> element encloses the entire document, which is divided into <head> for metadata and <body> for visible content.",
            keyPoints: [
                "Always place <!DOCTYPE html> on the very first line.",
                "Set language with <html lang=\"en\"> for accessibility and SEO.",
                "Use <h1> only once per page for the primary topic heading.",
                "Structure content with semantic tags (<header>, <main>, <footer>)."
            ],
            codeExample: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My First Webpage</title>
  </head>
  <body>
    <header><h1>Welcome to Web Dev</h1></header>
    <main><p>Learning HTML step by step!</p></main>
  </body>
</html>`
        },
        2: {
            title: "Text & Semantic Formatting",
            summary: "Text tags define meaning, not just visual presentation. Use <p> for paragraphs, <strong> for high importance (bold), <em> for stress emphasis (italics), and <a> for hyperlinks.",
            keyPoints: [
                "Use <a href=\"...\"> with meaningful anchor text, avoiding generic 'click here'.",
                "For external links, consider target=\"_blank\" rel=\"noopener noreferrer\".",
                "Unordered lists (<ul>) for bullet points, ordered lists (<ol>) for sequential steps.",
                "Use <code> for inline snippets and <pre><code> for multi-line code blocks."
            ],
            codeExample: `<p>
  Learn more in our 
  <a href="/docs" target="_blank" rel="noopener">Documentation</a>.
</p>
<ul>
  <li><strong>First:</strong> Set up project</li>
  <li><em>Second:</em> Write code</li>
</ul>`
        },
        3: {
            title: "Media, Images & Embeds",
            summary: "Images and media make web pages rich and engaging. The <img> tag requires a src and an alt attribute describing the image for screen readers and search engines.",
            keyPoints: [
                "Always provide descriptive alt attributes on <img> tags.",
                "Specify width and height attributes to prevent layout shifts (CLS).",
                "Use native <audio> and <video> tags with controls attribute.",
                "Prefer modern formats like WebP or AVIF for optimal file size."
            ],
            codeExample: `<figure>
  <img 
    src="/assets/banner.webp" 
    alt="Developer working on laptop with code on screen" 
    width="800" 
    height="450" 
    loading="lazy"
  />
  <figcaption>Modern Web Development Flow</figcaption>
</figure>`
        },
        4: {
            title: "Interactive Forms & User Controls",
            summary: "HTML forms gather user feedback, credentials, and data. Pairing semantic inputs with proper labels and native validation provides an accessible user experience.",
            keyPoints: [
                "Always wrap controls in a <form> and pair every input with an accessible <label for=\"...\">.",
                "Use specific type attributes (<input type=\"email\">, type=\"number\") for browser validation and mobile keyboards.",
                "Group related controls using <fieldset> and <legend>.",
                "Align form layouts using display: flex with gap for responsive, well-spaced fields."
            ],
            codeExample: `<form action="/login" method="POST">
  <div class="form-group">
    <label for="email">Email address:</label>
    <input type="email" id="email" name="email" required />
  </div>
  <button type="submit">Log In</button>
</form>`
        }
    },
    CSS: {
        1: {
            title: "CSS Fundamentals & Selectors",
            summary: "CSS determines how HTML elements are styled and presented. Rule sets consist of a selector and a declaration block of property-value pairs.",
            keyPoints: [
                "Class selectors (.class) are reusable, ID selectors (#id) should be unique.",
                "Pseudo-classes like :hover, :focus-visible, and :active create interactive states.",
                "Use CSS custom properties (variables like --primary: #7c3aed) for maintainable themes.",
                "Always check specificity: inline > IDs > classes > elements."
            ],
            codeExample: `:root {
  --primary: #7c3aed;
  --text-main: #0f172a;
}

.card {
  color: var(--text-main);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
}`
        },
        2: {
            title: "Box Model & Sizing",
            summary: "Every HTML element is a rectangular box comprising content, padding, border, and margin. Use box-sizing: border-box universally for intuitive layout calculations.",
            keyPoints: [
                "Always apply *, *::before, *::after { box-sizing: border-box; }.",
                "Padding is internal space; Margin is external breathing room.",
                "Vertical margins on block elements can collapse into each other.",
                "Use rem units for scalable padding and margins."
            ],
            codeExample: `*, *::before, *::after {
  box-sizing: border-box;
}

.box {
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
  margin: 2rem auto;
  border-radius: 16px;
}`
        },
        3: {
            title: "Typography & Text Styling",
            summary: "Typography establishes visual hierarchy and readability. Use font-family, font-size, font-weight, line-height, and letter-spacing to build harmonious typography.",
            keyPoints: [
                "Maintain line-height between 1.4 and 1.6 for body copy readability.",
                "Use clamp() for fluid, responsive typography across device widths.",
                "Never set font-size in px for body text; use rem so user browser preferences are respected.",
                "Use font-display: swap when loading custom web fonts."
            ],
            codeExample: `body {
  font-family: 'Poppins', system-ui, sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  color: #1e293b;
}

h1 {
  font-size: clamp(1.8rem, 4vw + 1rem, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}`
        },
        4: {
            title: "Layouts & Flexbox",
            summary: "Flexbox provides powerful 1-dimensional layout control along a main axis and cross axis. It makes centering and responsive alignment effortless.",
            keyPoints: [
                "display: flex activates flex context on direct child items.",
                "justify-content aligns children along the main axis.",
                "align-items aligns children across the cross axis.",
                "Use gap: 1rem for consistent spacing without margin hacks."
            ],
            codeExample: `.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 2rem;
}

.center-all {
  display: flex;
  justify-content: center;
  align-items: center;
}`
        },
        5: {
            title: "CSS Grid Architecture",
            summary: "CSS Grid is a 2-dimensional layout system that handles both rows and columns simultaneously. It is ideal for complete page structures and component matrices.",
            keyPoints: [
                "repeat(auto-fit, minmax(280px, 1fr)) creates automatic responsive grids without media queries.",
                "Use fr (fractional) units to divide available space proportionally.",
                "grid-template-areas provides clear declarative page layouts.",
                "Combine gap with grid for uniform gutters."
            ],
            codeExample: `.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}`
        },
        6: {
            title: "Transitions, Animations & 3D Transforms",
            summary: "CSS transitions and keyframe animations bring interfaces to life. Hardware-accelerated properties (transform and opacity) deliver smooth 60fps animations.",
            keyPoints: [
                "Only animate transform and opacity for buttery-smooth performance.",
                "Use cubic-bezier easing curves for natural, springy motion.",
                "Always respect user preferences using @media (prefers-reduced-motion: reduce).",
                "Active push-down tactile buttons use transform: translateY() with box-shadow adjustments."
            ],
            codeExample: `.btn-3d {
  transform: translateY(0);
  box-shadow: 0 6px 0 #5b21b6;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-3d:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 #5b21b6;
}`
        }
    },
    JavaScript: {
        1: {
            title: "JavaScript Essentials & Types",
            summary: "JavaScript powers dynamic interactivity on the web. It uses modern ES6 declarations (const and let) and handles primitives and reference types.",
            keyPoints: [
                "Always prefer const by default; use let only when reassignment is needed. Avoid var.",
                "Use strict equality (===) to prevent unexpected type coercion.",
                "Template literals (\`Hello \${name}\`) enable clean multi-line string interpolation.",
                "Nullish coalescing (??) checks specifically for null and undefined."
            ],
            codeExample: `const username = "Learner";
let score = 0;

const greeting = \`Welcome back, \${username}!\`;
const activeStreak = user.streak ?? 1;`
        },
        2: {
            title: "Control Flow, Conditionals & Loops",
            summary: "Control structures guide execution flow based on conditions. Utilize if/else, ternary operators, switch statements, and modern iteration methods.",
            keyPoints: [
                "Use ternary operators (condition ? a : b) for concise expressions.",
                "for...of iterates over array values; for...in iterates over object keys.",
                "Prefer array methods (map, filter, forEach) over traditional for-loops where appropriate.",
                "Always include break statements in switch cases unless intentional fall-through."
            ],
            codeExample: `const status = xp >= 1000 ? "Master" : "Apprentice";

for (const item of items) {
  console.log(item.title);
}`
        },
        3: {
            title: "Functions, Scope & Closures",
            summary: "Functions are first-class citizens in JavaScript. Closures allow inner functions to retain access to variables from their enclosing lexical scope.",
            keyPoints: [
                "Arrow functions (() => {}) inherit the this context of their lexical enclosing scope.",
                "Default parameters (function fn(a = 1)) prevent undefined arguments.",
                "Closures enable private state and data encapsulation.",
                "Pure functions avoid side effects and return consistent results for identical inputs."
            ],
            codeExample: `const createCounter = (initial = 0) => {
  let count = initial;
  return () => ++count;
};

const nextId = createCounter(100);
console.log(nextId()); // 101
console.log(nextId()); // 102`
        },
        4: {
            title: "Strings, Arrays & Destructuring",
            summary: "Modern JavaScript provides expressive methods for arrays and strings, along with powerful destructuring syntax for unpacking values cleanly.",
            keyPoints: [
                "Destructure objects: const { name, xp } = user.",
                "Use the spread operator (...arr) for shallow cloning and merging arrays.",
                "Array methods like map, filter, and reduce enable immutable data processing.",
                "Optional chaining (?.) safely traverses deeply nested properties without crashing."
            ],
            codeExample: `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);

const { username, stats: { level = 1 } = {} } = player;`
        },
        5: {
            title: "Objects & Modern ES6+ Features",
            summary: "Objects map key-value properties. Modern JavaScript offers Object.keys(), Object.entries(), computed property keys, and Set/Map data structures.",
            keyPoints: [
                "Use Object.entries(obj) to iterate through [key, value] pairs.",
                "Set stores unique values, useful for deduplicating arrays: [...new Set(array)].",
                "Map retains insertion order and supports any key data type.",
                "Object.freeze() provides shallow immutability."
            ],
            codeExample: `const uniqueTags = [...new Set(["html", "css", "html", "js"])];

const cache = new Map();
cache.set("user_42", { name: "Alex" });`
        },
        6: {
            title: "DOM Manipulation & Event Handling",
            summary: "The Document Object Model (DOM) is the programming interface for HTML. JavaScript reads and mutates elements and listens for user interactions.",
            keyPoints: [
                "Use querySelector and querySelectorAll for clean CSS-based element targeting.",
                "Attach events with addEventListener; remove them when cleaning up.",
                "Use event delegation on a common parent to handle multiple dynamic children.",
                "Prefer element.classList.toggle() over directly editing element.className."
            ],
            codeExample: `const btn = document.querySelector("#submit-btn");
btn?.addEventListener("click", (event) => {
  event.preventDefault();
  btn.classList.add("active");
});`
        },
        7: {
            title: "Async JavaScript, Promises & Fetch",
            summary: "Asynchronous JavaScript handles non-blocking operations like network requests and timers using Promises and async/await syntax.",
            keyPoints: [
                "Always wrap async/await in try/catch blocks to gracefully catch network errors.",
                "Use Promise.all([p1, p2]) to fetch independent data concurrently.",
                "Check res.ok before parsing res.json() when using the fetch API.",
                "AbortController can cancel in-flight HTTP requests if the component unmounts."
            ],
            codeExample: `async function fetchUserData(userId) {
  try {
    const res = await fetch(\`/api/users/\${userId}\`);
    if (!res.ok) throw new Error("HTTP error " + res.status);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
}`
        }
    }
};
