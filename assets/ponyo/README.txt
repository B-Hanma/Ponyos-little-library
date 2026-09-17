assets/ponyo/  —  her pictures live here.

HOW TO ADD THEM
  1. Copy the image files into this folder (.jpg, .jpeg, .png, .webp, .avif).
  2. From the project root, run:      powershell -ExecutionPolicy Bypass -File tools/import-ponyo-images.ps1
  3. Reload the page.

The script writes manifest.json, which is the only thing the app reads.
Nothing else in the app hardcodes a filename, so adding a picture later
never means editing code.

WHAT THE APP DOES WITH THEM
  home       a rotating hero, framed beside the greeting
  dna        framed artwork in her Reading Ocean
  study      the picture on the wall of the research room in Library Mode
  gallery    the picture wall on the ground floor of Library Mode
  anywhere   the fallback if none of the above are tagged

You can steer which picture goes where by naming the file with one of
those words in it, e.g. "study-desk.jpg" or "home-hero.png". Untagged
pictures are used everywhere.

IF THIS FOLDER IS EMPTY
  The app does not break and does not substitute a stock photo of a
  stranger. Every frame falls back to original drawn artwork: an empty
  frame with the little sea creature in it, and a caption saying the
  frame is waiting for a picture.
