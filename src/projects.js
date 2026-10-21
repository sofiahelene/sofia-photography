// ── Photography projects ────────────────────────────────────────────────────
// This is the only file to edit when adding or changing photos.
//
// Each project gets a line in the Projects menu and its own page at /<slug>,
// where its photos are shown one under another. The menu follows the order
// of this list.
//
// Photos live in public/projects/<folder>/ — list the file names in the order
// you want them shown. Text is [french, english].
//
// Every photo is shown at the same width so the edges line up. Portrait
// photos are detected automatically and open in a pop-up when clicked.
//
// To shrink one photo (to a bit taller than fits on screen), write it as
// { file: 'name.jpg', fit: true } instead of 'name.jpg'.
//
// To show photos side by side, group them in square brackets:
// ['1.jpg', '2.jpg']. The row spans the same width as the other photos.

export const projects = [
  {
    slug: 'the-caymans',
    title: ['The Caymans', 'The Caymans'],
    folder: 'The Caymans',
    photos: ['1.jpg', '2.jpg', '3.jpg', '5.jpg', '7.jpg'],
  },
  {
    slug: 'la-manif',
    title: ['La Manif', 'La Manif'],
    folder: 'La Manif/web',  // web-sized copies of the originals in La Manif/
    photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg'],
  },
  {
    slug: 'paris',
    title: ['Paris', 'Paris'],
    folder: 'Paris',
    photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.png', '8.jpg', '9.png', '10.png'],
  },
  {
    slug: 'katerina',
    title: ['Katerina', 'Katerina'],
    folder: 'Katerina',
    photos: [['1.jpg', '2.jpg'], '3.jpg', '4.jpg', '5.jpg', '6.jpg', ['7.jpg', '8.jpg'], '9.jpg'],
  },
  {
    slug: 'draculas-town',
    title: ["Dracula's Town", "Dracula's Town"],
    folder: "Dracula's Town",
    photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg'],
  },
  {
    slug: 'canicule',
    title: ['Canicule', 'Canicule'],
    folder: 'Canicule/web',  // web-sized copies of the originals in Canicule/
    photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg'],
  },
];

// ── Landing page grid ───────────────────────────────────────────────────────
// The photos in the home page grid (the ones in the GRID folder), as three
// columns read top to bottom, each photo as [project slug, file]. Hovering a
// photo shows its project's name. The files come from the projects' own
// folders (web-sized copies where a project has them). GRID file names are in
// the comments.
//
// The columns are balanced by photo shape so they end level; the site then
// evens out what's left by trimming a few percent off photos in the shorter
// columns. On phones (2 columns) the photos are re-dealt automatically.
export const gridColumns = [
  [ // left
    ['the-caymans', '1.jpg'],   // "1"
    ['paris', '3.jpg'],         // "3"
    ['la-manif', '3.jpg'],      // "3 2"
    ['the-caymans', '2.jpg'],   // "2 3"
    ['la-manif', '2.jpg'],      // "2 2"
    ['katerina', '1.jpg'],      // "1 2"
    ['la-manif', '9.jpg'],      // "9"
  ],
  [ // middle
    ['paris', '1.jpg'],         // "1 3"
    ['la-manif', '4.jpg'],      // "4"
    ['paris', '2.jpg'],         // "2"
    ['canicule', '3.jpg'],      // "3 4"
    ['draculas-town', '3.jpg'], // "3 3"
    ['the-caymans', '5.jpg'],   // "5"
    ['canicule', '4.jpg'],      // "4 2"
  ],
  [ // right
    ['la-manif', '1.jpg'],      // "1 4"
    ['draculas-town', '1.jpg'], // "1 5"
    ['katerina', '2.jpg'],      // "2 4"
    ['katerina', '5.jpg'],      // "5 2"
    ['canicule', '1.jpg'],      // "1 6"
  ],
];

export const photoSrc = (folder, file) => encodeURI(`/projects/${folder}/${file}`);
