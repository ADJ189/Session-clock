<script lang="ts">
  import ProviderCard from "./ProviderCard.svelte";
  import type {
    IntegrationId,
    IntegrationPanelCallbacks,
    IntegrationsService,
  } from "./types";

  let { service }: { service: IntegrationsService } = $props();

  // Track open cards
  let openCardId = $state<string | null>(null);

  // Reactive version trigger
  let version = $state(0);
  function refreshConn() {
    version++;
  }

  let connSpotify = $derived.by(() => {
    void version;
    return service.isSpotifyConnected();
  });
  let connYoutube = $derived.by(() => {
    void version;
    return service.isYouTubeConnected();
  });
  let connGcal = $derived.by(() => {
    void version;
    return service.isGCalConnected();
  });
  let connNotion = $derived.by(() => {
    void version;
    return service.isNotionConnected();
  });
  let connTodoist = $derived.by(() => {
    void version;
    return service.isTodoistConnected();
  });
  let connLinear = $derived.by(() => {
    void version;
    return service.isLinearConnected();
  });
  let connGithub = $derived.by(() => {
    void version;
    return service.isGithubConnected();
  });

  function handleToggle(id: string) {
    openCardId = openCardId === id ? null : id;
  }

  function handleDisconnect(id: IntegrationId, name: string) {
    service.disconnectAll(id);
    refreshConn();
    service.cb.showToast(`${name} disconnected`);
  }

  let redirectUri = $derived(service.getRedirectUri());

  // Form states
  let spotifyClientId = $state(localStorage.getItem("sc_spotify_client_id") ?? "");
  let showSpotifySelfHost = $state(false);

  let googleClientId = $state("");
  let showGoogleSelfHost = $state(false);

  let gcalApiKey = $state("");
  let gcalCalendarId = $state("primary");

  let notionClientId = $state(localStorage.getItem("sc_notion_client_id") ?? "");
  let notionDbId = $state("");
  let notionManualToken = $state("");
  let showNotionManual = $state(false);

  let todoistClientId = $state(localStorage.getItem("sc_todoist_client_id") ?? "");
  let todoistManualToken = $state("");
  let showTodoistManual = $state(false);

  let linearClientId = $state(localStorage.getItem("sc_linear_client_id") ?? "");
  let linearManualToken = $state("");
  let showLinearManual = $state(false);

  let githubClientId = $state(localStorage.getItem("sc_github_client_id") ?? "");
  let githubManualToken = $state("");
  let showGithubManual = $state(false);

  $effect(() => {
    googleClientId = localStorage.getItem(service.googleClientIdKey) ?? "";
    gcalApiKey = service.loadData("gcal")?.apiKey ?? "";
    gcalCalendarId = service.loadData("gcal")?.calendarId ?? "primary";
    notionDbId = service.loadData("notion")?.databaseId ?? "";
  });
</script>

<!-- 1. Spotify -->
<ProviderCard
  id="spotify"
  name="Spotify"
  icon="🎵"
  color="#1DB954"
  desc="Show now-playing, control playback, and launch focus playlists."
  connected={connSpotify}
  open={openCardId === "spotify"}
  ontoggle={() => handleToggle("spotify")}
>
  {#if connSpotify}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("spotify", "Spotify")}
    >
      Disconnect Spotify
    </button>
  {:else}
    {#if service.defaultSpotifyClientId}
      <button
        type="button"
        class="int-connect-btn"
        onclick={() => service.spotifyLogin(service.defaultSpotifyClientId)}
      >
        Connect with Spotify
      </button>
      {#if !showSpotifySelfHost}
        <button
          type="button"
          class="int-manual-toggle"
          style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;"
          onclick={() => (showSpotifySelfHost = true)}
        >
          use your own app instead ▾
        </button>
      {/if}
    {/if}

    {#if !service.defaultSpotifyClientId || showSpotifySelfHost}
      <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
        Create a free app at developer.spotify.com → Dashboard → Create App, add this exact Redirect URI, then paste the Client ID:
      </p>
      <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
        {redirectUri}
      </code>
      <input
        type="text"
        placeholder="Client ID"
        aria-label="Client ID"
        bind:value={spotifyClientId}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={async () => {
          const id = spotifyClientId.trim();
          if (!id) {
            service.cb.showToast("Enter a Client ID first");
            return;
          }
          await service.spotifyLogin(id);
        }}
      >
        Connect with Spotify
      </button>
    {/if}
  {/if}
</ProviderCard>

<!-- 2. YouTube -->
<ProviderCard
  id="youtube"
  name="YouTube"
  icon="📺"
  color="#FF0000"
  desc="Pull focus/study playlists from YouTube. Shares the Google connection below."
  connected={connYoutube}
  open={openCardId === "youtube"}
  ontoggle={() => handleToggle("youtube")}
>
  {#if connYoutube}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("youtube", "YouTube")}
    >
      Disconnect YouTube
    </button>
  {:else}
    {#if service.defaultGoogleClientId}
      <button
        type="button"
        class="int-connect-btn"
        onclick={async (e) => {
          (e.currentTarget as HTMLButtonElement).textContent = "Connecting…";
          await service.googleLogin(service.defaultGoogleClientId);
        }}
      >
        Connect Google for YouTube
      </button>
      {#if !showGoogleSelfHost}
        <button
          type="button"
          class="int-manual-toggle"
          style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;"
          onclick={() => (showGoogleSelfHost = true)}
        >
          use a different Client ID ▾
        </button>
      {/if}
    {/if}

    {#if !service.defaultGoogleClientId || showGoogleSelfHost}
      <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
        Paste the Google OAuth Client ID this deployment already has configured (ask the site owner if you don't have it — see CONTRIBUTING.md). Its Authorized redirect URI must be exactly:
      </p>
      <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
        {redirectUri}
      </code>
      <input
        type="text"
        placeholder="Client ID"
        aria-label="Client ID"
        bind:value={googleClientId}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={async (e) => {
          const id = googleClientId.trim();
          if (!id) {
            service.cb.showToast("Enter a Client ID first");
            return;
          }
          (e.currentTarget as HTMLButtonElement).textContent = "Connecting…";
          await service.googleLogin(id);
        }}
      >
        Connect Google for YouTube
      </button>
    {/if}
  {/if}
</ProviderCard>

<!-- 3. Google Calendar -->
<ProviderCard
  id="gcal"
  name="Google Calendar"
  icon="📅"
  color="#4285F4"
  desc="Show upcoming events in the focus widget."
  connected={connGcal}
  open={openCardId === "gcal"}
  ontoggle={() => handleToggle("gcal")}
>
  {#if connGcal}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("gcal", "Google Calendar")}
    >
      Disconnect Google Calendar
    </button>
  {:else}
    {#if service.defaultGoogleClientId}
      <button
        type="button"
        class="int-connect-btn"
        onclick={async (e) => {
          (e.currentTarget as HTMLButtonElement).textContent = "Connecting…";
          await service.googleLogin(service.defaultGoogleClientId);
        }}
      >
        Connect Google for Calendar
      </button>
    {/if}

    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      — or, for a public calendar only, a plain API key works without signing in —
    </p>
    <input
      type="text"
      placeholder="API Key"
      aria-label="API Key"
      bind:value={gcalApiKey}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <input
      type="text"
      placeholder="Calendar ID (default: primary)"
      aria-label="Calendar ID (default: primary)"
      bind:value={gcalCalendarId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={() => {
        const k = gcalApiKey.trim();
        const c2 = gcalCalendarId.trim() || "primary";
        if (!k) {
          service.cb.showToast("Enter an API key");
          return;
        }
        service.saveGCalCredentials(k, c2);
        refreshConn();
        service.cb.showToast("📅 Google Calendar connected");
      }}
    >
      Save API key
    </button>
  {/if}
</ProviderCard>

<!-- 4. Notion -->
<ProviderCard
  id="notion"
  name="Notion"
  icon="📝"
  color="#787774"
  desc="See your Notion tasks in the focus sidebar."
  connected={connNotion}
  open={openCardId === "notion"}
  ontoggle={() => handleToggle("notion")}
>
  {#if connNotion}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("notion", "Notion")}
    >
      Disconnect Notion
    </button>
  {:else}
    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      Create a public OAuth integration at notion.so/my-integrations, add this exact Redirect URI, then paste the OAuth Client ID:
    </p>
    <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
      {redirectUri}
    </code>
    <input
      type="text"
      placeholder="OAuth Client ID"
      aria-label="OAuth Client ID"
      bind:value={notionClientId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={async () => {
        const id = notionClientId.trim();
        if (!id) {
          service.cb.showToast("Enter a Client ID first");
          return;
        }
        await service.oauthLogin("notion", id);
      }}
    >
      Connect with Notion
    </button>

    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      Then share your database with the integration and enter its ID:
    </p>
    <input
      type="text"
      placeholder="Database ID (needed either way)"
      aria-label="Database ID (needed either way)"
      bind:value={notionDbId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={() => {
        const db = notionDbId.trim();
        if (!db) {
          service.cb.showToast("Enter a database ID");
          return;
        }
        const existing = service.loadData("notion");
        if (!existing?.token) {
          service.cb.showToast("Connect with Notion first");
          return;
        }
        service.saveNotionCredentials(existing.token, db);
        refreshConn();
        service.cb.showToast("📝 Database linked");
      }}
    >
      Save database ID
    </button>

    <button
      type="button"
      style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;display:block;"
      onclick={() => (showNotionManual = !showNotionManual)}
    >
      or paste a token manually ▾
    </button>

    {#if showNotionManual}
      <input
        type="text"
        placeholder="Internal Integration Token (secret_…)"
        aria-label="Internal Integration Token (secret_…)"
        bind:value={notionManualToken}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={() => {
          const t = notionManualToken.trim();
          const db = notionDbId.trim();
          if (!t) {
            service.cb.showToast("Enter a token first");
            return;
          }
          if (!db) {
            service.cb.showToast("Enter a database ID first");
            return;
          }
          service.saveNotionCredentials(t, db);
          refreshConn();
          service.cb.showToast("Notion connected");
        }}
      >
        Save token
      </button>
    {/if}
  {/if}
</ProviderCard>

<!-- 5. Todoist -->
<ProviderCard
  id="todoist"
  name="Todoist"
  icon="✅"
  color="#E44332"
  desc="Show today's Todoist tasks in the focus sidebar."
  connected={connTodoist}
  open={openCardId === "todoist"}
  ontoggle={() => handleToggle("todoist")}
>
  {#if connTodoist}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("todoist", "Todoist")}
    >
      Disconnect Todoist
    </button>
  {:else}
    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      Create an app at developer.todoist.com/appconsole, add this exact OAuth redirect URL, then paste the Client ID:
    </p>
    <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
      {redirectUri}
    </code>
    <input
      type="text"
      placeholder="Client ID"
      aria-label="Client ID"
      bind:value={todoistClientId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={async () => {
        const id = todoistClientId.trim();
        if (!id) {
          service.cb.showToast("Enter a Client ID first");
          return;
        }
        await service.oauthLogin("todoist", id);
      }}
    >
      Connect with Todoist
    </button>

    <button
      type="button"
      style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;display:block;"
      onclick={() => (showTodoistManual = !showTodoistManual)}
    >
      or paste a token manually ▾
    </button>

    {#if showTodoistManual}
      <input
        type="text"
        placeholder="API Token"
        aria-label="API Token"
        bind:value={todoistManualToken}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={() => {
          const t = todoistManualToken.trim();
          if (!t) {
            service.cb.showToast("Enter a token first");
            return;
          }
          service.saveTodoistCredentials(t);
          refreshConn();
          service.cb.showToast("Todoist connected");
        }}
      >
        Save token
      </button>
    {/if}
  {/if}
</ProviderCard>

<!-- 6. Linear -->
<ProviderCard
  id="linear"
  name="Linear"
  icon="🔷"
  color="#5E6AD2"
  desc="Show your assigned Linear issues in the focus sidebar."
  connected={connLinear}
  open={openCardId === "linear"}
  ontoggle={() => handleToggle("linear")}
>
  {#if connLinear}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("linear", "Linear")}
    >
      Disconnect Linear
    </button>
  {:else}
    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      Create an OAuth app at linear.app/settings/api/applications, add this exact redirect URI, then paste the Client ID:
    </p>
    <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
      {redirectUri}
    </code>
    <input
      type="text"
      placeholder="Client ID"
      aria-label="Client ID"
      bind:value={linearClientId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={async () => {
        const id = linearClientId.trim();
        if (!id) {
          service.cb.showToast("Enter a Client ID first");
          return;
        }
        await service.oauthLogin("linear", id);
      }}
    >
      Connect with Linear
    </button>

    <button
      type="button"
      style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;display:block;"
      onclick={() => (showLinearManual = !showLinearManual)}
    >
      or paste a token manually ▾
    </button>

    {#if showLinearManual}
      <input
        type="text"
        placeholder="Personal API Key (lin_api_…)"
        aria-label="Personal API Key (lin_api_…)"
        bind:value={linearManualToken}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={() => {
          const t = linearManualToken.trim();
          if (!t) {
            service.cb.showToast("Enter a token first");
            return;
          }
          service.saveLinearCredentials(t);
          refreshConn();
          service.cb.showToast("Linear connected");
        }}
      >
        Save token
      </button>
    {/if}
  {/if}
</ProviderCard>

<!-- 7. GitHub -->
<ProviderCard
  id="github"
  name="GitHub"
  icon="🐙"
  color="#8b8f98"
  desc="Show your assigned GitHub issues and PRs in the focus sidebar."
  connected={connGithub}
  open={openCardId === "github"}
  ontoggle={() => handleToggle("github")}
>
  {#if connGithub}
    <button
      type="button"
      class="int-disconnect-btn"
      onclick={() => handleDisconnect("github", "GitHub")}
    >
      Disconnect GitHub
    </button>
  {:else}
    <p style="font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;">
      Create an OAuth App at github.com/settings/developers, set this exact callback URL, then paste the Client ID:
    </p>
    <code style="display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;">
      {redirectUri}
    </code>
    <input
      type="text"
      placeholder="Client ID"
      aria-label="Client ID"
      bind:value={githubClientId}
      style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
    />
    <button
      type="button"
      class="int-connect-btn"
      onclick={async () => {
        const id = githubClientId.trim();
        if (!id) {
          service.cb.showToast("Enter a Client ID first");
          return;
        }
        await service.oauthLogin("github", id);
      }}
    >
      Connect with GitHub
    </button>

    <button
      type="button"
      style="background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;display:block;"
      onclick={() => (showGithubManual = !showGithubManual)}
    >
      or paste a token manually ▾
    </button>

    {#if showGithubManual}
      <input
        type="text"
        placeholder="Personal Access Token (ghp_…)"
        aria-label="Personal Access Token (ghp_…)"
        bind:value={githubManualToken}
        style="width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;"
      />
      <button
        type="button"
        class="int-connect-btn"
        onclick={() => {
          const t = githubManualToken.trim();
          if (!t) {
            service.cb.showToast("Enter a token first");
            return;
          }
          service.saveGithubCredentials(t);
          refreshConn();
          service.cb.showToast("GitHub connected");
        }}
      >
        Save token
      </button>
    {/if}
  {/if}
</ProviderCard>
