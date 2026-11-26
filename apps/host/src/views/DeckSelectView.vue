<template>
  <div class="decks">
    <div class="decks__inner">
      <BrandLogo centered class="decks__logo" />

      <!-- Tag page -->
      <template v-if="route.kind === 'tag'">
        <a class="decks__back" href="#/">← All quizzes</a>
        <h1 class="decks__title"><span class="decks__hash">#</span>{{ route.tag }}</h1>
        <ul v-if="tagDecks.length" class="decks__grid">
          <DeckCard v-for="deck in tagDecks" :key="deck.id" :deck="deck" :solo-href="soloHref(deck)" @pick="pick" />
        </ul>
        <p v-else class="decks__empty">No quiz with the tag “{{ route.tag }}”.</p>
      </template>

      <!-- Full list -->
      <template v-else>
        <h1 class="decks__title">Pick a quiz</h1>
        <p v-if="loading" class="decks__empty">Loading quizzes…</p>
        <p v-else-if="loadError" class="decks__empty">Could not load the quiz list: {{ loadError }}</p>
        <ul v-else-if="decks.length" class="decks__grid">
          <DeckCard v-for="deck in decks" :key="deck.id" :deck="deck" :solo-href="soloHref(deck)" @pick="pick" />
        </ul>
        <p v-else class="decks__empty">No decks found. Add <code>.quizv.md</code> files to your decks folder.</p>

        <section v-if="tags.length" class="decks__tags" aria-labelledby="decks-tags">
          <h2 id="decks-tags" class="decks__heading qv-label">Tags</h2>
          <ul class="decks__taglist">
            <li v-for="t in tags" :key="t.tag">
              <a class="decks__tag" :href="tagHash(t.tag)">
                {{ t.tag }} <span class="decks__tag-count">{{ t.count }}</span>
              </a>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BrandLogo } from '@quizv/ui'
import { useGameStore } from '../stores/game'
import { loadDecks, type BundledDeck } from '../decks'
import { decksForTag, parseDeckHash, playerBaseUrl, soloUrl, tagCounts, tagHash } from '../deck-browse'
import DeckCard from '../components/DeckCard.vue'

const game = useGameStore()
const decks = ref<BundledDeck[]>([])
const loading = ref(true)
const loadError = ref('')
const tags = computed(() => tagCounts(decks.value))

onMounted(async () => {
  try {
    decks.value = await loadDecks()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

// Minimal hash routing (#/tag/<tag>): the browser back button and direct links keep working.
const route = ref(parseDeckHash(location.hash))
const sync = () => { route.value = parseDeckHash(location.hash) }
onMounted(() => window.addEventListener('hashchange', sync))
onBeforeUnmount(() => window.removeEventListener('hashchange', sync))

const tagDecks = computed(() => (route.value.kind === 'tag' ? decksForTag(decks.value, route.value.tag) : []))

// The solo link needs the same Supabase credentials as a room; it opens the player app in this tab.
const hasCreds = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
const playerBase = playerBaseUrl(import.meta.env, location)
const soloHref = (deck: BundledDeck) =>
  hasCreds && deck.quiz.meta.solo ? soloUrl(deck.id, playerBase) : undefined

function pick(deck: BundledDeck) {
  game.startWithDeck(deck)
}
</script>

<style scoped>
/* The page scrolls on its own: the app shell is fixed height and the star backdrop stays put behind it. */
.decks { height: 100%; overflow-y: auto; }
.decks__inner {
  max-width: 84rem;
  margin: 0 auto;
  padding: 4vmin 4vmin 6vmin;
  display: flex;
  flex-direction: column;
  gap: 3vmin;
}
.decks__title { margin: 0; text-align: center; font-size: clamp(1.4rem, 3.4vmin, 2.4rem); font-weight: 600; }
.decks__hash { color: var(--qv-accent); margin-right: 0.1em; }
.decks__back {
  align-self: flex-start;
  color: var(--qv-text-muted);
  text-decoration: none;
  font-size: clamp(0.9rem, 1.8vmin, 1.2rem);
}
.decks__back:hover, .decks__back:focus-visible { color: var(--qv-text); text-decoration: underline; }
.decks__grid {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 2vmin;
}
.decks__empty { text-align: center; color: var(--qv-text-muted); }
.decks__heading { margin: 0 0 1.2vmin; color: var(--qv-text-muted); font-size: clamp(0.8rem, 1.6vmin, 1.1rem); }
.decks__taglist { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 1vmin; }
.decks__tag {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.8rem;
  background: color-mix(in srgb, var(--qv-surface) 82%, transparent);
  border: 1px solid var(--qv-border);
  border-radius: var(--qv-radius-sm);
  color: var(--qv-text);
  text-decoration: none;
  font-size: clamp(0.85rem, 1.8vmin, 1.2rem);
}
.decks__tag:hover { border-color: var(--qv-accent); }
.decks__tag:focus-visible { outline: 2px solid var(--qv-accent); outline-offset: 2px; }
.decks__tag-count { color: var(--qv-text-muted); font-size: 0.85em; }
</style>
