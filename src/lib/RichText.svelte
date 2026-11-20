<script lang="ts">
  import Icon from './Icon.svelte';
  import { tokenize } from '../db/mentions';
  import type { LinkTarget } from '../db/entities';
  import { href } from './route';

  let { text, links, seriesId }: { text: string; links: Record<number, LinkTarget>; seriesId: number } = $props();

  const segments = $derived(tokenize(text));
</script>

<div class="rich">
  {#each segments as s, i (i)}
    {#if s.kind === 'text'}{s.text}{:else if links[s.id]}<a
        class="mention"
        style:--c={links[s.id].color}
        href={href({ name: 'entity', seriesId, entityId: s.id })}><Icon name={links[s.id].icon} size={14} /> {links[s.id].name}</a
      >{:else}{s.label}{/if}
  {/each}
</div>

<style>
  .rich { white-space: pre-wrap; overflow-wrap: anywhere; }
  .mention {
    text-decoration: none;
    font-weight: 500;
    padding: 0 0.2em;
    border-radius: 4px;
    border-bottom: 2px solid var(--c);
    color: var(--text);
  }
  .mention:hover { background: color-mix(in srgb, var(--c) 18%, transparent); }
</style>
