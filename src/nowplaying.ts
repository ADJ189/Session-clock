// ── Now Playing → theme matching ────────────────────────────────────
// Spotify auto-detection reuses the existing OAuth PKCE integration in
// integrations.ts (Integrations.spotifyNowPlaying) rather than
// duplicating it. This module only adds the theme-matching layer on
// top, plus a manual "what's playing" override that works with any
// player — Apple Music, YouTube Music, a physical record player,
// whatever — since it doesn't depend on any API.
//
// Apple Music and YouTube Music aren't auto-detected: Apple's MusicKit
// JS needs a developer token signed server-side with a private key,
// which can't be done safely from a static site, and YouTube Music has
// no official public "now playing" API. The manual override covers
// both in practice.

export interface NowPlayingInfo { title: string; artist: string }

// Keyword → theme id, matched as a substring against "title artist"
// lowercased. Deliberately simple — this is a fun ambience feature, not
// a music metadata service, so a handful of soundtrack/theme-song
// giveaways is enough. Every target id below is verified to exist in
// themes.ts.
const THEME_KEYWORDS: [string, string][] = [
  ['interstellar', 'interstellar'], ['hans zimmer', 'interstellar'], ['no time for caution', 'interstellar'],
  ['dune', 'dune'], ['duncan idaho', 'dune'],
  ['blade runner', 'bladerunner'],
  ['the matrix', 'matrix'], ['clubbed to death', 'matrix'],
  ['breaking bad', 'breakingbad'],
  ['stranger things', 'strangerthings'], ['running up that hill', 'strangerthings'],
  ['the godfather', 'godfather'],
  ['inception', 'inception'],
  ['tenet', 'tenet'],
  ['cowboy bebop', 'cowboybebop'], ['tank!', 'cowboybebop'],
  ['your name', 'yourname'], ['radwimps', 'yourname'],
  ['ghost in the shell', 'ghostshell'],
  ['vinland saga', 'vinlandsaga'],
  ['jujutsu kaisen', 'jjk'],
  ['whiplash', 'whiplash'], ['caravan', 'whiplash'],
  ['the batman', 'thebatman'],
  ['john wick', 'johnwick'],
  ['oppenheimer', 'oppenheimer'],
  ['a real hero', 'drivemovie'],
  ['house of the dragon', 'dragonfire'], ['game of thrones', 'dragonfire'],
  ['peaky blinders', 'peakyblinders'], ['red right hand', 'peakyblinders'],
  ['the sopranos', 'sopranos'],
  ['twin peaks', 'twinpeaks'], ['laura palmer', 'twinpeaks'],
  ['true detective', 'truedetective'],
  ['fargo', 'fargo'],
  ['mad men', 'madmen'],
  ['gravity falls', 'gravityfalls'],
  ['adventure time', 'adventuretime'],
  ['sunflower', 'spiderverse'],
  ['studio ghibli', 'ghibli'], ['joe hisaishi', 'ghibli'],
];

export function matchThemeForTrack(info: NowPlayingInfo): string | null {
  const hay = `${info.title} ${info.artist}`.toLowerCase();
  for (const [kw, themeId] of THEME_KEYWORDS) {
    if (hay.includes(kw)) return themeId;
  }
  return null;
}
