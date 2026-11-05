// ── Internationalisation ──────────────────────────────────────────────
// 8 languages: EN, ES, FR, DE, JA, KO, PT, HI
// Central catalog with per-key translations, zero duplication, and English fallback.

import { safeGet } from "./storage";

export type Locale = "en" | "es" | "fr" | "de" | "ja" | "ko" | "pt" | "hi";

export const LOCALES_LIST: readonly Locale[] = [
  "en",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
  "pt",
  "hi",
] as const;

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  hi: "हिन्दी",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  ja: "🇯🇵",
  ko: "🇰🇷",
  pt: "🇧🇷",
  hi: "🇮🇳",
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
  welcomeEyebrow: string;
  welcomeHeadline: string;
  welcomeHintThemes: string;
  welcomeHintFocus: string;
  welcomeHintSound: string;
  getStarted: string;
  useDefaults: string;
  skipAll: string;
  welcomeStep: string;
  durationStep: string;
  themeStep: string;
  soundStep: string;
  stepLabel: string;
  progressLabel: string;
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

  // Weather page
  weatherClose: string;
  weatherRoom: string;
  weatherSetLocation: string;
  weatherSetLocationLabel: string;
  weatherCurrentConditions: string;
  weatherLoading: string;
  weatherFeelsLike: string;
  weatherWindSpeed: string;
  weatherHumidity: string;
  weatherNext24Hours: string;
  weatherHourly: string;
  weatherSwipe: string;
  weatherDaylight: string;
  weatherSunPath: string;
  weatherWeekAhead: string;
  weatherDailyForecast: string;
  weatherAdaptiveTheme: string;
  weatherAdaptiveThemeDesc: string;
  weatherForecastSource: string;
  weatherDone: string;
  weatherSearchPlaceholder: string;
  weatherSearchLabel: string;
  weatherOr: string;
  weatherUseLocation: string;
  weatherGPSHint: string;
  weatherLocationPrivacy: string;
  weatherLocating: string;
  weatherPleaseWait: string;
  weatherGPSUnavailable: string;
  weatherSearchInstead: string;
  weatherSearching: string;
  weatherNoResults: string;
  weatherSearchFailed: string;
  weatherCurrentLocation: string;
  weatherNoLocation: string;
  weatherUnavailable: string;
  weatherConnectionPaused: string;
  weatherFetching: string;
  weatherBegin: string;
  weatherReadingSky: string;
  weatherNoForecast: string;
  weatherNow: string;
  weatherSunLocationHint: string;
  weatherSunrise: string;
  weatherSunset: string;
  weatherToday: string;

  // Language
  language: string;

  // Analytics
  analyticsTitle: string;
  analyticsReassurance: string;
  analyticsStatusAutoOn: string;
  analyticsStatusActive: string;
  analyticsStatusDisabled: string;
  analyticsStatusUnavailable: string;
  analyticsStatusChecking: string;
  analyticsDescBlocked: string;
  analyticsDescNormal: string;
  analyticsDescPrivacyMode: string;
  analyticsActionEnable: string;
  analyticsActionDisable: string;
  analyticsActionAuto: string;
}

export type TranslationKey = keyof Strings;

/**
 * Format helper for strings with template placeholders like "{temp}", "{speed}", "{n}", etc.
 */
export function format(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match,
  );
}

type TranslationRow = Record<Locale, string>;

const CATALOG: Record<TranslationKey, TranslationRow> = {
  weatherClose: { en: "Close weather", es: "Cerrar el tiempo", fr: "Fermer la météo", de: "Wetter schließen", ja: "天気を閉じる", ko: "날씨 닫기", pt: "Fechar previsão", hi: "मौसम बंद करें" },
  weatherRoom: { en: "Weather Room", es: "Sala del tiempo", fr: "Espace météo", de: "Wetterraum", ja: "天気ルーム", ko: "날씨 공간", pt: "Sala do tempo", hi: "मौसम कक्ष" },
  weatherSetLocation: { en: "Set location", es: "Elegir ubicación", fr: "Choisir un lieu", de: "Ort festlegen", ja: "場所を設定", ko: "위치 설정", pt: "Definir localização", hi: "स्थान सेट करें" },
  weatherSetLocationLabel: { en: "Set weather location", es: "Elegir ubicación del tiempo", fr: "Choisir le lieu de la météo", de: "Wetterstandort festlegen", ja: "天気の場所を設定", ko: "날씨 위치 설정", pt: "Definir local da previsão", hi: "मौसम का स्थान सेट करें" },
  weatherCurrentConditions: { en: "Current conditions", es: "Condiciones actuales", fr: "Conditions actuelles", de: "Aktuelle Bedingungen", ja: "現在の天気", ko: "현재 날씨", pt: "Condições atuais", hi: "वर्तमान स्थिति" },
  weatherLoading: { en: "Loading…", es: "Cargando…", fr: "Chargement…", de: "Wird geladen…", ja: "読み込み中…", ko: "불러오는 중…", pt: "Carregando…", hi: "लोड हो रहा है…" },
  weatherFeelsLike: { en: "Feels like {temp}°", es: "Sensación de {temp}°", fr: "Ressenti {temp}°", de: "Gefühlt {temp}°", ja: "体感温度 {temp}°", ko: "체감 {temp}°", pt: "Sensação de {temp}°", hi: "महसूस होता है {temp}°" },
  weatherWindSpeed: { en: "{speed} km/h wind", es: "Viento de {speed} km/h", fr: "Vent à {speed} km/h", de: "Wind {speed} km/h", ja: "風速 {speed} km/h", ko: "풍속 {speed} km/h", pt: "Vento de {speed} km/h", hi: "हवा {speed} किमी/घंटा" },
  weatherHumidity: { en: "{humidity}% humidity", es: "Humedad del {humidity}%", fr: "Humidité {humidity} %", de: "Luftfeuchtigkeit {humidity} %", ja: "湿度 {humidity}%", ko: "습도 {humidity}%", pt: "Umidade de {humidity}%", hi: "नमी {humidity}%" },
  weatherNext24Hours: { en: "Next 24 hours", es: "Próximas 24 horas", fr: "Prochaines 24 heures", de: "Nächste 24 Stunden", ja: "今後24時間", ko: "향후 24시간", pt: "Próximas 24 horas", hi: "अगले 24 घंटे" },
  weatherHourly: { en: "Hour by hour", es: "Hora a hora", fr: "Heure par heure", de: "Stündlich", ja: "1時間ごと", ko: "시간별", pt: "Hora a hora", hi: "हर घंटे" },
  weatherSwipe: { en: "Swipe to explore", es: "Desliza para explorar", fr: "Balayez pour explorer", de: "Zum Erkunden wischen", ja: "スワイプして確認", ko: "스와이프하여 확인", pt: "Deslize para explorar", hi: "देखने के लिए स्वाइप करें" },
  weatherDaylight: { en: "Daylight", es: "Luz del día", fr: "Lumière du jour", de: "Tageslicht", ja: "日照", ko: "일조", pt: "Luz do dia", hi: "दिन का प्रकाश" },
  weatherSunPath: { en: "Sun path", es: "Trayectoria solar", fr: "Course du soleil", de: "Sonnenlauf", ja: "太陽の軌道", ko: "태양의 경로", pt: "Trajetória solar", hi: "सूर्य का पथ" },
  weatherWeekAhead: { en: "The week ahead", es: "La próxima semana", fr: "La semaine à venir", de: "Die kommende Woche", ja: "今週の天気", ko: "이번 주 날씨", pt: "A semana pela frente", hi: "आने वाला सप्ताह" },
  weatherDailyForecast: { en: "7-day forecast", es: "Pronóstico de 7 días", fr: "Prévisions sur 7 jours", de: "7-Tage-Vorhersage", ja: "7日間予報", ko: "7일 예보", pt: "Previsão de 7 dias", hi: "7 दिनों का पूर्वानुमान" },
  weatherAdaptiveTheme: { en: "Weather-adaptive theme", es: "Tema adaptable al tiempo", fr: "Thème adapté à la météo", de: "Wetterabhängiges Design", ja: "天気に合わせたテーマ", ko: "날씨 적응 테마", pt: "Tema adaptado ao tempo", hi: "मौसम के अनुसार थीम" },
  weatherAdaptiveThemeDesc: { en: "Subtly blend the current conditions into your theme — a tint, never a theme switch.", es: "Integra sutilmente el tiempo actual en tu tema: un matiz, sin cambiar de tema.", fr: "Intégrez subtilement la météo à votre thème : une nuance, sans changer de thème.", de: "Aktuelles Wetter dezent ins Design einblenden — nur eine Tönung, kein Designwechsel.", ja: "現在の天気をテーマにさりげなく反映します。色合いだけで、テーマは変わりません。", ko: "현재 날씨를 테마에 은은하게 반영합니다. 색조만 바뀌며 테마는 유지됩니다.", pt: "Integre sutilmente o tempo ao tema — apenas um tom, sem trocar o tema.", hi: "वर्तमान मौसम की हल्की झलक थीम में जोड़ें — केवल रंगत बदलेगी, थीम नहीं।" },
  weatherForecastSource: { en: "Forecast source", es: "Fuente del pronóstico", fr: "Source des prévisions", de: "Vorhersagequelle", ja: "予報の場所", ko: "예보 위치", pt: "Fonte da previsão", hi: "पूर्वानुमान का स्रोत" },
  weatherDone: { en: "Done", es: "Listo", fr: "Terminé", de: "Fertig", ja: "完了", ko: "완료", pt: "Concluído", hi: "हो गया" },
  weatherSearchPlaceholder: { en: "Search for a city…", es: "Busca una ciudad…", fr: "Rechercher une ville…", de: "Nach einer Stadt suchen…", ja: "都市を検索…", ko: "도시 검색…", pt: "Buscar uma cidade…", hi: "शहर खोजें…" },
  weatherSearchLabel: { en: "Search for a city", es: "Buscar una ciudad", fr: "Rechercher une ville", de: "Nach einer Stadt suchen", ja: "都市を検索", ko: "도시 검색", pt: "Buscar uma cidade", hi: "शहर खोजें" },
  weatherOr: { en: "or", es: "o", fr: "ou", de: "oder", ja: "または", ko: "또는", pt: "ou", hi: "या" },
  weatherUseLocation: { en: "Use my current location", es: "Usar mi ubicación actual", fr: "Utiliser ma position actuelle", de: "Meinen aktuellen Standort verwenden", ja: "現在地を使用", ko: "현재 위치 사용", pt: "Usar minha localização atual", hi: "मेरे वर्तमान स्थान का उपयोग करें" },
  weatherGPSHint: { en: "Only asks for GPS after you choose this", es: "Solo pide GPS al elegir esta opción", fr: "Le GPS n’est demandé qu’après ce choix", de: "GPS wird erst nach dieser Auswahl angefragt", ja: "選択した場合のみ位置情報を要求します", ko: "이 옵션을 선택한 후에만 GPS를 요청합니다", pt: "Só solicita GPS após esta escolha", hi: "इसे चुनने के बाद ही GPS की अनुमति माँगी जाएगी" },
  weatherLocationPrivacy: { en: "Your saved location stays in this browser.", es: "Tu ubicación guardada permanece en este navegador.", fr: "Votre lieu enregistré reste dans ce navigateur.", de: "Dein gespeicherter Standort bleibt in diesem Browser.", ja: "保存した場所はこのブラウザー内にのみ保持されます。", ko: "저장한 위치는 이 브라우저에만 보관됩니다.", pt: "Sua localização salva fica neste navegador.", hi: "आपका सहेजा गया स्थान इसी ब्राउज़र में रहता है।" },
  weatherLocating: { en: "Locating…", es: "Localizando…", fr: "Localisation…", de: "Standort wird ermittelt…", ja: "現在地を取得中…", ko: "위치 확인 중…", pt: "Localizando…", hi: "स्थान खोजा जा रहा है…" },
  weatherPleaseWait: { en: "Please wait", es: "Espera un momento", fr: "Veuillez patienter", de: "Bitte warten", ja: "お待ちください", ko: "잠시 기다려 주세요", pt: "Aguarde", hi: "कृपया प्रतीक्षा करें" },
  weatherGPSUnavailable: { en: "GPS unavailable", es: "GPS no disponible", fr: "GPS indisponible", de: "GPS nicht verfügbar", ja: "位置情報を取得できません", ko: "GPS를 사용할 수 없습니다", pt: "GPS indisponível", hi: "GPS उपलब्ध नहीं है" },
  weatherSearchInstead: { en: "Search for a city instead", es: "Busca una ciudad en su lugar", fr: "Recherchez plutôt une ville", de: "Suche stattdessen nach einer Stadt", ja: "代わりに都市を検索してください", ko: "대신 도시를 검색해 주세요", pt: "Busque uma cidade", hi: "इसके बजाय शहर खोजें" },
  weatherSearching: { en: "Searching…", es: "Buscando…", fr: "Recherche…", de: "Suche läuft…", ja: "検索中…", ko: "검색 중…", pt: "Buscando…", hi: "खोजा जा रहा है…" },
  weatherNoResults: { en: "No results found", es: "No se encontraron resultados", fr: "Aucun résultat", de: "Keine Ergebnisse gefunden", ja: "結果が見つかりません", ko: "검색 결과가 없습니다", pt: "Nenhum resultado encontrado", hi: "कोई परिणाम नहीं मिला" },
  weatherSearchFailed: { en: "Search failed", es: "La búsqueda falló", fr: "Échec de la recherche", de: "Suche fehlgeschlagen", ja: "検索に失敗しました", ko: "검색에 실패했습니다", pt: "Falha na busca", hi: "खोज विफल रही" },
  weatherCurrentLocation: { en: "Current location", es: "Ubicación actual", fr: "Position actuelle", de: "Aktueller Standort", ja: "現在地", ko: "현재 위치", pt: "Localização atual", hi: "वर्तमान स्थान" },
  weatherNoLocation: { en: "No location set", es: "Sin ubicación", fr: "Aucun lieu défini", de: "Kein Standort festgelegt", ja: "場所が未設定です", ko: "위치가 설정되지 않았습니다", pt: "Localização não definida", hi: "स्थान सेट नहीं है" },
  weatherUnavailable: { en: "Weather unavailable — tap to retry", es: "Tiempo no disponible: toca para reintentar", fr: "Météo indisponible — touchez pour réessayer", de: "Wetter nicht verfügbar — zum Wiederholen tippen", ja: "天気を取得できません。タップして再試行", ko: "날씨를 불러올 수 없습니다. 탭하여 다시 시도", pt: "Previsão indisponível — toque para tentar novamente", hi: "मौसम उपलब्ध नहीं है — फिर कोशिश करने के लिए टैप करें" },
  weatherConnectionPaused: { en: "Connection paused", es: "Conexión en pausa", fr: "Connexion en pause", de: "Verbindung pausiert", ja: "接続を一時停止中", ko: "연결 일시 중지", pt: "Conexão pausada", hi: "कनेक्शन रुका हुआ है" },
  weatherFetching: { en: "Fetching weather…", es: "Obteniendo el tiempo…", fr: "Récupération de la météo…", de: "Wetter wird abgerufen…", ja: "天気を取得中…", ko: "날씨 가져오는 중…", pt: "Obtendo previsão…", hi: "मौसम प्राप्त किया जा रहा है…" },
  weatherBegin: { en: "Tap “Set location” to begin", es: "Toca «Elegir ubicación» para empezar", fr: "Touchez «Choisir un lieu» pour commencer", de: "Tippe zum Starten auf „Ort festlegen“", ja: "「場所を設定」をタップして開始", ko: "시작하려면 ‘위치 설정’을 탭하세요", pt: "Toque em “Definir localização” para começar", hi: "शुरू करने के लिए “स्थान सेट करें” पर टैप करें" },
  weatherReadingSky: { en: "Reading the sky", es: "Leyendo el cielo", fr: "À l’écoute du ciel", de: "Blick in den Himmel", ja: "空の様子を確認中", ko: "하늘을 살피는 중", pt: "Observando o céu", hi: "आसमान का हाल पढ़ रहे हैं" },
  weatherNoForecast: { en: "No forecast data — set a location to load", es: "Sin pronóstico: elige una ubicación para cargarlo", fr: "Aucune prévision — choisissez un lieu", de: "Keine Vorhersagedaten — Standort zum Laden festlegen", ja: "予報がありません。場所を設定してください", ko: "예보 데이터가 없습니다. 위치를 설정해 주세요", pt: "Sem previsão — defina uma localização para carregar", hi: "पूर्वानुमान नहीं है — लोड करने के लिए स्थान सेट करें" },
  weatherNow: { en: "Now", es: "Ahora", fr: "Maintenant", de: "Jetzt", ja: "現在", ko: "지금", pt: "Agora", hi: "अभी" },
  weatherSunLocationHint: { en: "Set a location to see sunrise and sunset", es: "Elige una ubicación para ver la salida y puesta del sol", fr: "Choisissez un lieu pour voir le lever et le coucher du soleil", de: "Standort für Sonnenaufgang und Sonnenuntergang festlegen", ja: "日の出・日の入りを見るには場所を設定してください", ko: "일출과 일몰을 보려면 위치를 설정해 주세요", pt: "Defina uma localização para ver o nascer e o pôr do sol", hi: "सूर्योदय और सूर्यास्त देखने के लिए स्थान सेट करें" },
  weatherSunrise: { en: "Sunrise", es: "Salida del sol", fr: "Lever du soleil", de: "Sonnenaufgang", ja: "日の出", ko: "일출", pt: "Nascer do sol", hi: "सूर्योदय" },
  weatherSunset: { en: "Sunset", es: "Puesta del sol", fr: "Coucher du soleil", de: "Sonnenuntergang", ja: "日の入り", ko: "일몰", pt: "Pôr do sol", hi: "सूर्यास्त" },
  weatherToday: { en: "Today", es: "Hoy", fr: "Aujourd’hui", de: "Heute", ja: "今日", ko: "오늘", pt: "Hoje", hi: "आज" },
  beginSession: { en: "Begin Session", es: "Iniciar sesión", fr: "Commencer", de: "Sitzung starten", ja: "セッション開始", ko: "세션 시작", pt: "Iniciar sessão", hi: "सत्र शुरू करें" },
  takeBreak: { en: "Take a Break", es: "Tomar descanso", fr: "Faire une pause", de: "Pause machen", ja: "休憩する", ko: "휴식하기", pt: "Fazer pausa", hi: "ब्रेक लें" },
  pauseBreak: { en: "Pause Break", es: "Pausar descanso", fr: "Pause en cours", de: "Pause pausieren", ja: "休憩を一時停止", ko: "휴식 일시정지", pt: "Pausar descanso", hi: "ब्रेक रोकें" },
  continueSession: { en: "Continue Focus", es: "Continuar enfoque", fr: "Reprendre", de: "Weiter", ja: "集中を続ける", ko: "집중 계속", pt: "Continuar foco", hi: "ध्यान जारी रखें" },
  resetTimer: { en: "Reset", es: "Reiniciar", fr: "Réinitialiser", de: "Zurücksetzen", ja: "リセット", ko: "초기화", pt: "Reiniciar", hi: "रीसेट" },
  sessionTimer: { en: "Session Timer", es: "Temporizador", fr: "Minuteur", de: "Sitzungstimer", ja: "セッションタイマー", ko: "세션 타이머", pt: "Temporizador", hi: "सत्र टाइमर" },
  workingOn: { en: "Working on", es: "Trabajando en", fr: "Je travaille sur", de: "Arbeite an", ja: "作業中", ko: "작업 중", pt: "Trabalhando em", hi: "काम कर रहा हूँ" },
  workingOnPlaceholder: { en: "what are you working on?", es: "¿en qué estás trabajando?", fr: "sur quoi travaillez-vous ?", de: "woran arbeitest du?", ja: "何に取り組んでいますか？", ko: "무엇을 하고 있나요?", pt: "no que você está trabalhando?", hi: "आप किस पर काम कर रहे हैं?" },
  readyToFocus: { en: "Ready when you are. Begin your first session.", es: "Listo cuando quieras. Comienza tu primera sesión.", fr: "Prêt quand vous l'êtes. Commencez votre première session.", de: "Bereit, wenn du es bist. Starte deine erste Sitzung.", ja: "準備ができたら始めましょう。最初のセッションを開始してください。", ko: "준비됐을 때 시작하세요. 첫 번째 세션을 시작하세요.", pt: "Pronto quando você estiver. Comece sua primeira sessão.", hi: "जब तैयार हों तब शुरू करें। अपना पहला सत्र शुरू करें।" },
  inProgress: { en: "Focus session in progress. Stay with it.", es: "Sesión de enfoque en progreso. ¡Sigue así!", fr: "Session de concentration en cours.", de: "Fokus-Sitzung läuft. Bleib dran.", ja: "集中セッション進行中。続けてください。", ko: "집중 세션 진행 중. 계속하세요.", pt: "Sessão de foco em andamento.", hi: "फोकस सत्र जारी है। लगे रहें।" },
  sessionPaused: { en: "Session paused. Continue when you are ready.", es: "Sesión pausada. Continúa cuando estés listo.", fr: "Session en pause. Reprenez quand vous êtes prêt.", de: "Sitzung pausiert. Mach weiter, wenn du bereit bist.", ja: "セッションを一時停止しました。準備ができたら再開してください。", ko: "세션 일시정지. 준비가 되면 계속하세요.", pt: "Sessão pausada. Continue quando estiver pronto.", hi: "सत्र रुका हुआ है। तैयार होने पर जारी रखें।" },
  sessionComplete: { en: "Session complete. Well done!", es: "¡Sesión completada. ¡Bien hecho!", fr: "Session terminée. Bien joué !", de: "Sitzung abgeschlossen. Gut gemacht!", ja: "セッション完了！よくできました！", ko: "세션 완료! 잘 했어요!", pt: "Sessão concluída. Muito bem!", hi: "सत्र पूरा हुआ! शाबाश!" },
  breakTime: { en: "Break time. Breathe, stretch, hydrate.", es: "Hora del descanso. Respira, estírate, hidrátate.", fr: "Pause. Respirez, étirez-vous, hydratez-vous.", de: "Pause. Atme, dehne dich, trinke Wasser.", ja: "休憩時間。深呼吸して、ストレッチして、水を飲みましょう。", ko: "휴식 시간. 숨 쉬고, 스트레칭하고, 물 마시세요.", pt: "Hora da pausa. Respire, alongue-se, hidrate-se.", hi: "ब्रेक का समय। सांस लें, स्ट्रेच करें, पानी पिएं।" },
  almostThere: { en: "Almost there —", es: "Ya casi —", fr: "Presque terminé —", de: "Fast geschafft —", ja: "もうすぐです —", ko: "거의 다 됐어요 —", pt: "Quase lá —", hi: "लगभग हो गया —" },
  focusSession: { en: "Focus", es: "Enfoque", fr: "Focus", de: "Fokus", ja: "集中", ko: "집중", pt: "Foco", hi: "फोकस" },
  shortBreak: { en: "Short Break", es: "Descanso corto", fr: "Courte pause", de: "Kurze Pause", ja: "短い休憩", ko: "짧은 휴식", pt: "Pausa curta", hi: "छोटा ब्रेक" },
  longBreak: { en: "Long Break", es: "Descanso largo", fr: "Longue pause", de: "Lange Pause", ja: "長い休憩", ko: "긴 휴식", pt: "Pausa longa", hi: "लंबा ब्रेक" },
  sound: { en: "Sound", es: "Sonido", fr: "Son", de: "Ton", ja: "サウンド", ko: "사운드", pt: "Som", hi: "ध्वनि" },
  log: { en: "Log", es: "Registro", fr: "Journal", de: "Protokoll", ja: "ログ", ko: "기록", pt: "Registro", hi: "लॉग" },
  share: { en: "Share", es: "Compartir", fr: "Partager", de: "Teilen", ja: "共有", ko: "공유", pt: "Compartilhar", hi: "साझा" },
  settings: { en: "Settings", es: "Ajustes", fr: "Réglages", de: "Einstellungen", ja: "設定", ko: "설정", pt: "Configurações", hi: "सेटिंग्स" },
  preferences: { en: "Preferences", es: "Preferencias", fr: "Préférences", de: "Einstellungen", ja: "設定", ko: "환경설정", pt: "Preferências", hi: "प्राथमिकताएं" },
  general: { en: "General", es: "General", fr: "Général", de: "Allgemein", ja: "一般", ko: "일반", pt: "Geral", hi: "सामान्य" },
  soundLabel: { en: "Sound", es: "Sonido", fr: "Son", de: "Ton", ja: "サウンド", ko: "사운드", pt: "Som", hi: "ध्वनि" },
  focus: { en: "Focus", es: "Enfoque", fr: "Focus", de: "Fokus", ja: "集中", ko: "집중", pt: "Foco", hi: "फोकस" },
  display: { en: "Display", es: "Pantalla", fr: "Affichage", de: "Anzeige", ja: "表示", ko: "디스플레이", pt: "Exibição", hi: "डिस्प्ले" },
  privacy: { en: "Privacy", es: "Privacidad", fr: "Confidentialité", de: "Datenschutz", ja: "プライバシー", ko: "개인정보", pt: "Privacidade", hi: "गोपनीयता" },
  themeSaved: { en: "Theme saved", es: "Tema guardado", fr: "Thème enregistré", de: "Thema gespeichert", ja: "テーマを保存しました", ko: "테마 저장됨", pt: "Tema salvo", hi: "थीम सहेजी गई" },
  sessionSaved: { en: "Session saved", es: "Sesión guardada", fr: "Session enregistrée", de: "Sitzung gespeichert", ja: "セッションを保存しました", ko: "세션 저장됨", pt: "Sessão salva", hi: "सत्र सहेजा गया" },
  copied: { en: "Copied to clipboard", es: "Copiado al portapapeles", fr: "Copié dans le presse-papiers", de: "In Zwischenablage kopiert", ja: "クリップボードにコピーしました", ko: "클립보드에 복사됨", pt: "Copiado para a área de transferência", hi: "क्लिपबोर्ड पर कॉपी किया" },
  privacyOn: { en: "Privacy Mode on", es: "Modo privacidad activado", fr: "Mode confidentialité activé", de: "Datenschutzmodus ein", ja: "プライバシーモード オン", ko: "개인정보 보호 모드 켜짐", pt: "Modo privacidade ativado", hi: "गोपनीयता मोड चालू" },
  privacyOff: { en: "Privacy Mode off", es: "Modo privacidad desactivado", fr: "Mode confidentialité désactivé", de: "Datenschutzmodus aus", ja: "プライバシーモード オフ", ko: "개인정보 보호 모드 꺼짐", pt: "Modo privacidade desativado", hi: "गोपनीयता मोड बंद" },
  incognitoOn: { en: "🕵 Incognito on", es: "🕵 Incógnito activado", fr: "🕵 Incognito activé", de: "🕵 Inkognito ein", ja: "🕵 シークレットモード オン", ko: "🕵 시크릿 모드 켜짐", pt: "🕵 Incógnito ativado", hi: "🕵 इन्कॉग्निटो चालू" },
  incognitoOff: { en: "Incognito off", es: "Incógnito desactivado", fr: "Incognito désactivé", de: "Inkognito aus", ja: "シークレットモード オフ", ko: "시크릿 모드 꺼짐", pt: "Incógnito desativado", hi: "इन्कॉग्निटो बंद" },
  welcomeTitle: { en: "Welcome to Session Clock", es: "Bienvenido a Session Clock", fr: "Bienvenue sur Session Clock", de: "Willkommen bei Session Clock", ja: "Session Clockへようこそ", ko: "Session Clock에 오신 것을 환영합니다", pt: "Bem-vindo ao Session Clock", hi: "Session Clock में आपका स्वागत है" },
  welcomeBody: { en: "A calmer way to start, stay with, and finish focused work.", es: "Una forma más tranquila de empezar, mantener y terminar el trabajo enfocado.", fr: "Une façon plus sereine de commencer, poursuivre et terminer un travail concentré.", de: "Ein ruhigerer Weg, konzentrierte Arbeit zu beginnen, durchzuhalten und abzuschließen.", ja: "集中を始め、続け、終えるための、より静かな方法。", ko: "집중을 시작하고 이어가고 마무리하는 더 차분한 방법.", pt: "Uma forma mais calma de começar, manter e concluir o trabalho focado.", hi: "केंद्रित काम शुरू करने, जारी रखने और पूरा करने का एक शांत तरीका।" },
  welcomeEyebrow: { en: "Focus timer", es: "Temporizador de enfoque", fr: "Minuteur de concentration", de: "Fokus-Timer", ja: "フォーカスタイマー", ko: "집중 타이머", pt: "Temporizador de foco", hi: "फोकस टाइमर" },
  welcomeHeadline: { en: "Make time yours.", es: "Haz tuyo el tiempo.", fr: "Faites du temps le vôtre.", de: "Mach die Zeit zu deiner.", ja: "時間を、あなたのものに。", ko: "시간을 당신의 것으로.", pt: "Faça do tempo o seu.", hi: "समय को अपना बनाएँ।" },
  welcomeHintThemes: { en: "45+ themes", es: "45+ temas", fr: "45+ thèmes", de: "45+ Themes", ja: "45以上のテーマ", ko: "45개 이상의 테마", pt: "45+ temas", hi: "45+ थीम" },
  welcomeHintFocus: { en: "Focus sessions", es: "Sesiones de enfoque", fr: "Sessions de concentration", de: "Fokus-Sitzungen", ja: "集中セッション", ko: "집중 세션", pt: "Sessões de foco", hi: "फोकस सत्र" },
  welcomeHintSound: { en: "Ambient sound", es: "Sonido ambiental", fr: "Son d'ambiance", de: "Umgebungsklang", ja: "環境音", ko: "주변 소리", pt: "Som ambiente", hi: "परिवेशी ध्वनि" },
  getStarted: { en: "Set up →", es: "Configurar →", fr: "Configurer →", de: "Einrichten →", ja: "セットアップ →", ko: "설정하기 →", pt: "Configurar →", hi: "सेट अप करें →" },
  useDefaults: { en: "Use defaults", es: "Usar valores predeterminados", fr: "Utiliser les valeurs par défaut", de: "Standardwerte verwenden", ja: "デフォルトを使う", ko: "기본값 사용", pt: "Usar padrões", hi: "डिफ़ॉल्ट उपयोग करें" },
  skipAll: { en: "Skip setup", es: "Omitir configuración", fr: "Ignorer la configuration", de: "Einrichtung überspringen", ja: "セットアップをスキップ", ko: "설정 건너뛰기", pt: "Pular configuração", hi: "सेटअप छोड़ें" },
  welcomeStep: { en: "Welcome", es: "Bienvenida", fr: "Bienvenue", de: "Willkommen", ja: "ようこそ", ko: "환영합니다", pt: "Boas-vindas", hi: "स्वागत" },
  durationStep: { en: "Session length", es: "Duración de la sesión", fr: "Durée de la session", de: "Sitzungsdauer", ja: "セッションの長さ", ko: "세션 길이", pt: "Duração da sessão", hi: "सत्र अवधि" },
  themeStep: { en: "Theme", es: "Tema", fr: "Thème", de: "Theme", ja: "テーマ", ko: "테마", pt: "Tema", hi: "थीम" },
  soundStep: { en: "Ambient sound", es: "Sonido ambiental", fr: "Son d'ambiance", de: "Umgebungsklang", ja: "環境音", ko: "주변 소리", pt: "Som ambiente", hi: "परिवेशी ध्वनि" },
  stepLabel: { en: "Step {n} of {total}", es: "Paso {n} de {total}", fr: "Étape {n} sur {total}", de: "Schritt {n} von {total}", ja: "ステップ {n} / {total}", ko: "{total}단계 중 {n}단계", pt: "Etapa {n} de {total}", hi: "चरण {n} / {total}" },
  progressLabel: { en: "Setup progress", es: "Progreso de la configuración", fr: "Progression de la configuration", de: "Einrichtungsfortschritt", ja: "セットアップの進行状況", ko: "설정 진행 상황", pt: "Progresso da configuração", hi: "सेटअप प्रगति" },
  sessionLengthQ: { en: "Session length?", es: "¿Duración de sesión?", fr: "Durée de session ?", de: "Sitzungsdauer?", ja: "セッションの長さは？", ko: "세션 길이는?", pt: "Duração da sessão?", hi: "सत्र की लंबाई?" },
  sessionLengthHint: { en: "How long is your typical focus block?", es: "¿Cuánto dura tu bloque de enfoque?", fr: "Quelle est votre durée de concentration habituelle ?", de: "Wie lang ist dein typischer Fokusblock?", ja: "典型的な集中ブロックはどのくらいですか？", ko: "평소 집중 블록은 얼마나 되나요?", pt: "Qual é a duração típica do seu bloco de foco?", hi: "आपका सामान्य फोकस ब्लॉक कितना लंबा है?" },
  chooseThemeQ: { en: "Choose your vibe", es: "Elige tu estilo", fr: "Choisissez votre ambiance", de: "Wähle dein Thema", ja: "テーマを選んでください", ko: "분위기를 선택하세요", pt: "Escolha seu estilo", hi: "थीम चुनें" },
  chooseThemeHint: { en: "45+ themes available — change anytime.", es: "+45 temas disponibles — cambia cuando quieras.", fr: "+45 thèmes disponibles.", de: "+45 Themen verfügbar.", ja: "45以上のテーマ — いつでも変更可能。", ko: "45개 이상의 테마 — 언제든지 변경 가능.", pt: "+45 temas disponíveis.", hi: "45+ थीम उपलब्ध — कभी भी बदलें।" },
  soundQ: { en: "Ambient sound?", es: "¿Sonido ambiente?", fr: "Son ambiant ?", de: "Ambiente Geräusche?", ja: "環境音は？", ko: "주변 사운드?", pt: "Som ambiente?", hi: "परिवेश ध्वनि?" },
  soundHint: { en: "Background audio helps many people focus deeply. Optional.", es: "El audio de fondo ayuda a muchos a concentrarse. Opcional.", fr: "La musique de fond aide à se concentrer. Optionnel.", de: "Hintergrundgeräusche helfen vielen beim Fokussieren.", ja: "バックグラウンドオーディオは集中力を高めます。任意。", ko: "배경 오디오는 집중력을 높이는 데 도움이 됩니다.", pt: "O áudio de fundo ajuda muitas pessoas a se concentrarem.", hi: "पृष्ठभूमि ऑडियो कई लोगों की एकाग्रता बढ़ाती है।" },
  skipBtn: { en: "Skip →", es: "Omitir →", fr: "Passer →", de: "Überspringen →", ja: "スキップ →", ko: "건너뛰기 →", pt: "Pular →", hi: "छोड़ें →" },
  integrations: { en: "Integrations", es: "Integraciones", fr: "Intégrations", de: "Integrationen", ja: "インテグレーション", ko: "통합", pt: "Integrações", hi: "एकीकरण" },
  connectSpotify: { en: "Connect Spotify", es: "Conectar Spotify", fr: "Connecter Spotify", de: "Spotify verbinden", ja: "Spotifyを接続", ko: "Spotify 연결", pt: "Conectar Spotify", hi: "Spotify जोड़ें" },
  connectCalendar: { en: "Connect Google Calendar", es: "Conectar Google Calendar", fr: "Connecter Google Agenda", de: "Google Kalender verbinden", ja: "Googleカレンダーを接続", ko: "Google 캘린더 연결", pt: "Conectar Google Agenda", hi: "Google Calendar जोड़ें" },
  connectNotion: { en: "Connect Notion", es: "Conectar Notion", fr: "Connecter Notion", de: "Notion verbinden", ja: "Notionを接続", ko: "Notion 연결", pt: "Conectar Notion", hi: "Notion जोड़ें" },
  connectTodoist: { en: "Connect Todoist", es: "Conectar Todoist", fr: "Connecter Todoist", de: "Todoist verbinden", ja: "Todoistを接続", ko: "Todoist 연결", pt: "Conectar Todoist", hi: "Todoist जोड़ें" },
  noUpcomingEvents: { en: "No upcoming events", es: "Sin eventos próximos", fr: "Aucun événement", de: "Keine Ereignisse", ja: "今後のイベントはありません", ko: "예정된 일정 없음", pt: "Nenhum evento próximo", hi: "कोई आगामी कार्यक्रम नहीं" },
  noTasks: { en: "No tasks", es: "Sin tareas", fr: "Aucune tâche", de: "Keine Aufgaben", ja: "タスクはありません", ko: "할 일 없음", pt: "Sem tarefas", hi: "कोई कार्य नहीं" },
  focusPlaylist: { en: "Focus Playlist", es: "Lista de enfoque", fr: "Playlist de concentration", de: "Fokus-Playlist", ja: "集中プレイリスト", ko: "집중 플레이리스트", pt: "Playlist de foco", hi: "फोकस प्लेलिस्ट" },
  nextEvent: { en: "Next:", es: "Próximo:", fr: "Prochain :", de: "Nächstes:", ja: "次:", ko: "다음:", pt: "Próximo:", hi: "अगला:" },
  howDidItFeel: { en: "How did that session feel?", es: "¿Cómo fue esa sesión?", fr: "Comment s'est passée cette session ?", de: "Wie war die Sitzung?", ja: "このセッションはどうでしたか？", ko: "이 세션은 어땠나요?", pt: "Como foi essa sessão?", hi: "यह सत्र कैसा था?" },
  ratingRough: { en: "Rough", es: "Difícil", fr: "Difficile", de: "Schwierig", ja: "辛かった", ko: "힘들었음", pt: "Difícil", hi: "कठिन" },
  ratingDistracted: { en: "Distracted", es: "Distraído", fr: "Distrait", de: "Abgelenkt", ja: "散漫", ko: "산만했음", pt: "Distraído", hi: "भटका हुआ" },
  ratingOkay: { en: "Okay", es: "Regular", fr: "Correct", de: "Okay", ja: "普通", ko: "보통", pt: "Ok", hi: "ठीक" },
  ratingFocused: { en: "Focused", es: "Enfocado", fr: "Concentré", de: "Fokussiert", ja: "集中できた", ko: "집중됨", pt: "Focado", hi: "केंद्रित" },
  ratingZone: { en: "In the zone", es: "En la zona", fr: "Dans la zone", de: "Im Flow", ja: "ゾーン状態", ko: "플로우 상태", pt: "Em zona", hi: "ज़ोन में" },
  skipRating: { en: "Skip", es: "Omitir", fr: "Passer", de: "Überspringen", ja: "スキップ", ko: "건너뛰기", pt: "Pular", hi: "छोड़ें" },
  worldClock: { en: "World Clock", es: "Reloj mundial", fr: "Horloge mondiale", de: "Weltzeituhr", ja: "世界時計", ko: "세계 시계", pt: "Relógio mundial", hi: "विश्व घड़ी" },
  addTimezone: { en: "Add timezone", es: "Agregar zona horaria", fr: "Ajouter un fuseau", de: "Zeitzone hinzufügen", ja: "タイムゾーンを追加", ko: "시간대 추가", pt: "Adicionar fuso horário", hi: "टाइमज़ोन जोड़ें" },
  deadlineCountdown: { en: "Deadline Countdown", es: "Cuenta regresiva", fr: "Compte à rebours", de: "Countdown", ja: "締め切りカウントダウン", ko: "마감 카운트다운", pt: "Contagem regressiva", hi: "डेडलाइन काउंटडाउन" },
  startCountdown: { en: "Start countdown", es: "Iniciar cuenta regresiva", fr: "Démarrer", de: "Countdown starten", ja: "カウントダウン開始", ko: "카운트다운 시작", pt: "Iniciar contagem", hi: "काउंटडाउन शुरू" },
  clearCountdown: { en: "Clear countdown", es: "Eliminar cuenta regresiva", fr: "Effacer", de: "Löschen", ja: "クリア", ko: "지우기", pt: "Limpar", hi: "साफ़ करें" },
  language: { en: "Language", es: "Idioma", fr: "Langue", de: "Sprache", ja: "言語", ko: "언어", pt: "Idioma", hi: "भाषा" },
  analyticsTitle: { en: "Optional Usage Analytics", es: "Analítica de uso opcional", fr: "Analytique d'utilisation facultative", de: "Optionale Nutzungsanalyse", ja: "オプションの利用状況分析", ko: "선택적 사용 통계", pt: "Análise de uso opcional", hi: "वैकल्पिक उपयोग एनालिटिक्स" },
  analyticsReassurance: {
    en: "We value your privacy. Optional analytics share basic page-usage and performance measurements with Cloudflare to help improve Session Clock. Your clock, timer, themes, sounds, and saved settings work the same whether analytics is on or off. You can change this any time in Settings.",
    es: "Valoramos su privacidad. Las estadísticas opcionales comparten mediciones básicas de uso y rendimiento con Cloudflare para mejorar Session Clock. Su reloj, temporizador, temas, sonidos y ajustes guardados funcionan igual con la analítica activada o desactivada.",
    fr: "Nous respectons votre vie privée. Les statistiques facultatives partagent des mesures élémentaires de consultation et de performance avec Cloudflare pour améliorer Session Clock. Votre horloge, minuteur, thèmes, sons et préférences fonctionnent à l'identique.",
    de: "Wir schätzen Ihre Privatsphäre. Optionale Analysen teilen grundlegende Nutzungs- und Leistungsmessungen mit Cloudflare zur Verbesserung von Session Clock. Ihre Uhr, Timer, Themes, Töne und gespeicherten Einstellungen funktionieren stets gleich.",
    ja: "プライバシーを尊重します。任意の利用状況分析により、Session Clock向上のための基本的なページ利用状況とパフォーマンス測定値がCloudflareと共有されます。時計、タイマー、テーマ、サウンド、保存した設定は、分析のオン/オフに関わらず全く同じように動作します。",
    ko: "저희는 개인정보를 소중히 여깁니다. 선택적 분석은 Session Clock 개선을 위해 기본적인 페이지 사용량 및 성능 측정값을 Cloudflare와 공유합니다. 시계, 타이머, 테마, 사운드 및 저장된 설정은 분석 활성화 여부와 관계없이 동일하게 작동합니다.",
    pt: "Valorizamos a sua privacidade. As métricas opcionais partilham medições básicas de utilização e desempenho com a Cloudflare para melhorar o Session Clock. O seu relógio, temporizador, temas, sons e definições guardadas funcionam da mesma forma.",
    hi: "हम आपकी गोपनीयता का सम्मान करते हैं। वैकल्पिक एनालिटिक्स Session Clock को बेहतर बनाने के लिए Cloudflare के साथ बुनियादी पृष्ठ-उपयोग और प्रदर्शन माप साझा करता है। आपकी घड़ी, टाइमर, थीम, ध्वनियां और सहेजी गई सेटिंग्स समान रूप से काम करती हैं।",
  },
  analyticsStatusAutoOn: { en: "On (automatic)", es: "Activado (automático)", fr: "Activé (automatique)", de: "Ein (automatisch)", ja: "オン（自動）", ko: "켜짐 (자동)", pt: "Ativado (automático)", hi: "चालू (स्वचालित)" },
  analyticsStatusActive: { en: "On", es: "Activado", fr: "Activé", de: "Ein", ja: "オン", ko: "켜짐", pt: "Ativado", hi: "चालू" },
  analyticsStatusDisabled: { en: "Off (disabled)", es: "Desactivado", fr: "Désactivé", de: "Aus (deaktiviert)", ja: "オフ（無効）", ko: "꺼짐 (비활성화됨)", pt: "Desativado", hi: "बंद (अक्षम)" },
  analyticsStatusUnavailable: { en: "Off (unavailable)", es: "Desactivado (no disponible)", fr: "Désactivé (indisponible)", de: "Aus (nicht verfügbar)", ja: "オフ（利用不可）", ko: "꺼짐 (사용 불가)", pt: "Desativado (indisponível)", hi: "बंद (अनुपलब्ध)" },
  analyticsStatusChecking: { en: "Checking…", es: "Comprobando…", fr: "Vérification…", de: "Wird geprüft…", ja: "確認中…", ko: "확인 중…", pt: "A verificar…", hi: "जांच जारी है…" },
  analyticsDescBlocked: {
    en: "Analytics could not load. Your browser, network, or privacy settings may be blocking it. Session Clock is unaffected.",
    es: "No se pudo cargar la analítica. Es posible que su navegador, red o configuración de privacidad la estén bloqueando. Session Clock no se ve afectado.",
    fr: "Impossible de charger l'analytique. Votre navigateur, réseau ou paramètres de confidentialité la bloquent peut-être. Session Clock n'en est pas affecté.",
    de: "Die Analyse konnte nicht geladen werden. Ihr Browser, Netzwerk oder Datenschutzeinstellungen blockieren sie möglicherweise. Session Clock bleibt unbeeinträchtigt.",
    ja: "分析スクリプトを読み込めませんでした。ブラウザ、ネットワーク、またはプライバシー設定によってブロックされている可能性があります。Session Clockの動作には影響しません。",
    ko: "분석 스크립트를 로드할 수 없습니다. 브라우저, 네트워크 또는 개인정보 보호 설정에서 차단되었을 수 있습니다. Session Clock의 동작에는 영향을 주지 않습니다.",
    pt: "Não foi possível carregar a análise. O seu navegador, rede ou definições de privacidade podem estar a bloqueá-la. O Session Clock não é afetado.",
    hi: "एनालिटिक्स लोड नहीं हो सका। आपका ब्राउज़र, नेटवर्क या गोपनीयता सेटिंग्स इसे रोक सकती हैं। Session Clock अप्रभावित रहता है।",
  },
  analyticsDescNormal: {
    en: "Shares anonymous page-usage and performance measurements to help improve Session Clock.",
    es: "Comparte mediciones anónimas de uso de página y rendimiento para ayudar a mejorar Session Clock.",
    fr: "Partage des mesures anonymes de consultation et de performance pour améliorer Session Clock.",
    de: "Teilt anonyme Nutzungs- und Leistungsmessungen zur Verbesserung von Session Clock.",
    ja: "Session Clockの改善に役立つ匿名のページ利用状況およびパフォーマンス測定値を共有します。",
    ko: "Session Clock 개선에 도움이 되는 익명의 페이지 사용량 및 성능 측정값을 공유합니다.",
    pt: "Partilha medições anónimas de utilização de página e desempenho para ajudar a melhorar o Session Clock.",
    hi: "Session Clock को बेहतर बनाने में मदद के लिए अनाम पृष्ठ-उपयोग और प्रदर्शन माप साझा करता है।",
  },
  analyticsDescPrivacyMode: {
    en: "Disabled by Privacy Mode — no outbound analytics requests.",
    es: "Desactivado por el Modo Privacidad: sin solicitudes salientes de analítica.",
    fr: "Désactivé par le Mode Confidentialité — aucune requête analytique sortante.",
    de: "Durch Datenschutzmodus deaktiviert — keine ausgehenden Analyseanfragen.",
    ja: "プライバシーモードにより無効 — 外部への分析リクエストは行われません。",
    ko: "개인정보 보호 모드에 의해 비활성화됨 — 외부 분석 요청 없음.",
    pt: "Desativado pelo Modo de Privacidade — sem pedidos de análise enviados.",
    hi: "गोपनीयता मोड द्वारा अक्षम — कोई बाहरी एनालिटिक्स अनुरोध नहीं।",
  },
  analyticsActionEnable: { en: "Enable / Retry", es: "Activar / Reintentar", fr: "Activer / Réessayer", de: "Aktivieren / Wiederholen", ja: "有効化 / 再試行", ko: "활성화 / 다시 시도", pt: "Ativar / Tentar novamente", hi: "सक्रिय करें / पुनः प्रयास करें" },
  analyticsActionDisable: { en: "Turn off", es: "Desactivar", fr: "Désactiver", de: "Ausschalten", ja: "オフにする", ko: "끄기", pt: "Desativar", hi: "बंद करें" },
  analyticsActionAuto: { en: "Use automatic", es: "Usar automático", fr: "Utiliser automatique", de: "Automatisch verwenden", ja: "自動設定を使用", ko: "자동 사용", pt: "Usar automático", hi: "स्वचालित का उपयोग करें" },
};

function createLocaleDictionary(locale: Locale): Strings {
  const dict = {} as Strings;
  for (const key of Object.keys(CATALOG) as TranslationKey[]) {
    dict[key] = CATALOG[key]?.[locale] ?? CATALOG[key]?.en ?? "";
  }
  return dict;
}

const LOCALES: Record<Locale, Strings> = {
  en: createLocaleDictionary("en"),
  es: createLocaleDictionary("es"),
  fr: createLocaleDictionary("fr"),
  de: createLocaleDictionary("de"),
  ja: createLocaleDictionary("ja"),
  ko: createLocaleDictionary("ko"),
  pt: createLocaleDictionary("pt"),
  hi: createLocaleDictionary("hi"),
};

const STORAGE_KEY = "sc_locale";
let _current: Locale = (safeGet(STORAGE_KEY) as Locale) || detectLocale();

export function detectLocale(): Locale {
  if (typeof navigator === "undefined" || !navigator.language) return "en";
  const lang = navigator.language.slice(0, 2).toLowerCase();
  const map: Record<string, Locale> = {
    en: "en",
    es: "es",
    fr: "fr",
    de: "de",
    ja: "ja",
    ko: "ko",
    pt: "pt",
    hi: "hi",
  };
  return map[lang] ?? "en";
}

export function t(): Strings {
  return LOCALES[_current] ?? LOCALES.en;
}

export function getLocale(): Locale {
  return _current;
}

export function setLocale(l: Locale) {
  _current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // Non-throwing in strict environments
  }
  const target = typeof window !== "undefined" ? window : globalThis;
  if (typeof target?.dispatchEvent === "function") {
    target.dispatchEvent(new CustomEvent("sc:locale", { detail: l }));
  }
}
