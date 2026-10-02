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
      'Text editors underline misspelled words in English and German. Right-click an underlined word for suggestions or choose Add to dictionary.',
      'Names of your items, characters, towns and enemies are always counted as correct, so your made-up names are not flagged.',
      'Settings (bottom of the sidebar, or the gear on the start screen) turns spell check on or off, picks the languages and lists your own words.',
      'The AI helper is optional. Download it in Settings (about 1.1 GB). It runs on your computer and adds Ask the AI helper to the right-click menu, which picks the spelling that fits the sentence.',
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
      'Before you delete something, the app shows every place it is used, so nothing breaks silently.',
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
      'The layers panel lets you reorder everything, and an always-on-top layer keeps your drawings above the images.',
    ],
    tips: ['Drop image files straight onto the board.'],
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
}

/** Where to find the developer, Evelopment Games. */
export const COMMUNITY_LINKS = [
  { label: 'Discord', url: 'https://discord.gg/AGfaBwNKfN', icon: MessageCircle },
  { label: 'YouTube', url: 'https://www.youtube.com/@EvelopmentGames', icon: Play },
  { label: 'Instagram', url: 'https://www.instagram.com/evelopmentgames/', icon: Camera },
]
