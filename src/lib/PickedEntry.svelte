<script lang="ts">
  /**
   * One chosen entry, or a picker to choose it: the chosen name with a Clear (or Change) button, else an
   * EntityPicker. Bind `value` to the choice.
   */
  import EntityPicker from './EntityPicker.svelte';

  type Picked = { id: number; name: string };

  let {
    value = $bindable(null),
    seriesId,
    label,
    placeholder,
    typeKey = null,
    exclude = [],
    clearLabel = 'Clear',
    emphasis = true,
  }: {
    value: Picked | null;
    seriesId: number;
    /** Accessible name of the picker input. */
    label: string;
    placeholder?: string;
    /** Restrict to one type, e.g. 'event'. */
    typeKey?: string | null;
    exclude?: number[];
    clearLabel?: string;
    /** Show the chosen name in bold. */
    emphasis?: boolean;
  } = $props();
</script>

{#if value}
  <div class="row">
    {#if emphasis}<strong>{value.name}</strong>{:else}<span>{value.name}</span>{/if}
    <button type="button" class="ghost" onclick={() => (value = null)}>{clearLabel}</button>
  </div>
{:else}
  <EntityPicker {seriesId} {typeKey} {exclude} {label} {placeholder} onpick={(e) => (value = { id: e.id, name: e.name })} />
{/if}
