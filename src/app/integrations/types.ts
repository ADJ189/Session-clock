export type IntegrationId =
  | "spotify"
  | "youtube"
  | "gcal"
  | "notion"
  | "todoist"
  | "linear"
  | "github";

export interface IntegrationPanelCallbacks {
  showToast: (msg: string, dur?: number) => void;
}

export interface IntegrationsService {
  cb: IntegrationPanelCallbacks;
  isSpotifyConnected: () => boolean;
  isYouTubeConnected: () => boolean;
  isGCalConnected: () => boolean;
  isNotionConnected: () => boolean;
  isTodoistConnected: () => boolean;
  isLinearConnected: () => boolean;
  isGithubConnected: () => boolean;
  disconnectAll: (id: IntegrationId) => void;
  spotifyLogin: (clientId: string) => Promise<void> | void;
  googleLogin: (clientId: string) => Promise<void> | void;
  oauthLogin: (provider: string, clientId: string) => Promise<void> | void;
  saveGCalCredentials: (apiKey: string, calendarId?: string) => void;
  saveNotionCredentials: (token: string, dbId: string) => void;
  saveTodoistCredentials: (token: string) => void;
  saveLinearCredentials: (token: string) => void;
  saveGithubCredentials: (token: string) => void;
  loadData: (id: string) => Record<string, string> | null;
  getRedirectUri: () => string;
  defaultSpotifyClientId: string;
  defaultGoogleClientId: string;
  googleClientIdKey: string;
}
