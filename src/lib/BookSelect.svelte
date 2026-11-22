<script lang="ts">
  /** A book dropdown ("Book 2: Deadhouse Gates") with an empty choice first. Bind `value` to the book id. */
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import type { BookRef } from '../db/books';

  let {
    value = $bindable(null),
    books,
    emptyLabel = '(no book)',
    ...rest
  }: { value: number | null; books: BookRef[]; emptyLabel?: string } & Omit<HTMLSelectAttributes, 'value'> = $props();
</script>

<select bind:value {...rest}>
  <option value={null}>{emptyLabel}</option>
  {#each books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
</select>
