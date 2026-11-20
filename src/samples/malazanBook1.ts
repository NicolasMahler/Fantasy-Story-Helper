import { rpc } from '../db/client';

/**
 * Sample series: Malazan Book of the Fallen, Book 1 (Gardens of the Moon) ONLY. Added from Settings
 * ("Add the Malazan Book 1 sample"), or in dev with `await loadMalazanSample()` in the console.
 * Keep every entry and event within Book 1.
 * Descriptions write links as {{Entry name}}; they are turned into real @-links once every entry exists.
 */
/** `book` is the book number the entry first appears in (default 1). `aka` lists other names it goes by. */
type Sample = { type: string; name: string; description: string; book?: number; aka?: string[] };

const BOOKS = ['Gardens of the Moon'];

const SERIES = 'Malazan Book of the Fallen';

const ENTRIES: Sample[] = [
  // Characters
  { type: 'character', name: 'Ganoes Paran', aka: ['Captain Paran', 'Paran'], description: 'Noble-born Malazan officer recruited by {{Adjunct Lorn}} and later given command of {{Whiskeyjack}}\'s squad of {{Bridgeburners}}. Becomes a pawn of {{Oponn}} through the sword {{Chance}}.' },
  { type: 'character', name: 'Whiskeyjack', description: 'Weary, principled sergeant of the {{Bridgeburners}}\' Ninth Squad. Survives the {{Siege of Pale}} and leads the squad into {{Darujhistan}}.' },
  { type: 'character', name: 'Kalam', description: 'Bridgeburner corporal and former member of the {{Claw}}. Partners with {{Quick Ben}} in {{Darujhistan}}.' },
  { type: 'character', name: 'Quick Ben', description: 'Squad mage of the {{Bridgeburners}}, far more powerful and secretive than he lets on. Schemes against {{Hairlock}} alongside {{Kalam}}.' },
  { type: 'character', name: 'Sorry', description: 'A quiet recruit in {{Whiskeyjack}}\'s squad — in truth a fisher girl possessed by {{Cotillion}}, the Rope.' },
  { type: 'character', name: 'Tattersail', description: 'Malazan cadre mage who survives the {{Siege of Pale}}. Reads the {{Deck of Dragons}} and grows close to {{Ganoes Paran}}.' },
  { type: 'character', name: 'Hairlock', description: 'Cadre mage whose shattered body is replaced by a wooden puppet. A dangerous ally of {{Tattersail}} and {{Quick Ben}}.' },
  { type: 'character', name: 'Adjunct Lorn', aka: ['Lorn', 'The Adjunct'], description: 'The Empress\'s Adjunct, hunter of rogue sorcery for the {{Malazan Empire}}. Carries an {{Otataral}} sword and seeks to free the {{Jaghut Tyrant}}.' },
  { type: 'character', name: 'Anomander Rake', aka: ['Son of Darkness'], description: 'Son of Darkness, lord of the {{Tiste Andii}} and master of {{Moon\'s Spawn}}. Wields the sword {{Dragnipur}}.' },
  { type: 'character', name: 'Crokus Younghand', aka: ['Crokus'], description: 'Young thief of {{Darujhistan}} who becomes the unwitting bearer of the {{Coin of Oponn}}.' },
  { type: 'character', name: 'Kruppe', description: 'Self-important, rotund dream-reader of the {{Phoenix Inn}} who speaks of himself in the third person. Much cleverer than he seems.' },
  { type: 'character', name: 'Rallick Nom', aka: ['Rallick'], description: 'Assassin of {{Darujhistan}} and friend of {{Crokus Younghand}}, plotting revenge for his friend {{Coll}}.' },
  { type: 'character', name: 'Coll', description: 'Ruined noble of {{Darujhistan}}, betrayed by his wife; friend of {{Rallick Nom}}.' },
  { type: 'character', name: 'Baruk', description: 'High alchemist of {{Darujhistan}} and member of the {{T\'orrud Cabal}}, working quietly against the {{Malazan Empire}}.' },
  { type: 'character', name: 'Tool', aka: ["Onos T'oolan"], description: 'A {{T\'lan Imass}} who accompanies {{Adjunct Lorn}} on her mission to the {{Gadrobi Hills}}.' },
  { type: 'character', name: 'Cotillion', aka: ['The Rope'], description: 'The Rope, patron of assassins and companion of {{Shadowthrone}}. One of the new {{Ascendants}} who only recently took the {{House of Shadow}}. Rides {{Sorry}} as a vessel. The old Emperor had a master assassin too, {{Dancer}} — see {{Fate of Kellanved and Dancer}}.' },
  // Locations
  { type: 'location', name: 'Genabackis', description: 'Continent where the {{Malazan Empire}} wages its campaign. Home to {{Pale}} and {{Darujhistan}}.' },
  { type: 'location', name: 'Pale', description: 'Free City on {{Genabackis}}, protected by {{Moon\'s Spawn}} until the {{Siege of Pale}}.' },
  { type: 'location', name: 'Darujhistan', aka: ['City of Blue Fire'], description: 'The City of Blue Fire, lit by gas, and the last great Free City standing against the {{Malazan Empire}}.' },
  { type: 'location', name: 'Moon\'s Spawn', description: 'A vast floating fortress of black basalt, home of {{Anomander Rake}} and the {{Tiste Andii}}.' },
  { type: 'location', name: 'Phoenix Inn', description: 'Tavern in {{Darujhistan}}, haunt of {{Kruppe}}, {{Rallick Nom}} and {{Crokus Younghand}}.' },
  { type: 'location', name: 'Gadrobi Hills', description: 'Hills outside {{Darujhistan}} where a {{Jaghut Tyrant}} lies imprisoned in a barrow.' },
  // Factions
  { type: 'faction', name: 'Malazan Empire', description: 'Expansionist empire ruled by Empress Laseen, now campaigning on {{Genabackis}}.' },
  { type: 'faction', name: 'Bridgeburners', description: 'Elite, battle-hardened Malazan sapper and marine company, badly mauled at the {{Siege of Pale}}. Members include {{Whiskeyjack}}, {{Kalam}} and {{Quick Ben}}.' },
  { type: 'faction', name: 'Claw', description: 'The Empire\'s assassins and spies. {{Kalam}} was once one of them.' },
  { type: 'faction', name: 'T\'orrud Cabal', description: 'Secret council of mages guiding {{Darujhistan}} from the shadows, led by {{Baruk}}.' },
  // Peoples
  { type: 'people', name: 'Tiste Andii', description: 'Ancient, long-lived Children of Darkness, led by {{Anomander Rake}}.' },
  { type: 'people', name: 'T\'lan Imass', description: 'Undying army bound by the Ritual of Tellann to an endless war against the {{Jaghut}}. {{Tool}} is one of them.' },
  { type: 'people', name: 'Jaghut', description: 'Ancient, mostly solitary race, hunted almost to extinction by the {{T\'lan Imass}}.' },
  // Items
  { type: 'item', name: 'Dragnipur', description: 'Sword of {{Anomander Rake}}. Those it slays are chained within it, forever.' },
  { type: 'item', name: 'Coin of Oponn', description: 'A coin through which {{Oponn}} meddles in mortal affairs. Carried by {{Crokus Younghand}}.' },
  { type: 'item', name: 'Chance', description: 'Sword bought by {{Ganoes Paran}}, which binds him to {{Oponn}}\'s luck.' },
  // Magic
  { type: 'magic', name: 'Warrens', description: 'Paths of power that mages draw on for sorcery — and through which they can travel.' },
  { type: 'magic', name: 'Deck of Dragons', description: 'Tarot-like deck used to read the movements of gods and Ascendants. {{Tattersail}} is a skilled reader.' },
  { type: 'magic', name: 'Otataral', description: 'Rust-coloured ore that negates sorcery. {{Adjunct Lorn}}\'s sword is made of it.' },
  // Religion
  { type: 'religion', name: 'Oponn', aka: ['Twin Jesters', 'Jesters of Chance'], description: 'The Twin Jesters of Chance, gods who play games with mortal lives — chiefly through {{Ganoes Paran}} and the {{Coin of Oponn}}.' },
  // Creatures
  { type: 'creature', name: 'Hounds of Shadow', description: 'Huge, terrifying hounds that serve the Shadow Realm and hunt at {{Cotillion}}\'s side.' },
  { type: 'creature', name: 'Jaghut Tyrant', aka: ['Raest'], description: 'A {{Jaghut}} of immense power, imprisoned in the {{Gadrobi Hills}}. {{Adjunct Lorn}} and {{Tool}} plan to release him on {{Darujhistan}}.' },
  // Events
  { type: 'event', name: 'Siege of Pale', description: 'The {{Malazan Empire}} takes {{Pale}} and drives off {{Moon\'s Spawn}}, at a terrible cost to the {{Bridgeburners}} and the cadre mages.' },
  { type: 'event', name: 'Fête of Gedderone', description: 'Spring festival in {{Darujhistan}} where the city\'s plots — and {{Anomander Rake}}, {{Kalam}} and {{Rallick Nom}} — collide.' },
  { type: 'event', name: 'T\'lan Imass–Jaghut Wars', description: 'The ancient war of extermination waged by the {{T\'lan Imass}} against the {{Jaghut}}, as {{Tool}} remembers it.' },
  { type: 'event', name: 'Imprisonment of the Jaghut Tyrant', description: 'Long ago, a {{Jaghut Tyrant}} was sealed in a barrow in the {{Gadrobi Hills}}.' },
  { type: 'event', name: 'Release of the Jaghut Tyrant', description: '{{Adjunct Lorn}} and {{Tool}} free the {{Jaghut Tyrant}} to unleash him on {{Darujhistan}}.' },
  { type: 'event', name: 'Betrayal of Coll', description: "How {{Coll}} lost his estate and standing to his wife {{Lady Simtal}}'s treachery, the wrong {{Rallick Nom}} means to avenge." },

  // ——— Expanded Book 1 content ———
  // Malazan command and mages
  { type: 'character', name: 'Empress Laseen', aka: ['Surly', 'The Empress'], description: 'Ruler of the {{Malazan Empire}}. Once called Surly and head of the {{Claw}}, she took the throne by having {{Kellanved}} and {{Dancer}} killed. Trusts few, and is said to want the {{Bridgeburners}} gone.' },
  { type: 'character', name: 'Dujek Onearm', aka: ['High Fist', 'Onearm'], description: 'High Fist of the Malazan armies on {{Genabackis}}, commanding {{Onearm\'s Host}}. An old soldier from the Emperor\'s day and a friend of {{Whiskeyjack}}.' },
  { type: 'character', name: 'Tayschrenn', aka: ['High Mage'], description: 'Imperial High Mage, loyal to {{Empress Laseen}}. Directs the sorcery at the {{Siege of Pale}}, where many of the Empire\'s own mages die. {{Tattersail}} distrusts him deeply.' },
  { type: 'character', name: 'Toc the Younger', description: 'Malazan scout and courier who loses an eye at the {{Siege of Pale}}. Rides with {{Adjunct Lorn}} and {{Tool}} toward the {{Gadrobi Hills}}.' },
  { type: 'character', name: 'Calot', description: 'Cadre mage and {{Tattersail}}\'s lover, killed at the {{Siege of Pale}}.' },
  { type: 'character', name: 'Nightchill', description: 'Powerful sorceress of the Second Army\'s mage cadre, cut down at the {{Siege of Pale}}. {{Bellurdan}} carries her body away to bury it.' },
  { type: 'character', name: 'Bellurdan', description: 'Huge Thelomen Toblakai of the mage cadre, gentle and loyal. Devoted to {{Nightchill}}, and travels with {{Tattersail}} after the siege.' },
  { type: 'character', name: 'Silverfox', description: 'A Rhivi child born at the very end of the book, into whom the soul of {{Tattersail}} passes.' },
  // Rest of the Ninth Squad
  { type: 'character', name: 'Fiddler', description: 'Bridgeburner sapper of {{Whiskeyjack}}\'s squad with an uncanny sense for trouble. Distrusts {{Sorry}} from the start. Close friend of {{Hedge}}.' },
  { type: 'character', name: 'Hedge', description: 'Bridgeburner sapper, {{Fiddler}}\'s partner in mining {{Darujhistan}} with {{Moranth}} munitions.' },
  { type: 'character', name: 'Mallet', description: 'The squad\'s healer in the {{Bridgeburners}}, steady and practical.' },
  { type: 'character', name: 'Trotts', description: 'A {{Barghast}} warrior in {{Whiskeyjack}}\'s squad, bigger and sharper than most people assume.' },
  // Darujhistan
  { type: 'character', name: 'Murillio', description: 'Charming, idle gentleman of {{Darujhistan}} who lives off rich widows. Friend of {{Kruppe}} and {{Rallick Nom}}, and part of their plan to restore {{Coll}}.' },
  { type: 'character', name: 'Mammot', description: 'Elderly scholar, uncle of {{Crokus Younghand}} and a member of the {{T\'orrud Cabal}}. His studies of the {{Gadrobi Hills}} barrow draw the attention of the {{Jaghut Tyrant}}.' },
  { type: 'character', name: 'Challice D\'Arle', description: 'Young noblewoman of {{Darujhistan}} whose house {{Crokus Younghand}} burgles, and whom he becomes infatuated with.' },
  { type: 'character', name: 'Lady Simtal', description: 'Noblewoman of {{Darujhistan}} who betrayed her husband {{Coll}} and took his estate. Hosts the great party on the night of the {{Fête of Gedderone}}.' },
  { type: 'character', name: 'Turban Orr', description: 'Ambitious member of the {{Darujhistan Council}} and {{Lady Simtal}}\'s lover, behind the plot against {{Coll}}.' },
  { type: 'character', name: 'Vorcan', description: 'Master of the {{Assassins\' Guild}} of {{Darujhistan}}, and a High Mage in her own right.' },
  { type: 'character', name: 'Derudan', description: 'Witch of Tennes and member of the {{T\'orrud Cabal}} alongside {{Baruk}}.' },
  // Elsewhere on Genabackis
  { type: 'character', name: 'Caladan Brood', aka: ['Brood', 'The Warlord'], description: 'Warlord leading the armies that fight the {{Malazan Empire}} in the north of {{Genabackis}}. An ally of {{Anomander Rake}}, he carries a great hammer.' },
  { type: 'character', name: 'Lady Envy', description: 'Mysterious, beautiful and dangerous sorceress who arrives in {{Darujhistan}} and knows {{Anomander Rake}} of old.' },
  { type: 'character', name: 'Shadowthrone', description: 'God who rules the {{House of Shadow}}, master of the {{Hounds of Shadow}} and partner of {{Cotillion}}. A new Ascendant, openly hostile to the {{Malazan Empire}} and to {{Empress Laseen}} in particular. See {{Fate of Kellanved and Dancer}}.' },
  { type: 'character', name: 'Kellanved', aka: ['The Emperor'], description: "The first Emperor of the {{Malazan Empire}}, a mage who built it from {{Malaz City}}. Killed on {{Empress Laseen}}'s orders, or so the official story goes. See {{Fate of Kellanved and Dancer}}." },
  { type: 'character', name: 'Dancer', description: "{{Kellanved}}'s companion and master assassin, killed alongside him on {{Empress Laseen}}'s orders. See {{Fate of Kellanved and Dancer}}." },
  // Places
  { type: 'location', name: 'Malaz City', description: 'Island port where the Empire began. As a boy, {{Ganoes Paran}} watches the {{Purge of the Mouse}} from the walls of Mock\'s Hold.' },
  { type: 'location', name: 'Itko Kan', description: 'Coastal province of the {{Malazan Empire}} on Quon Tali, where the {{Massacre at Gerrom}} takes place.' },
  { type: 'location', name: 'Gerrom', description: 'Fishing village in {{Itko Kan}}, site of the {{Massacre at Gerrom}}.' },
  { type: 'location', name: 'D\'Arle Estate', description: 'Noble house in {{Darujhistan}}, home of {{Challice D\'Arle}}, burgled by {{Crokus Younghand}} at the start of his part of the story.' },
  { type: 'location', name: 'Simtal Estate', description: 'The house {{Lady Simtal}} took from {{Coll}}, where her party on the night of the {{Fête of Gedderone}} ends in blood.' },
  { type: 'location', name: 'Baruk\'s Mansion', description: 'Home of {{Baruk}} in {{Darujhistan}}, where the {{T\'orrud Cabal}} meets and {{Kruppe}} brings his reports.' },
  // Factions
  { type: 'faction', name: 'Onearm\'s Host', description: 'The Malazan army on {{Genabackis}} under {{Dujek Onearm}}, including the {{Bridgeburners}}.' },
  { type: 'faction', name: 'Moranth', description: 'Armoured, secretive allies of the {{Malazan Empire}} who ride flying quorls and supply the munitions the {{Bridgeburners}} use.' },
  { type: 'faction', name: 'Assassins\' Guild', description: 'The guild of killers that rules {{Darujhistan}}\'s rooftops, led by {{Vorcan}}. {{Rallick Nom}} is a member; {{Kalam}} and {{Quick Ben}} mean to cripple it.' },
  { type: 'faction', name: 'Darujhistan Council', description: 'The quarrelling noble council that governs {{Darujhistan}} in name, while the {{T\'orrud Cabal}} guards it in fact. {{Turban Orr}} is one of its power brokers.' },
  { type: 'faction', name: 'Mage Cadre', description: 'The Empire\'s battle mages attached to the army. {{Tattersail}}, {{Hairlock}}, {{Calot}}, {{Nightchill}} and {{Bellurdan}} serve in it, and are nearly wiped out at the {{Siege of Pale}}.' },
  // Peoples
  { type: 'people', name: 'Rhivi', description: 'Nomadic herders of the plains of {{Genabackis}}, allied with {{Caladan Brood}}. {{Silverfox}} is born among them.' },
  { type: 'people', name: 'Barghast', description: 'Tall, tattooed tribal warriors of {{Genabackis}}. {{Trotts}} is one of them.' },
  // Items
  { type: 'item', name: 'Moranth Munitions', description: 'Explosives sold by the {{Moranth}}: crackers, burners, sharpers and cussers. {{Fiddler}} and {{Hedge}} mine {{Darujhistan}}\'s crossroads with them.' },
  { type: 'item', name: 'Finnest', description: 'An object holding the power of the {{Jaghut Tyrant}}, without which he is not whole. Both he and {{Adjunct Lorn}} want it.' },
  // Magic
  { type: 'magic', name: 'Gas of Darujhistan', description: 'The natural gas piped under {{Darujhistan}} that fills the city with its famous blue light.' },
  // Religion
  { type: 'religion', name: 'Gedderone', aka: ['Lady of Spring'], description: 'The Lady of Spring, celebrated in {{Darujhistan}} at the {{Fête of Gedderone}}.' },
  // Lore
  { type: 'lore', name: 'Ascendants', description: 'Beings who have risen to godlike power, such as {{Anomander Rake}}. Gods and Ascendants move through the {{Deck of Dragons}} and use mortals as pieces, as {{Oponn}} does.' },
  { type: 'lore', name: 'Fate of Kellanved and Dancer', description: "Officially, {{Kellanved}} and {{Dancer}} were assassinated on {{Empress Laseen}}'s orders. But the book drops hints: the {{House of Shadow}} stood empty until recently, when {{Shadowthrone}} and {{Cotillion}} ascended to it; {{Cotillion}}, the Rope, is patron of assassins, just as {{Dancer}} was the Emperor's assassin; and {{Shadowthrone}} is openly hostile to the Empire and to Laseen. Book 1 never says outright that they are the same pair." },
  { type: 'lore', name: 'House of Shadow', description: 'The realm and throne of Shadow, empty until recently, now held by {{Shadowthrone}} and {{Cotillion}}, with the {{Hounds of Shadow}} at their call.' },
  { type: 'lore', name: 'Old Guard', description: 'The soldiers and officers who served the old Emperor, {{Kellanved}}. {{Empress Laseen}} distrusts them, among them {{Dujek Onearm}}, {{Whiskeyjack}} and the {{Bridgeburners}}.' },
  // Events
  { type: 'event', name: 'Assassination of Kellanved and Dancer', description: '{{Empress Laseen}} has the Emperor {{Kellanved}} and {{Dancer}} killed and takes the throne, as told in Book 1. See {{Fate of Kellanved and Dancer}}.' },
  { type: 'event', name: 'Purge of the Mouse', description: 'A bloody cleansing of the Mouse quarter of {{Malaz City}} ordered from above, witnessed by the young {{Ganoes Paran}}. The book\'s prologue.' },
  { type: 'event', name: 'Massacre at Gerrom', description: 'The {{Hounds of Shadow}} slaughter the people of {{Gerrom}}. {{Ganoes Paran}} rides with {{Adjunct Lorn}} to investigate, and the fisher girl who will be {{Sorry}} is taken by {{Cotillion}}.' },
  { type: 'event', name: 'Death of Hairlock', description: 'The {{Hounds of Shadow}} come for {{Hairlock}}\'s puppet body and tear it apart in front of {{Tattersail}}.' },
  { type: 'event', name: 'Death and Return of Paran', description: '{{Ganoes Paran}} is stabbed and dies, then is sent back to life by {{Oponn}} through the sword {{Chance}}.' },
  { type: 'event', name: 'Infiltration of Darujhistan', description: '{{Whiskeyjack}}\'s squad slips into {{Darujhistan}} to mine the city and contact the {{Assassins\' Guild}}, while the {{Malazan Empire}} prepares to take it.' },
  { type: 'event', name: 'Simtal\'s Party', description: 'The masked party at the {{Simtal Estate}} on the night of the {{Fête of Gedderone}}. {{Rallick Nom}} strikes at {{Turban Orr}}, and {{Coll}} is given back his name and estate.' },
  { type: 'event', name: 'Outlawing of Onearm\'s Host', description: 'At the end of the book {{Dujek Onearm}} and his army are declared outlaws by the {{Malazan Empire}}.' },
  { type: 'event', name: 'Birth of Silverfox', description: 'A {{Rhivi}} child is born carrying the soul of {{Tattersail}}: {{Silverfox}}.' },
];

/**
 * Step 3: event details. Dates are approximate and only for exercising the app.
 * `relative` names another event; `told` is the teller of a recounted event.
 */
type EventSample = {
  name: string;
  /** Book number where it happens / is described (default 1). */
  book?: number;
  /** Manual timeline position (sort_key_override). */
  pin?: number;
  mode?: 'present' | 'recounted';
  told?: string;
  date:
    | { year: number; age?: string }
    | { bucket: string }
    | { relative: string; offset: number }
    | null;
  participants: [name: string, role?: string][];
};

const AGES = [{ name: 'Burn\'s Sleep', startYear: 0, endYear: null, direction: 'forward' as const }];

const EVENTS: EventSample[] = [
  {
    name: 'T\'lan Imass–Jaghut Wars', mode: 'recounted', told: 'Tool', date: { bucket: 'ancient' },
    participants: [['T\'lan Imass'], ['Jaghut']],
  },
  {
    name: 'Imprisonment of the Jaghut Tyrant', mode: 'recounted', told: 'Tool', date: { bucket: 'distant' },
    participants: [['Jaghut Tyrant', 'victim'], ['Gadrobi Hills']],
  },
  {
    name: 'Purge of the Mouse', date: { year: 1154, age: 'Burn\'s Sleep' },
    participants: [['Ganoes Paran', 'witness'], ['Dujek Onearm'], ['Whiskeyjack'], ['Malaz City']],
  },
  {
    name: 'Massacre at Gerrom', date: { year: 1161, age: 'Burn\'s Sleep' },
    participants: [
      ['Hounds of Shadow', 'attacker'], ['Ganoes Paran', 'investigator'], ['Adjunct Lorn', 'investigator'],
      ['Cotillion'], ['Sorry'], ['Gerrom'], ['Itko Kan'],
    ],
  },
  {
    name: 'Siege of Pale', date: { year: 1163, age: 'Burn\'s Sleep' },
    participants: [
      ['Whiskeyjack', 'leader'], ['Dujek Onearm', 'commander'], ['Tayschrenn'], ['Quick Ben'], ['Kalam'],
      ['Fiddler'], ['Hedge'], ['Tattersail'], ['Hairlock'], ['Calot', 'killed'], ['Nightchill', 'killed'],
      ['Bellurdan'], ['Toc the Younger'], ['Anomander Rake'], ['Bridgeburners'], ['Mage Cadre'],
      ['Malazan Empire'], ['Moon\'s Spawn'], ['Pale'],
    ],
  },
  {
    name: 'Death of Hairlock', date: { relative: 'Siege of Pale', offset: 0 },
    participants: [['Hairlock', 'victim'], ['Hounds of Shadow', 'attacker'], ['Tattersail', 'witness']],
  },
  {
    name: 'Death and Return of Paran', date: { relative: 'Siege of Pale', offset: 0 },
    participants: [['Ganoes Paran', 'victim'], ['Sorry'], ['Oponn'], ['Chance']],
  },
  {
    name: 'Infiltration of Darujhistan', date: { relative: 'Siege of Pale', offset: 1 },
    participants: [
      ['Whiskeyjack', 'leader'], ['Kalam'], ['Quick Ben'], ['Fiddler'], ['Hedge'], ['Mallet'], ['Trotts'],
      ['Sorry'], ['Moranth Munitions'], ['Darujhistan'],
    ],
  },
  {
    name: 'Fête of Gedderone', date: { relative: 'Siege of Pale', offset: 1 },
    participants: [
      ['Anomander Rake'], ['Kalam'], ['Rallick Nom'], ['Crokus Younghand'], ['Kruppe'], ['Baruk'], ['Darujhistan'],
    ],
  },
  {
    name: 'Release of the Jaghut Tyrant', date: { relative: 'Fête of Gedderone', offset: 0 },
    participants: [['Adjunct Lorn', 'leader'], ['Tool'], ['Toc the Younger'], ['Jaghut Tyrant'], ['Gadrobi Hills']],
  },
  {
    name: 'Simtal\'s Party', date: { relative: 'Fête of Gedderone', offset: 0 },
    participants: [
      ['Rallick Nom'], ['Turban Orr', 'target'], ['Lady Simtal', 'host'], ['Coll'], ['Murillio'], ['Kruppe'],
      ['Crokus Younghand'], ['Challice D\'Arle'], ['Simtal Estate'],
    ],
  },
  {
    name: 'Outlawing of Onearm\'s Host', date: { relative: 'Fête of Gedderone', offset: 0 },
    participants: [['Dujek Onearm', 'leader'], ['Onearm\'s Host'], ['Malazan Empire']],
  },
  {
    name: 'Birth of Silverfox', date: { relative: 'Fête of Gedderone', offset: 0 },
    participants: [['Silverfox'], ['Tattersail'], ['Rhivi']],
  },
  {
    name: 'Assassination of Kellanved and Dancer', mode: 'recounted', date: null,
    participants: [['Kellanved', 'victim'], ['Dancer', 'victim'], ['Empress Laseen', 'ordered it'], ['Malazan Empire']],
  },
  // Undated + recounted example (timeline: Undated section; chart: not plotted).
  {
    name: 'Betrayal of Coll', mode: 'recounted', told: 'Rallick Nom', date: null,
    participants: [['Coll', 'victim'], ['Darujhistan']],
  },
];

/** Step 5: hand-made relationships (all from Book 1). [from, kind, to, note?] */
const LINKS: [from: string, kind: string, to: string, note?: string][] = [
  ['Kalam', 'partners', 'Quick Ben'],
  ['Whiskeyjack', 'member of', 'Bridgeburners', 'sergeant of the Ninth Squad'],
  ['Kalam', 'member of', 'Bridgeburners'],
  ['Quick Ben', 'member of', 'Bridgeburners'],
  ['Sorry', 'member of', 'Bridgeburners', 'recruit'],
  ['Kalam', 'formerly of', 'Claw'],
  ['Ganoes Paran', 'serves', 'Adjunct Lorn'],
  ['Adjunct Lorn', 'serves', 'Malazan Empire'],
  ['Tool', 'ally', 'Adjunct Lorn'],
  ['Tool', 'member of', 'T\'lan Imass'],
  ['Jaghut Tyrant', 'member of', 'Jaghut'],
  ['Anomander Rake', 'leads', 'Tiste Andii'],
  ['Anomander Rake', 'owns', 'Dragnipur'],
  ['Ganoes Paran', 'owns', 'Chance'],
  ['Crokus Younghand', 'owns', 'Coin of Oponn'],
  ['Baruk', 'member of', 'T\'orrud Cabal'],
  ['Rallick Nom', 'friends', 'Crokus Younghand'],
  ['Rallick Nom', 'friends', 'Coll'],
  ['Tattersail', 'close to', 'Ganoes Paran'],
  ['Cotillion', 'possesses', 'Sorry'],
  // Expanded Book 1 relationships
  ['Empress Laseen', 'leads', 'Malazan Empire'],
  ['Empress Laseen', 'formerly of', 'Claw'],
  ['Adjunct Lorn', 'serves', 'Empress Laseen'],
  ['Tayschrenn', 'serves', 'Empress Laseen'],
  ['Dujek Onearm', 'leads', 'Onearm\'s Host'],
  ['Bridgeburners', 'part of', 'Onearm\'s Host'],
  ['Whiskeyjack', 'friends', 'Dujek Onearm'],
  ['Fiddler', 'member of', 'Bridgeburners', 'sapper'],
  ['Hedge', 'member of', 'Bridgeburners', 'sapper'],
  ['Mallet', 'member of', 'Bridgeburners', 'healer'],
  ['Trotts', 'member of', 'Bridgeburners'],
  ['Trotts', 'member of', 'Barghast'],
  ['Fiddler', 'friends', 'Hedge'],
  ['Fiddler', 'distrusts', 'Sorry'],
  ['Toc the Younger', 'serves', 'Adjunct Lorn', 'scout'],
  ['Tattersail', 'member of', 'Mage Cadre'],
  ['Hairlock', 'member of', 'Mage Cadre'],
  ['Calot', 'member of', 'Mage Cadre'],
  ['Nightchill', 'member of', 'Mage Cadre'],
  ['Bellurdan', 'member of', 'Mage Cadre'],
  ['Tattersail', 'lovers', 'Calot'],
  ['Bellurdan', 'devoted to', 'Nightchill'],
  ['Tattersail', 'distrusts', 'Tayschrenn'],
  ['Silverfox', 'reborn from', 'Tattersail'],
  ['Silverfox', 'member of', 'Rhivi'],
  ['Moranth', 'ally', 'Malazan Empire'],
  ['Shadowthrone', 'partners', 'Cotillion'],
  ['Kellanved', 'partners', 'Dancer'],
  ['Empress Laseen', 'killed', 'Kellanved', 'officially'],
  ['Empress Laseen', 'killed', 'Dancer', 'officially'],
  ['Shadowthrone', 'rules', 'House of Shadow'],
  ['Cotillion', 'rules', 'House of Shadow'],
  ['Shadowthrone', 'hostile to', 'Empress Laseen'],
  ['Shadowthrone', 'commands', 'Hounds of Shadow'],
  ['Anomander Rake', 'ally', 'Caladan Brood'],
  ['Rhivi', 'ally', 'Caladan Brood'],
  ['Lady Envy', 'knows', 'Anomander Rake'],
  ['Mammot', 'uncle of', 'Crokus Younghand'],
  ['Mammot', 'member of', 'T\'orrud Cabal'],
  ['Derudan', 'member of', 'T\'orrud Cabal'],
  ['Crokus Younghand', 'infatuated with', 'Challice D\'Arle'],
  ['Kruppe', 'friends', 'Crokus Younghand'],
  ['Kruppe', 'friends', 'Murillio'],
  ['Murillio', 'friends', 'Rallick Nom'],
  ['Kruppe', 'reports to', 'Baruk'],
  ['Coll', 'married to', 'Lady Simtal'],
  ['Lady Simtal', 'lovers', 'Turban Orr'],
  ['Turban Orr', 'member of', 'Darujhistan Council'],
  ['Vorcan', 'leads', 'Assassins\' Guild'],
  ['Rallick Nom', 'member of', 'Assassins\' Guild'],
  ['Jaghut Tyrant', 'seeks', 'Finnest'],
  ['Adjunct Lorn', 'seeks', 'Finnest'],
];

/**
 * Creates the sample series. Refuses to run if a series with the same name already exists. Returns the series id.
 * If anything fails partway, the half-built series is removed again.
 */
export async function loadMalazanSample(): Promise<number> {
  if ((await rpc('listSeries')).some((s) => s.name === SERIES)) {
    throw new Error(`“${SERIES}” is already in your library. Delete it first to add the sample again.`);
  }
  const seriesId = await rpc('createSeries', {
    name: SERIES,
    description: 'Sample data from Book 1, Gardens of the Moon.',
  });
  try {
    await fill(seriesId);
  } catch (e) {
    await rpc('deleteSeries', seriesId).catch(() => { /* keep the original error */ });
    throw e;
  }
  return seriesId;
}

async function fill(seriesId: number): Promise<void> {
  const bookIds: number[] = [];
  for (const title of BOOKS) bookIds.push(await rpc('addBook', seriesId, title));
  const book = (n = 1) => bookIds[n - 1];
  const typeIds = new Map((await rpc('listTypes', seriesId)).map((t) => [t.key, t.id]));

  // Pass 1: create every entry so each has an id.
  const ids = new Map<string, number>();
  for (const e of ENTRIES) {
    const typeId = typeIds.get(e.type);
    if (typeId === undefined) throw new Error(`Unknown type "${e.type}".`);
    ids.set(e.name, await rpc('createEntity', { seriesId, typeId, name: e.name, firstBookId: book(e.book), aliases: e.aka }));
  }

  // Pass 2: write descriptions with real @-links.
  for (const e of ENTRIES) {
    const description = e.description.replace(/\{\{([^}]+)\}\}/g, (_, name: string) => {
      const id = ids.get(name);
      if (id === undefined) throw new Error(`"${e.name}" links to unknown entry "${name}".`);
      return `@[${name}](${id})`;
    });
    await rpc('updateEntity', ids.get(e.name)!, { description });
  }

  // Pass 3 (step 3): ages, event dates (in dependency order as listed), participants.
  const ageIds = new Map<string, number>();
  for (const a of AGES) ageIds.set(a.name, await rpc('createAge', seriesId, a));
  const id = (name: string) => {
    const v = ids.get(name);
    if (v === undefined) throw new Error(`Unknown entry "${name}".`);
    return v;
  };
  for (const ev of EVENTS) {
    const d = ev.date;
    await rpc('saveEvent', id(ev.name), {
      mode: ev.mode ?? 'present',
      bookId: book(ev.book),
      toldById: ev.told ? id(ev.told) : null,
      datePrecision: d === null ? null : 'year' in d ? 'year' : 'bucket' in d ? 'bucket' : 'relative',
      year: d && 'year' in d ? d.year : null,
      ageId: d && 'year' in d && d.age ? ageIds.get(d.age)! : null,
      relativeTo: d && 'relative' in d ? id(d.relative) : null,
      offsetYears: d && 'relative' in d ? d.offset : null,
      bucket: d && 'bucket' in d ? d.bucket : null,
      sortKeyOverride: ev.pin ?? null,
      manualOrder: 0,
    });
    for (const [name, role] of ev.participants) await rpc('addParticipant', id(ev.name), id(name), role);
  }

  // Pass 4 (step 5): relationships.
  for (const [from, kind, to, note] of LINKS) {
    await rpc('createLink', { fromId: id(from), toId: id(to), kind, note });
  }
}
