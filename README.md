GitHub Repository of QuizWeb

**NextJs Format**
*Important* = npm install
*Pag run* = npm run dev

**Files and meaning**
*Main file per page/folder*
page.tsx = index.html (follow nyo nlng ung format ng nasa app folder)
layout.tsx = dto babasahin ni nextjs ung pag display ng page (follow nyo nlng ung nasa app folder din)

globals.css = gagamitin na css ng lahat ng page
favicon.ico = logo sa tab ng browser

**Changes from normal html and nextjs**
*hindi na 'class', 'className' na ang palit*

ONLY DO ".(style name)" dont css the tag itself, have a className

*Pag gamit ng styles* 
import (var name ex. styles) from "(relative directory)";

Old: <div class="sample">
New: <div className={styles.sample}>

Old: <div id="sample">
New: <div id={styles['sample']}>

*Pag gamit ng Image*
import Image from "next/image";

Old: <img class="sample">
New: <Image className="sample" width={100} height={100}

Need ng width and height para ma display nya, pwede din na 0 ung value kung iibahin mo sya sa css

*Pag comment*
{/* Commented text */}

*Folders and Meaning*
public = for css and images only
utils = for scripts
components = for parts ng pages na need gamitin paulit-ulit tulad ng navbar
lib = for backend scripts
auth = for authentication scripts

Want new page? create folder in app and have page.tsx and layout.tsx

If have question, go chat me

- Pat
