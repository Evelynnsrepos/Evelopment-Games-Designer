/**
 * The principles and story structures a new project starts with. Written for
 * this app in plain words; users can change, add, sort and delete them.
 */

export interface SeedCategory {
  id: string
  name: string
  kind: 'rules' | 'structure'
  about: string
  items: { title: string; text: string; example?: string }[]
}

export const SEED: SeedCategory[] = [
  {
    id: 'story',
    name: 'Storytelling',
    kind: 'rules',
    about: 'Rules most good stories follow, in books, films and games.',
    items: [
      {
        title: 'Show, don’t tell',
        text: 'Let the audience see things happen and draw their own conclusions instead of being told what to think or feel. A trembling hand says more than “she was nervous”.',
        example: 'Instead of a guard saying the king is cruel, the player walks past an empty market square and a row of cages.',
      },
      {
        title: 'Every story needs conflict',
        text: 'Someone wants something and something stands in the way. Without an obstacle there is no story, only a description.',
      },
      {
        title: 'Want versus need',
        text: 'A character chases what they want (revenge, gold, the crown) but grows by getting what they need (forgiveness, friends, humility). The gap between the two is the arc.',
      },
      {
        title: 'Stakes: what is lost if they fail?',
        text: 'Make clear what happens when the hero fails, and make it personal. A threatened world matters less than a threatened sister.',
      },
      {
        title: '“Therefore” and “but”, never “and then”',
        text: 'Scenes should connect through cause and effect: this happened, therefore that; or this happened, but then that. A list of “and then” events feels random.',
      },
      {
        title: 'Setup and payoff',
        text: 'Plant things early that matter later, and pay off what you plant. A sword on the wall in act one should be swung by act three (Chekhov’s gun). Payoffs without setups feel cheap.',
      },
      {
        title: 'No rescue from nowhere',
        text: 'Heroes should solve the final problem through their own choices and growth, not luck or a sudden new power (deus ex machina). Coincidence may get characters into trouble, never out of it.',
      },
      {
        title: 'Active protagonist',
        text: 'The hero makes decisions that drive the story instead of things only happening to them.',
      },
      {
        title: 'Flaws make characters',
        text: 'Perfect characters are boring. Give heroes real flaws that cost them something and villains reasons that make sense to them.',
      },
      {
        title: 'Enter late, leave early',
        text: 'Start a scene as close to its point as possible and end it as soon as the point is made.',
      },
      {
        title: 'Every scene changes something',
        text: 'If a scene can be cut without the story changing, cut it or give it a turn: new information, a decision, a loss or a gain.',
      },
      {
        title: 'Tension and release',
        text: 'Alternate hard moments with quiet ones. Without rest the audience goes numb; without tension they get bored.',
      },
      {
        title: 'Theme is a question',
        text: 'A theme is a question the story keeps asking, like “is loyalty worth it?”. Characters answer it in different ways; the ending gives the story’s answer.',
      },
      {
        title: 'Specific beats generic',
        text: 'Concrete details (a chipped blue mug, a song only one town sings) make a world feel real. Vague words like “ancient evil” make it feel like every other story.',
      },
      {
        title: 'Rule of three',
        text: 'Things in threes feel complete: three trials, three warnings, a pattern set up twice and broken on the third time.',
      },
      {
        title: 'Kill your darlings',
        text: 'Cut the scene, line or character you love most if it does not serve the story. Keep it in a notes file if it hurts.',
      },
    ],
  },
  {
    id: 'game',
    name: 'Game narrative',
    kind: 'rules',
    about: 'What is different when the audience is holding the controller.',
    items: [
      {
        title: 'Information theory: give players what they need, when they need it',
        text: 'Players can only take in so much at once. Do not front-load names, places and history; give each piece of information right before it becomes useful, and let the rest be found by those who look. Every proper noun in the opening is a cost.',
        example: 'Teach the name of the rebel leader when the player is about to meet her, not in the opening crawl.',
      },
      {
        title: 'Save the player from themselves',
        text: 'Players will do things they regret. Warn before choices that cannot be undone, save before bosses and point-of-no-return moments, never let them sell a quest item or soft-lock the game, and make dangerous actions hard to trigger by accident.',
        example: '“You will not be able to return to the village. Continue?” and an autosave right before the bridge collapses.',
      },
      {
        title: 'Story and gameplay should agree',
        text: 'If the story says the hero is a pacifist, the game should not reward killing (ludonarrative dissonance). The best stories are told through what the player does.',
      },
      {
        title: 'Environmental storytelling',
        text: 'Rooms, objects and leftovers tell stories without a word: a barricaded door, two skeletons holding hands, a half-written letter.',
      },
      {
        title: 'Choices need consequences',
        text: 'A choice matters when the player can see what it changed, even in small ways. Fake choices are noticed and resented.',
      },
      {
        title: 'Respect the player’s time',
        text: 'Let players skip cutscenes and dialogue they have seen, keep important lines short, and never make them watch the same thing twice.',
      },
      {
        title: 'Iceberg lore',
        text: 'Keep the main path simple and put depth below the surface (item texts, books, optional characters) for players who want it.',
      },
      {
        title: 'Let the player be the hero',
        text: 'Big moments should be things the player does, not things they watch. Avoid cutscenes where the character does something cooler than the player ever could.',
      },
      {
        title: 'Teach through play',
        text: 'Introduce each mechanic in a safe space where it is the only thing to do, then test it, then combine it with others. Text boxes come last.',
      },
      {
        title: 'Consistent rules',
        text: 'Once the world has rules (magic costs blood, the dead stay dead), keep them. Breaking a rule for drama breaks trust.',
      },
      {
        title: 'Repetition needs variety',
        text: 'Lines that repeat (barks, shop greetings) need several versions, or players will hear the same sentence a hundred times.',
      },
    ],
  },
  {
    id: 'dialogue',
    name: 'Dialogue',
    kind: 'rules',
    about: 'Making characters sound like people.',
    items: [
      { title: 'Short lines win', text: 'People rarely speak in paragraphs. Cut every line in half, then see if it still works.' },
      { title: 'Each character has a voice', text: 'Cover the names: you should still know who is speaking from word choice, rhythm and what they care about.' },
      { title: 'No “as you know”', text: 'Characters should not tell each other things they both already know just to inform the player.' },
      { title: 'Subtext', text: 'People rarely say exactly what they mean. Let what is left unsaid carry the emotion.' },
      { title: 'Read it out loud', text: 'If it is hard to say, it will sound wrong when voiced and feel wrong when read.' },
    ],
  },
  {
    id: 'heros-journey',
    name: 'Hero’s Journey',
    kind: 'structure',
    about: 'Joseph Campbell’s monomyth in the 12 stages Christopher Vogler made popular. Fits adventures and RPGs.',
    items: [
      { title: 'Ordinary world', text: 'The hero’s normal life, showing what they lack and what is at stake.' },
      { title: 'Call to adventure', text: 'Something disrupts the normal world and offers a quest.' },
      { title: 'Refusal of the call', text: 'Fear or duty makes the hero hesitate.' },
      { title: 'Meeting the mentor', text: 'Someone gives advice, training or a gift that helps the hero commit.' },
      { title: 'Crossing the threshold', text: 'The hero leaves the known world and enters the adventure.' },
      { title: 'Tests, allies, enemies', text: 'The hero learns the new world’s rules and finds out who to trust.' },
      { title: 'Approach to the inmost cave', text: 'Preparation for the biggest challenge; doubts return.' },
      { title: 'The ordeal', text: 'The hero faces their greatest fear or a near-death moment.' },
      { title: 'Reward', text: 'Having survived, the hero gains the treasure, knowledge or reconciliation.' },
      { title: 'The road back', text: 'The hero heads home, often chased by the consequences of the ordeal.' },
      { title: 'Resurrection', text: 'A final test where the hero must use everything they learned; they are changed.' },
      { title: 'Return with the elixir', text: 'The hero comes home with something that improves the ordinary world.' },
    ],
  },
  {
    id: 'three-act',
    name: 'Three-act structure',
    kind: 'structure',
    about: 'The classic beginning, middle and end, used by most films.',
    items: [
      { title: 'Act 1: Setup', text: 'Introduce the hero, their world and the problem. Ends with an inciting incident and a decision to act (about the first quarter).' },
      { title: 'Act 2: Confrontation', text: 'Rising obstacles, a midpoint twist that raises the stakes, and a low point where all seems lost (about half the story).' },
      { title: 'Act 3: Resolution', text: 'The climax where the main conflict is decided, then a short ending that shows the new normal.' },
    ],
  },
  {
    id: 'story-circle',
    name: 'Story circle',
    kind: 'structure',
    about: 'Dan Harmon’s simplified hero’s journey in eight steps. Great for quests and episodes.',
    items: [
      { title: 'You', text: 'A character in a zone of comfort.' },
      { title: 'Need', text: 'But they want something.' },
      { title: 'Go', text: 'They enter an unfamiliar situation.' },
      { title: 'Search', text: 'They adapt to it.' },
      { title: 'Find', text: 'They get what they wanted.' },
      { title: 'Take', text: 'They pay a heavy price for it.' },
      { title: 'Return', text: 'They return to their familiar situation.' },
      { title: 'Change', text: 'Having changed.' },
    ],
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat beats',
    kind: 'structure',
    about: 'Blake Snyder’s beat sheet: where key moments land in a story.',
    items: [
      { title: 'Opening image', text: 'A snapshot of the hero before the change.' },
      { title: 'Theme stated', text: 'Someone hints at the lesson the hero must learn.' },
      { title: 'Setup', text: 'The hero’s world, flaws and what needs fixing.' },
      { title: 'Catalyst', text: 'The event that starts the story.' },
      { title: 'Debate', text: 'The hero doubts whether to act.' },
      { title: 'Break into two', text: 'The hero chooses to enter the new world.' },
      { title: 'B story', text: 'A second plot, often a relationship, that carries the theme.' },
      { title: 'Fun and games', text: 'The promise of the premise: what the audience came for.' },
      { title: 'Midpoint', text: 'A false victory or false defeat that raises the stakes.' },
      { title: 'Bad guys close in', text: 'Outside pressure and inside doubts grow.' },
      { title: 'All is lost', text: 'The lowest point; often something or someone is lost.' },
      { title: 'Dark night of the soul', text: 'The hero processes the loss and finds the lesson.' },
      { title: 'Break into three', text: 'With the lesson learned, the hero finds the solution.' },
      { title: 'Finale', text: 'The hero proves they have changed and wins (or loses meaningfully).' },
      { title: 'Final image', text: 'A mirror of the opening image showing the change.' },
    ],
  },
  {
    id: 'kishotenketsu',
    name: 'Kishōtenketsu',
    kind: 'structure',
    about: 'A four-part structure from Chinese and Japanese storytelling that works without conflict, through contrast and surprise. Good for cozy and slice-of-life games.',
    items: [
      { title: 'Ki: introduction', text: 'Introduce the characters and setting.' },
      { title: 'Shō: development', text: 'Develop them; nothing dramatic needs to happen.' },
      { title: 'Ten: twist', text: 'Something unexpected or seemingly unrelated appears.' },
      { title: 'Ketsu: conclusion', text: 'The twist and the earlier parts come together into a new understanding.' },
    ],
  },
  {
    id: 'seven-point',
    name: 'Seven-point structure',
    kind: 'structure',
    about: 'Dan Wells’ structure: plan the ending first, then mirror it in the beginning.',
    items: [
      { title: 'Hook', text: 'The hero’s starting state, the opposite of the resolution.' },
      { title: 'Plot turn 1', text: 'The call that sets the story going.' },
      { title: 'Pinch 1', text: 'Pressure from the antagonist forces the hero to act.' },
      { title: 'Midpoint', text: 'The hero stops reacting and starts acting.' },
      { title: 'Pinch 2', text: 'Things get worse; the plan fails or help is lost.' },
      { title: 'Plot turn 2', text: 'The hero finds the last piece needed to win.' },
      { title: 'Resolution', text: 'The climax, and the end state that mirrors the hook.' },
    ],
  },
  {
    id: 'freytag',
    name: 'Freytag’s pyramid',
    kind: 'structure',
    about: 'Gustav Freytag’s five-part shape of a drama, often used for tragedies.',
    items: [
      { title: 'Exposition', text: 'Introduce the world and the characters.' },
      { title: 'Rising action', text: 'Complications build tension.' },
      { title: 'Climax', text: 'The turning point; the hero’s fate turns.' },
      { title: 'Falling action', text: 'Consequences of the climax unfold.' },
      { title: 'Denouement', text: 'Loose ends tie up; a new normal or catastrophe.' },
    ],
  },
]
