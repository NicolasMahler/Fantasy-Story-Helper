<script lang="ts">
  import { ICONS, isIconName } from './icons';

  /**
   * Shows a type icon: a named line icon (see icons.ts) or, for older and custom types, an emoji.
   * Decorative by default; the surrounding text names the thing.
   */
  let { name, size = 16, color }: { name: string; size?: number; color?: string } = $props();
</script>

{#if isIconName(name)}
  <svg
    class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" style:color={color} aria-hidden="true"
  >{@html ICONS[name]}</svg>
{:else if name}
  <span class="emoji" style:font-size={`${size}px`} aria-hidden="true">{name}</span>
{/if}

<style>
  .icon { display: inline-block; flex: none; vertical-align: -0.15em; }
  .emoji { display: inline-block; line-height: 1; }
</style>
