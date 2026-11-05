<script lang="ts">
  let { id, class: className = "" }: { id?: string; class?: string } = $props();
</script>

<span class="beta-tag {className}" {id}>Beta</span>
