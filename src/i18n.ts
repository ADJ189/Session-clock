// ── Internationalisation ──────────────────────────────────────────────
// 8 languages: EN, ES, FR, DE, JA, KO, PT, HI
// Keys used across main.ts UI strings

export type Locale = 'en'|'es'|'fr'|'de'|'ja'|'ko'|'pt'|'hi';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
  ja: '日本語',  ko: '한국어',  pt: 'Português', hi: 'हिन्दी',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪',
  ja: '🇯🇵', ko: '🇰🇷', pt: '🇧🇷', hi: '🇮🇳',
};

export interface Strings {
  // Session controls
  beginSession: string;
  takeBreak: string;
  pauseBreak: string;
  continueSession: string;
  resetTimer: string;
  sessionTimer: string;
  workingOn: string;
  workingOnPlaceholder: string;

  // Status
  readyToFocus: string;
  inProgress: string;
  sessionPaused: string;
  sessionComplete: string;
  breakTime: string;
  almostThere: string;

  // Pomodoro
  focusSession: string;
  shortBreak: string;
  longBreak: string;

  // Bottom dock
  sound: string;
  log: string;
  share: string;
  shop: string;
  settings: string;

  // Settings
  preferences: string;
  general: string;
  soundLabel: string;
  focus: string;
  display: string;
  privacy: string;

  // Toasts / messages
  themeSaved: string;
  sessionSaved: string;
  copied: string;
  privacyOn: string;
  privacyOff: string;
  incognitoOn: string;
  incognitoOff: string;

  // Onboarding
  welcomeTitle: string;
  welcomeBody: string;
  getStarted: string;
  skipAll: string;
  sessionLengthQ: string;
  sessionLengthHint: string;
  chooseThemeQ: string;
  chooseThemeHint: string;
  soundQ: string;
  soundHint: string;
  skipBtn: string;

  // Integrations
  integrations: string;
  connectSpotify: string;
  connectCalendar: string;
  connectNotion: string;
  connectTodoist: string;
  noUpcomingEvents: string;
  noTasks: string;
  focusPlaylist: string;
  nextEvent: string;

  // Rating
  howDidItFeel: string;
  ratingRough: string;
  ratingDistracted: string;
  ratingOkay: string;
  ratingFocused: string;
  ratingZone: string;
  skipRating: string;

  // World clock
  worldClock: string;
  addTimezone: string;

  // Countdown
  deadlineCountdown: string;
  startCountdown: string;
  clearCountdown: string;

  // Language
  language: string;
}

const en: Strings = {
  beginSession: 'Begin Session', takeBreak: 'Take a Break',
  pauseBreak: 'Pause Break', continueSession: 'Continue Focus',
  resetTimer: 'Reset', sessionTimer: 'Session Timer',
  workingOn: 'Working on', workingOnPlaceholder: 'what are you working on?',
  readyToFocus: 'Ready when you are. Begin your first session.',
  inProgress: 'Focus session in progress. Stay with it.',
  sessionPaused: 'Session paused. Continue when you are ready.',
  sessionComplete: 'Session complete. Well done!',
  breakTime: 'Break time. Breathe, stretch, hydrate.',
  almostThere: 'Almost there —',
  focusSession: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break',
  sound: 'Sound', log: 'Log', share: 'Share', shop: 'Shop', settings: 'Settings',
  preferences: 'Preferences', general: 'General', soundLabel: 'Sound',
  focus: 'Focus', display: 'Display', privacy: 'Privacy',
  themeSaved: 'Theme saved', sessionSaved: 'Session saved',
  copied: 'Copied to clipboard', privacyOn: 'Privacy Mode on',
  privacyOff: 'Privacy Mode off', incognitoOn: '🕵 Incognito on',
  incognitoOff: 'Incognito off',
  welcomeTitle: 'Welcome to Session Clock',
  welcomeBody: 'A precise, beautiful focus timer — themes, binaural beats, session tracking, and more.',
  getStarted: 'Get started →', skipAll: 'Skip all',
  sessionLengthQ: 'Session length?',
  sessionLengthHint: 'How long is your typical focus block?',
  chooseThemeQ: 'Choose your vibe',
  chooseThemeHint: '45+ themes available — change anytime.',
  soundQ: 'Ambient sound?',
  soundHint: 'Background audio helps many people focus deeply. Optional.',
  skipBtn: 'Skip →',
  integrations: 'Integrations',
  connectSpotify: 'Connect Spotify', connectCalendar: 'Connect Google Calendar',
  connectNotion: 'Connect Notion', connectTodoist: 'Connect Todoist',
  noUpcomingEvents: 'No upcoming events', noTasks: 'No tasks',
  focusPlaylist: 'Focus Playlist', nextEvent: 'Next:',
  howDidItFeel: 'How did that session feel?',
  ratingRough: 'Rough', ratingDistracted: 'Distracted', ratingOkay: 'Okay',
  ratingFocused: 'Focused', ratingZone: 'In the zone', skipRating: 'Skip',
  worldClock: 'World Clock', addTimezone: 'Add timezone',
  deadlineCountdown: 'Deadline Countdown', startCountdown: 'Start countdown',
  clearCountdown: 'Clear countdown', language: 'Language',
};

const es: Strings = {
  beginSession: 'Iniciar sesión', takeBreak: 'Tomar descanso',
  pauseBreak: 'Pausar descanso', continueSession: 'Continuar enfoque',
  resetTimer: 'Reiniciar', sessionTimer: 'Temporizador',
  workingOn: 'Trabajando en', workingOnPlaceholder: '¿en qué estás trabajando?',
  readyToFocus: 'Listo cuando quieras. Comienza tu primera sesión.',
  inProgress: 'Sesión de enfoque en progreso. ¡Sigue así!',
  sessionPaused: 'Sesión pausada. Continúa cuando estés listo.',
  sessionComplete: '¡Sesión completada. ¡Bien hecho!',
  breakTime: 'Hora del descanso. Respira, estírate, hidrátate.',
  almostThere: 'Ya casi —',
  focusSession: 'Enfoque', shortBreak: 'Descanso corto', longBreak: 'Descanso largo',
  sound: 'Sonido', log: 'Registro', share: 'Compartir', shop: 'Tienda', settings: 'Ajustes',
  preferences: 'Preferencias', general: 'General', soundLabel: 'Sonido',
  focus: 'Enfoque', display: 'Pantalla', privacy: 'Privacidad',
  themeSaved: 'Tema guardado', sessionSaved: 'Sesión guardada',
  copied: 'Copiado al portapapeles', privacyOn: 'Modo privacidad activado',
  privacyOff: 'Modo privacidad desactivado', incognitoOn: '🕵 Incógnito activado',
  incognitoOff: 'Incógnito desactivado',
  welcomeTitle: 'Bienvenido a Session Clock',
  welcomeBody: 'Un temporizador de enfoque preciso y hermoso — temas, latidos binaurales, seguimiento de sesiones y más.',
  getStarted: 'Comenzar →', skipAll: 'Omitir todo',
  sessionLengthQ: '¿Duración de sesión?', sessionLengthHint: '¿Cuánto dura tu bloque de enfoque?',
  chooseThemeQ: 'Elige tu estilo', chooseThemeHint: '+45 temas disponibles — cambia cuando quieras.',
  soundQ: '¿Sonido ambiente?', soundHint: 'El audio de fondo ayuda a muchos a concentrarse. Opcional.',
  skipBtn: 'Omitir →',
  integrations: 'Integraciones', connectSpotify: 'Conectar Spotify',
  connectCalendar: 'Conectar Google Calendar', connectNotion: 'Conectar Notion',
  connectTodoist: 'Conectar Todoist', noUpcomingEvents: 'Sin eventos próximos',
  noTasks: 'Sin tareas', focusPlaylist: 'Lista de enfoque', nextEvent: 'Próximo:',
  howDidItFeel: '¿Cómo fue esa sesión?',
  ratingRough: 'Difícil', ratingDistracted: 'Distraído', ratingOkay: 'Regular',
  ratingFocused: 'Enfocado', ratingZone: 'En la zona', skipRating: 'Omitir',
  worldClock: 'Reloj mundial', addTimezone: 'Agregar zona horaria',
  deadlineCountdown: 'Cuenta regresiva', startCountdown: 'Iniciar cuenta regresiva',
  clearCountdown: 'Eliminar cuenta regresiva', language: 'Idioma',
};

const fr: Strings = {
  beginSession: 'Commencer', takeBreak: 'Faire une pause',
  pauseBreak: 'Pause en cours', continueSession: 'Reprendre',
  resetTimer: 'Réinitialiser', sessionTimer: 'Minuteur',
  workingOn: 'Je travaille sur', workingOnPlaceholder: 'sur quoi travaillez-vous ?',
  readyToFocus: 'Prêt quand vous l\'êtes. Commencez votre première session.',
  inProgress: 'Session de concentration en cours.',
  sessionPaused: 'Session en pause. Reprenez quand vous êtes prêt.',
  sessionComplete: 'Session terminée. Bien joué !',
  breakTime: 'Pause. Respirez, étirez-vous, hydratez-vous.',
  almostThere: 'Presque terminé —',
  focusSession: 'Focus', shortBreak: 'Courte pause', longBreak: 'Longue pause',
  sound: 'Son', log: 'Journal', share: 'Partager', shop: 'Boutique', settings: 'Réglages',
  preferences: 'Préférences', general: 'Général', soundLabel: 'Son',
  focus: 'Focus', display: 'Affichage', privacy: 'Confidentialité',
  themeSaved: 'Thème enregistré', sessionSaved: 'Session enregistrée',
  copied: 'Copié dans le presse-papiers', privacyOn: 'Mode confidentialité activé',
  privacyOff: 'Mode confidentialité désactivé', incognitoOn: '🕵 Incognito activé',
  incognitoOff: 'Incognito désactivé',
  welcomeTitle: 'Bienvenue sur Session Clock',
  welcomeBody: 'Un minuteur de concentration précis et beau — thèmes, battements binauraux, suivi des sessions.',
  getStarted: 'Commencer →', skipAll: 'Tout ignorer',
  sessionLengthQ: 'Durée de session ?', sessionLengthHint: 'Quelle est votre durée de concentration habituelle ?',
  chooseThemeQ: 'Choisissez votre ambiance', chooseThemeHint: '+45 thèmes disponibles.',
  soundQ: 'Son ambiant ?', soundHint: 'La musique de fond aide à se concentrer. Optionnel.',
  skipBtn: 'Passer →',
  integrations: 'Intégrations', connectSpotify: 'Connecter Spotify',
  connectCalendar: 'Connecter Google Agenda', connectNotion: 'Connecter Notion',
  connectTodoist: 'Connecter Todoist', noUpcomingEvents: 'Aucun événement',
  noTasks: 'Aucune tâche', focusPlaylist: 'Playlist de concentration', nextEvent: 'Prochain :',
  howDidItFeel: 'Comment s\'est passée cette session ?',
  ratingRough: 'Difficile', ratingDistracted: 'Distrait', ratingOkay: 'Correct',
  ratingFocused: 'Concentré', ratingZone: 'Dans la zone', skipRating: 'Passer',
  worldClock: 'Horloge mondiale', addTimezone: 'Ajouter un fuseau',
  deadlineCountdown: 'Compte à rebours', startCountdown: 'Démarrer',
  clearCountdown: 'Effacer', language: 'Langue',
};

const de: Strings = {
  beginSession: 'Sitzung starten', takeBreak: 'Pause machen',
  pauseBreak: 'Pause pausieren', continueSession: 'Weiter',
  resetTimer: 'Zurücksetzen', sessionTimer: 'Sitzungstimer',
  workingOn: 'Arbeite an', workingOnPlaceholder: 'woran arbeitest du?',
  readyToFocus: 'Bereit, wenn du es bist. Starte deine erste Sitzung.',
  inProgress: 'Fokus-Sitzung läuft. Bleib dran.',
  sessionPaused: 'Sitzung pausiert. Mach weiter, wenn du bereit bist.',
  sessionComplete: 'Sitzung abgeschlossen. Gut gemacht!',
  breakTime: 'Pause. Atme, dehne dich, trinke Wasser.',
  almostThere: 'Fast geschafft —',
  focusSession: 'Fokus', shortBreak: 'Kurze Pause', longBreak: 'Lange Pause',
  sound: 'Ton', log: 'Protokoll', share: 'Teilen', shop: 'Shop', settings: 'Einstellungen',
  preferences: 'Einstellungen', general: 'Allgemein', soundLabel: 'Ton',
  focus: 'Fokus', display: 'Anzeige', privacy: 'Datenschutz',
  themeSaved: 'Thema gespeichert', sessionSaved: 'Sitzung gespeichert',
  copied: 'In Zwischenablage kopiert', privacyOn: 'Datenschutzmodus ein',
  privacyOff: 'Datenschutzmodus aus', incognitoOn: '🕵 Inkognito ein',
  incognitoOff: 'Inkognito aus',
  welcomeTitle: 'Willkommen bei Session Clock',
  welcomeBody: 'Ein präziser, schöner Fokus-Timer — Themen, binaurale Beats, Sitzungsverfolgung.',
  getStarted: 'Loslegen →', skipAll: 'Alles überspringen',
  sessionLengthQ: 'Sitzungsdauer?', sessionLengthHint: 'Wie lang ist dein typischer Fokusblock?',
  chooseThemeQ: 'Wähle dein Thema', chooseThemeHint: '+45 Themen verfügbar.',
  soundQ: 'Ambiente Geräusche?', soundHint: 'Hintergrundgeräusche helfen vielen beim Fokussieren.',
  skipBtn: 'Überspringen →',
  integrations: 'Integrationen', connectSpotify: 'Spotify verbinden',
  connectCalendar: 'Google Kalender verbinden', connectNotion: 'Notion verbinden',
  connectTodoist: 'Todoist verbinden', noUpcomingEvents: 'Keine Ereignisse',
  noTasks: 'Keine Aufgaben', focusPlaylist: 'Fokus-Playlist', nextEvent: 'Nächstes:',
  howDidItFeel: 'Wie war die Sitzung?',
  ratingRough: 'Schwierig', ratingDistracted: 'Abgelenkt', ratingOkay: 'Okay',
  ratingFocused: 'Fokussiert', ratingZone: 'Im Flow', skipRating: 'Überspringen',
  worldClock: 'Weltzeituhr', addTimezone: 'Zeitzone hinzufügen',
  deadlineCountdown: 'Countdown', startCountdown: 'Countdown starten',
  clearCountdown: 'Löschen', language: 'Sprache',
};

const ja: Strings = {
  beginSession: 'セッション開始', takeBreak: '休憩する',
  pauseBreak: '休憩を一時停止', continueSession: '集中を続ける',
  resetTimer: 'リセット', sessionTimer: 'セッションタイマー',
  workingOn: '作業中', workingOnPlaceholder: '何に取り組んでいますか？',
  readyToFocus: '準備ができたら始めましょう。最初のセッションを開始してください。',
  inProgress: '集中セッション進行中。続けてください。',
  sessionPaused: 'セッションを一時停止しました。準備ができたら再開してください。',
  sessionComplete: 'セッション完了！よくできました！',
  breakTime: '休憩時間。深呼吸して、ストレッチして、水を飲みましょう。',
  almostThere: 'もうすぐです —',
  focusSession: '集中', shortBreak: '短い休憩', longBreak: '長い休憩',
  sound: 'サウンド', log: 'ログ', share: '共有', shop: 'ショップ', settings: '設定',
  preferences: '設定', general: '一般', soundLabel: 'サウンド',
  focus: '集中', display: '表示', privacy: 'プライバシー',
  themeSaved: 'テーマを保存しました', sessionSaved: 'セッションを保存しました',
  copied: 'クリップボードにコピーしました', privacyOn: 'プライバシーモード オン',
  privacyOff: 'プライバシーモード オフ', incognitoOn: '🕵 シークレットモード オン',
  incognitoOff: 'シークレットモード オフ',
  welcomeTitle: 'Session Clockへようこそ',
  welcomeBody: '正確で美しい集中タイマー — テーマ、バイノーラルビート、セッション追跡など。',
  getStarted: 'はじめる →', skipAll: 'すべてスキップ',
  sessionLengthQ: 'セッションの長さは？', sessionLengthHint: '典型的な集中ブロックはどのくらいですか？',
  chooseThemeQ: 'テーマを選んでください', chooseThemeHint: '45以上のテーマ — いつでも変更可能。',
  soundQ: '環境音は？', soundHint: 'バックグラウンドオーディオは集中力を高めます。任意。',
  skipBtn: 'スキップ →',
  integrations: 'インテグレーション', connectSpotify: 'Spotifyを接続',
  connectCalendar: 'Googleカレンダーを接続', connectNotion: 'Notionを接続',
  connectTodoist: 'Todoistを接続', noUpcomingEvents: '今後のイベントはありません',
  noTasks: 'タスクはありません', focusPlaylist: '集中プレイリスト', nextEvent: '次:',
  howDidItFeel: 'このセッションはどうでしたか？',
  ratingRough: '辛かった', ratingDistracted: '散漫', ratingOkay: '普通',
  ratingFocused: '集中できた', ratingZone: 'ゾーン状態', skipRating: 'スキップ',
  worldClock: '世界時計', addTimezone: 'タイムゾーンを追加',
  deadlineCountdown: '締め切りカウントダウン', startCountdown: 'カウントダウン開始',
  clearCountdown: 'クリア', language: '言語',
};

const ko: Strings = {
  beginSession: '세션 시작', takeBreak: '휴식하기',
  pauseBreak: '휴식 일시정지', continueSession: '집중 계속',
  resetTimer: '초기화', sessionTimer: '세션 타이머',
  workingOn: '작업 중', workingOnPlaceholder: '무엇을 하고 있나요?',
  readyToFocus: '준비됐을 때 시작하세요. 첫 번째 세션을 시작하세요.',
  inProgress: '집중 세션 진행 중. 계속하세요.',
  sessionPaused: '세션 일시정지. 준비가 되면 계속하세요.',
  sessionComplete: '세션 완료! 잘 했어요!',
  breakTime: '휴식 시간. 숨 쉬고, 스트레칭하고, 물 마시세요.',
  almostThere: '거의 다 됐어요 —',
  focusSession: '집중', shortBreak: '짧은 휴식', longBreak: '긴 휴식',
  sound: '사운드', log: '기록', share: '공유', shop: '상점', settings: '설정',
  preferences: '환경설정', general: '일반', soundLabel: '사운드',
  focus: '집중', display: '디스플레이', privacy: '개인정보',
  themeSaved: '테마 저장됨', sessionSaved: '세션 저장됨',
  copied: '클립보드에 복사됨', privacyOn: '개인정보 보호 모드 켜짐',
  privacyOff: '개인정보 보호 모드 꺼짐', incognitoOn: '🕵 시크릿 모드 켜짐',
  incognitoOff: '시크릿 모드 꺼짐',
  welcomeTitle: 'Session Clock에 오신 것을 환영합니다',
  welcomeBody: '정확하고 아름다운 집중 타이머 — 테마, 바이노럴 비트, 세션 추적 등.',
  getStarted: '시작하기 →', skipAll: '모두 건너뛰기',
  sessionLengthQ: '세션 길이는?', sessionLengthHint: '평소 집중 블록은 얼마나 되나요?',
  chooseThemeQ: '분위기를 선택하세요', chooseThemeHint: '45개 이상의 테마 — 언제든지 변경 가능.',
  soundQ: '주변 사운드?', soundHint: '배경 오디오는 집중력을 높이는 데 도움이 됩니다.',
  skipBtn: '건너뛰기 →',
  integrations: '통합', connectSpotify: 'Spotify 연결',
  connectCalendar: 'Google 캘린더 연결', connectNotion: 'Notion 연결',
  connectTodoist: 'Todoist 연결', noUpcomingEvents: '예정된 일정 없음',
  noTasks: '할 일 없음', focusPlaylist: '집중 플레이리스트', nextEvent: '다음:',
  howDidItFeel: '이 세션은 어땠나요?',
  ratingRough: '힘들었음', ratingDistracted: '산만했음', ratingOkay: '보통',
  ratingFocused: '집중됨', ratingZone: '플로우 상태', skipRating: '건너뛰기',
  worldClock: '세계 시계', addTimezone: '시간대 추가',
  deadlineCountdown: '마감 카운트다운', startCountdown: '카운트다운 시작',
  clearCountdown: '지우기', language: '언어',
};

const pt: Strings = {
  beginSession: 'Iniciar sessão', takeBreak: 'Fazer pausa',
  pauseBreak: 'Pausar descanso', continueSession: 'Continuar foco',
  resetTimer: 'Reiniciar', sessionTimer: 'Temporizador',
  workingOn: 'Trabalhando em', workingOnPlaceholder: 'no que você está trabalhando?',
  readyToFocus: 'Pronto quando você estiver. Comece sua primeira sessão.',
  inProgress: 'Sessão de foco em andamento.',
  sessionPaused: 'Sessão pausada. Continue quando estiver pronto.',
  sessionComplete: 'Sessão concluída. Muito bem!',
  breakTime: 'Hora da pausa. Respire, alongue-se, hidrate-se.',
  almostThere: 'Quase lá —',
  focusSession: 'Foco', shortBreak: 'Pausa curta', longBreak: 'Pausa longa',
  sound: 'Som', log: 'Registro', share: 'Compartilhar', shop: 'Loja', settings: 'Configurações',
  preferences: 'Preferências', general: 'Geral', soundLabel: 'Som',
  focus: 'Foco', display: 'Exibição', privacy: 'Privacidade',
  themeSaved: 'Tema salvo', sessionSaved: 'Sessão salva',
  copied: 'Copiado para a área de transferência', privacyOn: 'Modo privacidade ativado',
  privacyOff: 'Modo privacidade desativado', incognitoOn: '🕵 Incógnito ativado',
  incognitoOff: 'Incógnito desativado',
  welcomeTitle: 'Bem-vindo ao Session Clock',
  welcomeBody: 'Um timer de foco preciso e bonito — temas, batidas binaurais, rastreamento de sessões.',
  getStarted: 'Começar →', skipAll: 'Pular tudo',
  sessionLengthQ: 'Duração da sessão?', sessionLengthHint: 'Qual é a duração típica do seu bloco de foco?',
  chooseThemeQ: 'Escolha seu estilo', chooseThemeHint: '+45 temas disponíveis.',
  soundQ: 'Som ambiente?', soundHint: 'O áudio de fundo ajuda muitas pessoas a se concentrarem.',
  skipBtn: 'Pular →',
  integrations: 'Integrações', connectSpotify: 'Conectar Spotify',
  connectCalendar: 'Conectar Google Agenda', connectNotion: 'Conectar Notion',
  connectTodoist: 'Conectar Todoist', noUpcomingEvents: 'Nenhum evento próximo',
  noTasks: 'Sem tarefas', focusPlaylist: 'Playlist de foco', nextEvent: 'Próximo:',
  howDidItFeel: 'Como foi essa sessão?',
  ratingRough: 'Difícil', ratingDistracted: 'Distraído', ratingOkay: 'Ok',
  ratingFocused: 'Focado', ratingZone: 'Em zona', skipRating: 'Pular',
  worldClock: 'Relógio mundial', addTimezone: 'Adicionar fuso horário',
  deadlineCountdown: 'Contagem regressiva', startCountdown: 'Iniciar contagem',
  clearCountdown: 'Limpar', language: 'Idioma',
};

const hi: Strings = {
  beginSession: 'सत्र शुरू करें', takeBreak: 'ब्रेक लें',
  pauseBreak: 'ब्रेक रोकें', continueSession: 'ध्यान जारी रखें',
  resetTimer: 'रीसेट', sessionTimer: 'सत्र टाइमर',
  workingOn: 'काम कर रहा हूँ', workingOnPlaceholder: 'आप किस पर काम कर रहे हैं?',
  readyToFocus: 'जब तैयार हों तब शुरू करें। अपना पहला सत्र शुरू करें।',
  inProgress: 'फोकस सत्र जारी है। लगे रहें।',
  sessionPaused: 'सत्र रुका हुआ है। तैयार होने पर जारी रखें।',
  sessionComplete: 'सत्र पूरा हुआ! शाबाश!',
  breakTime: 'ब्रेक का समय। सांस लें, स्ट्रेच करें, पानी पिएं।',
  almostThere: 'लगभग हो गया —',
  focusSession: 'फोकस', shortBreak: 'छोटा ब्रेक', longBreak: 'लंबा ब्रेक',
  sound: 'ध्वनि', log: 'लॉग', share: 'साझा', shop: 'दुकान', settings: 'सेटिंग्स',
  preferences: 'प्राथमिकताएं', general: 'सामान्य', soundLabel: 'ध्वनि',
  focus: 'फोकस', display: 'डिस्प्ले', privacy: 'गोपनीयता',
  themeSaved: 'थीम सहेजी गई', sessionSaved: 'सत्र सहेजा गया',
  copied: 'क्लिपबोर्ड पर कॉपी किया', privacyOn: 'गोपनीयता मोड चालू',
  privacyOff: 'गोपनीयता मोड बंद', incognitoOn: '🕵 इन्कॉग्निटो चालू',
  incognitoOff: 'इन्कॉग्निटो बंद',
  welcomeTitle: 'Session Clock में आपका स्वागत है',
  welcomeBody: 'एक सटीक, सुंदर फोकस टाइमर — थीम, बायनॉरल बीट्स, सत्र ट्रैकिंग।',
  getStarted: 'शुरू करें →', skipAll: 'सब छोड़ें',
  sessionLengthQ: 'सत्र की लंबाई?', sessionLengthHint: 'आपका सामान्य फोकस ब्लॉक कितना लंबा है?',
  chooseThemeQ: 'थीम चुनें', chooseThemeHint: '45+ थीम उपलब्ध — कभी भी बदलें।',
  soundQ: 'परिवेश ध्वनि?', soundHint: 'पृष्ठभूमि ऑडियो कई लोगों की एकाग्रता बढ़ाती है।',
  skipBtn: 'छोड़ें →',
  integrations: 'एकीकरण', connectSpotify: 'Spotify जोड़ें',
  connectCalendar: 'Google Calendar जोड़ें', connectNotion: 'Notion जोड़ें',
  connectTodoist: 'Todoist जोड़ें', noUpcomingEvents: 'कोई आगामी कार्यक्रम नहीं',
  noTasks: 'कोई कार्य नहीं', focusPlaylist: 'फोकस प्लेलिस्ट', nextEvent: 'अगला:',
  howDidItFeel: 'यह सत्र कैसा था?',
  ratingRough: 'कठिन', ratingDistracted: 'भटका हुआ', ratingOkay: 'ठीक',
  ratingFocused: 'केंद्रित', ratingZone: 'ज़ोन में', skipRating: 'छोड़ें',
  worldClock: 'विश्व घड़ी', addTimezone: 'टाइमज़ोन जोड़ें',
  deadlineCountdown: 'डेडलाइन काउंटडाउन', startCountdown: 'काउंटडाउन शुरू',
  clearCountdown: 'साफ़ करें', language: 'भाषा',
};

const LOCALES: Record<Locale, Strings> = { en, es, fr, de, ja, ko, pt, hi };

const STORAGE_KEY = 'sc_locale';
let _current: Locale = (localStorage.getItem(STORAGE_KEY) as Locale) || detectLocale();

function detectLocale(): Locale {
  const lang = navigator.language.slice(0, 2).toLowerCase();
  const map: Record<string, Locale> = {
    en: 'en', es: 'es', fr: 'fr', de: 'de',
    ja: 'ja', ko: 'ko', pt: 'pt', hi: 'hi',
  };
  return map[lang] ?? 'en';
}

export function t(): Strings { return LOCALES[_current] ?? LOCALES.en; }
export function getLocale(): Locale { return _current; }
export function setLocale(l: Locale) {
  _current = l;
  localStorage.setItem(STORAGE_KEY, l);
  // Dispatch event so UI can re-render
  window.dispatchEvent(new CustomEvent('sc:locale', { detail: l }));
}
