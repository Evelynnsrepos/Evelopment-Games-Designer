import { Camera, MessageCircle, Play } from 'lucide-react'
import type { ComponentType } from '@/core/model'

/** In-app user guide. Ships with the app, no network. Plain strings so they can be translated later. */

export interface GuideTopic {
  title: string
  /** Paragraphs. */
  body: string[]
  tips?: string[]
}

export const BASICS: Record<string, GuideTopic> = {
  start: {
    title: 'Getting started',
    body: [
      'Every game you design is a project. Click New Project on the start screen, give it a name and pick the tools you want. You can add more tools later.',
      'A project is a normal folder in Documents/Evelopment Games Designer, full of readable JSON files and an assets folder for images and audio. Back it up like any other folder.',
      'Inside a project, the sidebar on the left lists your tools. Click one to show only that tool; Shift-click to open it next to the ones already open. Tools that hold several documents (boards, maps, timelines…) list them underneath.',
    ],
    tips: ['Questions or ideas? Join the Evelopment Games Discord, linked at the bottom of this list.', 'Press F1 anywhere to open this guide.', 'Use the Projects button at the top of the sidebar to go back to the start screen.'],
  },
  workspace: {
    title: 'Workspace and Layout Mode',
    body: [
      'You can open several tools side by side. Shift-click a tool in the sidebar, or drag a tool or document from the sidebar onto an open panel to split the screen, and drag the dividers to resize.',
      'Press Esc to enter Layout Mode. Every panel shows big buttons to close it or move it around. Layout Mode ends after your next click or key press.',
      'Single-letter shortcuts only work in the panel you clicked last, so typing in one tool never triggers another.',
    ],
    tips: ['Collapse the sidebar with the button at its bottom to get more room.', 'On drawing canvases, the Size and Smoothing sliders appear in the bottom toolbar while the pen is selected. More smoothing irons out shaky lines.'],
  },
  tools: {
    title: 'Adding and closing tools',
    body: [
      'Add tool at the bottom of the sidebar is always there. Click it to add any tool your project does not have yet.',
      'Right-click a tool in the sidebar and choose Close tool. Hide removes it from the sidebar but keeps everything you made in it. Delete contents removes the tool and everything in it; the red button has to be pressed twice, and this cannot be undone.',
      'If you add a hidden tool again, the app asks whether to bring its contents back or delete them and start empty (again with the red button pressed twice).',
    ],
  },
  saving: {
    title: 'Saving, undo and backups',
    body: [
      'There is no Save button. Everything saves about a second after you change it, and again when you close the app.',
      'Every tool has its own undo and redo: Ctrl+Z and Ctrl+Y (Cmd on a Mac).',
      'The app keeps rolling backups of your last 10 saves. On the start screen, open a project card menu (…) and choose Restore a backup.',
      'To back up a whole project or send it to someone, open its card menu (…) and choose Export as zip. Import zip on the start screen brings it back as a new project.',
    ],
  },
  spelling: {
    title: 'Spell check and the AI helper',
    body: [
      'Text editors underline misspelled words in English and German. Click an underlined word for a card with up to 3 fixes, Dismiss and Add to dictionary.',
      'Names of your items, characters, towns and enemies are always counted as correct, so your made-up names are not flagged.',
      'Settings (bottom of the sidebar, or the gear on the start screen) turns spell check on or off, picks the languages and lists your own words.',
      'The AI helper is optional. Download it in Settings: Small (1.1 GB, fast) or Better (2.5 GB, catches more). It runs on your computer and checks grammar as you write: wrong words for the sentence, verb forms, missing commas. Its suggestions get a blue underline. Click one for a card with what is wrong and up to 3 fixes, or Dismiss it. Spell check and the AI helper work in the Writer, the Wiki and the description and notes boxes.',
    ],
  },
  plugins: {
    title: 'Plugins',
    body: [
      'Plugins add new tools made by other people. Open Settings, paste the link of a plugin on GitHub and press Install, or use Install from zip.',
      'Only install plugins you trust. A plugin is a program with full access to your computer, and in projects you share with others it can change things your teammates do not expect.',
      'An installed plugin appears in Add tool like any other tool. Remove it in Settings; what you made with it stays in your project.',
    ],
  },
  links: {
    title: 'Links and categories',
    body: [
      'Type [[ in the Wiki, Writer, Story Branch Writer or Timeline to link to an article, item, character, town or enemy. Links follow renames.',
      'Custom categories such as Element or Faction are created once and shared by the Item, Character, Town and Enemy lists.',
      'Rarities: click Rarities at the bottom of the sidebar. Rarity comes ready from Common to Legendary; change names, colors, borders (or switch them off), icons or your own pictures, and a rating as 1 to 5 stars or a number.',
      'Add more systems next to Rarity, like Tier or Quality, each on the lists you choose, and give a system your own fields (drop rate, sell price…) to fill in per rarity. Rarities show on cards, in tables, on pages, in the wiki and in [[links]].',
      'Before you delete something, the app shows every place it is used, so nothing breaks silently.',
    ],
  },
  together: {
    title: 'Working together',
    body: [
      'Several people can edit one project at the same time, each on their own computer, on Windows, Mac or Linux. There is no account: the computers connect directly, or through a server if your team runs one (see the end of this page).',
      'To invite someone, open the project and click Work together at the bottom of the sidebar. Enter your name, pick a color and click Share project. Copy the invite code and send it to your teammate.',
      'Your teammate clicks Join project on their start screen, pastes the code and picks a folder. You are asked to let them in. After that, the project is copied to their computer and changes show up for both of you within a moment.',
      'You see where the others are: colored dots in the sidebar show who is in which tool, canvases show their pointer and what they selected, and in the Writer and Wiki you type in the same text live and see their cursor.',
      'Everyone keeps a full copy. If you work offline, your changes are saved as usual and merge automatically the next time you are both online. Undo only takes back your own changes.',
      'Each person keeps their own panel layout and sidebar. The tools, documents and everything in them are shared, except Sketch drawings: those stay on each computer. Pictures made from them, like stickers on a Moodboard, are shared.',
      'The person who shared the project is the host. When the host closes the project or stops sharing, everyone else is disconnected and asked whether to keep their copy as a normal project or delete it.',
      'Only the host can remove people. Everyone else can Leave project, keeping or deleting their copy.',
      'Privacy: computers connect directly, so the people you work with can see your IP address. When a direct connection is not possible, the encrypted traffic goes through public relay servers run by n0, a US company (the makers of iroh). The project contents stay end-to-end encrypted on the way.',
      'Working through a server: an Evelopment Games Designer Server keeps a copy of the project, so people can join and catch up even when nobody else is online. Each person gets their own connect code (it starts with EGS1-) from the server\'s admin page. A code can be for editing or view only.',
      'To join a project on a server, click Join project on the start screen and paste your connect code. To put the open project on a server, open Work together, click Or work through a server, paste a connect code and click Move to server. People you shared with directly then need their own connect code.',
      'With a server, the Work together window shows the server\'s name and who is online now. Only the server\'s admin can remove people or close the project. The project is stored on that server, so whoever runs it can read it: only use servers you trust.',
      'A server can offer plugins. Click Review to see each one with the usual plugin warning; nothing installs by itself, and a plugin that changes on the server asks again.',
    ],
    tips: [
      'Without a server, the project has to be open on at least one computer that is already in it when someone joins or catches up.',
      'Making a new invite code stops older codes from working. Removing someone from the list stops their computer from connecting; they keep their copy.',
    ],
  },
  search: {
    title: 'Search (Ctrl+K) and the Design Book',
    body: [
      'Press Ctrl+K (Cmd+K on a Mac) anywhere in a project to search tools, documents, items, characters, towns, enemies, wiki articles and commands like Settings. Enter opens the result alone, Shift+Enter opens it next to the open tools.',
      'Design Book at the bottom of the sidebar turns your project into one game design document with a cover, contents, images and info boxes. Pick the parts and entries to include, then save it as a web page or print it; choose Save as PDF as the printer for a PDF.',
    ],
  },
  look: {
    title: 'Project look (theming)',
    body: [
      'Each project can have its own look. Click Project look at the bottom of the sidebar.',
      'Accent changes buttons and highlights. Background recolors every panel; text switches between light and dark automatically so it stays readable.',
      'Wallpaper puts an image behind the whole editor. Once one is set you can blur, dim and tint it, change its contrast, and lower Panel opacity to let it shine through.',
      'Default resets one color, Reset all removes the project theme. The light/dark switch on the start screen still sets the base theme for every project.',
    ],
  },
}

export const TOOL_GUIDE: Record<ComponentType, GuideTopic> = {
  'item-list': {
    title: 'Item List',
    body: [
      'Every item in your game in one table: image, rarity, value, stats and your own custom categories.',
      'Click New item to create one, then fill in its details. Each item shows which enemies drop it, taken from the Enemy List.',
    ],
    tips: ['Items can be linked with [[links]] and turned into a Wiki article with a live info box.'],
  },
  'character-list': {
    title: 'Character List',
    body: [
      'Characters with portraits, family, nation, clan, race and links to other characters.',
      'Relations are stored by reference, so renaming a character updates it everywhere.',
    ],
  },
  'town-list': {
    title: 'Town List',
    body: [
      'Towns with nation, race, religion and links.',
      'Cities you place in the Map Creator are towns from this list, so a town and its map city are always the same thing.',
    ],
  },
  'enemy-list': {
    title: 'Enemy List',
    body: [
      'Enemies with combat stats, growth per level, resistances, drop tables and where they are found.',
      'Drop tables point at items from the Item List. The Level and Resource Calculators can use your enemies directly.',
    ],
  },
  wiki: {
    title: 'Wiki',
    body: [
      'Your lore wiki. Write articles and link them with [[Article name]].',
      'You can make an article from any item, character, town or enemy; it gets an info box that always shows the current data.',
      'Each article lists its backlinks, and the connection map shows how everything links together.',
    ],
  },
  writer: {
    title: 'Writer',
    body: [
      'Rich text documents for design docs, scripts and dialogue, with headings, lists, images and [[links]].',
      'The word count updates as you type, and you can export a document as Markdown or plain text.',
    ],
  },
  'story-writer': {
    title: 'Story Branch Writer',
    body: [
      'A mind-map for branching stories. Create nodes, branch them, connect them to each other and sever connections.',
      'Like every canvas tool it has a bottom toolbar; hover a button to see its shortcut letter.',
    ],
    tips: ['Pan with the middle mouse button or Space+drag, zoom with the mouse wheel.'],
  },
  timeline: {
    title: 'Timeline',
    body: [
      'Timelines with optional years and events that can hold images.',
      'Press B to start a branch for an alternative history. Pressing a tool shortcut again returns to the select tool.',
    ],
    tips: ['Pan with the middle mouse button or Space+drag, zoom with the mouse wheel.'],
  },
  moodboard: {
    title: 'Moodboard',
    body: [
      'Collect images, cutouts, text and shapes. Cutouts can be shapes or a freehand lasso.',
      'The layers panel (button in the bottom toolbar) lets you reorder everything, and an always-on-top layer keeps your drawings above the images.',
      'The brush button opens your drawings from the Sketch tool. Click one to place it as a sticker; transparent parts stay see-through. Double-click to edit it in Sketch.',
    ],
    tips: ['Drop image files straight onto the board.', 'Design Language works exactly the same way, for pinning down the look of your game.'],
  },
  brainstorm: {
    title: 'Brainstorm Board',
    body: [
      'A free board for ideas: drawing, sticky notes, shapes, images, audio clips and voice recordings.',
      'Pin notes and connect pins with string, and group things in named, colored areas.',
    ],
    tips: ['Hover a toolbar button to see its shortcut letter.'],
  },
  map: {
    title: 'Map Creator',
    body: [
      'Draw maps with cities, streets and terrain stamps such as mountains, forests, water and deserts.',
      'Every city is a town from the Town List. Export the finished map as a PNG.',
    ],
  },
  cosmos: {
    title: 'Cosmos Creator',
    body: [
      'Mark out where everything is in the universe you are creating: universes, galaxies, nebulae, star clusters, solar systems, stars, black holes, planets, moons, asteroid belts, comets and stations.',
      'The list on the left shows everything nested inside each other. Drag an entry onto another to move it inside, or onto the empty space below to move it to the top level.',
      'The middle is an isometric view. At the top level, and inside universes, nebulae and star clusters, everything is drawn as a node graph: lines connect each body to what is inside it.',
      'Double-click a galaxy or a solar system to see its orbits. Moons circle their planets. Click to select, double-click to look inside, and use the breadcrumb or the up arrow to go back out.',
      'Add places a new body where you are looking; it picks a sensible kind (planets in a solar system, moons around a planet) and you can choose another in the drop-down. Give each body a name, a color, a picture of your own and notes on the right.',
    ],
    tips: ['Each cosmos is its own document, so you can keep several (for example one per game or era).', 'Ctrl+Z undoes, including deletes.'],
  },
  sketch: {
    title: 'Sketch',
    body: [
      'Draw and paint like in Procreate. Pick a canvas size when you start a new drawing.',
      'Brushes: Pencil, Ink, Marker, Paint and Airbrush. With a pen tablet, pressing harder makes lines thicker or stronger. Size, opacity and smoothing are on the right; [ and ] change the size.',
      'Layers have opacity, blend modes (Multiply, Screen, Overlay and more), alpha lock (paint only on what is there), clipping masks, duplicate, merge down and reordering. Double-click a layer to rename it.',
      'Selection: lasso (L) or rectangle (M). Painting, fill, clear, flip and move (V) only affect the selection. Ctrl+D deselects.',
      'QuickShape: draw a rough line, circle, rectangle or triangle and keep holding at the end. It snaps to a clean shape; keep holding and drag to resize it, and hold Shift for a perfect one (straight 15° lines, circles, squares). This works with the pen on every canvas too.',
      'Mirror draws left/right, top/bottom or four ways at once. The eyedropper (I, or hold Alt) picks a color from the picture.',
      'Insert an image as a new layer, or add a reference image that floats over the canvas without being part of the picture; references can come from any image in the project.',
      'Export as PNG, or use Send to… to put the picture on a Moodboard, a Design Language board or into the Asset Pool.',
    ],
    tips: ['Space or the middle mouse button pans, the mouse wheel zooms, 0 fits the canvas into view.', 'Ctrl+Z undoes strokes. Everything saves by itself a moment after you stop drawing.'],
  },
  'design-language': {
    title: 'Design Language',
    body: [
      'Pin down the look of your game: style references, color swatches, shapes and examples of what fits and what does not.',
      'It works exactly like a Moodboard: add images, cut them out, draw, write notes, and use layers.',
      'The brush button opens your drawings from the Sketch tool; click one to place it as a sticker. Pictures sent from Sketch land here too.',
    ],
  },
  'asset-pool': {
    title: 'Asset Pool',
    body: [
      'Track every asset the game still needs: icons, sprites, 3D models, animations, sounds, music, UI and effects.',
      'Add many… makes one asset for every item, character, town or enemy that does not have one of that kind yet, or one per line of a pasted checklist.',
      'Click the status to move an asset from Needed to In progress, Review and Done; the bar at the top shows how much is done.',
      'Select an asset to add notes and pictures. Assets made from an item or character keep its name when you rename it, and Open jumps to it.',
    ],
    tips: ['Send a drawing from the Sketch tool to the Asset Pool: it is attached to the selected asset, or becomes a new one.'],
  },
  'damage-calculator': {
    title: 'Damage Calculator',
    body: [
      'A library of damage formulas grouped by game type: elemental reactions, armor, crits, damage over time, resistances and more.',
      'Pick a formula, enter values and see the result, or write your own formulas. Each preset is its own document.',
    ],
  },
  'level-calculator': {
    title: 'Level Calculator',
    body: [
      'Design XP curves and stat growth, and see damage per level against a fixed defense or an enemy from your Enemy List.',
    ],
  },
  'resource-calculator': {
    title: 'Resource Calculator',
    body: [
      'Work out how many resources and how much play time a goal takes, using level-up costs and enemy drop rates.',
    ],
  },
  'wave-planner': {
    title: 'Wave Planner',
    body: [
      'Plan the waves of a wave or tower-defense mode. Set the number of waves, how long each one lasts and how fast enemy health grows: by a percent, a flat amount or by the level growth set on each enemy.',
      'Add enemies from the Enemy List or as custom enemies, with how many come in the first wave, how many more each wave, and from which to which wave. "Every 5 waves" makes a boss wave.',
      'The chart and the wave-by-wave table show total health, the damage per second needed to clear each wave in time, and the expected drops.',
      'Pick weapons from the Item List to see up to which wave each one is strong enough.',
    ],
  },
  quests: {
    title: 'Quest Designer',
    body: [
      'Write quests with a type (main, side, daily, event), a quest giver, a place, a level, objectives and rewards in XP, gold and items.',
      'Objectives point at your characters, enemies, items and towns: talk to, defeat, collect, go to, or anything else in your own words.',
      'Requires links quests into chains. Quest chains shows them as a graph, and the app stops you from making a loop. Each quest also shows what the whole chain up to it gives.',
      'Flags are game-state values like met_the_king or reputation. A quest can start only if a flag has a value and set flags when it is done. The Dialogue Editor uses the same flags.',
    ],
  },
  dialogue: {
    title: 'Dialogue Editor',
    body: [
      'A conversation is a set of lines, shown as a graph. Each line has a speaker (a character or any name) and what is said, then either goes on to the next line, ends, or offers the player choices.',
      'Lines and choices can depend on flags (only said if, only offered if) and change flags when said or picked. Lines that nothing leads to are marked.',
      'Play runs through the conversation like the player would, showing the flags as they change.',
      'Export saves the conversation as JSON, Yarn Spinner or Ink, ready for your engine.',
    ],
  },
  gacha: {
    title: 'Gacha & Loot Simulator',
    body: [
      'Banner: set the tiers and their rates (or use the project rarities), hard and soft pity, the featured chance and the guarantee after losing a 50/50, and how many featured copies you want.',
      'The simulator plays thousands of players and shows the average pulls, how many pulls 50, 90 and 99% of players need, what that costs, and a chart of players done by pull.',
      'Chest / drop table: list what can drop, either one entry picked by weight or each entry with its own chance, or load an enemy drop table. Mark one entry as the target to see its chance per opening and how many openings a 50, 90 or 99% chance takes.',
    ],
  },
  spreadsheet: {
    title: 'Spreadsheet',
    body: [
      'Works like Excel. Click a cell and type; start with = for a formula, like =SUM(A1:A10) or =IF(B2>100, "rich", "poor"). Hundreds of Excel functions work, including VLOOKUP, SUMIF, ROUND, DATE and TEXT.',
      'While writing a formula, click or drag over cells to put their address in, even on another sheet. Sheets reference each other with Sheet2!A1. Add sheets with the + at the bottom; double-click a tab to rename it, right-click to move or delete it.',
      'Drag the small square at the corner of the selection to fill: numbers and dates continue their step, "Wave 1" becomes "Wave 2", month and weekday names keep going, and formulas move their cell references along. Double-click it to fill down as far as the column next to it goes. Ctrl+D and Ctrl+R fill down and right.',
      'The toolbar sets bold, italic, underline, text and fill colors, alignment, number formats (number, percent, currency, date, text) with decimals, and borders with a thickness and color. Right-click a row or column header to insert or delete; drag a header edge to resize; right-click a selection to sort it.',
      'Damage Calculator results can live in a cell: drag a Damage Calculator preset from the sidebar onto a cell, or use Calculator in the toolbar. The cell shows =CALC("Preset name"). The panel that opens lets you take any calculator input from a cell, so the sheet can run the formula for every row.',
    ],
    tips: ['Copy and paste work with other programs too; pasted text with tabs fills several cells.', 'Select numbers to see their sum, average and count at the bottom right.'],
  principles: {
    title: 'Writing Principles',
    body: [
      'A collection of rules for good stories and game writing, ready to use: show, don’t tell; setup and payoff; information theory; save the player from themselves; and more, each with what it means and often an example.',
      'Story structures such as the Hero’s Journey, the three-act structure, the story circle, Save the Cat, Kishōtenketsu, the seven-point structure and Freytag’s pyramid are listed as numbered steps.',
      'Make it yours: add principles and categories, edit or delete any entry, star the ones that matter for your game, and sort by your own order, A to Z or starred first. Deleted built-in entries can be brought back with Restore.',
    ],
  'gameplay-loop': {
    title: 'Gameplay Loop',
    body: [
      'Map the loop your players repeat, like explore, fight, loot, upgrade. Each step sits on a circular timeline; the arrows show the direction the loop runs.',
      'Click a step to flesh it out: its type (action, challenge, reward, progression, social, rest), what the player does, what it gives them, how many minutes it takes and notes. Move steps earlier or later around the circle.',
      'Turn on Size steps by time to make the circle a real timeline: each step takes up as much of the circle as it takes time in the game.',
      'Add branches to a step for ideas, variants or open questions, and branch off branches for more detail. Make several documents for different loops, like a core loop, a session loop and a long-term loop.',
    ],
    tips: ['Scroll to zoom and drag the empty space to move around.'],
  },
  reviews: {
    title: 'Reviews',
    body: [
      'Every tool window and every item, character, town and enemy has a small Review button. Give it a status (Idea, Draft, In review, Approved, Final) or write a comment.',
      'On the Brainstorm Board, Moodboard, Design Language and Map, the Comment tool in the bottom toolbar pins a comment to a spot: click to drop a pin and write, click a pin to read and answer.',
      'The Reviews tool shows everything with a status or comments as a board. Needs review only shows what is waiting for review or has open comments. Click a card to read and answer the comments, or Open to jump there.',
      'Resolve a comment when it is done; resolved comments are hidden until you show them. When working together, everyone sees the same statuses and comments.',
    ],
  },
}

/** Where to find the developer, Evelopment Games. */
export const COMMUNITY_LINKS = [
  { label: 'Discord', url: 'https://discord.gg/AGfaBwNKfN', icon: MessageCircle },
  { label: 'YouTube', url: 'https://www.youtube.com/@EvelopmentGames', icon: Play },
  { label: 'Instagram', url: 'https://www.instagram.com/evelopmentgames/', icon: Camera },
]
