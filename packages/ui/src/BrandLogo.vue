<template>
  <svg
    :class="['hq-logo', { 'hq-logo--center': centered }]"
    viewBox="0 0 1952 832"
    role="img"
    aria-label="HashQuiz"
  >
    <path class="hq-logo__hash-back" d="M544 407 517 532 645 532 672 407ZM27 407 0 532 129 533 102 659 230 659 285 406ZM82 154 55 279 183 279 210 154ZM497 27 470 153 597 154 570 280 700 279 727 154 598 153 625 27ZM239 27 212 153 340 153 367 27Z" />
    <path class="hq-logo__hash-front" d="M1840 419 1816 526 1927 526 1951 419ZM212 154 157 405 285 405 313 280 438 280 412 406 286 407 258 532 386 532 360 659 480 659 464 741 581 741 562 830 691 830 718 705 601 705 619 615 498 614 596 154Z" />
    <path class="hq-logo__text" d="M1400 149 1399 248 1597 248 1598 280 1552 281 1551 315 1510 315 1508 351 1469 351 1467 386 1434 387 1432 420 1398 421 1399 525 1741 526 1765 418 1597 417 1596 390 1598 387 1642 387 1644 350 1684 349 1687 314 1725 314 1727 279 1762 279 1762 149ZM1234 149 1231 153 1231 526 1346 526 1349 524 1350 500 1349 150ZM782 149 781 458 817 459 818 492 850 493 850 526 1109 526 1109 494 1141 492 1141 460 1177 458 1177 149 1059 149 1058 414 901 414 900 150ZM1231 1 1233 108 1349 109 1349 1Z" />
  </svg>
</template>

<script setup lang="ts">
/**
 * HashQuiz logo ("#uiz.": the hash merged with the q). Source artwork: docs/brand/.
 * Corner (default): fixed top left, discreet like the fullscreen button.
 */
defineProps<{ centered?: boolean }>()
</script>

<style scoped>
.hq-logo {
  position: fixed;
  top: 1.5vmin;
  left: 1.5vmin;
  z-index: 50;
  height: clamp(1.1rem, 2.6vmin, 1.9rem);
  width: auto;
  color: var(--hq-text-muted);
  opacity: 0.7;
  pointer-events: none;
}
/* Centered variant: a large logo in the page flow. */
.hq-logo--center {
  position: static;
  display: block;
  margin: 0 auto;
  height: clamp(2.5rem, 8vmin, 5.5rem);
  color: var(--hq-text);
  opacity: 1;
  pointer-events: auto;
}
.hq-logo__hash-back { fill: var(--hq-brand-violet); }
.hq-logo__hash-front { fill: var(--hq-brand-purple); }
.hq-logo__text { fill: currentColor; }
</style>
