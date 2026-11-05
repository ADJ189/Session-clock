<script lang="ts">
  let {
    quote = "",
    meta = "",
  }: {
    quote?: string;
    meta?: string;
  } = $props();
</script>

<div class="quote-area">
  <p class="quote-text" id="quoteText">{quote}</p>
  <p class="lit-meta" id="litMeta">{meta}</p>
</div>
