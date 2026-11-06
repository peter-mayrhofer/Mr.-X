<!-- Platzhalter beim Laden – nie leere weiße Seiten. -->
<script lang="ts">
  let { w = "100%", h = "20px", r = "var(--r-s)" }: { w?: string; h?: string; r?: string } = $props();
</script>

<span class="sk" style:width={w} style:height={h} style:border-radius={r} aria-hidden="true"></span>

<style>
  .sk {
    display: block;
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
</style>
