/**
 * Curriculum Section Descriptions
 *
 * Canonical descriptions for all 16 curriculum sections across HTML, CSS, and JavaScript.
 * Section descriptions provide learners with concise overviews of learning outcomes.
 */

export const CANONICAL_SECTION_DESCRIPTIONS: Record<number, string> = {
  // HTML (Beginner)
  1: "Learn how an HTML page is built, from the doctype and the head/body skeleton to basic text like headings, paragraphs and lists.",
  2: "Connect pages to each other and to the outside world with links, then add images, audio, video and embedded content.",
  3: "Organize a page with meaningful semantic tags, and use div and span with classes and ids to group and label content.",

  // CSS (Beginner)
  4: "Learn how to pick elements with selectors, add CSS to a page in three ways, and style hover, focus and position states.",
  5: "Understand that every element is a box with content, padding, border and margin, and control how big those boxes are.",
  6: "Make a page look good with colors, backgrounds, gradients and opacity, plus fonts, text size, alignment and spacing.",
  7: "Control how elements sit on the page using display and position, then line them up with the basics of flexbox.",

  // JavaScript (Intermediate)
  8: "Store data in variables, learn the main data types, and combine values with operators.",
  9: "Make decisions with if and switch, and repeat code with loops.",
  10: "Package code into reusable functions, then write them in shorter forms with function expressions and arrow functions.",
  11: "Use newer shortcuts such as template literals, destructuring, spread and rest to write cleaner code.",
  12: "Work with groups of data using arrays, array methods like map and filter, and objects.",

  // CSS (Advanced)
  13: "Build complex, responsive page structures with CSS Grid, multi-column layouts, and advanced flex alignments.",
  14: "Bring interfaces to life with smooth transitions, keyframe animations, transforms, and responsive finishing touches.",

  // JavaScript (Advanced)
  15: "Select page elements, change them with JavaScript, and respond to user actions like clicks and form input.",
  16: "Read and write JSON, fetch data from an API, and show that data on the page.",
};

/**
 * Returns the description for a given section ID, or a fallback if not found.
 */
export function getSectionDescription(secId: number | string): string {
  const id = Number(secId);
  return (
    CANONICAL_SECTION_DESCRIPTIONS[id] ??
    "Master essential web development skills and hands-on coding techniques."
  );
}
