/**
 * Line icons from Tabler Icons (MIT licence, https://tabler.io/icons). Only the icons listed here are
 * bundled. A type's `icon` is either one of these names or, for older and custom types, an emoji.
 */
const files = import.meta.glob(
  [
    // Built-in types
    '/node_modules/@tabler/icons/icons/outline/{user,users-group,building-castle,swords,shield,diamond,wand,paw,flame,script,bulb}.svg',
    // App icons (search results, header)
    '/node_modules/@tabler/icons/icons/outline/{books,book,hourglass,search}.svg',
    // More choices for custom types
    '/node_modules/@tabler/icons/icons/outline/{dragon,sword,bow,axe,hammer,crown,chess-knight,chess-queen,chess-rook,skull,ghost-2,mask,eye,feather,book-2,map-2,map-pin,compass,globe,mountain,trees,leaf,tent,campfire,building-church,tower,ship,anchor,horse,spider,fish,bone,key,coin,flask-2,sparkles,bolt,moon,moon-stars,sun,star,snowflake,droplet,heart,cards,dice-5,ankh,pentagram,pyramid,spiral}.svg',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Icon name → the SVG's inner markup (paths), without Tabler's invisible bounding-box path. */
export const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
    svg
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, '')
      .trim(),
  ]),
);

export const isIconName = (icon: string): icon is keyof typeof ICONS => Object.hasOwn(ICONS, icon);

/** For plain-text places (dropdown options, labels): emoji pass through, named icons are left out. */
export const iconText = (icon: string): string => (isIconName(icon) ? '' : icon);

/** Icons offered in the type picker, built-in type icons first. */
export const PICKER_ICONS: string[] = [
  'user', 'users-group', 'building-castle', 'swords', 'shield', 'diamond', 'wand', 'paw', 'flame', 'script',
  'dragon', 'sword', 'bow', 'axe', 'hammer', 'crown', 'chess-knight', 'chess-queen', 'chess-rook', 'skull',
  'ghost-2', 'mask', 'eye', 'feather', 'book-2', 'map-2', 'map-pin', 'compass', 'globe', 'mountain', 'trees',
  'leaf', 'tent', 'campfire', 'building-church', 'tower', 'ship', 'anchor', 'horse', 'spider', 'fish', 'bone',
  'key', 'coin', 'flask-2', 'sparkles', 'bolt', 'moon', 'moon-stars', 'sun', 'star', 'snowflake', 'droplet',
  'heart', 'cards', 'dice-5', 'ankh', 'pentagram', 'pyramid', 'spiral',
];
