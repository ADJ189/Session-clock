<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { Theme } from "../../../types";
  import type {
    ThemeFinderController,
    ThemeLibNavItem,
    ThemeLibSnapshot,
  } from "./types";
  import ThemeArt from "./ThemeArt.svelte";

  let { controller }: { controller: ThemeFinderController } = $props();

  // Read the controller once for the first paint; subsequent updates arrive
  // through the subscription below. `untrack` makes that intent explicit and
  // avoids Svelte's state_referenced_locally warning.
  let snapshot = $state<ThemeLibSnapshot>(
    untrack(() => controller.getSnapshot()),
  );

  onMount(() =>
    controller.subscribe((next) => {
      snapshot = next;
    }),
  );

  // Same developer-authored star as the imperative card fallback; kept inline
  // so the component has no HTML-string interpolation.
  const STAR =
    "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z";

  function themeStyle(t: Theme): string {
    return [
      `--tl-bg0:${t.baseBg[0] ?? "#000"}`,
      `--tl-bg1:${t.baseBg[1] ?? t.baseBg[0] ?? "#000"}`,
      `--tl-bg2:${t.baseBg[2] ?? t.baseBg[0] ?? "#000"}`,
      `--tl-accent:${t.accent}`,
      `--tl-accent2:${t.accent2}`,
      `--tl-text:${t.text}`,
      `--tl-font:${t.font}`,
    ].join(";");
  }

  function onSearchInput(event: Event) {
    controller.setQuery((event.currentTarget as HTMLInputElement).value);
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    // Escape clears a non-empty query first; with an empty box it closes the
    // library (the global handler only blurs focused inputs).
    event.stopPropagation();
    if ((event.currentTarget as HTMLInputElement).value) controller.clearSearch();
    else controller.close();
  }

  function onSortChange(event: Event) {
    controller.setSort((event.currentTarget as HTMLSelectElement).value);
  }

  function onNav(item: ThemeLibNavItem) {
    controller.setView(item.view);
  }

  function onRecentChoose(theme: Theme, event: MouseEvent) {
    const origin = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
      ".tl-recent-art",
    );
    controller.chooseTheme(theme, origin);
  }

  function onEmptyAction() {
    if (!snapshot.empty) return;
    if (snapshot.empty.action === "clear") controller.clearSearch();
    else controller.setView("all");
  }
</script>

<div class="tl-head">
  <div class="tl-titles">
    <h2 id="themeLibTitle">Theme Finder</h2>
    <span class="tl-count" id="tlCount" aria-live="polite">{snapshot.countLabel}</span>
  </div>
  <div class="tl-search">
    <svg
      class="tl-search-ico"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7"></circle>
      <path d="m20 20-3.5-3.5"></path>
    </svg>
    <input
      id="tlSearch"
      type="search"
      placeholder="Search worlds, shows, films, moods"
      aria-label="Search themes"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      value={snapshot.query}
      oninput={onSearchInput}
      onkeydown={onSearchKeydown}
    />
    <button
      type="button"
      id="tlClear"
      class="tl-clear"
      aria-label="Clear search"
      hidden={!snapshot.clearVisible}
      onclick={() => controller.clearSearch()}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12"></path>
      </svg>
    </button>
  </div>
  <select
    id="tlSort"
    class="tl-sort"
    aria-label="Sort themes"
    value={snapshot.sort}
    disabled={snapshot.sortDisabled}
    onchange={onSortChange}
  >
    <option value="default">Default order</option>
    <option value="az">A–Z</option>
  </select>
  <button
    type="button"
    class="modal-close tl-close"
    aria-label="Close theme library"
    onclick={() => controller.close()}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12"></path>
    </svg>
  </button>
</div>

<nav class="tl-nav" id="tlNav" aria-label="Theme collections">
  {#each snapshot.navItems as item (item.view)}
    {#if item.dividerBefore}<span class="tl-nav-divider"></span>{/if}
    <button
      type="button"
      class="tl-nav-item"
      class:active={item.active}
      data-view={item.view}
      aria-current={item.active ? "true" : undefined}
      onclick={() => onNav(item)}
    >
      <span class="tl-nav-label">{item.label}</span>
      <span class="tl-nav-count">{item.count}</span>
    </button>
  {/each}
</nav>

<div class="tl-body">
  <div class="tl-main" id="tlMain">
    <section
      class="tl-spotlight"
      id="tlSpotlight"
      aria-label="Current theme"
      hidden={!snapshot.spotlight}
      style={snapshot.spotlight ? themeStyle(snapshot.spotlight) : undefined}
      data-bg={snapshot.spotlight?.bgType}
    >
      {#if snapshot.spotlight}
        {@const theme = snapshot.spotlight}
        <div class="tl-current-art" aria-hidden="true">
          <ThemeArt theme={theme} markClass="tl-current-mark" fillMark={controller.fillMark} />
        </div>
        <div class="tl-current-copy">
          <span class="tl-current-label">
            <span class="tl-current-dot"></span>Using now
          </span>
          <span class="tl-current-name">{theme.name}</span>
          <span class="tl-current-sub">{theme.sub ?? snapshot.spotlightSub}</span>
        </div>
        <button
          type="button"
          class="tl-current-fav"
          class:is-fav={snapshot.spotlightFav}
          aria-pressed={String(snapshot.spotlightFav)}
          aria-label={snapshot.spotlightFav
            ? `Remove ${theme.name} from favourites`
            : `Add ${theme.name} to favourites`}
          onclick={() => controller.toggleFav(theme.id)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d={STAR} stroke-width="2" stroke-linejoin="round"></path>
          </svg>
        </button>
      {/if}
    </section>

    <section class="tl-shelf" id="tlRecentSection" hidden={!snapshot.recentsVisible}>
      <div class="tl-shelf-head">
        <div>
          <h3 class="tl-shelf-title">Recently used</h3>
        </div>
        <button
          class="tl-shelf-link"
          type="button"
          id="tlRecentAll"
          onclick={() => controller.setView("recent")}
        >
          View all
        </button>
      </div>
      <div class="tl-recent-rail" id="tlRecentRail">
        {#each snapshot.recents as theme (theme.id)}
          <button
            type="button"
            class="tl-recent-card"
            data-id={theme.id}
            style={themeStyle(theme)}
            data-bg={theme.bgType}
            aria-label={`Use ${theme.name}`}
            onclick={(event) => onRecentChoose(theme, event)}
          >
            <span class="tl-recent-art" aria-hidden="true">
              <ThemeArt theme={theme} markClass="tl-recent-mark" fillMark={controller.fillMark} />
            </span>
            <span class="tl-recent-name">{theme.name}</span>
          </button>
        {/each}
      </div>
    </section>

    <div class="tl-wall-head">
      <div>
        <h3 class="tl-wall-title" id="tlWallTitle">{snapshot.wallTitle}</h3>
      </div>
      <span class="tl-wall-count" id="tlWallCount" aria-hidden="true">{snapshot.wallCount}</span>
    </div>

    <!-- The card wall is rendered by themelib.ts: filtering re-attaches the
         same cached card nodes instead of rebuilding ~100 previews. Svelte
         owns the grid element and every sibling surface; the card children
         remain a single imperative owner. -->
    <div class="tl-grid" id="tlGrid" role="list"></div>

    <div class="tl-empty" id="tlEmpty" hidden={!snapshot.empty}>
      {#if snapshot.empty}
        <p class="tl-empty-title">{snapshot.empty.title}</p>
        <p class="tl-empty-body">{snapshot.empty.body}</p>
        <button class="tl-empty-btn" type="button" onclick={onEmptyAction}>
          {snapshot.empty.actionLabel}
        </button>
      {/if}
    </div>
  </div>
</div>
