import { rpc } from '../db/client';

/**
 * Dev-only sample data: a small slice of Malazan Book of the Fallen, Book 1 (Gardens of the Moon).
 * Descriptions write links as {{Entry name}}; they are turned into real @-links once every entry exists.
 */
type Sample = { type: string; name: string; description: string };

const SERIES = 'Malazan Book of the Fallen';

const ENTRIES: Sample[] = [
  // Characters
  { type: 'character', name: 'Ganoes Paran', description: 'Noble-born Malazan officer recruited by {{Adjunct Lorn}} and later given command of {{Whiskeyjack}}\'s squad of {{Bridgeburners}}. Becomes a pawn of {{Oponn}} through the sword {{Chance}}.' },
  { type: 'character', name: 'Whiskeyjack', description: 'Weary, principled sergeant of the {{Bridgeburners}}\' Ninth Squad. Survives the {{Siege of Pale}} and leads the squad into {{Darujhistan}}.' },
  { type: 'character', name: 'Kalam', description: 'Bridgeburner corporal and former member of the {{Claw}}. Partners with {{Quick Ben}} in {{Darujhistan}}.' },
  { type: 'character', name: 'Quick Ben', description: 'Squad mage of the {{Bridgeburners}}, far more powerful and secretive than he lets on. Schemes against {{Hairlock}} alongside {{Kalam}}.' },
  { type: 'character', name: 'Sorry', description: 'A quiet recruit in {{Whiskeyjack}}\'s squad — in truth a fisher girl possessed by {{Cotillion}}, the Rope.' },
  { type: 'character', name: 'Tattersail', description: 'Malazan cadre mage who survives the {{Siege of Pale}}. Reads the {{Deck of Dragons}} and grows close to {{Ganoes Paran}}.' },
  { type: 'character', name: 'Hairlock', description: 'Cadre mage whose shattered body is replaced by a wooden puppet. A dangerous ally of {{Tattersail}} and {{Quick Ben}}.' },
  { type: 'character', name: 'Adjunct Lorn', description: 'The Empress\'s Adjunct, hunter of rogue sorcery for the {{Malazan Empire}}. Carries an {{Otataral}} sword and seeks to free the {{Jaghut Tyrant}}.' },
  { type: 'character', name: 'Anomander Rake', description: 'Son of Darkness, lord of the {{Tiste Andii}} and master of {{Moon\'s Spawn}}. Wields the sword {{Dragnipur}}.' },
  { type: 'character', name: 'Crokus Younghand', description: 'Young thief of {{Darujhistan}} who becomes the unwitting bearer of the {{Coin of Oponn}}.' },
  { type: 'character', name: 'Kruppe', description: 'Self-important, rotund dream-reader of the {{Phoenix Inn}} who speaks of himself in the third person. Much cleverer than he seems.' },
  { type: 'character', name: 'Rallick Nom', description: 'Assassin of {{Darujhistan}} and friend of {{Crokus Younghand}}, plotting revenge for his friend Coll.' },
  { type: 'character', name: 'Baruk', description: 'High alchemist of {{Darujhistan}} and member of the {{T\'orrud Cabal}}, working quietly against the {{Malazan Empire}}.' },
  { type: 'character', name: 'Tool', description: 'A {{T\'lan Imass}} who accompanies {{Adjunct Lorn}} on her mission to the {{Gadrobi Hills}}.' },
  { type: 'character', name: 'Cotillion', description: 'The Rope, patron of assassins and companion of Shadowthrone. Rides {{Sorry}} as a vessel.' },
  // Locations
  { type: 'location', name: 'Genabackis', description: 'Continent where the {{Malazan Empire}} wages its campaign. Home to {{Pale}} and {{Darujhistan}}.' },
  { type: 'location', name: 'Pale', description: 'Free City on {{Genabackis}}, protected by {{Moon\'s Spawn}} until the {{Siege of Pale}}.' },
  { type: 'location', name: 'Darujhistan', description: 'The City of Blue Fire, lit by gas, and the last great Free City standing against the {{Malazan Empire}}.' },
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
  { type: 'religion', name: 'Oponn', description: 'The Twin Jesters of Chance, gods who play games with mortal lives — chiefly through {{Ganoes Paran}} and the {{Coin of Oponn}}.' },
  // Creatures
  { type: 'creature', name: 'Hounds of Shadow', description: 'Huge, terrifying hounds that serve the Shadow Realm and hunt at {{Cotillion}}\'s side.' },
  { type: 'creature', name: 'Jaghut Tyrant', description: 'A {{Jaghut}} of immense power, imprisoned in the {{Gadrobi Hills}}. {{Adjunct Lorn}} and {{Tool}} plan to release him on {{Darujhistan}}.' },
  // Events
  { type: 'event', name: 'Siege of Pale', description: 'The {{Malazan Empire}} takes {{Pale}} and drives off {{Moon\'s Spawn}}, at a terrible cost to the {{Bridgeburners}} and the cadre mages.' },
  { type: 'event', name: 'Fête of Gedderone', description: 'Spring festival in {{Darujhistan}} where the city\'s plots — and {{Anomander Rake}}, {{Kalam}} and {{Rallick Nom}} — collide.' },
];

/** Creates the sample series. Refuses to run if a series with the same name already exists. Returns the series id. */
export async function loadMalazanSample(): Promise<number> {
  if ((await rpc('listSeries')).some((s) => s.name === SERIES)) {
    throw new Error(`"${SERIES}" already exists — delete it first to reload the sample.`);
  }
  const seriesId = await rpc('createSeries', {
    name: SERIES,
    description: 'Sample data from Book 1, Gardens of the Moon.',
  });
  const bookId = await rpc('addBook', seriesId, 'Gardens of the Moon');
  const typeIds = new Map((await rpc('listTypes', seriesId)).map((t) => [t.key, t.id]));

  // Pass 1: create every entry so each has an id.
  const ids = new Map<string, number>();
  for (const e of ENTRIES) {
    const typeId = typeIds.get(e.type);
    if (typeId === undefined) throw new Error(`Unknown type "${e.type}".`);
    ids.set(e.name, await rpc('createEntity', { seriesId, typeId, name: e.name, firstBookId: bookId }));
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
  return seriesId;
}
