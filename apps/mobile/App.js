import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const SESSION_STORAGE_KEY = 'studos.session.v1';
const STUDOS_LOGO = require('./assets/icon.png');
const CHAT_SEND_ROCKET = require('./assets/chat-send-rocket.png');
const APP_WINDOW_WIDTH = Dimensions.get('window').width;
const IS_WEB = Platform.OS === 'web';
const IS_MOBILE_WEB = IS_WEB && APP_WINDOW_WIDTH <= 768;
const USE_IOS_SAFE_FRAME = Platform.OS === 'ios' || IS_MOBILE_WEB;
const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
const APP_TOP_BAR_HEIGHT = USE_IOS_SAFE_FRAME ? 100 : 58 + ANDROID_STATUS_BAR_HEIGHT;
const APP_TOP_BAR_PADDING_TOP = USE_IOS_SAFE_FRAME ? 42 : ANDROID_STATUS_BAR_HEIGHT;
const APP_TOP_BAR_PADDING_BOTTOM = USE_IOS_SAFE_FRAME ? 8 : 0;
const APP_MOBILE_WEB_FOOTER_SAFE_AREA = IS_MOBILE_WEB ? 34 : 0;
const APP_FOOTER_PADDING_BOTTOM = Platform.OS === 'android' ? 54 : IS_MOBILE_WEB ? APP_MOBILE_WEB_FOOTER_SAFE_AREA : 8;
const APP_FOOTER_BOTTOM_PULL = IS_MOBILE_WEB ? -APP_MOBILE_WEB_FOOTER_SAFE_AREA : 0;
const APP_SCREEN_PADDING = 20;
const APP_SCREEN_TOP_PADDING = 30;
const APP_FOOTER_HEIGHT = 10 + 52 + APP_FOOTER_PADDING_BOTTOM;
const CHAT_THREAD_TOP_PADDING = USE_IOS_SAFE_FRAME ? 54 : ANDROID_STATUS_BAR_HEIGHT + 14;
const CHAT_THREAD_BOTTOM_PADDING = Platform.OS === 'android' ? APP_FOOTER_PADDING_BOTTOM : IS_MOBILE_WEB ? 0 : 10;
const CHAT_THREAD_KEYBOARD_VERTICAL_OFFSET = 0;
const CHAT_LIST_HEADER_SCROLL_PADDING_TOP = 160;
const CHAT_LIST_HEADER_COLLAPSE_DISTANCE = 260;
const CHAT_LIST_HEADER_CLAMP_DISTANCE = 14;
const CHAT_LIST_SEARCH_COLLAPSE_DISTANCE = 58;
const CHAT_LIST_HEADER_EXPANDED_HEIGHT = APP_SCREEN_TOP_PADDING + CHAT_LIST_HEADER_SCROLL_PADDING_TOP;
const CHAT_LIST_HEADER_COLLAPSED_HEIGHT = CHAT_LIST_HEADER_EXPANDED_HEIGHT - CHAT_LIST_SEARCH_COLLAPSE_DISTANCE;
const CHAT_THREAD_HEADER_COUNTERS = [
  { id: 'home', icon: 'home', value: '12' },
  { id: 'wave', icon: 'water', value: '8' },
  { id: 'bolt', icon: 'flash', value: '4' },
  { id: 'heart', icon: 'heart', value: '21' },
  { id: 'square', icon: 'square', value: '6' },
  { id: 'triangle', icon: 'triangle', value: '3' },
];

const BrowserSessionStore = {
  getItemAsync: async (key) => {
    try {
      return globalThis?.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItemAsync: async (key, value) => {
    try {
      globalThis?.localStorage?.setItem(key, value);
    } catch {
      // Browser storage can be blocked in private/locked-down modes.
    }
  },
  deleteItemAsync: async (key) => {
    try {
      globalThis?.localStorage?.removeItem(key);
    } catch {
      // Browser storage can be blocked in private/locked-down modes.
    }
  },
};
const SessionStore = Platform.OS === 'web' ? BrowserSessionStore : SecureStore;

function ChatSendRocketLogo({ disabled }) {
  return (
    <View style={[styles.chatSendRocketBadge, disabled ? styles.chatSendRocketBadgeDisabled : null]}>
      <Image
        resizeMode="contain"
        source={CHAT_SEND_ROCKET}
        style={[styles.chatSendRocketImage, disabled ? styles.chatSendRocketImageDisabled : null]}
      />
    </View>
  );
}

function ChatConversationChevron({ unread }) {
  if (!unread) {
    return <Ionicons name="chevron-forward" size={18} color={STUDOS_THEME.ink} />;
  }

  return <MaterialCommunityIcons name="chevron-right" size={30} color={STUDOS_THEME.red} style={styles.chatConversationChevronUnreadIcon} />;
}

const isConversationMuted = (conversation) => {
  const mutedUntil = conversation?.mutedUntil ? Date.parse(conversation.mutedUntil) : Number.NaN;

  return Number.isFinite(mutedUntil) && mutedUntil > Date.now();
};

const chatActionConfigFor = (actionType, conversation) => {
  const chatTitle = conversation?.title ? `“${conversation.title}”` : 'chatten';

  switch (actionType) {
    case 'mute':
      return {
        icon: 'notifications-off',
        title: 'Slå notifikationer fra?',
        body: `Du får ikke push-alarmer fra ${chatTitle}, men chatten bliver liggende.`,
        confirmLabel: 'Slå fra',
        tone: 'quiet',
      };
    case 'unmute':
      return {
        icon: 'notifications',
        title: 'Slå notifikationer til?',
        body: `Du får igen notifikationer fra ${chatTitle}.`,
        confirmLabel: 'Slå til',
        tone: 'calm',
      };
    case 'hide':
      return {
        icon: 'eye-off',
        title: 'Skjul chat?',
        body: 'Chatten fjernes kun hos dig. Den kan komme frem igen, hvis I skriver sammen.',
        confirmLabel: 'Skjul',
        tone: 'quiet',
      };
    case 'leave':
      return {
        icon: 'log-out-outline',
        title: 'Forlad gruppechat?',
        body: `Du fjernes fra ${chatTitle} og kan ikke skrive videre i gruppen.`,
        confirmLabel: 'Forlad',
        tone: 'danger',
      };
    case 'delete':
      return {
        icon: 'trash',
        title: 'Slet gruppechat?',
        body: `Sletter ${chatTitle} for alle deltagere. Det kan ikke fortrydes.`,
        confirmLabel: 'Slet',
        tone: 'danger',
      };
    case 'report':
      return {
        icon: 'flag',
        title: 'Rapportér chat?',
        body: 'Rapporten gemmes til moderering. Chatten bliver ikke slettet automatisk.',
        confirmLabel: 'Rapportér',
        tone: 'warning',
      };
    case 'block':
      return {
        icon: 'person-remove',
        title: 'Blokér person?',
        body: 'Personen kan ikke chatte videre med dig, og chatten skjules hos dig.',
        confirmLabel: 'Blokér',
        tone: 'danger',
      };
    default:
      return null;
  }
};

const chatMessageActionConfigFor = (actionType) => {
  switch (actionType) {
    case 'delete-message':
      return {
        icon: 'trash',
        title: 'Slet besked?',
        body: 'Beskeden fjernes fra chatten og vises som slettet.',
        confirmLabel: 'Slet',
        tone: 'danger',
      };
    case 'report-message':
      return {
        icon: 'flag',
        title: 'Rapportér besked?',
        body: 'Beskeden sendes til moderation. Den anden person får ikke en notifikation om rapporten.',
        confirmLabel: 'Rapportér',
        tone: 'warning',
      };
    default:
      return null;
  }
};

const CREATE_CLASS_URL =
  process.env.EXPO_PUBLIC_CREATE_CLASS_URL
  ?? 'http://192.168.1.114/studenter-app/public/opret-klasse';
const EXPLICIT_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const LOCAL_API_BASE_URLS = [
  'http://192.168.1.114/studenter-app/public/api',
  'http://localhost/studenter-app/public/api',
  'http://127.0.0.1/studenter-app/public/api',
  'http://MacBook-Air-tilhrende-Chris.local/studenter-app/public/api',
];
const API_BASE_URLS = (EXPLICIT_API_BASE_URL ? [EXPLICIT_API_BASE_URL] : LOCAL_API_BASE_URLS).filter(Boolean);
const REVERB_APP_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? 'studos-local-key';
const REVERB_HOST = process.env.EXPO_PUBLIC_REVERB_HOST ?? '192.168.1.114';
const REVERB_PORT = Number(process.env.EXPO_PUBLIC_REVERB_PORT ?? 8080);
const REVERB_SCHEME = process.env.EXPO_PUBLIC_REVERB_SCHEME ?? 'http';
const REVERB_FORCE_TLS = REVERB_SCHEME === 'https' || REVERB_PORT === 443;
const APP_TABS = [
  { id: 'calendar', label: 'Kalender', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  { id: 'overview', label: 'Overblik', icon: 'home-outline', activeIcon: 'home' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet-outline', activeIcon: 'wallet' },
  { id: 'walls', label: 'Walls', icon: 'images-outline', activeIcon: 'images' },
];
const STUDOS_THEME = {
  blue: '#75DED0',
  yellow: '#FFD46D',
  red: '#FF6F73',
  ink: '#172143',
};
const CHAT_THREAD_BACK_SWIPE_ACTIVATION_DISTANCE = 18;
const CHAT_THREAD_BACK_SWIPE_DISTANCE = 72;
const CHAT_THREAD_BACK_SWIPE_FAST_DISTANCE = 48;
const CHAT_THREAD_BACK_SWIPE_VELOCITY = 0.26;
const CHAT_THREAD_BACK_SWIPE_VERTICAL_RATIO = 1.18;
const APP_DRAWER_SECTIONS = [
  {
    title: 'Din klasse',
    items: [
      { id: 'leaderboard', label: 'Leaderboard', icon: 'stats-chart-outline', activeIcon: 'stats-chart', accentColor: STUDOS_THEME.red },
      { id: 'moodBoard', label: 'Stemningstavle', icon: 'happy-outline', activeIcon: 'happy', accentColor: STUDOS_THEME.yellow },
      { id: 'challenges', label: 'Udfordringer', icon: 'flash-outline', activeIcon: 'flash', accentColor: STUDOS_THEME.red },
      { id: 'badges', label: 'Badges / klip', icon: 'ribbon-outline', activeIcon: 'ribbon', accentColor: STUDOS_THEME.yellow },
      { id: 'bluebook', label: 'Blå bog', icon: 'book-outline', activeIcon: 'book', accentColor: STUDOS_THEME.blue },
      { id: 'randomizer', label: 'Randomizer', icon: 'shuffle-outline', activeIcon: 'shuffle', accentColor: STUDOS_THEME.red },
    ],
  },
  {
    title: 'Andre klasser',
    items: [
      { id: 'connections', label: 'Connections', icon: 'person-add-outline', activeIcon: 'person-add', accentColor: STUDOS_THEME.blue },
      { id: 'classBattle', label: 'Klassedyst', icon: 'podium-outline', activeIcon: 'podium', accentColor: STUDOS_THEME.yellow },
    ],
  },
];

const emptyProfile = {
  schoolId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthday: '',
  profilePhotoUrl: '',
  profilePhotoData: '',
  password: '',
  passwordConfirmation: '',
  termsAccepted: false,
  privacyAccepted: false,
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
};

const formatInputDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const createCalendarDraft = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    title: '',
    eventDate: formatInputDate(tomorrow),
    eventTime: '19:00',
    location: '',
    description: '',
    coverImageUri: '',
    coverImageData: '',
    inviteScope: 'class',
    invitedMemberIds: [],
  };
};

const CALENDAR_WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const CALENDAR_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => `${index}`.padStart(2, '0'));
const CALENDAR_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => `${index}`.padStart(2, '0'));
const CALENDAR_TIME_WHEEL_ITEM_HEIGHT = 36;
const CALENDAR_INVITE_SCOPE_OPTIONS = [
  { id: 'class', label: 'Hele klassen', icon: 'school' },
  { id: 'crew', label: 'Mit crew', icon: 'people' },
  { id: 'custom', label: 'Vælg personer', icon: 'person-add' },
];

const dateFromInput = (value) => {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const splitCalendarTime = (value) => {
  const [rawHour = '19', rawMinute = '00'] = String(value || '19:00').split(':');
  const hour = rawHour.padStart(2, '0').slice(-2);
  const minute = rawMinute.padStart(2, '0').slice(0, 2);

  return {
    hour: CALENDAR_HOUR_OPTIONS.includes(hour) ? hour : '19',
    minute: CALENDAR_MINUTE_OPTIONS.includes(minute) ? minute : '00',
  };
};

const monthTitle = (date) => new Intl.DateTimeFormat('da-DK', {
  month: 'long',
  year: 'numeric',
}).format(date);

const addCalendarMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1, 12);

const calendarDaysForMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1, 12);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();

  return [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({
      id: `empty-${year}-${month}-${index}`,
      empty: true,
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dayDate = new Date(year, month, day, 12);

      return {
        id: formatInputDate(dayDate),
        day,
        value: formatInputDate(dayDate),
      };
    }),
  ];
};

const formatCalendarDateParts = (value) => {
  const date = value ? new Date(`${value}T12:00:00`) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return { day: '--', month: 'dato', weekday: 'Dato kommer' };
  }

  return {
    day: new Intl.DateTimeFormat('da-DK', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('da-DK', { month: 'short' }).format(date).replace('.', ''),
    weekday: new Intl.DateTimeFormat('da-DK', { weekday: 'long' }).format(date),
  };
};

const formatCalendarTime = (value) => {
  const text = String(value ?? '');
  const timeMatch = text.match(/(?:T|\s)(\d{2}:\d{2})/);

  if (timeMatch?.[1]) {
    return timeMatch[1];
  }

  return '';
};

const formatMoodUpdatedAt = (date = new Date()) => new Intl.DateTimeFormat('da-DK', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(date);

const formatChatTime = (value) => {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfLocalWeek = (date) => {
  const start = startOfLocalDay(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);

  return start;
};

const formatChatListTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const messageDay = startOfLocalDay(date);
  const today = startOfLocalDay(now);
  const yesterday = startOfLocalDay(now);
  yesterday.setDate(today.getDate() - 1);

  const timeText = formatChatTime(value);

  if (messageDay.getTime() === today.getTime()) {
    return `idag ${timeText}`;
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return `igår ${timeText}`;
  }

  if (messageDay >= startOfLocalWeek(now)) {
    const weekday = new Intl.DateTimeFormat('da-DK', { weekday: 'short' })
      .format(date)
      .replace('.', '')
      .toLocaleLowerCase('da-DK');

    return `${weekday} ${timeText}`;
  }

  const dateText = new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);

  return `${dateText} ${timeText}`;
};

const timestampForConversationSort = (conversation) => {
  const timestamp = Date.parse(
    conversation?.lastMessage?.createdAt
      ?? conversation?.updatedAt
      ?? conversation?.createdAt
      ?? '',
  );

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isMemberOnline = (member) => Boolean(member?.isOnline);

const formatMemberActivity = (member) => {
  if (isMemberOnline(member)) {
    return 'Aktiv nu';
  }

  const timestamp = Date.parse(member?.lastSeenAt ?? '');

  if (!Number.isFinite(timestamp)) {
    return 'Sidst aktiv ukendt';
  }

  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));

  if (diffMinutes < 60) {
    return `Sidst aktiv for ${diffMinutes} min. siden`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `Sidst aktiv for ${diffHours} t. siden`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `Sidst aktiv for ${diffDays} d. siden`;
  }

  return `Sidst aktiv ${new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(timestamp))}`;
};

const daysUntil = (value) => {
  if (!value) {
    return 0;
  }

  const today = new Date();
  const target = new Date(`${value}T12:00:00`);
  const diff = target.getTime() - today.getTime();

  return Math.max(0, Math.ceil(diff / 86_400_000));
};

const firstLetterOf = (value) => String(value ?? '').trim().charAt(0);

const initialsFor = (profile) => {
  const firstName = String(profile?.firstName ?? '').trim();
  const lastName = String(profile?.lastName ?? '').trim();

  if (firstName && lastName) {
    return `${firstLetterOf(firstName)}${firstLetterOf(lastName)}`.toLocaleUpperCase('da-DK');
  }

  const displayParts = String(profile?.displayName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (displayParts.length >= 2) {
    return `${firstLetterOf(displayParts[0])}${firstLetterOf(displayParts[displayParts.length - 1])}`.toLocaleUpperCase('da-DK');
  }

  const nameParts = [firstName, lastName]
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length >= 2) {
    return `${firstLetterOf(nameParts[0])}${firstLetterOf(nameParts[nameParts.length - 1])}`.toLocaleUpperCase('da-DK');
  }

  const singleName = nameParts[0] || displayParts[0] || String(profile?.email ?? '').split('@')[0] || 'Studos';
  const letters = singleName.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2);

  return (letters.length === 1 ? `${letters}${letters}` : letters || 'ST').toLocaleUpperCase('da-DK');
};

const fetchWithTimeout = (url, options) =>
  Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Forbindelsen tog for lang tid.')), 6000);
    }),
  ]);

const parseApiError = (payload) => {
  const errors = payload?.errors ? Object.values(payload.errors).flat() : [];

  return errors[0] || payload?.message || 'Noget gik galt. Proev igen.';
};

const apiFetch = async (path, options = {}) => {
  const { authToken, headers: optionHeaders, ...fetchOptions } = options;
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(optionHeaders ?? {}),
        },
        ...fetchOptions,
      });
      const text = await response.text();
      let payload = {};

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = {};
        }
      }

      if (!response.ok) {
        const error = new Error(parseApiError(payload));
        error.status = response.status;
        throw error;
      }

      return payload;
    } catch (error) {
      lastError = error;

      if (error.status) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('API kunne ikke naas.');
};

const createChatEcho = (authToken) => {
  const isWeb = Platform.OS === 'web';

  if (!isWeb && !NativeModules?.RNCNetInfo) {
    return null;
  }

  try {
    const EchoModule = require('laravel-echo');
    const PusherModule = isWeb ? require('pusher-js') : require('pusher-js/react-native');
    const EchoClient = EchoModule.default ?? EchoModule;
    const PusherClient = PusherModule.default ?? PusherModule;

    globalThis.Pusher = PusherClient;

    return new EchoClient({
      broadcaster: 'reverb',
      key: REVERB_APP_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_FORCE_TLS,
      enabledTransports: [REVERB_FORCE_TLS ? 'wss' : 'ws'],
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          apiFetch('/chat/realtime/auth', {
            authToken,
            method: 'POST',
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          })
            .then((data) => callback(false, data))
            .catch((error) => callback(true, error));
        },
      }),
    });
  } catch (error) {
    console.warn('Chat realtime is unavailable in this build.', error);
    return null;
  }
};

const profileFromMember = (member) => ({
  firstName: member?.firstName ?? '',
  lastName: member?.lastName ?? '',
  email: member?.email ?? '',
  phone: member?.phone ?? '',
  birthday: member?.birthday ?? '',
  profilePhotoUrl: member?.profilePhotoUrl ?? '',
});

export default function App() {
  const [step, setStep] = useState('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [schoolClass, setSchoolClass] = useState(null);
  const [availableSchools, setAvailableSchools] = useState([]);
  const [profile, setProfile] = useState(emptyProfile);
  const [session, setSession] = useState(null);
  const [existingLogin, setExistingLogin] = useState({ inviteCode: '', email: '', password: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const appScrollRef = useRef(null);

  const activeClass = session?.class ?? schoolClass;
  const activeMember = session?.member ?? null;
  const events = activeClass?.events ?? [];
  const contentBlocks = activeClass?.contentBlocks ?? [];
  const nextEvent = events[0] ?? null;
  const pinnedContent = contentBlocks.find((block) => block.isPinned) ?? contentBlocks[0] ?? null;
  const activeMembers = activeClass?.members?.filter((member) => member.status === 'active') ?? [];
  const countdown = useMemo(
    () => daysUntil(activeClass?.graduationDate),
    [activeClass?.graduationDate],
  );
  const appContentDetached = activeTab === 'chat' || activeTab === 'calendar';

  const scrollAppToTop = useCallback(() => {
    requestAnimationFrame(() => {
      appScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    SessionStore.getItemAsync(SESSION_STORAGE_KEY)
      .then(async (storedSession) => {
        if (!storedSession || !isMounted) {
          return;
        }

        const parsedSession = JSON.parse(storedSession);
        const storedToken = parsedSession?.session?.token;

        if (!storedToken) {
          await SessionStore.deleteItemAsync(SESSION_STORAGE_KEY);
          return;
        }

        const data = await apiFetch('/session/me', { authToken: storedToken });
        const nextSession = {
          ...data.session,
          token: storedToken,
        };

        if (!nextSession?.member || !data.class) {
          await SessionStore.deleteItemAsync(SESSION_STORAGE_KEY);
          return;
        }

        await storeSession({
          session: nextSession,
          class: data.class,
        });

        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setSchoolClass(data.class);
        setProfile(profileFromMember(nextSession.member));
        setActiveTab('overview');
        setStep('overview');
      })
      .catch(async () => {
        await SessionStore.deleteItemAsync(SESSION_STORAGE_KEY);

        if (isMounted) {
          setError('');
        }
      })
      .finally(() => {
        if (isMounted) {
          setCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateProfile = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const updateExistingLogin = (key, value) => {
    setExistingLogin((current) => ({ ...current, [key]: value }));
  };

  const storeSession = async (data) => {
    await SessionStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify({
      session: data.session,
      class: data.class,
    }));
  };

  useEffect(() => {
    if (!session?.member?.id || !session?.token) {
      return;
    }

    let isMounted = true;

    apiFetch('/session/me', { authToken: session.token })
      .then(async (data) => {
        if (!isMounted) {
          return;
        }

        if (!data.session?.member || !data.class) {
          return;
        }

        const nextSession = {
          ...data.session,
          token: session.token,
        };

        setSession(nextSession);
        setSchoolClass(data.class);
        setProfile(profileFromMember(nextSession.member));

        await storeSession({
          session: nextSession,
          class: data.class,
        });
      })
      .catch(async (apiError) => {
        if (apiError.status === 401) {
          await clearSession();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session?.member?.id, session?.token]);

  const clearSession = async () => {
    await SessionStore.deleteItemAsync(SESSION_STORAGE_KEY);
    setSession(null);
    setSchoolClass(null);
    setAvailableSchools([]);
    setProfile(emptyProfile);
    setInviteCode('');
    setExistingLogin({ inviteCode: '', email: '', password: '' });
    setActiveTab('overview');
    setSidebarOpen(false);
    setError('');
    setStep('invite');
  };

  const submitInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();

    if (!code) {
      setError('Indtast invitekode for at fortsaette.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(`/classes/invite/${encodeURIComponent(code)}`);
      const schools = data.schools?.length
        ? data.schools
        : data.class?.schoolId
          ? [{ id: data.class.schoolId, name: data.class.schoolName }]
          : [];

      setInviteCode(code);
      setSchoolClass(data.class);
      setAvailableSchools(schools);
      setProfile((current) => ({ ...current, schoolId: '' }));
      setStep('profile');
    } catch (apiError) {
      setError(apiError.message || 'Invitekoden kunne ikke findes.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateClassPage = async () => {
    setError('');

    try {
      await Linking.openURL(CREATE_CLASS_URL);
    } catch {
      setError('Kunne ikke aabne klasseoprettelsen.');
    }
  };

  const showExistingLogin = () => {
    setExistingLogin((current) => ({
      ...current,
      inviteCode: current.inviteCode || inviteCode.trim().toUpperCase(),
    }));
    setError('');
    setStep('existingLogin');
  };

  const loginExistingProfile = async () => {
    const nextLogin = {
      inviteCode: existingLogin.inviteCode.trim().toUpperCase(),
      email: existingLogin.email.trim().toLowerCase(),
      password: existingLogin.password,
    };

    if (!nextLogin.inviteCode || !nextLogin.email || !nextLogin.password) {
      setError('Indtast invitekode, email og adgangskode.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/session/login', {
        method: 'POST',
        body: JSON.stringify(nextLogin),
      });

      await storeSession(data);
      setExistingLogin({
        inviteCode: nextLogin.inviteCode,
        email: nextLogin.email,
        password: '',
      });
      setSession(data.session);
      setSchoolClass(data.class);
      setProfile(profileFromMember(data.session.member));
      setActiveTab('overview');
      setStep('overview');
    } catch (apiError) {
      setError(apiError.message || 'Login mislykkedes.');
    } finally {
      setLoading(false);
    }
  };

  const pickProfilePhoto = async () => {
    setError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Studos skal have adgang til billeder for at vaelge profilbillede.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';

      updateProfile('profilePhotoUrl', asset.uri);
      updateProfile('profilePhotoData', asset.base64 ? `data:${mimeType};base64,${asset.base64}` : '');
    }
  };

  const updateCurrentProfilePhoto = async (profilePhotoData) => {
    if (!session?.token) {
      setError('Login mangler.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/profile/photo', {
        authToken: session.token,
        method: 'POST',
        body: JSON.stringify({
          profilePhotoData,
        }),
      });
      const nextSession = {
        ...data.session,
        token: session.token,
      };

      setSession(nextSession);
      setSchoolClass(data.class);
      setProfile(profileFromMember(nextSession.member));

      await storeSession({
        session: nextSession,
        class: data.class,
      });

      return true;
    } catch (apiError) {
      setError(apiError.message || 'Profilbilledet kunne ikke gemmes.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const syncActiveClass = async (nextClass) => {
    setSchoolClass(nextClass);

    if (session) {
      await storeSession({
        session,
        class: nextClass,
      });
    }
  };

  const createCalendarEvent = async (eventPayload) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    const data = await apiFetch('/events', {
      authToken: session.token,
      method: 'POST',
      body: JSON.stringify(eventPayload),
    });

    if (data.class) {
      await syncActiveClass(data.class);
    }

    return data;
  };

  const respondToCalendarEvent = async (eventId, status) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    const data = await apiFetch(`/events/${encodeURIComponent(eventId)}/rsvp`, {
      authToken: session.token,
      method: 'POST',
      body: JSON.stringify({ status }),
    });

    if (data.class) {
      await syncActiveClass(data.class);
    }

    return data;
  };

  const submitProfile = async () => {
    const nextProfile = {
      schoolId: profile.schoolId,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.trim(),
      birthday: profile.birthday.trim(),
      profilePhotoData: profile.profilePhotoData,
      password: profile.password,
      passwordConfirmation: profile.passwordConfirmation,
      termsAccepted: profile.termsAccepted,
      privacyAccepted: profile.privacyAccepted,
    };
    const requiredFields = [
      'schoolId',
      'firstName',
      'lastName',
      'email',
      'birthday',
      'password',
      'passwordConfirmation',
    ];
    const missingField = requiredFields.find((key) => !nextProfile[key]);

    if (missingField) {
      setError('Udfyld navn, skole, email, foedselsdag og adgangskode.');
      return;
    }

    if (!nextProfile.termsAccepted || !nextProfile.privacyAccepted) {
      setError('Accepter vilkaar og privatlivspolitik for at oprette profilen.');
      return;
    }

    if (nextProfile.password !== nextProfile.passwordConfirmation) {
      setError('Adgangskoderne skal vaere ens.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextProfile.birthday)) {
      setError('Skriv foedselsdag som YYYY-MM-DD.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/classes/join', {
        method: 'POST',
        body: JSON.stringify({
          inviteCode,
          ...nextProfile,
        }),
      });

      await storeSession(data);
      setProfile(profileFromMember(data.session.member));
      setSession(data.session);
      setSchoolClass(data.class);
      setActiveTab('overview');
      setStep('overview');
    } catch (apiError) {
      setError(apiError.message || 'Profilen kunne ikke oprettes.');
    } finally {
      setLoading(false);
    }
  };

  const showAppShell = step === 'overview' && activeClass && activeMember;

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingScreen}>
          <Image source={STUDOS_LOGO} style={styles.logoMark} />
          <ActivityIndicator color="#ef5b3f" />
        </View>
      </SafeAreaView>
    );
  }

  if (showAppShell) {
    return (
      <View style={styles.appRoot}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#172143"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.appShell}>
            <AppTopBar
              className={activeClass.className}
              menuOpen={sidebarOpen}
              schoolName={activeClass.schoolName}
              onToggleMenu={() => setSidebarOpen((current) => !current)}
            />
            {appContentDetached ? (
              <View style={[
                styles.appScreen,
                activeTab === 'chat' ? styles.appScreenOverlayHost : null,
              ]}>
                <AppTabScreen
                  activeMember={activeMember}
                  activeMembers={activeMembers}
                  activeTab={activeTab}
                  countdown={countdown}
                  error={error}
                  events={events}
                  loading={loading}
                  nextEvent={nextEvent}
                  onCreateEvent={createCalendarEvent}
                  onProfilePhotoUpdate={updateCurrentProfilePhoto}
                  onRequestScrollTop={scrollAppToTop}
                  onRespondToEvent={respondToCalendarEvent}
                  pinnedContent={pinnedContent}
                  profile={profile}
                  schoolClass={activeClass}
                  sessionToken={session.token}
                />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.appScreen}
                keyboardShouldPersistTaps="handled"
                ref={appScrollRef}
                style={styles.appScroll}
              >
                <AppTabScreen
                  activeMember={activeMember}
                  activeMembers={activeMembers}
                  activeTab={activeTab}
                  countdown={countdown}
                  error={error}
                  events={events}
                  loading={loading}
                  nextEvent={nextEvent}
                  onCreateEvent={createCalendarEvent}
                  onProfilePhotoUpdate={updateCurrentProfilePhoto}
                  onRequestScrollTop={scrollAppToTop}
                  onRespondToEvent={respondToCalendarEvent}
                  pinnedContent={pinnedContent}
                  profile={profile}
                  schoolClass={activeClass}
                  sessionToken={session.token}
                />
              </ScrollView>
            )}
            <FooterNav activeTab={activeTab} onChangeTab={setActiveTab} />
            <AppSidebar
              activeMember={activeMember}
              activeMembers={activeMembers}
              activeRoute={activeTab}
              profile={profile}
              visible={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onSelect={(route) => {
                setActiveTab(route);
                setSidebarOpen(false);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {step === 'invite' && (
            <InviteScreen
              error={error}
              inviteCode={inviteCode}
              loading={loading}
              onChangeInviteCode={(value) => setInviteCode(value.toUpperCase())}
              onCreateClass={openCreateClassPage}
              onExistingLogin={showExistingLogin}
              onSubmit={submitInviteCode}
            />
          )}

          {step === 'existingLogin' && (
            <ExistingLoginScreen
              error={error}
              login={existingLogin}
              loading={loading}
              onBack={() => {
                setStep('invite');
                setError('');
              }}
              onChangeLogin={updateExistingLogin}
              onLogin={loginExistingProfile}
            />
          )}

          {step === 'profile' && schoolClass && (
            <ProfileScreen
              error={error}
              loading={loading}
              profile={profile}
              schools={availableSchools}
              schoolClass={schoolClass}
              onBack={() => {
                setStep('invite');
                setError('');
              }}
              onChangeProfile={updateProfile}
              onPickPhoto={pickProfilePhoto}
              onSubmit={submitProfile}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InviteScreen({
  error,
  inviteCode,
  loading,
  onChangeInviteCode,
  onCreateClass,
  onExistingLogin,
  onSubmit,
}) {
  return (
    <View style={styles.inviteShell}>
      <Pressable hitSlop={12} onPress={onExistingLogin} style={styles.topLoginButton}>
        <Text style={styles.topLoginText}>Jeg har allerede en profil</Text>
      </Pressable>

      <View style={styles.inviteMain}>
        <View style={styles.logoLockup}>
          <Image source={STUDOS_LOGO} style={styles.logoMark} />
          <Text style={styles.logoWord}>Studos</Text>
        </View>

        <View style={styles.inviteForm}>
          <Text style={styles.label}>Invitekode</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={onChangeInviteCode}
            onSubmitEditing={onSubmit}
            placeholder="STU-DEMO26"
            placeholderTextColor="#8b93a1"
            returnKeyType="go"
            style={styles.inviteInput}
            value={inviteCode}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="Fortsaet" loading={loading} onPress={onSubmit} />
        </View>
      </View>

      <Pressable hitSlop={12} onPress={onCreateClass} style={styles.createClassLink}>
        <Text style={styles.createClassText}>Mangler din klasse Studos?</Text>
        <Text style={styles.createClassAction}>Opret klassen her</Text>
      </Pressable>
    </View>
  );
}

function AppTabScreen({
  activeMember,
  activeMembers,
  activeTab,
  countdown,
  error,
  events,
  loading,
  nextEvent,
  onCreateEvent,
  onProfilePhotoUpdate,
  onRequestScrollTop,
  onRespondToEvent,
  pinnedContent,
  profile,
  schoolClass,
  sessionToken,
}) {
  if (activeTab === 'chat') {
    return (
      <ChatScreen
        activeMember={activeMember}
        activeMembers={activeMembers}
        schoolClass={schoolClass}
        sessionToken={sessionToken}
      />
    );
  }

  if (activeTab === 'profile') {
    return (
      <AccountProfileScreen
        activeMember={activeMember}
        error={error}
        loading={loading}
        profile={profile}
        schoolClass={schoolClass}
        onProfilePhotoUpdate={onProfilePhotoUpdate}
      />
    );
  }

  if (activeTab === 'walls') {
    return (
      <FeatureScreen
        icon="images"
        kicker={schoolClass.className}
        title="Walls"
        emptyTitle="Ingen walls endnu"
        emptyText="Billeder, minder og opslag lander her."
      />
    );
  }

  if (activeTab === 'awards') {
    return (
      <FeatureScreen
        icon="trophy"
        kicker={schoolClass.className}
        title="Awards"
        emptyTitle="Ingen awards endnu"
        emptyText="Afstemninger og klassepriser bliver samlet her."
      />
    );
  }

  if (activeTab === 'calendar') {
    return (
      <CalendarScreen
        activeMember={activeMember}
        activeMembers={activeMembers}
        events={events}
        onCreateEvent={onCreateEvent}
        onRequestScrollTop={onRequestScrollTop}
        onRespondToEvent={onRespondToEvent}
      />
    );
  }

  if (activeTab === 'wallet') {
    return (
      <FeatureScreen
        icon="wallet"
        kicker={schoolClass.className}
        title="Wallet"
        emptyTitle="Ingen fordele endnu"
        emptyText="Rabatkort, elevbevis og fordele bliver samlet her."
      />
    );
  }

  if (activeTab === 'bluebook') {
    return (
      <FeatureScreen
        icon="book"
        kicker={schoolClass.className}
        title="Blå bog"
        emptyTitle="Blå bog er tom endnu"
        emptyText="Klasseprofiler, historier og de små legendariske detaljer bliver samlet her."
      />
    );
  }

  if (activeTab === 'classBattle') {
    return (
      <FeatureScreen
        icon="podium"
        kicker={schoolClass.className}
        title="Klassedyst"
        emptyTitle="Ingen dyste endnu"
        emptyText="Point, udfordringer og klassekampe lander her."
      />
    );
  }

  if (activeTab === 'badges') {
    return (
      <FeatureScreen
        icon="ribbon"
        kicker={schoolClass.className}
        title="Badges"
        emptyTitle="Ingen badges endnu"
        emptyText="Hueklip, beviser og digitale mærker bliver samlet her."
      />
    );
  }

  if (activeTab === 'classmates') {
    return (
      <FeatureScreen
        icon="people"
        kicker={schoolClass.className}
        title="Mit crew"
        emptyTitle="Crewet er tomt endnu"
        emptyText="Klassen, profiler og små facts bliver samlet her."
      />
    );
  }

  if (activeTab === 'leaderboard') {
    return (
      <FeatureScreen
        icon="stats-chart"
        kicker={schoolClass.className}
        title="Leaderboard"
        emptyTitle="Ingen point endnu"
        emptyText="Point fra dyste, badges og udfordringer bliver samlet her."
      />
    );
  }

  if (activeTab === 'randomizer') {
    return (
      <FeatureScreen
        icon="shuffle"
        kicker={schoolClass.className}
        title="Randomizer"
        emptyTitle="Ingen challenges endnu"
        emptyText="Træk en tilfældig challenge, person eller mission til klassen."
      />
    );
  }

  if (activeTab === 'challenges') {
    return (
      <FeatureScreen
        icon="flash"
        kicker={schoolClass.className}
        title="Udfordringer"
        emptyTitle="Ingen udfordringer endnu"
        emptyText="Challenges fra andre elever bliver samlet her."
      />
    );
  }

  if (activeTab === 'moodBoard') {
    return (
      <FeatureScreen
        icon="happy"
        kicker={schoolClass.className}
        title="Stemningstavle"
        emptyTitle="Ingen stemning endnu"
        emptyText="Her kan alle dele hvordan de har det lige nu."
      />
    );
  }

  if (activeTab === 'connections') {
    return (
      <ConnectionsScreen
        activeMember={activeMember}
        schoolClass={schoolClass}
        sessionToken={sessionToken}
      />
    );
  }

  return (
    <OverviewScreen
      activeMember={activeMember}
      activeMembers={activeMembers}
      countdown={countdown}
      events={events}
      nextEvent={nextEvent}
      pinnedContent={pinnedContent}
      profile={profile}
      schoolClass={schoolClass}
    />
  );
}

function ChatScreen({
  activeMember,
  activeMembers,
  schoolClass,
  sessionToken,
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupPhotoUri, setGroupPhotoUri] = useState('');
  const [groupPhotoData, setGroupPhotoData] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupPickerQuery, setGroupPickerQuery] = useState('');
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [directPickerOpen, setDirectPickerOpen] = useState(false);
  const [directPickerQuery, setDirectPickerQuery] = useState('');
  const [externalAddOpen, setExternalAddOpen] = useState(false);
  const [externalPersonalCode, setExternalPersonalCode] = useState('');
  const [externalAddLoading, setExternalAddLoading] = useState(false);
  const [externalAddError, setExternalAddError] = useState('');
  const [externalAddMessage, setExternalAddMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatNotice, setChatNotice] = useState('');
  const [chatConversationActionMenu, setChatConversationActionMenu] = useState(null);
  const [chatActionConfirm, setChatActionConfirm] = useState(null);
  const [chatActionLoading, setChatActionLoading] = useState(false);
  const [chatMessageActionConfirm, setChatMessageActionConfirm] = useState(null);
  const [chatMessageActionLoading, setChatMessageActionLoading] = useState(false);
  const [chatListHeaderScrolled, setChatListHeaderScrolled] = useState(false);
  const echoRef = useRef(null);
  const activeRealtimeChannelRef = useRef('');
  const messagesScrollRef = useRef(null);
  const messageInputRef = useRef(null);
  const chatThreadDragX = useRef(new Animated.Value(0)).current;
  const chatListScrollY = useRef(new Animated.Value(0)).current;
  const chatListHeaderScrolledRef = useRef(false);
  const chatThreadWidthRef = useRef(APP_WINDOW_WIDTH);
  const chatThreadTouchStartRef = useRef(null);
  const chatThreadTouchLatestRef = useRef(null);
  const chatThreadSwipeActiveRef = useRef(false);
  const chatConversationLongPressHandledRef = useRef(false);

  const chatMembers = useMemo(
    () => (activeMembers ?? []).filter((member) => member.id !== activeMember?.id),
    [activeMembers, activeMember?.id],
  );
  const directPickerMembers = useMemo(() => {
    const query = directPickerQuery.trim().toLocaleLowerCase('da-DK');

    if (!query) {
      return chatMembers;
    }

    return chatMembers.filter((member) => {
      const searchableName = [
        member.displayName,
        member.firstName,
        member.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('da-DK');

      return searchableName.includes(query);
    });
  }, [chatMembers, directPickerQuery]);
  const groupPickerMembers = useMemo(() => {
    const query = groupPickerQuery.trim().toLocaleLowerCase('da-DK');

    if (!query) {
      return chatMembers;
    }

    return chatMembers.filter((member) => {
      const searchableName = [
        member.displayName,
        member.firstName,
        member.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('da-DK');

      return searchableName.includes(query);
    });
  }, [chatMembers, groupPickerQuery]);
  const filteredConversations = useMemo(() => {
    const query = chatSearchQuery.trim().toLocaleLowerCase('da-DK');
    const sortedConversations = [...conversations].sort((left, right) => {
      const leftTime = timestampForConversationSort(left);
      const rightTime = timestampForConversationSort(right);

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return String(right.id ?? '').localeCompare(String(left.id ?? ''));
    });

    if (!query) {
      return sortedConversations;
    }

    return sortedConversations.filter((conversation) => {
      const participantNames = conversation.participants
        ?.map((participant) => participant.member?.displayName)
        .filter(Boolean)
        .join(' ');
      const searchableConversation = [
        conversation.title,
        participantNames,
        conversation.lastMessage?.body,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('da-DK');

      return searchableConversation.includes(query);
    });
  }, [chatSearchQuery, conversations]);
  const chatListHeaderContainerStyle = useMemo(() => ({
    height: chatListScrollY.interpolate({
      inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
      outputRange: [
        CHAT_LIST_HEADER_EXPANDED_HEIGHT,
        CHAT_LIST_HEADER_COLLAPSED_HEIGHT,
      ],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: chatListScrollY.interpolate({
          inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
          outputRange: [0, -CHAT_LIST_HEADER_CLAMP_DISTANCE],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chatListScrollY]);
  const chatListHeaderShadowStyle = useMemo(() => ({
    opacity: chatListScrollY.interpolate({
      inputRange: [0, 6, 52],
      outputRange: [0, 0.82, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: chatListScrollY.interpolate({
          inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
          outputRange: [
            CHAT_LIST_HEADER_EXPANDED_HEIGHT,
            CHAT_LIST_HEADER_COLLAPSED_HEIGHT - CHAT_LIST_HEADER_CLAMP_DISTANCE,
          ],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chatListScrollY]);
  const chatSearchCollapseStyle = useMemo(() => ({
    opacity: chatListScrollY.interpolate({
      inputRange: [0, 120, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
      outputRange: [1, 0.45, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: chatListScrollY.interpolate({
          inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
          outputRange: [0, -CHAT_LIST_SEARCH_COLLAPSE_DISTANCE],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: chatListScrollY.interpolate({
          inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
          outputRange: [1, 0.96],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chatListScrollY]);
  const chatExternalPromptStyle = useMemo(() => ({
    transform: [
      {
        translateY: chatListScrollY.interpolate({
          inputRange: [0, CHAT_LIST_HEADER_COLLAPSE_DISTANCE],
          outputRange: [0, -CHAT_LIST_SEARCH_COLLAPSE_DISTANCE],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chatListScrollY]);
  const chatConversationHeaderSpacerStyle = useMemo(() => ({
    height: CHAT_LIST_HEADER_SCROLL_PADDING_TOP,
  }), []);
  const updateChatListHeaderScrolled = useCallback((scrolled) => {
    if (chatListHeaderScrolledRef.current === scrolled) {
      return;
    }

    chatListHeaderScrolledRef.current = scrolled;
    setChatListHeaderScrolled(scrolled);
  }, []);

  const handleChatListScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: chatListScrollY } } }],
    {
      listener: (event) => updateChatListHeaderScrolled(event.nativeEvent.contentOffset.y > 6),
      useNativeDriver: false,
    },
  ), [chatListScrollY, updateChatListHeaderScrolled]);

  const scrollMessagesToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const finishReturnToChatList = useCallback(() => {
    Keyboard.dismiss();
    chatThreadSwipeActiveRef.current = false;
    setChatMessageActionConfirm(null);
    setChatMessageActionLoading(false);
    setSelectedConversation(null);
    setMessages([]);

    requestAnimationFrame(() => {
      chatThreadDragX.setValue(0);
    });
  }, [chatThreadDragX]);

  const runChatThreadOpenTransition = useCallback(() => {
    chatThreadDragX.stopAnimation();
    chatThreadDragX.setValue(Math.max(chatThreadWidthRef.current, APP_WINDOW_WIDTH));

    requestAnimationFrame(() => {
      Animated.timing(chatThreadDragX, {
        toValue: 0,
        duration: 285,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: false,
      }).start();
    });
  }, [chatThreadDragX]);

  const resetChatThreadDrag = useCallback(() => {
    chatThreadSwipeActiveRef.current = false;

    Animated.spring(chatThreadDragX, {
      toValue: 0,
      tension: 135,
      friction: 19,
      useNativeDriver: false,
    }).start();
  }, [chatThreadDragX]);

  const returnToChatList = useCallback(() => {
    Keyboard.dismiss();

    Animated.timing(chatThreadDragX, {
      toValue: Math.max(chatThreadWidthRef.current, APP_WINDOW_WIDTH),
      duration: 245,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        finishReturnToChatList();
      }
    });
  }, [chatThreadDragX, finishReturnToChatList]);

  const chatThreadTouchHandlers = useMemo(() => {
    const touchFromEvent = (event) => event.nativeEvent.touches?.[0] ?? event.nativeEvent;

    const releaseChatThreadSwipe = () => {
      const latest = chatThreadTouchLatestRef.current;
      const start = chatThreadTouchStartRef.current;

      if (!latest || !start || !chatThreadSwipeActiveRef.current) {
        chatThreadTouchStartRef.current = null;
        chatThreadTouchLatestRef.current = null;
        chatThreadSwipeActiveRef.current = false;
        return;
      }

      const elapsed = Math.max(1, latest.time - start.time);
      const velocityX = latest.dx / elapsed;
      const movedFarEnough = latest.dx > Math.max(
        CHAT_THREAD_BACK_SWIPE_DISTANCE,
        chatThreadWidthRef.current * 0.08,
      );
      const flickedRight = latest.dx > CHAT_THREAD_BACK_SWIPE_FAST_DISTANCE
        && velocityX > CHAT_THREAD_BACK_SWIPE_VELOCITY;

      chatThreadTouchStartRef.current = null;
      chatThreadTouchLatestRef.current = null;
      chatThreadSwipeActiveRef.current = false;

      if (movedFarEnough || flickedRight) {
        returnToChatList();
        return;
      }

      resetChatThreadDrag();
    };

    return {
      onTouchStart: (event) => {
        const touch = touchFromEvent(event);

        if (!Number.isFinite(touch?.pageX) || !Number.isFinite(touch?.pageY)) {
          return;
        }

        chatThreadTouchStartRef.current = {
          x: touch.pageX,
          y: touch.pageY,
          time: Date.now(),
        };
        chatThreadTouchLatestRef.current = null;
        chatThreadSwipeActiveRef.current = false;
      },
      onTouchMove: (event) => {
        const start = chatThreadTouchStartRef.current;
        const touch = touchFromEvent(event);

        if (!start || !Number.isFinite(touch?.pageX) || !Number.isFinite(touch?.pageY)) {
          return;
        }

        const dx = touch.pageX - start.x;
        const dy = touch.pageY - start.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (dx <= CHAT_THREAD_BACK_SWIPE_ACTIVATION_DISTANCE) {
          return;
        }

        const isSwipeIntent = chatThreadSwipeActiveRef.current
          || (
            absDx > CHAT_THREAD_BACK_SWIPE_ACTIVATION_DISTANCE
            && absDx > absDy * CHAT_THREAD_BACK_SWIPE_VERTICAL_RATIO
          );

        if (!isSwipeIntent) {
          return;
        }

        if (!chatThreadSwipeActiveRef.current) {
          Keyboard.dismiss();
          chatThreadDragX.stopAnimation();
          chatThreadSwipeActiveRef.current = true;
        }

        chatThreadTouchLatestRef.current = {
          dx,
          dy,
          time: Date.now(),
        };
        chatThreadDragX.setValue(Math.min(Math.max(dx, 0), chatThreadWidthRef.current));
      },
      onTouchEnd: releaseChatThreadSwipe,
      onTouchCancel: releaseChatThreadSwipe,
    };
  }, [chatThreadDragX, resetChatThreadDrag, returnToChatList]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      return undefined;
    }

    scrollMessagesToEnd(false);

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => scrollMessagesToEnd(true),
    );

    return () => {
      showSubscription.remove();
    };
  }, [scrollMessagesToEnd, selectedConversation?.id]);

  useEffect(() => {
    if (selectedConversation?.id) {
      scrollMessagesToEnd(true);
    }
  }, [messages.length, selectedConversation?.id]);

  const loadConversations = async () => {
    if (!sessionToken) {
      return;
    }

    try {
      const data = await apiFetch('/chat/conversations', {
        authToken: sessionToken,
      });
      const nextConversations = data.conversations ?? [];

      setConversations(nextConversations);

      if (selectedConversation?.id) {
        const freshSelected = nextConversations.find((conversation) => conversation.id === selectedConversation.id);

        if (freshSelected) {
          setSelectedConversation(freshSelected);
        }
      }
    } catch (apiError) {
      setChatError(apiError.message || 'Chat kunne ikke hentes.');
    }
  };

  const loadMessages = async (conversation, options = {}) => {
    if (!conversation?.id || !sessionToken) {
      return;
    }

    const openingNewThread = !options.silent && selectedConversation?.id !== conversation.id;

    if (!options.silent) {
      setLoadingChat(true);
    }
    setChatError('');

    if (openingNewThread) {
      setMessages([]);
      setSelectedConversation(conversation);
      runChatThreadOpenTransition();
    }

    try {
      const data = await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        authToken: sessionToken,
      });
      const nextMessages = data.messages ?? [];
      const lastMessage = nextMessages[nextMessages.length - 1];
      const nextConversation = data.conversation ?? conversation;

      setSelectedConversation(nextConversation);
      setMessages(nextMessages);

      if (lastMessage) {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/read`, {
          authToken: sessionToken,
          method: 'POST',
          body: JSON.stringify({
            messageId: lastMessage.id,
          }),
        });
        await loadConversations();
      }
    } catch (apiError) {
      setChatError(apiError.message || 'Beskeder kunne ikke hentes.');
    } finally {
      if (!options.silent) {
        setLoadingChat(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!sessionToken) {
      return () => {
        isMounted = false;
      };
    }

    setLoadingChat(true);
    apiFetch('/chat/conversations', {
      authToken: sessionToken,
    })
      .then((data) => {
        if (isMounted) {
          setConversations(data.conversations ?? []);
        }
      })
      .catch((apiError) => {
        if (isMounted) {
          setChatError(apiError.message || 'Chat kunne ikke hentes.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingChat(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sessionToken]);

  useEffect(() => {
    setRealtimeReady(false);

    if (!sessionToken) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadConversations();
    }, 15000);

    return () => clearInterval(interval);
  }, [sessionToken, selectedConversation?.id]);

  useEffect(() => {
    if (!sessionToken) {
      return undefined;
    }

    echoRef.current = createChatEcho(sessionToken);
    setRealtimeReady(Boolean(echoRef.current));

    return () => {
      if (activeRealtimeChannelRef.current && echoRef.current) {
        echoRef.current.leave(activeRealtimeChannelRef.current);
      }

      echoRef.current?.disconnect();
      echoRef.current = null;
      activeRealtimeChannelRef.current = '';
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!realtimeReady || !echoRef.current || !selectedConversation?.id) {
      return undefined;
    }

    if (activeRealtimeChannelRef.current && activeRealtimeChannelRef.current !== `chat.${selectedConversation.id}`) {
      echoRef.current.leave(activeRealtimeChannelRef.current);
    }

    const channelName = `chat.${selectedConversation.id}`;
    activeRealtimeChannelRef.current = channelName;

    echoRef.current
      .private(channelName)
      .listen('.chat.message.created', () => {
        loadMessages(selectedConversation, { silent: true });
        loadConversations();
      });

    return () => {
      if (echoRef.current) {
        echoRef.current.leave(channelName);
      }

      if (activeRealtimeChannelRef.current === channelName) {
        activeRealtimeChannelRef.current = '';
      }
    };
  }, [realtimeReady, selectedConversation?.id, sessionToken]);

  useEffect(() => {
    if (realtimeReady || !selectedConversation?.id || !sessionToken) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadMessages(selectedConversation, { silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [realtimeReady, selectedConversation?.id, sessionToken]);

  const startDirectChat = async (memberId) => {
    setLoadingChat(true);
    setChatError('');

    try {
      const data = await apiFetch('/chat/conversations/direct', {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          memberId,
        }),
      });

      await loadConversations();
      await loadMessages(data.conversation);
    } catch (apiError) {
      setChatError(apiError.message || 'Chatten kunne ikke startes.');
    } finally {
      setLoadingChat(false);
    }
  };

  const selectDirectChatMember = async (memberId) => {
    setDirectPickerOpen(false);
    setDirectPickerQuery('');
    await startDirectChat(memberId);
  };

  const closeExternalAddModal = () => {
    setExternalAddOpen(false);
    setExternalPersonalCode('');
    setExternalAddError('');
    setExternalAddMessage('');
  };

  const requestExternalConnection = async () => {
    const code = externalPersonalCode.trim().toUpperCase();

    if (!code) {
      setExternalAddError('Skriv en Studos-kode.');
      setExternalAddMessage('');
      return;
    }

    setExternalAddLoading(true);
    setExternalAddError('');
    setExternalAddMessage('');

    try {
      const data = await apiFetch('/connections/request', {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          personalCode: code,
        }),
      });
      const otherName = data.connection?.otherMember?.firstName
        || data.connection?.otherMember?.displayName
        || 'personen';

      setExternalPersonalCode('');
      setExternalAddMessage(
        data.connection?.status === 'accepted'
          ? `I er nu connected med ${otherName}.`
          : `Request sendt til ${otherName}.`,
      );
    } catch (apiError) {
      setExternalAddError(apiError.message || 'Requesten kunne ikke sendes.');
    } finally {
      setExternalAddLoading(false);
    }
  };

  const toggleGroupMember = (memberId) => {
    setSelectedGroupMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    ));
  };

  const closeGroupChatModal = () => {
    setGroupPickerOpen(false);
    setGroupPickerQuery('');
    setGroupTitle('');
    setGroupPhotoUri('');
    setGroupPhotoData('');
    setSelectedGroupMemberIds([]);
    setChatError('');
  };

  const pickGroupPhotoImage = async () => {
    setChatError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setChatError('Studos skal have adgang til billeder for at vælge gruppebillede.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      setChatError('Gruppebilledet kunne ikke læses.');
      return;
    }

    const mimeType = asset.mimeType || 'image/jpeg';

    setGroupPhotoUri(asset.uri);
    setGroupPhotoData(`data:${mimeType};base64,${asset.base64}`);
  };

  const createGroupChat = async () => {
    const title = groupTitle.trim();

    if (!title || selectedGroupMemberIds.length < 2) {
      setChatError('Vælg navn og mindst to deltagere.');
      return;
    }

    setCreatingGroup(true);
    setChatError('');

    try {
      const data = await apiFetch('/chat/conversations/group', {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          title,
          memberIds: selectedGroupMemberIds,
          ...(groupPhotoData ? { groupPhotoData } : {}),
        }),
      });

      setGroupTitle('');
      setGroupPhotoUri('');
      setGroupPhotoData('');
      setSelectedGroupMemberIds([]);
      setGroupPickerQuery('');
      setGroupPickerOpen(false);
      await loadConversations();
      await loadMessages(data.conversation);
    } catch (apiError) {
      setChatError(apiError.message || 'Gruppen kunne ikke oprettes.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const sendMessage = async () => {
    const body = messageBody.trim();

    if (!body || !selectedConversation?.id) {
      return;
    }

    setSendingMessage(true);
    setChatError('');

    try {
      const data = await apiFetch(`/chat/conversations/${encodeURIComponent(selectedConversation.id)}/messages`, {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          body,
        }),
      });

      setMessageBody('');
      setSelectedConversation(data.conversation ?? selectedConversation);
      setMessages((current) => [...current, data.message]);
      await loadConversations();
    } catch (apiError) {
      setChatError(apiError.message || 'Beskeden kunne ikke sendes.');
    } finally {
      setSendingMessage(false);
    }
  };

  const closeConversationForMe = async () => {
    if (!selectedConversation?.id) {
      return;
    }

    const endpoint = selectedConversation.canDeleteForEveryone
      ? `/chat/conversations/${encodeURIComponent(selectedConversation.id)}`
      : selectedConversation.canLeave
        ? `/chat/conversations/${encodeURIComponent(selectedConversation.id)}/leave`
        : `/chat/conversations/${encodeURIComponent(selectedConversation.id)}/hide`;
    const method = selectedConversation.canDeleteForEveryone ? 'DELETE' : 'POST';

    setLoadingChat(true);
    setChatError('');

    try {
      await apiFetch(endpoint, {
        authToken: sessionToken,
        method,
      });
      setSelectedConversation(null);
      setMessages([]);
      await loadConversations();
    } catch (apiError) {
      setChatError(apiError.message || 'Chatten kunne ikke lukkes.');
    } finally {
      setLoadingChat(false);
    }
  };

  const replaceConversationInState = (nextConversation) => {
    if (!nextConversation?.id) {
      return;
    }

    setConversations((current) => current.map((conversation) => (
      conversation.id === nextConversation.id ? nextConversation : conversation
    )));

    if (selectedConversation?.id === nextConversation.id) {
      setSelectedConversation(nextConversation);
    }
  };

  const removeConversationFromState = (conversationId) => {
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));

    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
      setMessages([]);
    }
  };

  const openChatActionConfirm = (actionType, conversation) => {
    setChatConversationActionMenu(null);
    setChatActionConfirm({ type: actionType, conversation });
    setChatNotice('');
    setChatError('');
  };

  const performChatAction = async () => {
    const conversation = chatActionConfirm?.conversation;
    const actionType = chatActionConfirm?.type;

    if (!conversation?.id || !actionType) {
      return;
    }

    setChatActionLoading(true);
    setChatError('');
    setChatNotice('');

    try {
      if (actionType === 'mute' || actionType === 'unmute') {
        const data = await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/mute`, {
          authToken: sessionToken,
          method: 'POST',
          body: JSON.stringify({
            muted: actionType === 'mute',
          }),
        });

        replaceConversationInState(data.conversation);
        setChatNotice(actionType === 'mute' ? 'Notifikationer er slået fra.' : 'Notifikationer er slået til.');
      } else if (actionType === 'hide') {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/hide`, {
          authToken: sessionToken,
          method: 'POST',
        });
        removeConversationFromState(conversation.id);
        setChatNotice('Chatten er skjult hos dig.');
      } else if (actionType === 'leave') {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/leave`, {
          authToken: sessionToken,
          method: 'POST',
        });
        removeConversationFromState(conversation.id);
        setChatNotice('Du har forladt gruppechatten.');
      } else if (actionType === 'delete') {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}`, {
          authToken: sessionToken,
          method: 'DELETE',
        });
        removeConversationFromState(conversation.id);
        setChatNotice('Gruppechatten er slettet.');
      } else if (actionType === 'report') {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/report`, {
          authToken: sessionToken,
          method: 'POST',
          body: JSON.stringify({
            reason: 'Rapporteret fra chatlisten',
            details: 'Brugeren rapporterede chatten via chatmenuen.',
          }),
        });
        setChatNotice('Rapporten er sendt.');
      } else if (actionType === 'block') {
        await apiFetch(`/chat/conversations/${encodeURIComponent(conversation.id)}/block`, {
          authToken: sessionToken,
          method: 'POST',
        });
        removeConversationFromState(conversation.id);
        setChatNotice('Personen er blokeret.');
      }

      setChatActionConfirm(null);
      await loadConversations();
    } catch (apiError) {
      setChatError(apiError.message || 'Handlingen kunne ikke gennemføres.');
    } finally {
      setChatActionLoading(false);
    }
  };

  const chatConversationActionsFor = (conversation) => {
    const muted = isConversationMuted(conversation);
    const closeAction = conversation.canDeleteForEveryone
      ? { type: 'delete', icon: 'trash', label: 'Slet gruppechat', tone: 'danger' }
      : conversation.canLeave
        ? { type: 'leave', icon: 'log-out-outline', label: 'Forlad gruppechat', tone: 'danger' }
        : { type: 'hide', icon: 'eye-off', label: 'Skjul chat', tone: 'quiet' };
    const actions = [
      {
        type: muted ? 'unmute' : 'mute',
        icon: muted ? 'notifications' : 'notifications-off',
        label: muted ? 'Slå notifikationer til' : 'Slå notifikationer fra',
        tone: muted ? 'calm' : 'quiet',
      },
      closeAction,
      { type: 'report', icon: 'flag', label: 'Rapportér chat', tone: 'warning' },
      ...(conversation.type === 'direct'
        ? [{ type: 'block', icon: 'person-remove', label: 'Blokér person', tone: 'danger' }]
        : []),
    ];

    return actions;
  };

  const openChatConversationActionMenu = (conversation) => {
    if (!conversation?.id) {
      return;
    }

    chatConversationLongPressHandledRef.current = true;
    setTimeout(() => {
      chatConversationLongPressHandledRef.current = false;
    }, 450);
    setChatConversationActionMenu(conversation);
    setChatActionConfirm(null);
    setChatNotice('');
    setChatError('');
  };

  const closeChatConversationActionMenu = () => {
    setChatConversationActionMenu(null);
  };

  const selectChatConversationAction = (actionType) => {
    const conversation = chatConversationActionMenu;

    if (!conversation?.id || !actionType) {
      return;
    }

    openChatActionConfirm(actionType, conversation);
  };

  const openChatConversation = (conversation) => {
    if (chatConversationLongPressHandledRef.current) {
      chatConversationLongPressHandledRef.current = false;
      return;
    }

    loadMessages(conversation);
  };

  const openChatMessageActionConfirm = (message) => {
    if (!message?.id || message.isDeleted) {
      return;
    }

    setChatMessageActionConfirm({
      type: message.isMine ? 'delete-message' : 'report-message',
      message,
    });
    setChatNotice('');
    setChatError('');
  };

  const performChatMessageAction = async () => {
    const message = chatMessageActionConfirm?.message;
    const actionType = chatMessageActionConfirm?.type;

    if (!message?.id || !actionType) {
      return;
    }

    setChatMessageActionLoading(true);
    setChatError('');
    setChatNotice('');

    try {
      if (actionType === 'delete-message') {
        await apiFetch(`/chat/messages/${encodeURIComponent(message.id)}`, {
          authToken: sessionToken,
          method: 'DELETE',
        });

        setMessages((current) => current.map((currentMessage) => (
          currentMessage.id === message.id
            ? { ...currentMessage, isDeleted: true, body: '' }
            : currentMessage
        )));
        setChatNotice('Beskeden er slettet.');
        await loadConversations();
      } else if (actionType === 'report-message') {
        await apiFetch(`/chat/messages/${encodeURIComponent(message.id)}/report`, {
          authToken: sessionToken,
          method: 'POST',
          body: JSON.stringify({
            reason: 'Besked rapporteret fra chatten',
            details: `Rapporteret fra ${selectedConversation?.title ?? 'chat'}.`,
          }),
        });
        setChatNotice('Beskeden er rapporteret.');
      }

      setChatMessageActionConfirm(null);
    } catch (apiError) {
      setChatError(apiError.message || 'Beskedhandlingen kunne ikke gennemføres.');
    } finally {
      setChatMessageActionLoading(false);
    }
  };

  const selectedActionLabel = selectedConversation?.canDeleteForEveryone
    ? 'Slet gruppe'
    : selectedConversation?.canLeave
      ? 'Forlad'
      : 'Slet chat';
  const selectedConversationMember = selectedConversation?.participants
    ?.find((participant) => participant.memberId !== activeMember?.id)
    ?.member;
  const selectedConversationMeta = selectedConversation?.type === 'direct'
    ? 'Klassens stræber'
    : `${selectedConversation?.participants?.length ?? 0} deltagere`;
  const selectedConversationMemberOnline = isMemberOnline(selectedConversationMember);
  const selectedConversationActivity = formatMemberActivity(selectedConversationMember);
  const sendButtonInactive = !messageBody.trim();
  const sendButtonDisabled = sendingMessage || sendButtonInactive;
  const chatConversationActionMenuActions = chatConversationActionMenu
    ? chatConversationActionsFor(chatConversationActionMenu)
    : [];
  const chatActionConfig = chatActionConfirm
    ? chatActionConfigFor(chatActionConfirm.type, chatActionConfirm.conversation)
    : null;
  const chatMessageActionConfig = chatMessageActionConfirm
    ? chatMessageActionConfigFor(chatMessageActionConfirm.type)
    : null;
  const chatMessageActionPanel = chatMessageActionConfirm && chatMessageActionConfig ? (
    <View pointerEvents="box-none" style={styles.chatThreadActionOverlay}>
      <Pressable
        accessibilityLabel="Luk beskedhandling"
        disabled={chatMessageActionLoading}
        style={styles.chatThreadActionBackdrop}
        onPress={() => {
          if (!chatMessageActionLoading) {
            setChatMessageActionConfirm(null);
          }
        }}
      />
      <View style={[styles.chatModalPanel, styles.chatActionConfirmPanel, styles.chatThreadActionPanel]}>
        <View
          style={[
            styles.chatActionConfirmIcon,
            chatMessageActionConfig.tone === 'danger' ? styles.chatActionConfirmIconDanger : null,
            chatMessageActionConfig.tone === 'warning' ? styles.chatActionConfirmIconWarning : null,
          ]}
        >
          <Ionicons
            name={chatMessageActionConfig.icon ?? 'settings'}
            size={24}
            color={chatMessageActionConfig.tone === 'warning' ? STUDOS_THEME.ink : '#FFFFFF'}
          />
        </View>
        <Text style={[styles.chatModalTitle, styles.chatActionConfirmTitle]}>
          {chatMessageActionConfig.title}
        </Text>
        <Text style={[styles.chatCodeModalText, styles.chatActionConfirmText]}>
          {chatMessageActionConfig.body}
        </Text>
        <View style={styles.chatActionConfirmButtons}>
          <Pressable
            accessibilityRole="button"
            disabled={chatMessageActionLoading}
            onPress={() => setChatMessageActionConfirm(null)}
            style={({ pressed }) => [
              styles.chatActionCancelButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Text style={styles.chatActionCancelText}>Annuller</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={chatMessageActionLoading}
            onPress={performChatMessageAction}
            style={({ pressed }) => [
              styles.chatActionConfirmButton,
              chatMessageActionConfig.tone === 'danger' ? styles.chatActionConfirmButtonDanger : null,
              chatMessageActionConfig.tone === 'warning' ? styles.chatActionConfirmButtonWarning : null,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            {chatMessageActionLoading ? (
              <ActivityIndicator color={chatMessageActionConfig.tone === 'warning' ? STUDOS_THEME.ink : '#FFFFFF'} />
            ) : (
              <Text
                style={[
                  styles.chatActionConfirmButtonText,
                  chatMessageActionConfig.tone === 'warning' ? styles.chatActionConfirmButtonTextDark : null,
                ]}
              >
                {chatMessageActionConfig.confirmLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  ) : null;

  const chatThreadOverlay = selectedConversation ? (
    <Modal
      animationType="none"
      onRequestClose={returnToChatList}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={Boolean(selectedConversation)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={CHAT_THREAD_KEYBOARD_VERTICAL_OFFSET}
        style={styles.chatThreadModalHost}
      >
        <View
          onLayout={(event) => {
            chatThreadWidthRef.current = Math.max(event.nativeEvent.layout.width, 1);
          }}
          style={styles.chatThreadModalContent}
        >
        <Animated.View
          style={[
            styles.chatThreadFullscreen,
            styles.chatThreadDraggable,
            { transform: [{ translateX: chatThreadDragX }] },
          ]}
          {...chatThreadTouchHandlers}
        >
        <View style={styles.chatThreadPageHeader} {...chatThreadTouchHandlers}>
          <Pressable
            accessibilityLabel="Tilbage til chats"
            accessibilityRole="button"
            hitSlop={12}
            onPress={returnToChatList}
            style={({ pressed }) => [
              styles.chatThreadBackButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={STUDOS_THEME.ink} />
          </Pressable>
          <View style={styles.chatThreadCenteredIdentity}>
            <View style={styles.chatThreadProfileSummary}>
              {selectedConversationMember ? (
                <View style={styles.chatThreadAvatarStatusWrap}>
                  <Avatar profile={selectedConversationMember} variant="chatHeader" />
                  {selectedConversationMemberOnline ? <View style={styles.chatThreadOnlineDot} /> : null}
                </View>
              ) : (
                <View style={styles.chatThreadGroupAvatar}>
                  {selectedConversation.groupPhotoUrl ? (
                    <Image source={{ uri: selectedConversation.groupPhotoUrl }} style={styles.chatThreadGroupPhoto} />
                  ) : (
                    <Ionicons name="people" size={23} color={STUDOS_THEME.red} />
                  )}
                </View>
              )}
              <View style={styles.chatThreadPageTitleWrap}>
                <Text numberOfLines={1} style={styles.chatThreadPageTitle}>
                  {selectedConversation.title}
                </Text>
                {selectedConversation.type === 'direct' ? (
                  <>
                    <View style={styles.chatThreadPageMetaRow}>
                      <View style={styles.chatThreadAwardIcon}>
                        <View style={styles.chatThreadAwardRibbonRow}>
                          <View style={[styles.chatThreadAwardRibbon, styles.chatThreadAwardRibbonLeft]} />
                          <View style={[styles.chatThreadAwardRibbon, styles.chatThreadAwardRibbonRight]} />
                        </View>
                        <View style={styles.chatThreadAwardMedal}>
                          <View style={styles.chatThreadAwardMedalDot} />
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.chatThreadPageMeta}>
                        {selectedConversationMeta}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.chatThreadLastActive}>
                      {selectedConversationActivity}
                    </Text>
                  </>
                ) : (
                  <Text numberOfLines={1} style={styles.chatThreadPageMeta}>
                    {selectedConversationMeta}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.chatThreadCounterGrid}>
              {CHAT_THREAD_HEADER_COUNTERS.map((counter) => (
                <View key={counter.id} style={styles.chatThreadCounterPill}>
                  {counter.id === 'wave' ? (
                    <MaterialCommunityIcons name="waves" size={13} color={STUDOS_THEME.red} />
                  ) : (
                    <Ionicons name={counter.icon} size={11} color={STUDOS_THEME.red} />
                  )}
                  <Text numberOfLines={1} style={styles.chatThreadCounterText}>
                    {counter.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
        {chatNotice ? <Text style={styles.successText}>{chatNotice}</Text> : null}

        <ScrollView
          contentContainerStyle={styles.chatThreadPageMessagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollMessagesToEnd(true)}
          onLayout={() => scrollMessagesToEnd(false)}
          ref={messagesScrollRef}
          style={styles.chatThreadPageMessages}
          {...chatThreadTouchHandlers}
        >
          {messages.length ? messages.map((message) => {
            const messageProfile = message.isMine
              ? activeMember
              : message.sender ?? selectedConversationMember;
            const messageProfileOnline = selectedConversation.type === 'direct'
              && (message.isMine || isMemberOnline(messageProfile));

            return (
              <View
                key={message.id}
                style={[
                  styles.chatMessageRow,
                  message.isMine ? styles.chatMessageRowMine : null,
                ]}
              >
                {!message.isMine ? (
                  <View style={styles.chatMessageAvatarStatusWrap}>
                    <Avatar profile={messageProfile} variant="chatMessage" />
                    {messageProfileOnline ? <View style={styles.chatMessageOnlineDot} /> : null}
                  </View>
                ) : null}
                <Pressable
                  accessibilityHint={message.isMine ? 'Hold nede for at slette beskeden' : 'Hold nede for at rapportere beskeden'}
                  accessibilityRole="button"
                  delayLongPress={280}
                  disabled={message.isDeleted}
                  hitSlop={4}
                  onLongPress={() => openChatMessageActionConfirm(message)}
                  style={({ pressed }) => [
                    styles.chatBubble,
                    message.isMine ? styles.chatBubbleMine : styles.chatBubbleOther,
                    !message.isDeleted && pressed ? styles.chatBubbleHolding : null,
                    message.isDeleted ? styles.chatBubbleDeleted : null,
                  ]}
                >
                  {({ pressed }) => (
                    <>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.chatBubbleTail,
                          message.isMine ? styles.chatBubbleTailMine : styles.chatBubbleTailOther,
                        ]}
                      />
                      <Text style={[styles.chatMessageText, message.isMine ? styles.chatMessageTextMine : null]}>
                        {message.isDeleted ? 'Beskeden er slettet' : message.body}
                      </Text>
                      <View style={styles.chatBubbleMetaRow}>
                        <Text style={[styles.chatBubbleMeta, message.isMine ? styles.chatBubbleMetaMine : null]}>
                          {formatChatTime(message.createdAt)}
                        </Text>
                        {selectedConversation.type === 'direct' && message.isMine ? (
                          <Ionicons
                            name={message.readByOther ? 'checkmark-done' : 'checkmark'}
                            size={14}
                            color={message.readByOther ? STUDOS_THEME.blue : '#FFF4D8'}
                            style={styles.chatBubbleStatusIcon}
                          />
                        ) : null}
                      </View>
                      {!message.isDeleted && pressed ? (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.chatBubbleHoldIndicator,
                            message.isMine ? styles.chatBubbleHoldIndicatorMine : styles.chatBubbleHoldIndicatorOther,
                          ]}
                        >
                          <Ionicons
                            name={message.isMine ? 'trash' : 'flag'}
                            size={11}
                            color={message.isMine ? '#FFFFFF' : STUDOS_THEME.ink}
                          />
                        </View>
                      ) : null}
                    </>
                  )}
                </Pressable>

                {message.isMine ? (
                  <View style={styles.chatMessageAvatarStatusWrap}>
                    <Avatar profile={messageProfile} variant="chatMessage" />
                    {messageProfileOnline ? <View style={styles.chatMessageOnlineDot} /> : null}
                  </View>
                ) : null}
              </View>
            );
          }) : !loadingChat ? (
            <View style={styles.chatThreadEmptyState}>
              <Text style={styles.chatThreadEmptyTitle}>Ingen beskeder endnu</Text>
              <Text style={styles.chatThreadEmptyText}>Start samtalen med en besked.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.chatComposer} {...chatThreadTouchHandlers}>
          <View pointerEvents="none" style={styles.chatComposerSurface} />
          <TextInput
            blurOnSubmit={false}
            multiline
            onChangeText={setMessageBody}
            onFocus={() => setTimeout(() => scrollMessagesToEnd(true), 180)}
            placeholder="Skriv en besked"
            placeholderTextColor="#8b93a1"
            ref={messageInputRef}
            style={styles.chatComposerInput}
            textAlignVertical="top"
            value={messageBody}
          />
          <Pressable
            accessibilityRole="button"
            disabled={sendButtonDisabled}
            onPress={sendMessage}
            style={({ pressed }) => [
              styles.chatSendButton,
              pressed && !sendButtonDisabled ? styles.chatSendButtonPressed : null,
              sendButtonInactive ? styles.chatSendButtonDisabled : null,
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.chatSendButtonSurface,
                sendButtonInactive ? styles.chatSendButtonSurfaceDisabled : null,
              ]}
            />
            {sendingMessage ? (
              <View style={styles.chatSendSendingDots}>
                <View style={[styles.chatSendSendingDot, styles.chatSendDotBlue]} />
                <View style={[styles.chatSendSendingDot, styles.chatSendDotYellow]} />
                <View style={[styles.chatSendSendingDot, styles.chatSendDotWhite]} />
              </View>
            ) : (
              <ChatSendRocketLogo disabled={sendButtonInactive} />
            )}
          </Pressable>
        </View>
        </Animated.View>
        {chatMessageActionPanel}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  ) : null;

  return (
    <View style={styles.chatScreenRoot}>
      <Animated.View style={[
        styles.chatListHeader,
        chatListHeaderContainerStyle,
      ]}>
        <View style={styles.chatListHeaderContent}>
          <View style={styles.overviewTopLine}>
            <ChatTitle />
            <View style={styles.chatTitleActions}>
              <Pressable
                accessibilityLabel="Opret gruppechat"
                accessibilityRole="button"
                onPress={() => {
                  setGroupPickerOpen(true);
                  setGroupPickerQuery('');
                  setChatError('');
                }}
                style={({ pressed }) => [
                  styles.chatTitleActionButton,
                  styles.chatTitleGroupButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="people" size={27} color={STUDOS_THEME.ink} />
                <View style={[styles.chatTitleActionBadge, styles.chatTitleActionBadgeYellow]}>
                  <Ionicons name="add" size={10} color={STUDOS_THEME.ink} />
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel="Opret chat"
                accessibilityRole="button"
                onPress={() => {
                  setDirectPickerQuery('');
                  setDirectPickerOpen(true);
                }}
                style={({ pressed }) => [
                  styles.chatTitleActionButton,
                  styles.chatTitleDirectButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="chatbubble-ellipses" size={26} color={STUDOS_THEME.red} />
                <View style={[styles.chatTitleActionBadge, styles.chatTitleActionBadgeBlue]}>
                  <Ionicons name="add" size={10} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </View>
          <Animated.View
            pointerEvents={chatListHeaderScrolled ? 'none' : 'auto'}
            style={[styles.chatSearchCollapseSlot, chatSearchCollapseStyle]}
          >
            <View style={styles.chatSearchCollapseInner}>
              <View style={styles.chatSearchField}>
                <Ionicons name="search" size={18} color="#65748b" />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setChatSearchQuery}
                  placeholder="Søg på et crew eller en kammerat"
                  placeholderTextColor="#8b93a1"
                  style={styles.chatSearchInput}
                  value={chatSearchQuery}
                />
              </View>
            </View>
          </Animated.View>
          <Animated.View style={[styles.chatExternalPrompt, chatExternalPromptStyle]}>
            <View style={styles.chatExternalPromptCopy}>
              <Text style={styles.chatExternalPromptTitle}>
                Vil du chatte med en udenfor dit crew?
              </Text>
              <Text style={styles.chatExternalPromptText}>
                Andre kan tilføje dig på: <Text style={styles.chatExternalPromptCode}>{activeMember?.personalCode ?? 'Mangler'}</Text>
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Tilføj bruger med Studos-kode"
              accessibilityRole="button"
              onPress={() => {
                setExternalAddOpen(true);
                setExternalAddError('');
                setExternalAddMessage('');
              }}
              style={({ pressed }) => [
                styles.chatExternalPromptAction,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <View style={styles.chatExternalPromptIcon}>
                <Ionicons name="person-add" size={22} color="#172143" />
              </View>
              <Text style={styles.chatExternalPromptActionText}>Tilføj</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.chatListHeaderShadow, chatListHeaderShadowStyle]}
      />
      <Animated.ScrollView
        contentContainerStyle={styles.chatConversationList}
        keyboardShouldPersistTaps="handled"
        onScroll={handleChatListScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.chatConversationScroll}
      >
        <Animated.View pointerEvents="none" style={chatConversationHeaderSpacerStyle} />
        {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}
        {chatNotice ? <Text style={styles.successText}>{chatNotice}</Text> : null}
        {loadingChat && !conversations.length ? <ActivityIndicator color={STUDOS_THEME.red} /> : null}
        {filteredConversations.length ? filteredConversations.map((conversation) => {
          const otherMember = conversation.participants
            ?.find((participant) => participant.memberId !== activeMember?.id)
            ?.member;
          const lastMessagePreview = conversation.lastMessage?.isDeleted
            ? 'Beskeden er slettet'
            : conversation.lastMessage?.body || 'Ingen beskeder endnu';
          const lastMessageTime = formatChatListTime(conversation.lastMessage?.createdAt);

          return (
            <Pressable
              accessibilityHint="Hold inde for chatindstillinger"
              accessibilityRole="button"
              delayLongPress={280}
              key={conversation.id}
              onLongPress={() => openChatConversationActionMenu(conversation)}
              onPress={() => openChatConversation(conversation)}
              style={({ pressed }) => [
                styles.chatConversationRow,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              {({ pressed }) => (
                <>
                  <View pointerEvents="none" style={styles.chatConversationTail} />
                  {conversation.unreadCount > 0 ? (
                    <View style={styles.chatUnreadBadge}>
                      <Text numberOfLines={1} style={styles.chatUnreadText}>
                        {conversation.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                  {conversation.type === 'direct' && otherMember ? (
                    <View style={styles.chatConversationAvatarStatusWrap}>
                      <Avatar profile={otherMember} variant="chatCircle" />
                      {isMemberOnline(otherMember) ? <View style={styles.chatConversationOnlineDot} /> : null}
                    </View>
                  ) : (
                    <View style={styles.chatConversationIcon}>
                      {conversation.groupPhotoUrl ? (
                        <Image source={{ uri: conversation.groupPhotoUrl }} style={styles.chatConversationGroupPhoto} />
                      ) : (
                        <Ionicons name="people" size={18} color={STUDOS_THEME.red} />
                      )}
                    </View>
                  )}
                  <View style={styles.chatConversationCopy}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.chatConversationTitle,
                        conversation.unreadCount > 0 ? styles.chatConversationTitleUnread : null,
                      ]}
                    >
                      {conversation.title}
                    </Text>
                    <View style={styles.chatConversationPreviewRow}>
                      <Text numberOfLines={1} style={styles.chatConversationPreview}>
                        {lastMessagePreview}
                      </Text>
                      {lastMessageTime ? (
                        <>
                          <View style={styles.chatConversationPreviewDot} />
                          <Text numberOfLines={1} style={styles.chatConversationPreviewTime}>
                            {lastMessageTime}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.chatConversationMeta}>
                    <ChatConversationChevron unread={conversation.unreadCount > 0} />
                  </View>
                  {pressed ? (
                    <View pointerEvents="none" style={styles.chatConversationHoldIndicator}>
                      <Ionicons name="settings-sharp" size={15} color="#FFFFFF" />
                    </View>
                  ) : null}
                </>
              )}
            </Pressable>
          );
        }) : conversations.length ? (
          <Text style={styles.chatConversationEmptyText}>
            Ingen chats matcher søgningen.
          </Text>
        ) : (
          <View style={styles.chatConversationEmptyState}>
            <View style={styles.chatConversationEmptyIconWrap}>
              <Ionicons name="chatbubbles" size={76} color={STUDOS_THEME.red} />
              <View style={styles.chatConversationEmptySlash} />
            </View>
            <Text style={styles.chatConversationEmptyTitle}>Ingen chats endnu</Text>
            <Text style={styles.chatConversationEmptyBody}>
              Når du starter en chat, vil du kunne tilgå dem her
            </Text>
          </View>
        )}
      </Animated.ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={closeChatConversationActionMenu}
        transparent
        visible={Boolean(chatConversationActionMenu)}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk chatindstillinger"
            style={styles.chatModalBackdrop}
            onPress={closeChatConversationActionMenu}
          />
          <View style={[styles.chatModalPanel, styles.chatConversationActionMenuPanel]}>
            <View style={styles.chatModalHeader}>
              <View style={styles.chatConversationActionMenuHeading}>
                <Text style={styles.chatModalKicker}>Chatindstillinger</Text>
                <Text numberOfLines={1} style={styles.chatModalTitle}>
                  {chatConversationActionMenu?.title ?? 'Chat'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Luk chatindstillinger"
                accessibilityRole="button"
                onPress={closeChatConversationActionMenu}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={20} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>
            <View style={styles.chatConversationActionMenuList}>
              {chatConversationActionMenuActions.map((action) => (
                <Pressable
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  key={action.type}
                  onPress={() => selectChatConversationAction(action.type)}
                  style={({ pressed }) => [
                    styles.chatConversationActionMenuItem,
                    pressed ? styles.footerItemPressed : null,
                  ]}
                >
                  <View
                    style={[
                      styles.chatConversationActionMenuIcon,
                      action.tone === 'danger' ? styles.chatConversationActionMenuIconDanger : null,
                      action.tone === 'warning' ? styles.chatConversationActionMenuIconWarning : null,
                      action.tone === 'calm' ? styles.chatConversationActionMenuIconCalm : null,
                    ]}
                  >
                    <Ionicons
                      name={action.icon}
                      size={18}
                      color={action.tone === 'quiet' || action.tone === 'warning' ? STUDOS_THEME.ink : '#FFFFFF'}
                    />
                  </View>
                  <Text style={styles.chatConversationActionMenuText}>
                    {action.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setDirectPickerOpen(false);
          setDirectPickerQuery('');
        }}
        transparent
        visible={directPickerOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk vælger"
            style={styles.chatModalBackdrop}
            onPress={() => {
              setDirectPickerOpen(false);
              setDirectPickerQuery('');
            }}
          />
          <View style={styles.chatModalPanel}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Ny chat</Text>
                <Text style={styles.chatModalTitle}>Vælg kammerat</Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  setDirectPickerOpen(false);
                  setDirectPickerQuery('');
                }}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>

            <View style={styles.chatModalSearchField}>
              <Ionicons name="search" size={17} color="#65748b" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setDirectPickerQuery}
                placeholder="Søg efter navn"
                placeholderTextColor="#8b93a1"
                style={styles.chatModalSearchInput}
                value={directPickerQuery}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.chatModalMemberList}
              keyboardShouldPersistTaps="handled"
              style={styles.chatModalMemberScroll}
            >
              {directPickerMembers.length ? directPickerMembers.map((member) => (
                <Pressable
                  accessibilityRole="button"
                  key={member.id}
                  onPress={() => selectDirectChatMember(member.id)}
                  style={({ pressed }) => [
                    styles.chatModalMemberRow,
                    pressed ? styles.footerItemPressed : null,
                  ]}
                >
                  <Avatar profile={member} variant="chatCircle" />
                  <Text numberOfLines={1} style={styles.chatModalMemberName}>
                    {member.displayName}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#A9B3C2" />
                </Pressable>
              )) : (
                <Text style={styles.chatModalEmptyText}>
                  {chatMembers.length ? 'Ingen kammerater matcher søgningen.' : 'Ingen aktive kammerater endnu.'}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeGroupChatModal}
        transparent
        visible={groupPickerOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk gruppechat"
            style={styles.chatModalBackdrop}
            onPress={closeGroupChatModal}
          />
          <View style={styles.chatModalPanel}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Ny gruppechat</Text>
                <Text style={styles.chatModalTitle}>Vælg deltagere</Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={closeGroupChatModal}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Vælg gruppebillede"
              accessibilityRole="button"
              onPress={pickGroupPhotoImage}
              style={({ pressed }) => [
                styles.chatGroupPhotoPicker,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <View style={styles.chatGroupPhotoPreview}>
                {groupPhotoUri ? (
                  <Image source={{ uri: groupPhotoUri }} style={styles.chatGroupPhotoPreviewImage} />
                ) : (
                  <Ionicons name="camera" size={22} color={STUDOS_THEME.red} />
                )}
              </View>
              <View style={styles.chatGroupPhotoCopy}>
                <Text style={styles.chatGroupPhotoTitle}>
                  {groupPhotoUri ? 'Gruppebillede valgt' : 'Tilføj gruppebillede'}
                </Text>
                <Text style={styles.chatGroupPhotoText}>Vises på chatlisten og inde i gruppechatten.</Text>
              </View>
              <Ionicons name={groupPhotoUri ? 'swap-horizontal' : 'add'} size={18} color={STUDOS_THEME.ink} />
            </Pressable>

            <View style={styles.chatModalSearchField}>
              <Ionicons name="people" size={17} color="#65748b" />
              <TextInput
                autoCapitalize="sentences"
                autoCorrect={false}
                onChangeText={setGroupTitle}
                placeholder="Gruppenavn"
                placeholderTextColor="#8b93a1"
                style={styles.chatModalSearchInput}
                value={groupTitle}
              />
            </View>

            <View style={styles.chatModalSearchField}>
              <Ionicons name="search" size={17} color="#65748b" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setGroupPickerQuery}
                placeholder="Søg efter deltagere"
                placeholderTextColor="#8b93a1"
                style={styles.chatModalSearchInput}
                value={groupPickerQuery}
              />
            </View>

            <Text style={styles.chatGroupSelectionText}>
              {selectedGroupMemberIds.length} valgt · mindst 2 deltagere
            </Text>

            <ScrollView
              contentContainerStyle={styles.chatModalMemberList}
              keyboardShouldPersistTaps="handled"
              style={styles.chatModalMemberScroll}
            >
              {groupPickerMembers.length ? groupPickerMembers.map((member) => {
                const selected = selectedGroupMemberIds.includes(member.id);

                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={member.id}
                    onPress={() => toggleGroupMember(member.id)}
                    style={({ pressed }) => [
                      styles.chatModalMemberRow,
                      selected ? styles.chatModalMemberRowSelected : null,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <Avatar profile={member} variant="chatCircle" />
                    <Text numberOfLines={1} style={styles.chatModalMemberName}>
                      {member.displayName}
                    </Text>
                    <View style={[styles.chatModalCheck, selected ? styles.chatModalCheckSelected : null]}>
                      {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                    </View>
                  </Pressable>
                );
              }) : (
                <Text style={styles.chatModalEmptyText}>
                  {chatMembers.length ? 'Ingen kammerater matcher søgningen.' : 'Ingen aktive kammerater endnu.'}
                </Text>
              )}
            </ScrollView>

            {chatError ? <Text style={styles.errorText}>{chatError}</Text> : null}

            <Button
              label="Opret gruppechat"
              loading={creatingGroup}
              onPress={createGroupChat}
            />
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeExternalAddModal}
        transparent
        visible={externalAddOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk tilføj bruger"
            style={styles.chatModalBackdrop}
            onPress={closeExternalAddModal}
          />
          <View style={styles.chatModalPanel}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Tilføj</Text>
                <Text style={styles.chatModalTitle}>Studos-kode</Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={closeExternalAddModal}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>

            <Text style={styles.chatCodeModalText}>
              Skriv koden fra den person, du vil tilføje.
            </Text>

            <View style={styles.chatModalSearchField}>
              <Ionicons name="keypad" size={17} color="#65748b" />
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={(value) => setExternalPersonalCode(value.toUpperCase())}
                onSubmitEditing={requestExternalConnection}
                placeholder="MAJA-DISCO"
                placeholderTextColor="#8b93a1"
                returnKeyType="send"
                style={styles.chatModalSearchInput}
                value={externalPersonalCode}
              />
            </View>

            {externalAddError ? <Text style={styles.errorText}>{externalAddError}</Text> : null}
            {externalAddMessage ? <Text style={styles.successText}>{externalAddMessage}</Text> : null}

            <Button
              label="Send request"
              loading={externalAddLoading}
              onPress={requestExternalConnection}
            />
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!chatActionLoading) {
            setChatActionConfirm(null);
          }
        }}
        transparent
        visible={Boolean(chatActionConfirm && chatActionConfig)}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk chathandling"
            disabled={chatActionLoading}
            style={styles.chatModalBackdrop}
            onPress={() => {
              if (!chatActionLoading) {
                setChatActionConfirm(null);
              }
            }}
          />
          <View style={[styles.chatModalPanel, styles.chatActionConfirmPanel]}>
            <View
              style={[
                styles.chatActionConfirmIcon,
                chatActionConfig?.tone === 'danger' ? styles.chatActionConfirmIconDanger : null,
                chatActionConfig?.tone === 'warning' ? styles.chatActionConfirmIconWarning : null,
                chatActionConfig?.tone === 'calm' ? styles.chatActionConfirmIconCalm : null,
              ]}
            >
              <Ionicons
                name={chatActionConfig?.icon ?? 'settings'}
                size={24}
                color={chatActionConfig?.tone === 'quiet' || chatActionConfig?.tone === 'warning' ? STUDOS_THEME.ink : '#FFFFFF'}
              />
            </View>
            <Text style={[styles.chatModalTitle, styles.chatActionConfirmTitle]}>
              {chatActionConfig?.title}
            </Text>
            <Text style={[styles.chatCodeModalText, styles.chatActionConfirmText]}>
              {chatActionConfig?.body}
            </Text>
            <View style={styles.chatActionConfirmButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={chatActionLoading}
                onPress={() => setChatActionConfirm(null)}
                style={({ pressed }) => [
                  styles.chatActionCancelButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.chatActionCancelText}>Annuller</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={chatActionLoading}
                onPress={performChatAction}
                style={({ pressed }) => [
                  styles.chatActionConfirmButton,
                  chatActionConfig?.tone === 'danger' ? styles.chatActionConfirmButtonDanger : null,
                  chatActionConfig?.tone === 'warning' ? styles.chatActionConfirmButtonWarning : null,
                  chatActionConfig?.tone === 'calm' ? styles.chatActionConfirmButtonCalm : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                {chatActionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.chatActionConfirmButtonText,
                      chatActionConfig?.tone === 'warning' ? styles.chatActionConfirmButtonTextDark : null,
                    ]}
                  >
                    {chatActionConfig?.confirmLabel}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {chatThreadOverlay}
    </View>
  );
}

function CalendarScreen({
  activeMember,
  activeMembers = [],
  events,
  onCreateEvent,
  onRequestScrollTop,
  onRespondToEvent,
}) {
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [draft, setDraft] = useState(() => createCalendarDraft());
  const [visibleMonth, setVisibleMonth] = useState(() => dateFromInput(createCalendarDraft().eventDate));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectingInvitees, setSelectingInvitees] = useState(false);
  const [invitePeopleSearch, setInvitePeopleSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [calendarHeaderScrolled, setCalendarHeaderScrolled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [respondingEventId, setRespondingEventId] = useState('');
  const calendarHeaderScrolledRef = useRef(false);
  const calendarScrollY = useRef(new Animated.Value(0)).current;
  const hourWheelRef = useRef(null);
  const minuteWheelRef = useRef(null);
  const visibleMonthDays = useMemo(() => calendarDaysForMonth(visibleMonth), [visibleMonth]);
  const selectedTime = useMemo(() => splitCalendarTime(draft.eventTime), [draft.eventTime]);
  const invitableMembers = useMemo(
    () => (activeMembers ?? [])
      .filter((member) => member.status === 'active' && member.id !== activeMember?.id)
      .sort((first, second) => (first.displayName ?? '').localeCompare(second.displayName ?? '', 'da')),
    [activeMember?.id, activeMembers],
  );
  const filteredInvitableMembers = useMemo(() => {
    const query = invitePeopleSearch.trim().toLocaleLowerCase('da-DK');

    if (!query) {
      return invitableMembers;
    }

    return invitableMembers.filter((member) => {
      const searchableName = [
        member.displayName,
        member.firstName,
        member.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('da-DK');

      return searchableName.includes(query);
    });
  }, [invitableMembers, invitePeopleSearch]);
  const classInviteCount = Math.max(1, activeMembers.length);
  const selectedInviteCount = draft.inviteScope === 'custom'
    ? draft.invitedMemberIds.length
    : classInviteCount;
  const inviteSelectorMeta = draft.inviteScope === 'custom'
    ? `${selectedInviteCount} ${selectedInviteCount === 1 ? 'person valgt' : 'personer valgt'}`
    : `${selectedInviteCount} ${selectedInviteCount === 1 ? 'person' : 'personer'}`;
  const selectedInviteNames = useMemo(
    () => invitableMembers
      .filter((member) => draft.invitedMemberIds.includes(member.id))
      .slice(0, 3)
      .map((member) => member.firstName || member.displayName)
      .join(', '),
    [draft.invitedMemberIds, invitableMembers],
  );
  const customInviteMeta = selectedInviteCount
    ? `${inviteSelectorMeta}${selectedInviteNames ? ` · ${selectedInviteNames}` : ''}`
    : 'Ingen valgt endnu';
  const sortedEvents = useMemo(
    () => [...(events ?? [])].sort((first, second) => {
      const firstTime = Date.parse(first.startsAt ?? `${first.date}T12:00:00`);
      const secondTime = Date.parse(second.startsAt ?? `${second.date}T12:00:00`);

      return (Number.isFinite(firstTime) ? firstTime : 0) - (Number.isFinite(secondTime) ? secondTime : 0);
    }),
    [events],
  );
  const calendarHeaderContainerStyle = useMemo(() => ({
    transform: [
      {
        translateY: calendarScrollY.interpolate({
          inputRange: [0, 44],
          outputRange: [0, -7],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [calendarScrollY]);
  const calendarHeaderContentStyle = useMemo(() => ({
    transform: [
      {
        translateY: calendarScrollY.interpolate({
          inputRange: [0, 44],
          outputRange: [0, -7],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [calendarScrollY]);

  useEffect(() => {
    if (creatingEvent && selectingInvitees) {
      onRequestScrollTop?.();
    }
  }, [creatingEvent, onRequestScrollTop, selectingInvitees]);

  const updateCalendarHeaderScrolled = useCallback((scrolled) => {
    if (calendarHeaderScrolledRef.current === scrolled) {
      return;
    }

    calendarHeaderScrolledRef.current = scrolled;
    setCalendarHeaderScrolled(scrolled);
  }, []);

  const handleCalendarGridScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: calendarScrollY } } }],
    {
      listener: (event) => updateCalendarHeaderScrolled(event.nativeEvent.contentOffset.y > 6),
      useNativeDriver: true,
    },
  ), [calendarScrollY, updateCalendarHeaderScrolled]);

  const resetCalendarHeaderScroll = useCallback(() => {
    calendarScrollY.setValue(0);
    updateCalendarHeaderScrolled(false);
  }, [calendarScrollY, updateCalendarHeaderScrolled]);

  const scrollTimeWheelsTo = (time, animated = false) => {
    const nextTime = splitCalendarTime(time);
    const hourIndex = Math.max(0, CALENDAR_HOUR_OPTIONS.indexOf(nextTime.hour));
    const minuteIndex = Math.max(0, CALENDAR_MINUTE_OPTIONS.indexOf(nextTime.minute));

    setTimeout(() => {
      hourWheelRef.current?.scrollTo({
        y: hourIndex * CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
        animated,
      });
      minuteWheelRef.current?.scrollTo({
        y: minuteIndex * CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
        animated,
      });
    }, 0);
  };

  const openCreatePage = () => {
    const nextDraft = createCalendarDraft();

    setDraft(nextDraft);
    setVisibleMonth(dateFromInput(nextDraft.eventDate));
    setDatePickerOpen(false);
    setSelectingInvitees(false);
    setInvitePeopleSearch('');
    setCalendarError('');
    setFormError('');
    resetCalendarHeaderScroll();
    setCreatingEvent(true);
    scrollTimeWheelsTo(nextDraft.eventTime);
  };

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateCalendarDate = (value) => {
    updateDraft('eventDate', value);
    setVisibleMonth(dateFromInput(value));
    setDatePickerOpen(false);
  };

  const updateCalendarTime = (part, value, shouldScroll = true) => {
    const currentTime = splitCalendarTime(draft.eventTime);
    const nextTime = {
      ...currentTime,
      [part]: value,
    };
    const nextValue = `${nextTime.hour}:${nextTime.minute}`;

    updateDraft('eventTime', nextValue);

    if (shouldScroll) {
      scrollTimeWheelsTo(nextValue, true);
    }
  };

  const updateCalendarTimeFromScroll = (part, options, y) => {
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(y / CALENDAR_TIME_WHEEL_ITEM_HEIGHT)),
    );

    updateCalendarTime(part, options[index], false);
  };

  const updateInviteScope = (inviteScope) => {
    setDraft((current) => ({ ...current, inviteScope }));

    if (inviteScope === 'custom') {
      setSelectingInvitees(true);
    } else {
      setSelectingInvitees(false);
      setInvitePeopleSearch('');
    }
  };

  const toggleInvitedMember = (memberId) => {
    setDraft((current) => {
      const selected = current.invitedMemberIds.includes(memberId);

      return {
        ...current,
        invitedMemberIds: selected
          ? current.invitedMemberIds.filter((id) => id !== memberId)
          : [...current.invitedMemberIds, memberId],
      };
    });
  };

  const selectAllInvitees = () => {
    setDraft((current) => ({
      ...current,
      inviteScope: 'custom',
      invitedMemberIds: invitableMembers.map((member) => member.id),
    }));
  };

  const clearInvitedMembers = () => {
    setDraft((current) => ({
      ...current,
      invitedMemberIds: [],
    }));
  };

  const closeCreate = () => {
    if (saving) {
      return;
    }

    setCreatingEvent(false);
    setDatePickerOpen(false);
    setSelectingInvitees(false);
    setInvitePeopleSearch('');
    setFormError('');
    resetCalendarHeaderScroll();
  };

  const pickEventCoverImage = async () => {
    setFormError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setFormError('Studos skal have adgang til billeder for at vælge cover-billede.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      setFormError('Cover-billedet kunne ikke læses.');
      return;
    }

    const mimeType = asset.mimeType || 'image/jpeg';

    setDraft((current) => ({
      ...current,
      coverImageUri: asset.uri,
      coverImageData: `data:${mimeType};base64,${asset.base64}`,
    }));
  };

  const submitEvent = async () => {
    const nextDraft = {
      title: draft.title.trim(),
      eventDate: draft.eventDate.trim(),
      eventTime: draft.eventTime.trim(),
      location: draft.location.trim(),
      description: draft.description.trim(),
      inviteScope: draft.inviteScope,
    };

    if (draft.coverImageData) {
      nextDraft.coverImageData = draft.coverImageData;
    }

    if (draft.inviteScope === 'custom') {
      nextDraft.invitedMemberIds = draft.invitedMemberIds;
    }

    if (!nextDraft.title || !nextDraft.eventDate) {
      setFormError('Skriv titel og dato.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDraft.eventDate)) {
      setFormError('Dato skal skrives som YYYY-MM-DD.');
      return;
    }

    if (nextDraft.eventTime && !/^\d{2}:\d{2}$/.test(nextDraft.eventTime)) {
      setFormError('Tid skal skrives som HH:MM.');
      return;
    }

    if (nextDraft.inviteScope === 'custom' && nextDraft.invitedMemberIds.length === 0) {
      setFormError('Vælg mindst én person at invitere.');
      return;
    }

    setSaving(true);
    setFormError('');
    setCalendarError('');

    try {
      await onCreateEvent(nextDraft);
      setDraft(createCalendarDraft());
      setCreatingEvent(false);
      setDatePickerOpen(false);
      setSelectingInvitees(false);
      setInvitePeopleSearch('');
      resetCalendarHeaderScroll();
    } catch (apiError) {
      setFormError(apiError.message || 'Begivenheden kunne ikke oprettes.');
    } finally {
      setSaving(false);
    }
  };

  const respondToEvent = async (eventId, status) => {
    setRespondingEventId(`${eventId}:${status}`);
    setCalendarError('');

    try {
      await onRespondToEvent(eventId, status);
    } catch (apiError) {
      setCalendarError(apiError.message || 'Dit svar kunne ikke gemmes.');
    } finally {
      setRespondingEventId('');
    }
  };

  if (creatingEvent && selectingInvitees) {
    return (
      <ScrollView
        contentContainerStyle={styles.calendarScreenScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.calendarScreenScroll}
      >
        <View style={styles.calendarCreatePageHeader}>
          <Pressable
            accessibilityLabel="Tilbage til opret gilde"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setSelectingInvitees(false)}
            style={({ pressed }) => [
              styles.calendarCreateBackButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
            <Text style={styles.calendarCreateBackText}>Opret gilde</Text>
          </Pressable>
          <Text style={styles.calendarCreatePageTitle}>Vælg personer</Text>
        </View>

        <View style={styles.calendarInviteSelectPage}>
          <View style={styles.calendarInviteSearchRow}>
            <Ionicons name="search" size={16} color="#65748b" />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setInvitePeopleSearch}
              placeholder="Søg efter navn"
              placeholderTextColor="#8b93a1"
              style={styles.calendarInviteSearchInput}
              value={invitePeopleSearch}
            />
            {invitePeopleSearch ? (
              <Pressable
                accessibilityLabel="Ryd søgning"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setInvitePeopleSearch('')}
              >
                <Ionicons name="close-circle" size={18} color="#8b93a1" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.calendarInviteSelectToolbar}>
            <Text style={styles.calendarInviteSelectCount}>{inviteSelectorMeta}</Text>
            <View style={styles.calendarInviteSelectActions}>
              <Pressable
                accessibilityRole="button"
                onPress={selectAllInvitees}
                style={({ pressed }) => [
                  styles.calendarInviteSelectActionButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.calendarInviteSelectActionText}>Alle</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={clearInvitedMembers}
                style={({ pressed }) => [
                  styles.calendarInviteSelectActionButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.calendarInviteSelectActionText}>Ryd</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.calendarInviteSelectList}>
            {filteredInvitableMembers.length ? filteredInvitableMembers.map((member) => {
              const selected = draft.invitedMemberIds.includes(member.id);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={member.id}
                  onPress={() => toggleInvitedMember(member.id)}
                  style={({ pressed }) => [
                    styles.calendarInviteSelectRow,
                    selected ? styles.calendarInviteSelectRowActive : null,
                    pressed ? styles.footerItemPressed : null,
                  ]}
                >
                  <Avatar profile={member} variant="smallCircle" />
                  <View style={styles.calendarInviteSelectCopy}>
                    <Text numberOfLines={1} style={styles.calendarInviteSelectName}>
                      {member.displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.calendarInviteSelectMeta}>
                      {member.firstName || 'Elev'}
                    </Text>
                  </View>
                  <View style={[
                    styles.calendarInviteSelectCheck,
                    selected ? styles.calendarInviteSelectCheckActive : null,
                  ]}>
                    {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              );
            }) : (
              <Text style={styles.calendarInviteEmptyText}>
                {invitableMembers.length
                  ? 'Ingen matcher søgningen.'
                  : 'Der er ikke andre aktive medlemmer endnu.'}
              </Text>
            )}
          </View>

          <Button label="Færdig" onPress={() => setSelectingInvitees(false)} />
        </View>
      </ScrollView>
    );
  }

  if (creatingEvent) {
    return (
      <ScrollView
        contentContainerStyle={styles.calendarScreenScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.calendarScreenScroll}
      >
        <View style={styles.calendarCreatePageHeader}>
          <Pressable
            accessibilityLabel="Tilbage til kalender"
            accessibilityRole="button"
            hitSlop={10}
            onPress={closeCreate}
            style={({ pressed }) => [
              styles.calendarCreateBackButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
            <Text style={styles.calendarCreateBackText}>Kalender</Text>
          </Pressable>
          <Text style={styles.calendarCreatePageTitle}>Opret gilde</Text>
        </View>

        <View style={styles.calendarCreatePageCard}>
          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Titel</Text>
            <TextInput
              autoCorrect={false}
              onChangeText={(value) => updateDraft('title', value)}
              placeholder={`Studentergilde hos ${activeMember?.firstName ?? 'os'}`}
              placeholderTextColor="#8b93a1"
              style={styles.calendarInput}
              value={draft.title}
            />
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Cover-billede</Text>
            <Pressable
              accessibilityRole="button"
              onPress={pickEventCoverImage}
              style={({ pressed }) => [
                styles.calendarCoverPicker,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              {draft.coverImageUri ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: draft.coverImageUri }}
                  style={styles.calendarCoverPreview}
                />
              ) : (
                <View style={styles.calendarCoverPlaceholder}>
                  <Ionicons name="image" size={24} color={STUDOS_THEME.ink} />
                </View>
              )}
              <View style={styles.calendarCoverCopy}>
                <Text style={styles.calendarCoverTitle}>
                  {draft.coverImageUri ? 'Cover valgt' : 'Vælg et cover'}
                </Text>
                <Text style={styles.calendarCoverText}>
                  Billedet vises øverst på begivenheden.
                </Text>
              </View>
              <View style={styles.calendarCoverAction}>
                <Ionicons name={draft.coverImageUri ? 'swap-horizontal' : 'add'} size={18} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Dato</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDatePickerOpen((current) => !current)}
              style={({ pressed }) => [
                styles.calendarDateSelect,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <View style={styles.calendarDateSelectValue}>
                <View style={styles.calendarDateSelectIcon}>
                  <Ionicons name="calendar" size={16} color={STUDOS_THEME.ink} />
                </View>
                <Text numberOfLines={1} style={styles.calendarDateSelectText}>
                  {formatDate(draft.eventDate)}
                </Text>
              </View>
              <Ionicons
                name={datePickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#65748b"
              />
            </Pressable>

            {datePickerOpen ? (
              <View style={styles.calendarPickerBlock}>
                <View style={styles.calendarPickerHeader}>
                  <View style={styles.calendarMonthControls}>
                    <Pressable
                      accessibilityLabel="Forrige måned"
                      accessibilityRole="button"
                      onPress={() => setVisibleMonth((current) => addCalendarMonths(current, -1))}
                      style={({ pressed }) => [
                        styles.calendarMonthButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="chevron-back" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                    <Text numberOfLines={1} style={styles.calendarMonthTitle}>
                      {monthTitle(visibleMonth)}
                    </Text>
                    <Pressable
                      accessibilityLabel="Næste måned"
                      accessibilityRole="button"
                      onPress={() => setVisibleMonth((current) => addCalendarMonths(current, 1))}
                      style={({ pressed }) => [
                        styles.calendarMonthButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="chevron-forward" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.calendarWeekdayRow}>
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={styles.calendarWeekdayText}>{weekday}</Text>
                  ))}
                </View>
                <View style={styles.calendarDayGrid}>
                  {visibleMonthDays.map((day) => {
                    if (day.empty) {
                      return <View key={day.id} style={styles.calendarDayCell} />;
                    }

                    const active = draft.eventDate === day.value;

                    return (
                      <View key={day.id} style={styles.calendarDayCell}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => updateCalendarDate(day.value)}
                          style={({ pressed }) => [
                            styles.calendarDayButton,
                            active ? styles.calendarDayButtonActive : null,
                            pressed ? styles.footerItemPressed : null,
                          ]}
                        >
                          <Text style={[
                            styles.calendarDayText,
                            active ? styles.calendarDayTextActive : null,
                          ]}>
                            {day.day}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Tidspunkt</Text>
            <View style={styles.calendarTimeWheelCard}>
              <View style={styles.calendarTimeWheelLabelRow}>
                <Text style={[styles.calendarTimeWheelLabel, styles.calendarTimeWheelLabelSlot]}>
                  Time
                </Text>
                <View style={styles.calendarTimeWheelDividerSpacer} />
                <Text style={[styles.calendarTimeWheelLabel, styles.calendarTimeWheelLabelSlot]}>
                  Minut
                </Text>
              </View>
              <View style={styles.calendarTimeWheelBody}>
                <View style={styles.calendarTimeWheelSelectedLine} pointerEvents="none" />
                <View style={styles.calendarTimeWheelColumn}>
                  <ScrollView
                    contentContainerStyle={styles.calendarTimeWheelList}
                    decelerationRate="fast"
                    nestedScrollEnabled
                    onMomentumScrollEnd={(event) => updateCalendarTimeFromScroll(
                      'hour',
                      CALENDAR_HOUR_OPTIONS,
                      event.nativeEvent.contentOffset.y,
                    )}
                    ref={hourWheelRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={CALENDAR_TIME_WHEEL_ITEM_HEIGHT}
                    style={styles.calendarTimeWheel}
                  >
                    {CALENDAR_HOUR_OPTIONS.map((hour) => {
                      const active = selectedTime.hour === hour;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={hour}
                          onPress={() => updateCalendarTime('hour', hour)}
                          style={styles.calendarTimeWheelItem}
                        >
                          <Text style={[
                            styles.calendarTimeWheelText,
                            active ? styles.calendarTimeWheelTextActive : null,
                          ]}>
                            {hour}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
                <Text style={styles.calendarTimeWheelDivider}>:</Text>
                <View style={styles.calendarTimeWheelColumn}>
                  <ScrollView
                    contentContainerStyle={styles.calendarTimeWheelList}
                    decelerationRate="fast"
                    nestedScrollEnabled
                    onMomentumScrollEnd={(event) => updateCalendarTimeFromScroll(
                      'minute',
                      CALENDAR_MINUTE_OPTIONS,
                      event.nativeEvent.contentOffset.y,
                    )}
                    ref={minuteWheelRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={CALENDAR_TIME_WHEEL_ITEM_HEIGHT}
                    style={styles.calendarTimeWheel}
                  >
                    {CALENDAR_MINUTE_OPTIONS.map((minute) => {
                      const active = selectedTime.minute === minute;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={minute}
                          onPress={() => updateCalendarTime('minute', minute)}
                          style={styles.calendarTimeWheelItem}
                        >
                          <Text style={[
                            styles.calendarTimeWheelText,
                            active ? styles.calendarTimeWheelTextActive : null,
                          ]}>
                            {minute}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Sted</Text>
            <TextInput
              autoCorrect={false}
              onChangeText={(value) => updateDraft('location', value)}
              placeholder="Majas have"
              placeholderTextColor="#8b93a1"
              style={styles.calendarInput}
              value={draft.location}
            />
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Beskrivelse</Text>
            <TextInput
              multiline
              onChangeText={(value) => updateDraft('description', value)}
              placeholder="Skriv kort hvad folk skal vide."
              placeholderTextColor="#8b93a1"
              style={[styles.calendarInput, styles.calendarTextArea]}
              textAlignVertical="top"
              value={draft.description}
            />
          </View>

          <View style={styles.calendarField}>
            <Text style={styles.calendarFieldLabel}>Hvem skal inviteres?</Text>
            <View style={styles.calendarInviteModeList}>
              {CALENDAR_INVITE_SCOPE_OPTIONS.map((option) => {
                const active = draft.inviteScope === option.id;
                const custom = option.id === 'custom';
                const optionMeta = custom
                  ? customInviteMeta
                  : `${classInviteCount} ${classInviteCount === 1 ? 'person' : 'personer'}`;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.id}
                    onPress={() => updateInviteScope(option.id)}
                    style={({ pressed }) => [
                      styles.calendarInviteModeRow,
                      active ? styles.calendarInviteModeRowActive : null,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <View style={[
                      styles.calendarInviteModeIcon,
                      active ? styles.calendarInviteModeIconActive : null,
                    ]}>
                      <Ionicons
                        name={option.icon}
                        size={17}
                        color={active ? '#FFFFFF' : STUDOS_THEME.ink}
                      />
                    </View>
                    <View style={styles.calendarInviteModeCopy}>
                      <Text numberOfLines={1} style={styles.calendarInviteModeTitle}>
                        {option.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.calendarInviteModeMeta}>
                        {optionMeta}
                      </Text>
                    </View>
                    <View style={styles.calendarInviteModeAction}>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={19} color={STUDOS_THEME.red} />
                      ) : null}
                      {custom ? <Ionicons name="chevron-forward" size={18} color="#65748b" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {draft.inviteScope === 'custom' && selectedInviteCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectingInvitees(true)}
                style={({ pressed }) => [
                  styles.calendarInviteSelectedSummary,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text numberOfLines={1} style={styles.calendarInviteSelectedSummaryText}>
                  {customInviteMeta}
                </Text>
                <Ionicons name="pencil" size={15} color={STUDOS_THEME.ink} />
              </Pressable>
            ) : null}
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Button label="Opret gilde" loading={saving} onPress={submitEvent} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.calendarScreen, styles.calendarMainScreen]}>
      <Animated.ScrollView
        contentContainerStyle={styles.calendarGridScrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleCalendarGridScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.calendarGridScroll}
      >
      {calendarError ? <Text style={styles.errorText}>{calendarError}</Text> : null}

      {sortedEvents.length ? (
        <View style={styles.calendarEventList}>
          {sortedEvents.map((event) => {
            const dateParts = formatCalendarDateParts(event.date);
            const eventTime = formatCalendarTime(event.startsAt);
            const attendeePreview = (event.attendees ?? []).slice(0, 3);
            const attendingCount = event.attendingCount ?? event.rsvpCount ?? 0;
            const notAttendingCount = event.notAttendingCount ?? 0;
            const inviteCount = event.inviteCount ?? Math.max(attendingCount + notAttendingCount, attendingCount);
            const pendingCount = event.pendingCount ?? Math.max(0, inviteCount - attendingCount - notAttendingCount);
            const attendingLoading = respondingEventId === `${event.id}:attending`;
            const notAttendingLoading = respondingEventId === `${event.id}:not_attending`;
            const responseLocked = Boolean(respondingEventId);

            return (
              <View key={event.id} style={styles.calendarEventCard}>
                {event.coverImageUrl ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: event.coverImageUrl }}
                    style={styles.calendarEventCoverImage}
                  />
                ) : null}
                <View style={styles.calendarEventTopRow}>
                  <View style={styles.calendarDateBadge}>
                    <Text style={styles.calendarDateDay}>{dateParts.day}</Text>
                    <Text style={styles.calendarDateMonth}>{dateParts.month}</Text>
                  </View>
                  <View style={styles.calendarEventCopy}>
                    <View style={styles.calendarEventTitleRow}>
                      <Text numberOfLines={2} style={styles.calendarEventTitle}>
                        {event.title}
                      </Text>
                      <View style={styles.calendarEventTypePill}>
                        <Text style={styles.calendarEventTypeText}>Gilde</Text>
                      </View>
                    </View>
                    <View style={styles.calendarMetaLine}>
                      <Ionicons name="calendar" size={14} color={STUDOS_THEME.red} />
                      <Text numberOfLines={1} style={styles.calendarMetaText}>
                        {dateParts.weekday}{eventTime ? ` kl. ${eventTime}` : ''}
                      </Text>
                    </View>
                    {event.location ? (
                      <View style={styles.calendarMetaLine}>
                        <Ionicons name="location" size={14} color={STUDOS_THEME.blue} />
                        <Text numberOfLines={1} style={styles.calendarMetaText}>
                          {event.location}
                        </Text>
                      </View>
                    ) : null}
                    {event.creator?.displayName ? (
                      <Text numberOfLines={1} style={styles.calendarCreatorText}>
                        Oprettet af {event.creator.displayName}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {event.description ? (
                  <Text style={styles.calendarDescription}>{event.description}</Text>
                ) : null}

                <View style={styles.calendarInviteMetaRow}>
                  <View style={styles.calendarInviteMetaPill}>
                    <Text style={styles.calendarInviteMetaText}>{inviteCount} inviteret</Text>
                  </View>
                  <View style={styles.calendarInviteMetaPill}>
                    <Text style={styles.calendarInviteMetaText}>{pendingCount} mangler svar</Text>
                  </View>
                </View>

                <View style={styles.calendarStatsRow}>
                  <View style={styles.calendarAttendeePreview}>
                    {attendeePreview.map((person) => (
                      <Avatar
                        key={person.memberId}
                        profile={{
                          displayName: person.displayName,
                          profilePhotoUrl: person.profilePhotoUrl,
                        }}
                        variant="smallCircle"
                      />
                    ))}
                  </View>
                  <Text style={styles.calendarStatText}>{attendingCount} deltager</Text>
                  <View style={styles.calendarStatDot} />
                  <Text style={styles.calendarStatText}>{notAttendingCount} kan ikke</Text>
                </View>

                <View style={styles.calendarRsvpRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={responseLocked}
                    onPress={() => respondToEvent(event.id, 'attending')}
                    style={({ pressed }) => [
                      styles.calendarRsvpButton,
                      event.myRsvp === 'attending' ? styles.calendarRsvpButtonAttending : null,
                      pressed && !responseLocked ? styles.footerItemPressed : null,
                    ]}
                  >
                    {attendingLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color={event.myRsvp === 'attending' ? '#FFFFFF' : STUDOS_THEME.red}
                      />
                    )}
                    <Text
                      style={[
                        styles.calendarRsvpText,
                        event.myRsvp === 'attending' ? styles.calendarRsvpTextActive : null,
                      ]}
                    >
                      Deltager
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={responseLocked}
                    onPress={() => respondToEvent(event.id, 'not_attending')}
                    style={({ pressed }) => [
                      styles.calendarRsvpButton,
                      event.myRsvp === 'not_attending' ? styles.calendarRsvpButtonDeclined : null,
                      pressed && !responseLocked ? styles.footerItemPressed : null,
                    ]}
                  >
                    {notAttendingLoading ? (
                      <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                    ) : (
                      <Ionicons
                        name="close-circle"
                        size={17}
                        color={event.myRsvp === 'not_attending' ? STUDOS_THEME.ink : '#65748b'}
                      />
                    )}
                    <Text
                      style={[
                        styles.calendarRsvpText,
                        event.myRsvp === 'not_attending' ? styles.calendarRsvpTextDeclined : null,
                      ]}
                    >
                      Deltager ikke
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.calendarEmptyState}>
          <View style={styles.calendarEmptyIcon}>
            <Ionicons name="calendar-clear" size={56} color={STUDOS_THEME.red} />
          </View>
          <Text style={styles.calendarEmptyTitle}>Ingen gildes endnu</Text>
          <Text style={styles.calendarEmptyText}>
            Når klassen opretter et studentergilde, kan alle svare om de deltager her.
          </Text>
        </View>
      )}
      </Animated.ScrollView>

      <Animated.View style={[
        styles.calendarFloatingHeader,
        calendarHeaderContainerStyle,
        calendarHeaderScrolled ? styles.calendarFloatingHeaderScrolled : null,
      ]}>
        <Animated.View style={[styles.overviewTopLine, calendarHeaderContentStyle]}>
          <CalendarTitle />
          <Pressable
            accessibilityLabel="Opret gilde"
            accessibilityRole="button"
            onPress={openCreatePage}
            style={({ pressed }) => [
              styles.calendarCreateButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.calendarCreateButtonText}>Opret</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function FeatureScreen({ emptyText, emptyTitle, icon, kicker, title }) {
  return (
    <View style={styles.flowStack}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name={icon} size={28} color="#f6d36d" />
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.emptyFeatureIcon}>
          <Ionicons name={icon} size={30} color="#ef5b3f" />
        </View>
        <Text style={styles.sectionTitle}>{emptyTitle}</Text>
        <Text style={styles.feedText}>{emptyText}</Text>
      </View>
    </View>
  );
}

function ConnectionsScreen({ activeMember, schoolClass, sessionToken }) {
  const [personalCode, setPersonalCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [submittingConnection, setSubmittingConnection] = useState(false);
  const [respondingConnectionId, setRespondingConnectionId] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');

  const loadConnections = async () => {
    if (!activeMember?.id || !sessionToken) {
      return;
    }

    setLoadingConnections(true);

    try {
      const data = await apiFetch(`/members/${encodeURIComponent(activeMember.id)}/connections`, {
        authToken: sessionToken,
      });
      setConnections(data.connections ?? []);
    } catch (apiError) {
      setConnectionError(apiError.message || 'Connections kunne ikke hentes.');
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!activeMember?.id || !sessionToken) {
      return () => {
        isMounted = false;
      };
    }

    setLoadingConnections(true);
    apiFetch(`/members/${encodeURIComponent(activeMember.id)}/connections`, {
      authToken: sessionToken,
    })
      .then((data) => {
        if (isMounted) {
          setConnections(data.connections ?? []);
        }
      })
      .catch((apiError) => {
        if (isMounted) {
          setConnectionError(apiError.message || 'Connections kunne ikke hentes.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingConnections(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeMember?.id, sessionToken]);

  const requestConnection = async () => {
    const code = personalCode.trim().toUpperCase();

    if (!code) {
      setConnectionError('Skriv en Studos-kode.');
      setConnectionMessage('');
      return;
    }

    setSubmittingConnection(true);
    setConnectionError('');
    setConnectionMessage('');

    try {
      const data = await apiFetch('/connections/request', {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          personalCode: code,
        }),
      });
      const otherName = data.connection?.otherMember?.firstName
        || data.connection?.otherMember?.displayName
        || 'personen';
      const nextMessage = data.connection?.status === 'accepted'
        ? `I er nu connected med ${otherName}.`
        : `Request sendt til ${otherName}.`;

      setPersonalCode('');
      setConnectionMessage(nextMessage);
      await loadConnections();
    } catch (apiError) {
      setConnectionError(apiError.message || 'Requesten kunne ikke sendes.');
    } finally {
      setSubmittingConnection(false);
    }
  };

  const respondToConnection = async (connectionId, status) => {
    setRespondingConnectionId(connectionId);
    setConnectionError('');
    setConnectionMessage('');

    try {
      const data = await apiFetch(`/connections/${encodeURIComponent(connectionId)}/respond`, {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({
          status,
        }),
      });
      const otherName = data.connection?.otherMember?.firstName
        || data.connection?.otherMember?.displayName
        || 'personen';

      setConnectionMessage(
        status === 'accepted'
          ? `Du accepterede ${otherName}.`
          : `Du afviste ${otherName}.`,
      );
      await loadConnections();
    } catch (apiError) {
      setConnectionError(apiError.message || 'Svaret kunne ikke gemmes.');
    } finally {
      setRespondingConnectionId('');
    }
  };

  return (
    <View style={styles.flowStack}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={styles.kicker}>{schoolClass.className}</Text>
          <Text style={styles.title}>Connections</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="person-add" size={28} color="#f6d36d" />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Tilføj med Studos-kode</Text>
        <Text style={styles.feedText}>
          Send en request til en person fra en anden klasse.
        </Text>
        <Field
          autoCapitalize="characters"
          label="Studos-kode"
          onChangeText={(value) => setPersonalCode(value.toUpperCase())}
          placeholder="MAJA-DISCO"
          value={personalCode}
        />
        {connectionError ? <Text style={styles.errorText}>{connectionError}</Text> : null}
        {connectionMessage ? <Text style={styles.successText}>{connectionMessage}</Text> : null}
        <Button
          label="Send request"
          loading={submittingConnection}
          onPress={requestConnection}
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.sectionTitle}>Requests</Text>
          {loadingConnections ? <ActivityIndicator color="#FF6F73" /> : null}
        </View>

        <View style={styles.connectionList}>
          {connections.length ? connections.map((connection) => {
            const otherMember = connection.otherMember;
            const statusText = {
              accepted: 'Connected',
              pending: connection.direction === 'incoming' ? 'Afventer dig' : 'Sendt',
              rejected: 'Afvist',
            }[connection.status] ?? connection.status;
            const isIncomingPending = connection.status === 'pending' && connection.direction === 'incoming';

            return (
              <View key={connection.id} style={styles.connectionRow}>
                <Avatar profile={otherMember ?? { displayName: 'Ukendt' }} variant="smallCircle" />
                <View style={styles.connectionCopy}>
                  <Text numberOfLines={1} style={styles.connectionName}>
                    {otherMember?.displayName ?? 'Ukendt'}
                  </Text>
                  <Text numberOfLines={1} style={styles.connectionMeta}>
                    {otherMember?.class?.className ?? 'Klasse'} · {statusText}
                  </Text>
                  {isIncomingPending ? (
                    <View style={styles.connectionActions}>
                      <Pressable
                        disabled={respondingConnectionId === connection.id}
                        onPress={() => respondToConnection(connection.id, 'accepted')}
                        style={({ pressed }) => [
                          styles.connectionActionButton,
                          styles.connectionAcceptButton,
                          pressed ? styles.footerItemPressed : null,
                        ]}
                      >
                        <Text style={styles.connectionActionText}>Accepter</Text>
                      </Pressable>
                      <Pressable
                        disabled={respondingConnectionId === connection.id}
                        onPress={() => respondToConnection(connection.id, 'rejected')}
                        style={({ pressed }) => [
                          styles.connectionActionButton,
                          styles.connectionRejectButton,
                          pressed ? styles.footerItemPressed : null,
                        ]}
                      >
                        <Text style={styles.connectionRejectText}>Afvis</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }) : (
            <Text style={styles.emptyText}>Ingen connections endnu.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function AppTopBar({ className, menuOpen, onToggleMenu, schoolName }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        <Pressable
          accessibilityLabel={menuOpen ? 'Luk menu' : 'Aabn menu'}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onToggleMenu}
          style={({ pressed }) => [
            styles.topBarButton,
            pressed ? styles.topBarButtonPressed : null,
          ]}
        >
          {menuOpen ? (
            <Ionicons name="close" size={26} color="#ffffff" />
          ) : (
            <View style={styles.topBarMenuIcon}>
              <View style={styles.topBarMenuLine} />
              <View style={styles.topBarMenuLine} />
              <View style={styles.topBarMenuLine} />
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.topBarTitleGroup}>
        <Text numberOfLines={1} style={styles.topBarSchoolName}>
          {schoolName}
        </Text>
        <Text numberOfLines={1} style={styles.topBarTitle}>
          {className}
        </Text>
      </View>
      <View style={[styles.topBarSide, styles.topBarBrandSide]}>
        <StudosWordmark />
      </View>
    </View>
  );
}

function StudosWordmark() {
  return (
    <View style={styles.wordmark}>
      <View style={styles.wordmarkTextRow}>
        <Text numberOfLines={1} style={[styles.wordmarkText, styles.wordmarkTextLight]}>Stu</Text>
        <Text numberOfLines={1} style={styles.wordmarkText}>dos</Text>
      </View>
      <View style={styles.wordmarkUnderline} />
      <View style={styles.wordmarkDot} />
    </View>
  );
}

function SidebarMenuIcon({ active = false, item }) {
  if (item.id === 'leaderboard') {
    const bars = [
      { height: 13, color: STUDOS_THEME.blue },
      { height: 22, color: STUDOS_THEME.yellow },
      { height: 17, color: STUDOS_THEME.red },
      { height: 26, color: STUDOS_THEME.ink },
    ];

    return (
      <View style={[styles.sidebarMenuIconWrap, styles.sidebarLeaderboardIcon]}>
        {bars.map((bar, index) => (
          <View
            key={index}
            style={[
              styles.sidebarLeaderboardBar,
              { height: bar.height, backgroundColor: bar.color },
            ]}
          />
        ))}
      </View>
    );
  }

  if (item.id === 'classBattle') {
    const podium = [
      { height: 15, color: STUDOS_THEME.blue },
      { height: 25, color: STUDOS_THEME.yellow },
      { height: 19, color: STUDOS_THEME.red },
    ];

    return (
      <View style={[styles.sidebarMenuIconWrap, styles.sidebarPodiumIcon]}>
        {podium.map((step, index) => (
          <View
            key={index}
            style={[
              styles.sidebarPodiumStep,
              { height: step.height, backgroundColor: step.color },
            ]}
          />
        ))}
      </View>
    );
  }

  if (item.id === 'moodBoard') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarMoodBoardIcon}>
          <View style={[styles.sidebarMoodCard, styles.sidebarMoodCardBlue]}>
            <View style={styles.sidebarMoodCardLine} />
          </View>
          <View style={[styles.sidebarMoodCard, styles.sidebarMoodCardYellow]}>
            <View style={styles.sidebarMoodCardDot} />
          </View>
          <View style={[styles.sidebarMoodCard, styles.sidebarMoodCardRed]}>
            <View style={styles.sidebarMoodCardLine} />
          </View>
        </View>
      </View>
    );
  }

  if (item.id === 'badges') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarBadgeRibbonRow}>
          <View style={[styles.sidebarBadgeRibbon, styles.sidebarBadgeRibbonLeft]} />
          <View style={[styles.sidebarBadgeRibbon, styles.sidebarBadgeRibbonRight]} />
        </View>
        <View style={styles.sidebarBadgeMedal}>
          <View style={styles.sidebarBadgeMedalDot} />
        </View>
      </View>
    );
  }

  if (item.id === 'bluebook') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarBookIcon}>
          <View style={styles.sidebarBookSpine} />
          <View style={styles.sidebarBookBookmark} />
          <View style={styles.sidebarBookLine} />
        </View>
      </View>
    );
  }

  if (item.id === 'connections') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <Ionicons name="person" size={21} color={STUDOS_THEME.blue} style={styles.sidebarConnectionPersonLeft} />
        <Ionicons name="person" size={21} color={STUDOS_THEME.red} style={styles.sidebarConnectionPersonRight} />
        <Ionicons name="add-circle" size={13} color={STUDOS_THEME.yellow} style={styles.sidebarConnectionPlus} />
      </View>
    );
  }

  if (item.id === 'classmates') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarCrewIcon}>
          <View style={[styles.sidebarCrewPerson, styles.sidebarCrewPersonLeft]} />
          <View style={[styles.sidebarCrewPerson, styles.sidebarCrewPersonCenter]} />
          <View style={[styles.sidebarCrewPerson, styles.sidebarCrewPersonRight]} />
        </View>
      </View>
    );
  }

  if (item.id === 'randomizer') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarDiceIcon}>
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipTopLeft]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipTopRight]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipCenter]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipBottomLeft]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipBottomRight]} />
        </View>
      </View>
    );
  }

  if (item.id === 'challenges') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <Ionicons name={active ? item.activeIcon : item.icon} size={25} color={STUDOS_THEME.red} />
        <Ionicons name="flash" size={14} color={STUDOS_THEME.yellow} style={styles.sidebarChallengeAccent} />
      </View>
    );
  }

  return (
    <View style={styles.sidebarMenuIconWrap}>
      <Ionicons name={active ? item.activeIcon : item.icon} size={23} color={item.accentColor} />
    </View>
  );
}

function AppSidebar({ activeMember, activeMembers = [], activeRoute, onClose, onSelect, profile, visible }) {
  const [isRendered, setIsRendered] = useState(visible);
  const sidebarProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const sidebarMembers = Array.isArray(activeMembers) ? activeMembers : [];
  const memberProfile = {
    ...profile,
    ...activeMember,
  };
  const crewCount = sidebarMembers.length;
  const crewMeta = crewCount > 0
    ? `${crewCount} ${crewCount === 1 ? 'medlem' : 'medlemmer'}`
    : 'Medlemmer';
  const crewActive = activeRoute === 'classmates';
  const fullProfileName = [activeMember?.firstName, activeMember?.lastName]
    .filter(Boolean)
    .join(' ');
  const profileDisplayName =
    activeMember?.firstName && activeMember?.lastName ? fullProfileName : ''
    || activeMember?.displayName
    || 'Profil';

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(sidebarProgress, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(sidebarProgress, {
      toValue: 0,
      duration: 300,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsRendered(false);
      }
    });
  }, [sidebarProgress, visible]);

  const backdropOpacity = sidebarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const panelTranslateX = sidebarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-360, 0],
  });

  if (!isRendered) {
    return null;
  }

  return (
    <View style={styles.sidebarRoot}>
      <Animated.View
        pointerEvents="none"
        style={[styles.sidebarDim, { opacity: backdropOpacity }]}
      />
      <Pressable
        accessibilityLabel="Luk menu"
        style={styles.sidebarBackdrop}
        onPress={onClose}
      />

      <Animated.View
        style={[
          styles.sidebarPanel,
          { transform: [{ translateX: panelTranslateX }] },
        ]}
      >
        <View style={styles.sidebarPrimaryNav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect('profile')}
            style={({ pressed }) => [
              styles.sidebarMenuItem,
              styles.sidebarProfileItem,
              pressed ? styles.sidebarMenuItemPressed : null,
            ]}
          >
            <Avatar profile={memberProfile} variant="smallCircle" />
            <View style={styles.sidebarProfileCopy}>
              <Text numberOfLines={1} style={styles.sidebarProfileTitle}>
                {profileDisplayName}
              </Text>
              <Text style={styles.sidebarProfileSubtitle}>Min profil</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect('classmates')}
            style={({ pressed }) => [
              styles.sidebarCrewFeature,
              crewActive ? styles.sidebarCrewFeatureActive : null,
              pressed ? styles.sidebarMenuItemPressed : null,
            ]}
          >
            <View style={styles.sidebarCrewFeatureVisual}>
              <SidebarMenuIcon
                item={{
                  id: 'classmates',
                  icon: 'people-outline',
                  activeIcon: 'people',
                  accentColor: STUDOS_THEME.blue,
                }}
                active={crewActive}
              />
            </View>
            <Text numberOfLines={1} style={styles.sidebarCrewFeatureTitle}>Mit crew</Text>
            <View style={styles.sidebarCrewFeatureMetaWrap}>
              <Text numberOfLines={1} style={styles.sidebarCrewFeatureMeta}>{crewMeta}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={STUDOS_THEME.red} />
          </Pressable>

          {APP_DRAWER_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sidebarNavSection}>
              <View style={styles.sidebarNavSectionHeader}>
                <Text style={styles.sidebarNavSectionTitle}>{section.title}</Text>
                <View style={styles.sidebarNavSectionLine} />
              </View>

              {section.items.map((item) => {
                const isActive = activeRoute === item.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => onSelect(item.id)}
                    style={({ pressed }) => [
                      styles.sidebarMenuItem,
                      pressed ? styles.sidebarMenuItemPressed : null,
                    ]}
                  >
                    <SidebarMenuIcon item={item} active={isActive} />
                    <Text
                      style={[
                        styles.sidebarMenuText,
                        isActive ? styles.sidebarMenuTextActive : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.sidebarContent}>
          <View style={styles.sidebarSectionDivider} />
          <Pressable style={styles.sidebarMenuItem}>
            <SidebarMenuIcon item={{ id: 'settings', icon: 'settings-outline', activeIcon: 'settings', accentColor: STUDOS_THEME.blue }} />
            <Text style={styles.sidebarMenuText}>Indstillinger</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function FooterNav({ activeTab, onChangeTab }) {
  return (
    <View style={styles.footerNav}>
      {APP_TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isCenterAction = tab.id === 'overview';
        const isFirstItem = index === 0;
        const isLastItem = index === APP_TABS.length - 1;

        return (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            key={tab.id}
            onPress={() => onChangeTab(tab.id)}
            style={({ pressed }) => [
              styles.footerItem,
              !isCenterAction ? styles.footerStandardItem : null,
              isFirstItem ? styles.footerFirstItem : null,
              isLastItem ? styles.footerLastItem : null,
              isCenterAction ? styles.footerCenterItem : null,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            {isCenterAction ? (
              <View style={[styles.footerCenterCircle, isActive ? styles.footerCenterCircleActive : null]}>
                <FooterOverviewIcon active={isActive} />
                <Text
                  style={[
                    styles.footerCenterCircleLabel,
                    isActive ? styles.footerCenterCircleLabelActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            ) : (
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={25}
                color={isActive ? '#FF6F73' : '#172143'}
              />
            )}
            {!isCenterAction ? (
              <Text style={[styles.footerLabel, isActive ? styles.footerLabelActive : null]}>
                {tab.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function FooterOverviewIcon({ active }) {
  return (
    <View style={styles.footerOverviewIcon}>
      <View style={styles.footerOverviewChimney} />
      <View style={styles.footerOverviewRoof} />
      <View style={[styles.footerOverviewHouse, active ? styles.footerOverviewHouseActive : null]}>
        <View style={styles.footerOverviewDoor} />
      </View>
    </View>
  );
}

function ExistingLoginScreen({
  error,
  login,
  loading,
  onBack,
  onChangeLogin,
  onLogin,
}) {
  return (
    <View style={styles.flowStack}>
      <View style={styles.compactHeader}>
        <Pressable hitSlop={12} onPress={onBack}>
          <Text style={styles.backText}>Tilbage</Text>
        </Pressable>
        <View>
          <Text style={styles.kicker}>Studos</Text>
          <Text style={styles.compactTitle}>Log ind</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Eksisterende profil</Text>
        <Text style={styles.feedText}>
          Brug din invitekode, email og adgangskode.
        </Text>

        <View style={styles.formGrid}>
          <Field
            autoCapitalize="characters"
            label="Invitekode"
            onChangeText={(value) => onChangeLogin('inviteCode', value.toUpperCase())}
            value={login.inviteCode}
          />
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => onChangeLogin('email', value)}
            textContentType="emailAddress"
            value={login.email}
          />
          <Field
            autoCapitalize="none"
            label="Adgangskode"
            onChangeText={(value) => onChangeLogin('password', value)}
            secureTextEntry
            textContentType="password"
            value={login.password}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label="Log ind"
          loading={loading}
          onPress={onLogin}
        />
      </View>
    </View>
  );
}

function ProfileScreen({
  error,
  loading,
  profile,
  schools,
  schoolClass,
  onBack,
  onChangeProfile,
  onPickPhoto,
  onSubmit,
}) {
  return (
    <View style={styles.flowStack}>
      <View style={styles.compactHeader}>
        <Pressable hitSlop={12} onPress={onBack}>
          <Text style={styles.backText}>Tilbage</Text>
        </Pressable>
        <View>
          <Text style={styles.kicker}>{schoolClass.schoolName}</Text>
          <Text style={styles.compactTitle}>{schoolClass.className}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Opret profil</Text>

        <Pressable style={styles.photoPicker} onPress={onPickPhoto}>
          {profile.profilePhotoUrl ? (
            <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.photoInitials}>
                {initialsFor(profile)}
              </Text>
            </View>
          )}
          <View style={styles.photoCopy}>
            <Text style={styles.photoTitle}>Profilbillede</Text>
            <Text style={styles.photoText}>Valgfrit - du kan altid tilfoeje et senere</Text>
          </View>
        </Pressable>

        <View style={styles.formGrid}>
          <SchoolSelect
            onChange={(schoolId) => onChangeProfile('schoolId', schoolId)}
            schools={schools}
            value={profile.schoolId}
          />
          <Field
            label="Fornavn og mellemnavne"
            onChangeText={(value) => onChangeProfile('firstName', value)}
            textContentType="givenName"
            value={profile.firstName}
          />
          <Field
            label="Efternavn"
            onChangeText={(value) => onChangeProfile('lastName', value)}
            textContentType="familyName"
            value={profile.lastName}
          />
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => onChangeProfile('email', value)}
            textContentType="emailAddress"
            value={profile.email}
          />
          <Field
            keyboardType="phone-pad"
            label="Telefon (valgfri)"
            onChangeText={(value) => onChangeProfile('phone', value)}
            textContentType="telephoneNumber"
            value={profile.phone}
          />
          <Field
            keyboardType="numbers-and-punctuation"
            label="Foedselsdag"
            onChangeText={(value) => onChangeProfile('birthday', value)}
            placeholder="YYYY-MM-DD"
            value={profile.birthday}
          />
          <Field
            autoCapitalize="none"
            label="Adgangskode"
            onChangeText={(value) => onChangeProfile('password', value)}
            secureTextEntry
            textContentType="newPassword"
            value={profile.password}
          />
          <Field
            autoCapitalize="none"
            label="Gentag adgangskode"
            onChangeText={(value) => onChangeProfile('passwordConfirmation', value)}
            secureTextEntry
            textContentType="newPassword"
            value={profile.passwordConfirmation}
          />
        </View>

        <View style={styles.consentList}>
          <ConsentRow
            active={profile.termsAccepted}
            label="Jeg accepterer vilkaarene"
            onPress={() => onChangeProfile('termsAccepted', !profile.termsAccepted)}
          />
          <ConsentRow
            active={profile.privacyAccepted}
            label="Jeg accepterer privatlivspolitikken"
            onPress={() => onChangeProfile('privacyAccepted', !profile.privacyAccepted)}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button label="Opret profil" loading={loading} onPress={onSubmit} />
      </View>
    </View>
  );
}

function AccountProfileScreen({
  activeMember,
  error,
  loading,
  profile,
  schoolClass,
  onProfilePhotoUpdate,
}) {
  const [localPreview, setLocalPreview] = useState('');
  const [localError, setLocalError] = useState('');
  const displayProfile = {
    ...profile,
    ...activeMember,
    profilePhotoUrl: localPreview || activeMember?.profilePhotoUrl || profile.profilePhotoUrl,
  };
  const profileName = displayProfile.displayName
    || [displayProfile.firstName, displayProfile.lastName].filter(Boolean).join(' ')
    || 'Min profil';

  const pickAndUploadPhoto = async () => {
    setLocalError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Studos skal have adgang til billeder for at vaelge profilbillede.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.45,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      setLocalError('Billedet kunne ikke laeses.');
      return;
    }

    setLocalPreview(asset.uri);

    const mimeType = asset.mimeType || 'image/jpeg';
    const saved = await onProfilePhotoUpdate(`data:${mimeType};base64,${asset.base64}`);

    if (saved) {
      setLocalPreview('');
    }
  };

  return (
    <View style={[styles.overviewBlank, styles.overviewSurface]}>
      <View style={styles.overviewTopLine}>
        <View>
          <Text style={styles.kicker}>{schoolClass.className}</Text>
          <Text style={styles.compactTitle}>Min profil</Text>
        </View>
      </View>

      <View style={styles.accountProfilePanel}>
        <View style={styles.accountProfilePhotoWrap}>
          {displayProfile.profilePhotoUrl ? (
            <Image source={{ uri: displayProfile.profilePhotoUrl }} style={styles.accountProfilePhoto} />
          ) : (
            <View style={styles.accountProfilePhotoFallback}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.accountProfilePhotoInitials}>
                {initialsFor(displayProfile)}
              </Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={styles.accountProfileName}>{profileName}</Text>
        <Text numberOfLines={1} style={styles.accountProfileMeta}>{schoolClass.schoolName}</Text>

        {localError || error ? <Text style={styles.errorText}>{localError || error}</Text> : null}

        <Button
          label={displayProfile.profilePhotoUrl ? 'Skift profilbillede' : 'Tilfoej profilbillede'}
          loading={loading}
          onPress={pickAndUploadPhoto}
        />
      </View>
    </View>
  );
}

function OverviewScreen({ activeMember, countdown }) {
  const [selectedMood, setSelectedMood] = useState('klar');
  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [moodUpdatedAt, setMoodUpdatedAt] = useState(() => new Date());
  const profileName = activeMember?.displayName
    || [activeMember?.firstName, activeMember?.lastName].filter(Boolean).join(' ')
    || 'Din profil';
  const overviewStats = [
    { id: 'clips', icon: 'ribbon', label: 'Klip', value: '12', color: STUDOS_THEME.yellow },
    { id: 'challenges', icon: 'flash', label: 'Challenges', value: '4', color: STUDOS_THEME.red },
    { id: 'vibes', icon: 'heart', label: 'Vibes', value: '21', color: STUDOS_THEME.blue },
  ];
  const overviewMoods = [
    { id: 'klar', icon: 'sunny', label: 'Klar' },
    { id: 'kaos', icon: 'flash', label: 'Kaos' },
    { id: 'træt', icon: 'moon', label: 'Træt' },
    { id: 'glad', icon: 'happy', label: 'Glad' },
    { id: 'presset', icon: 'alarm', label: 'Presset' },
    { id: 'chill', icon: 'leaf', label: 'Chill' },
  ];
  const activeMood = overviewMoods.find((mood) => mood.id === selectedMood) ?? overviewMoods[0];
  const updateMood = (moodId) => {
    setSelectedMood(moodId);
    setMoodUpdatedAt(new Date());
    setMoodModalOpen(false);
  };

  return (
    <View style={[styles.overviewBlank, styles.overviewSurface]}>
      <View style={styles.overviewHeaderStack}>
        <View style={styles.overviewHeaderTopRow}>
          <OverviewTitle />
          <View style={styles.overviewCountdownInline}>
            <Text style={styles.overviewCountdownNumber}>{countdown}</Text>
            <Text style={styles.overviewCountdownLabel}>dage til{'\n'}studenterugen</Text>
          </View>
        </View>
      </View>
      <View style={styles.overviewStudosCard}>
        <View style={styles.overviewStudosIdentity}>
          <Avatar profile={activeMember ?? { displayName: profileName }} variant="chatHeader" />
          <View style={styles.overviewStudosCopy}>
            <Text numberOfLines={1} style={styles.overviewStudosKicker}>
              Mit Studos
            </Text>
            <Text numberOfLines={1} style={styles.overviewStudosName}>
              {profileName}
            </Text>
            <View style={styles.overviewStudosAwardRow}>
              <View style={styles.overviewStudosAwardIcon}>
                <View style={styles.overviewStudosAwardRibbonRow}>
                  <View style={[styles.overviewStudosAwardRibbon, styles.overviewStudosAwardRibbonBlue]} />
                  <View style={[styles.overviewStudosAwardRibbon, styles.overviewStudosAwardRibbonRed]} />
                </View>
                <View style={styles.overviewStudosAwardMedal}>
                  <View style={styles.overviewStudosAwardMedalDot} />
                </View>
              </View>
              <Text numberOfLines={1} style={styles.overviewStudosAwardText}>
                Klassens stræber
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.overviewStudosStats}>
          {overviewStats.map((stat) => (
            <View key={stat.id} style={styles.overviewStudosStat}>
              <Ionicons name={stat.icon} size={14} color={stat.color} />
              <Text style={styles.overviewStudosStatValue}>{stat.value}</Text>
              <Text numberOfLines={1} style={styles.overviewStudosStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.overviewMoodCard}>
        <View style={styles.overviewMoodHeader}>
          <View style={styles.overviewMoodHeaderCopy}>
            <Text numberOfLines={1} style={styles.overviewMoodQuestion}>
              Hvordan er stemningen i dag?
            </Text>
            <Text numberOfLines={1} style={styles.overviewMoodUpdatedText}>
              Sidst opdateret: {formatMoodUpdatedAt(moodUpdatedAt)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMoodModalOpen(true)}
            style={({ pressed }) => [
              styles.overviewMoodUpdateButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
            <Text style={styles.overviewMoodUpdateText}>Check ind</Text>
          </Pressable>
        </View>
        <View style={styles.overviewMoodCurrentRow}>
          <View style={styles.overviewMoodCurrentBadge}>
            <Ionicons name={activeMood.icon} size={18} color={STUDOS_THEME.ink} />
            <Text numberOfLines={1} style={styles.overviewMoodCurrentText}>
              {activeMood.label}
            </Text>
          </View>
        </View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setMoodModalOpen(false)}
        transparent
        visible={moodModalOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk stemning"
            style={styles.chatModalBackdrop}
            onPress={() => setMoodModalOpen(false)}
          />
          <View style={[styles.chatModalPanel, styles.overviewMoodModalPanel]}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Dagens stemning</Text>
                <Text style={styles.chatModalTitle}>Hvordan er stemningen?</Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setMoodModalOpen(false)}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>
            <View style={styles.overviewMoodModalOptions}>
              {overviewMoods.map((mood) => {
                const active = selectedMood === mood.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={mood.id}
                    onPress={() => updateMood(mood.id)}
                    style={({ pressed }) => [
                      styles.overviewMoodModalOption,
                      active ? styles.overviewMoodModalOptionActive : null,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <View style={[
                      styles.overviewMoodModalIcon,
                      active ? styles.overviewMoodModalIconActive : null,
                    ]}>
                      <Ionicons
                        name={mood.icon}
                        size={20}
                        color={STUDOS_THEME.ink}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.overviewMoodModalOptionText,
                        active ? styles.overviewMoodModalOptionTextActive : null,
                      ]}
                    >
                      {mood.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={STUDOS_THEME.red} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.overviewClipCard}>
        <View style={styles.overviewClipCopy}>
          <Text numberOfLines={1} style={styles.overviewClipTitle}>
            Skal du have et klip?
          </Text>
          <View style={styles.overviewClipIconRow}>
          {CHAT_THREAD_HEADER_COUNTERS.map((counter, index) => (
            <React.Fragment key={counter.id}>
              <View style={styles.overviewClipIcon}>
                {counter.id === 'wave' ? (
                  <MaterialCommunityIcons name="waves" size={16} color={STUDOS_THEME.ink} />
                ) : (
                  <Ionicons name={counter.icon} size={15} color={STUDOS_THEME.ink} />
                )}
              </View>
              {index < CHAT_THREAD_HEADER_COUNTERS.length - 1 ? (
                <View style={styles.overviewClipDot} />
              ) : null}
            </React.Fragment>
          ))}
          </View>
        </View>
        <Pressable
          accessibilityLabel="Tilføj klip"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.overviewClipAddButton,
            pressed ? styles.footerItemPressed : null,
          ]}
        >
          <Text style={styles.overviewClipAddText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OverviewTitle() {
  return (
    <View accessible accessibilityLabel="Overblik" style={styles.overviewPageTitleWrap}>
      <View style={styles.overviewTitleLetterWrap}>
        <Text style={styles.overviewPageTitleLetter}>O</Text>
        <StudentCap />
      </View>
      <Text style={styles.overviewPageTitleRest}>verblik</Text>
    </View>
  );
}

function ChatTitle() {
  return (
    <View accessible accessibilityLabel="Chats" style={styles.overviewPageTitleWrap}>
      <Text style={styles.overviewPageTitleRest}>Chats</Text>
      <View style={styles.chatTitleBubblePair} pointerEvents="none">
        <View style={[styles.chatTitleBubbleShape, styles.chatTitleBubbleBack]}>
          <View style={[styles.chatTitleBubbleLine, styles.chatTitleBubbleLineShort]} />
          <View style={styles.chatTitleBubbleLine} />
          <View style={[styles.chatTitleBubbleTailStable, styles.chatTitleBubbleTailBack]} />
        </View>
        <View style={[styles.chatTitleBubbleShape, styles.chatTitleBubbleFront]}>
          <View style={[styles.chatTitleBubbleDotStable, styles.chatTitleBubbleDotBlue]} />
          <View style={[styles.chatTitleBubbleDotStable, styles.chatTitleBubbleDotYellow]} />
          <View style={[styles.chatTitleBubbleDotStable, styles.chatTitleBubbleDotRed]} />
          <View style={[styles.chatTitleBubbleTailStable, styles.chatTitleBubbleTailFront]} />
        </View>
      </View>
    </View>
  );
}

function CalendarTitle() {
  return (
    <View accessible accessibilityLabel="Kalender" style={styles.overviewPageTitleWrap}>
      <Text style={styles.overviewPageTitleRest}>Kalender</Text>
      <View style={styles.calendarTitleGraphic} pointerEvents="none">
        <View style={styles.calendarTitleIconBack} />
        <View style={styles.calendarTitleIconFace}>
          <Ionicons name="calendar-clear" size={29} color={STUDOS_THEME.ink} />
          <View style={styles.calendarTitleIconDate}>
            <Text style={styles.calendarTitleIconDateText}>19</Text>
          </View>
        </View>
        <View style={styles.calendarTitleIconDot} />
      </View>
    </View>
  );
}

function StudentCap() {
  return (
    <View style={styles.studentCap}>
      <View style={styles.studentCapTop} />
      <View style={styles.studentCapTopShadow}>
        <View style={[styles.studentCapTopShadowStep, styles.studentCapTopShadowStepOne]} />
        <View style={[styles.studentCapTopShadowStep, styles.studentCapTopShadowStepTwo]} />
        <View style={[styles.studentCapTopShadowStep, styles.studentCapTopShadowStepThree]} />
        <View style={[styles.studentCapTopShadowStep, styles.studentCapTopShadowStepFour]} />
      </View>
      <View style={styles.studentCapBand} />
      <View style={styles.studentCapDot} />
      <View style={styles.studentCapTassel}>
        <View style={styles.studentCapTasselDot}>
          <View style={[styles.studentCapTasselPuff, styles.studentCapTasselPuffCenter]} />
          <View style={[styles.studentCapTasselPuff, styles.studentCapTasselPuffLeft]} />
          <View style={[styles.studentCapTasselPuff, styles.studentCapTasselPuffRight]} />
          <View style={[styles.studentCapTasselPuff, styles.studentCapTasselPuffBottom]} />
        </View>
      </View>
    </View>
  );
}

function SchoolSelect({ onChange, schools, value }) {
  const [open, setOpen] = useState(false);
  const selectedSchool = schools.find((school) => school.id === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Skole</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.selectButton,
          pressed ? styles.selectButtonPressed : null,
        ]}
      >
        <Text style={[styles.selectValue, !selectedSchool ? styles.selectPlaceholder : null]}>
          {selectedSchool?.name ?? 'Vaelg skole'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#172143" />
      </Pressable>

      {open ? (
        <View style={styles.selectOptions}>
          {schools.length ? (
            schools.map((school) => {
              const active = school.id === value;

              return (
                <Pressable
                  key={school.id}
                  onPress={() => {
                    onChange(school.id);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectOption,
                    active ? styles.selectOptionActive : null,
                    pressed ? styles.selectButtonPressed : null,
                  ]}
                >
                  <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : null]}>
                    {school.name}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={17} color="#FF6F73" /> : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.selectEmptyText}>Ingen skoler fundet.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function ConsentRow({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.consentRow}>
      <View style={[styles.consentBox, active ? styles.consentBoxActive : null]}>
        {active ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, placeholder, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCorrect={false}
        placeholder={placeholder ?? label}
        placeholderTextColor="#8b93a1"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function Avatar({ profile, variant }) {
  const imageStyle = variant === 'chatHeader'
    ? styles.avatarImageChatHeader
    : variant === 'chatMessage'
      ? styles.avatarImageChatMessage
    : variant === 'chatCircle'
      ? styles.avatarImageChatCircle
      : variant === 'smallCircle'
        ? styles.avatarImageSmallCircle
        : styles.avatarImage;
  const fallbackStyle = variant === 'chatHeader'
    ? styles.avatarFallbackChatHeader
    : variant === 'chatMessage'
      ? styles.avatarFallbackChatMessage
    : variant === 'chatCircle'
      ? styles.avatarFallbackChatCircle
      : variant === 'smallCircle'
        ? styles.avatarFallbackSmallCircle
        : styles.avatarFallback;
  const textStyle = variant === 'chatHeader'
    ? styles.avatarTextChatHeader
    : variant === 'chatMessage'
      ? styles.avatarTextChatMessage
    : variant === 'chatCircle'
      ? styles.avatarTextChatCircle
      : variant === 'smallCircle'
        ? styles.avatarTextSmallCircle
      : styles.avatarText;

  if (profile?.profilePhotoUrl) {
    return <Image source={{ uri: profile.profilePhotoUrl }} style={imageStyle} />;
  }

  return (
    <View style={fallbackStyle}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={textStyle}>
        {initialsFor(profile)}
      </Text>
    </View>
  );
}

function Button({ label, loading, onPress }) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !loading ? styles.primaryButtonPressed : null,
        loading ? styles.primaryButtonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8F2',
  },
  appRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#F1FBF8',
  },
  screen: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  appShell: {
    flex: 1,
    backgroundColor: '#F1FBF8',
  },
  appScreen: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 20,
    paddingTop: APP_SCREEN_TOP_PADDING,
  },
  appScreenOverlayHost: {
    position: 'relative',
    paddingBottom: 0,
    elevation: 30,
    zIndex: 10,
  },
  appScreenFullscreen: {
    flex: 1,
    padding: 0,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  appScroll: {
    zIndex: 2,
  },
  appScrollFullscreen: {
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
    minHeight: APP_TOP_BAR_HEIGHT,
    borderBottomColor: 'rgba(11, 16, 36, 0.55)',
    borderBottomWidth: 1,
    backgroundColor: '#172143',
    paddingHorizontal: 12,
    paddingTop: APP_TOP_BAR_PADDING_TOP,
    paddingBottom: APP_TOP_BAR_PADDING_BOTTOM,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 40,
    zIndex: 40,
  },
  topBarSide: {
    width: 78,
  },
  topBarBrandSide: {
    alignItems: 'flex-end',
    transform: [{ translateY: 5 }],
  },
  topBarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 8,
    transform: [{ translateY: 8 }],
  },
  topBarButtonPressed: {
    backgroundColor: '#223363',
  },
  topBarMenuIcon: {
    justifyContent: 'space-between',
    width: 27,
    height: 22,
  },
  topBarMenuLine: {
    width: 27,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  topBarTitleGroup: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    transform: [{ translateY: 8 }],
  },
  topBarSchoolName: {
    color: '#FF6F73',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
  topBarTitle: {
    color: '#FFF4D8',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  wordmark: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 42,
    position: 'relative',
    width: 66,
  },
  wordmarkTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  wordmarkText: {
    color: '#FFF4D8',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  wordmarkTextLight: {
    color: STUDOS_THEME.blue,
  },
  wordmarkUnderline: {
    width: 40,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.red,
    marginTop: -1,
    transform: [{ rotate: '-3deg' }],
  },
  wordmarkDot: {
    position: 'absolute',
    right: 5,
    top: -1,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
  },
  sidebarRoot: {
    position: 'absolute',
    top: APP_TOP_BAR_HEIGHT,
    right: 0,
    bottom: 0,
    left: 0,
    elevation: 30,
    zIndex: 30,
  },
  sidebarDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 22, 0.28)',
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sidebarPanel: {
    width: '76%',
    maxWidth: 310,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    zIndex: 1,
  },
  sidebarPrimaryNav: {
    flexShrink: 1,
    gap: 10,
  },
  sidebarNavSection: {
    gap: 1,
  },
  sidebarNavSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 18,
    paddingHorizontal: 10,
  },
  sidebarNavSectionTitle: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  sidebarNavSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E8EF',
  },
  sidebarContent: {
    gap: 6,
  },
  sidebarSectionDivider: {
    height: 1,
    backgroundColor: '#E5E8EF',
    marginHorizontal: 10,
  },
  sidebarMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  sidebarMenuItemPressed: {
    opacity: 0.68,
  },
  sidebarProfileItem: {
    minHeight: 44,
  },
  sidebarCrewFeature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(117, 222, 208, 0.42)',
    backgroundColor: '#F1FBF8',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sidebarCrewFeatureActive: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: '#FFFFFF',
  },
  sidebarCrewFeatureVisual: {
    justifyContent: 'center',
    width: 34,
    minHeight: 34,
  },
  sidebarCrewFeatureTitle: {
    flex: 1,
    color: STUDOS_THEME.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  sidebarCrewFeatureMetaWrap: {
    alignItems: 'flex-end',
    maxWidth: 86,
  },
  sidebarCrewFeatureMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 13,
  },
  sidebarMenuIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 34,
    height: 34,
  },
  sidebarLeaderboardIcon: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    paddingBottom: 6,
  },
  sidebarLeaderboardBar: {
    width: 5,
    borderRadius: 5,
  },
  sidebarPodiumIcon: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    paddingBottom: 6,
  },
  sidebarPodiumStep: {
    width: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  sidebarMoodBoardIcon: {
    position: 'relative',
    width: 28,
    height: 27,
  },
  sidebarMoodCard: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sidebarMoodCardBlue: {
    left: 0,
    top: 3,
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-8deg' }],
  },
  sidebarMoodCardYellow: {
    right: 0,
    top: 0,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '7deg' }],
  },
  sidebarMoodCardRed: {
    bottom: 0,
    left: 7,
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '-2deg' }],
  },
  sidebarMoodCardLine: {
    width: 7,
    height: 2,
    borderRadius: 2,
    backgroundColor: STUDOS_THEME.ink,
    opacity: 0.7,
  },
  sidebarMoodCardDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: STUDOS_THEME.ink,
    opacity: 0.72,
  },
  sidebarBadgeRibbonRow: {
    position: 'absolute',
    top: 5,
    flexDirection: 'row',
    gap: 2,
  },
  sidebarBadgeRibbon: {
    width: 7,
    height: 15,
    borderRadius: 2,
  },
  sidebarBadgeRibbonLeft: {
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-14deg' }],
  },
  sidebarBadgeRibbonRight: {
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '14deg' }],
  },
  sidebarBadgeMedal: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    width: 18,
    height: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.yellow,
  },
  sidebarBadgeMedalDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: STUDOS_THEME.blue,
  },
  sidebarBookIcon: {
    position: 'relative',
    width: 24,
    height: 27,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: STUDOS_THEME.ink,
    backgroundColor: STUDOS_THEME.blue,
    overflow: 'hidden',
  },
  sidebarBookSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 6,
    backgroundColor: STUDOS_THEME.red,
  },
  sidebarBookBookmark: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 5,
    height: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: STUDOS_THEME.yellow,
  },
  sidebarBookLine: {
    position: 'absolute',
    right: 4,
    bottom: 7,
    left: 10,
    height: 2,
    borderRadius: 2,
    backgroundColor: STUDOS_THEME.ink,
    opacity: 0.42,
  },
  sidebarConnectionPersonLeft: {
    position: 'absolute',
    left: 6,
    top: 11,
  },
  sidebarConnectionPersonRight: {
    position: 'absolute',
    right: 6,
    top: 8,
  },
  sidebarConnectionPlus: {
    position: 'absolute',
    right: 4,
    top: 5,
  },
  sidebarCrewIcon: {
    position: 'relative',
    width: 30,
    height: 26,
  },
  sidebarCrewPerson: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sidebarCrewPersonLeft: {
    left: 1,
    bottom: 1,
    width: 14,
    height: 18,
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-5deg' }],
  },
  sidebarCrewPersonCenter: {
    left: 9,
    top: 0,
    width: 14,
    height: 21,
    backgroundColor: STUDOS_THEME.yellow,
    zIndex: 2,
  },
  sidebarCrewPersonRight: {
    right: 1,
    bottom: 1,
    width: 14,
    height: 18,
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '5deg' }],
  },
  sidebarDiceIcon: {
    position: 'relative',
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: STUDOS_THEME.ink,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-7deg' }],
  },
  sidebarDicePip: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 5,
  },
  sidebarDicePipTopLeft: {
    left: 5,
    top: 5,
    backgroundColor: STUDOS_THEME.blue,
  },
  sidebarDicePipTopRight: {
    right: 5,
    top: 5,
    backgroundColor: STUDOS_THEME.red,
  },
  sidebarDicePipCenter: {
    left: 10,
    top: 10,
    backgroundColor: STUDOS_THEME.yellow,
  },
  sidebarDicePipBottomLeft: {
    left: 5,
    bottom: 5,
    backgroundColor: STUDOS_THEME.red,
  },
  sidebarDicePipBottomRight: {
    right: 5,
    bottom: 5,
    backgroundColor: STUDOS_THEME.blue,
  },
  sidebarChallengeAccent: {
    position: 'absolute',
    right: 7,
    bottom: 8,
  },
  sidebarProfileTitle: {
    color: '#172143',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  sidebarMenuText: {
    color: '#172143',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },
  sidebarMenuTextActive: {
    color: '#FF6F73',
    fontWeight: '700',
  },
  sidebarProfileCopy: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  sidebarProfileSubtitle: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 13,
  },
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 18,
  },
  inviteShell: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 28,
    minHeight: 700,
    paddingTop: 10,
  },
  topLoginButton: {
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  topLoginText: {
    color: '#182446',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  inviteMain: {
    alignItems: 'center',
    gap: 28,
  },
  logoLockup: {
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  logoWord: {
    color: '#182446',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  inviteForm: {
    alignSelf: 'stretch',
    gap: 12,
  },
  createClassLink: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  createClassText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  createClassAction: {
    color: '#ef5b3f',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  centeredFlow: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
    minHeight: 680,
  },
  flowStack: {
    gap: 16,
  },
  calendarScreen: {
    flex: 1,
    gap: 16,
    paddingBottom: 16,
  },
  calendarMainScreen: {
    overflow: 'visible',
    paddingBottom: 0,
    position: 'relative',
  },
  calendarScreenScroll: {
    flex: 1,
  },
  calendarScreenScrollContent: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 16,
  },
  calendarFloatingHeader: {
    position: 'absolute',
    top: -APP_SCREEN_TOP_PADDING,
    left: -APP_SCREEN_PADDING,
    right: -APP_SCREEN_PADDING,
    zIndex: 8,
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingTop: APP_SCREEN_TOP_PADDING,
    paddingBottom: 12,
    backgroundColor: '#F1FBF8',
  },
  calendarFloatingHeaderScrolled: {
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 15,
    elevation: 8,
  },
  calendarGridScroll: {
    flex: 1,
  },
  calendarGridScrollContent: {
    flexGrow: 1,
    gap: 16,
    paddingTop: 72,
    paddingBottom: 16,
  },
  calendarHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 4,
  },
  calendarHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  calendarKicker: {
    color: STUDOS_THEME.red,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  calendarTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 47,
  },
  calendarIntro: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
    maxWidth: 260,
  },
  calendarCreateButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 13,
    shadowColor: '#C74A52',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  calendarCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarEventList: {
    gap: 12,
  },
  calendarEventCard: {
    gap: 12,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 13,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 17,
    elevation: 5,
  },
  calendarEventCoverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: '#F7FAFA',
  },
  calendarEventTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  calendarDateBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    minHeight: 64,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  calendarDateDay: {
    color: STUDOS_THEME.red,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
  },
  calendarDateMonth: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  calendarEventCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  calendarEventTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  calendarEventTitle: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  calendarEventTypePill: {
    borderRadius: 999,
    backgroundColor: STUDOS_THEME.blue,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  calendarEventTypeText: {
    color: STUDOS_THEME.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  calendarMetaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  calendarMetaText: {
    color: '#46546B',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'capitalize',
  },
  calendarCreatorText: {
    color: '#8B94A6',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  calendarDescription: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
  },
  calendarInviteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  calendarInviteMetaPill: {
    borderColor: '#FFE1B1',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  calendarInviteMetaText: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    minHeight: 26,
  },
  calendarAttendeePreview: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
  },
  calendarStatText: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarStatDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#BAC4D1',
  },
  calendarRsvpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarRsvpButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    borderColor: '#E5E8EF',
    borderRadius: 21,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
  },
  calendarRsvpButtonAttending: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.red,
  },
  calendarRsvpButtonDeclined: {
    borderColor: STUDOS_THEME.blue,
    backgroundColor: STUDOS_THEME.blue,
  },
  calendarRsvpText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarRsvpTextActive: {
    color: '#FFFFFF',
  },
  calendarRsvpTextDeclined: {
    color: STUDOS_THEME.ink,
  },
  calendarEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 310,
    paddingHorizontal: 24,
  },
  calendarEmptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFF0F0',
    marginBottom: 14,
  },
  calendarEmptyTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  calendarEmptyText: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
  },
  calendarCreatePageHeader: {
    gap: 8,
    paddingTop: 2,
  },
  calendarCreateBackButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 3,
    minHeight: 32,
    paddingRight: 10,
  },
  calendarCreateBackText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarCreatePageTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 38,
  },
  calendarCreatePageCard: {
    gap: 15,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  calendarCoverPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 8,
  },
  calendarCoverPreview: {
    width: 88,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  calendarCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 88,
    height: 58,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.yellow,
  },
  calendarCoverCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  calendarCoverTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarCoverText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
  },
  calendarCoverAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: STUDOS_THEME.red,
  },
  calendarDateSelect: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 46,
    borderColor: '#DDE8E5',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  calendarDateSelectValue: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  calendarDateSelectIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: STUDOS_THEME.yellow,
  },
  calendarDateSelectText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarPickerBlock: {
    gap: 10,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 12,
  },
  calendarPickerHeader: {
    gap: 10,
  },
  calendarMonthControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  calendarMonthButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderColor: '#DDE8E5',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  calendarMonthTitle: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
  },
  calendarWeekdayText: {
    color: '#8B94A6',
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarDayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  calendarDayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '14.2857%',
    minHeight: 36,
  },
  calendarDayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  calendarDayButtonActive: {
    backgroundColor: STUDOS_THEME.red,
  },
  calendarDayText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
  },
  calendarTimeWheelCard: {
    gap: 4,
    height: 146,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  calendarTimeWheelBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    position: 'relative',
  },
  calendarTimeWheelSelectedLine: {
    position: 'absolute',
    right: 0,
    left: 0,
    top: CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
    height: CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  calendarTimeWheelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  calendarTimeWheelLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  calendarTimeWheelLabel: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  calendarTimeWheelLabelSlot: {
    flex: 1,
  },
  calendarTimeWheelDividerSpacer: {
    width: 18,
  },
  calendarTimeWheel: {
    width: '100%',
    height: 108,
  },
  calendarTimeWheelList: {
    paddingVertical: CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
  },
  calendarTimeWheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
  },
  calendarTimeWheelText: {
    color: '#8B94A6',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  calendarTimeWheelTextActive: {
    color: STUDOS_THEME.ink,
    fontSize: 23,
    fontWeight: '900',
  },
  calendarTimeWheelDivider: {
    color: STUDOS_THEME.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: CALENDAR_TIME_WHEEL_ITEM_HEIGHT,
    textAlign: 'center',
    width: 18,
  },
  calendarField: {
    gap: 6,
  },
  calendarFieldLabel: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInput: {
    color: STUDOS_THEME.ink,
    minHeight: 44,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  calendarTextArea: {
    minHeight: 82,
    paddingTop: 11,
    paddingBottom: 11,
  },
  calendarInviteModeList: {
    gap: 8,
  },
  calendarInviteModeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  calendarInviteModeRowActive: {
    borderColor: '#FFE1B1',
    backgroundColor: '#FFF8E8',
  },
  calendarInviteModeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F7FAFA',
  },
  calendarInviteModeIconActive: {
    backgroundColor: STUDOS_THEME.red,
  },
  calendarInviteModeCopy: {
    flex: 1,
    minWidth: 0,
  },
  calendarInviteModeTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInviteModeMeta: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 2,
  },
  calendarInviteModeAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  calendarInviteSelectedSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    borderColor: '#DDE8E5',
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 11,
  },
  calendarInviteSelectedSummaryText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInviteSelectPage: {
    gap: 12,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  calendarInviteSearchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    borderColor: '#DDE8E5',
    borderRadius: 21,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
  },
  calendarInviteSearchInput: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    padding: 0,
  },
  calendarInviteSelectToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  calendarInviteSelectCount: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInviteSelectActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  calendarInviteSelectActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 11,
  },
  calendarInviteSelectActionText: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInviteSelectList: {
    gap: 7,
  },
  calendarInviteSelectRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
  },
  calendarInviteSelectRowActive: {
    borderColor: '#FFE1B1',
    backgroundColor: '#FFF8E8',
  },
  calendarInviteSelectCopy: {
    flex: 1,
    minWidth: 0,
  },
  calendarInviteSelectName: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarInviteSelectMeta: {
    color: '#8B94A6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 1,
  },
  calendarInviteSelectCheck: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderColor: '#DDE8E5',
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
  },
  calendarInviteSelectCheckActive: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.red,
  },
  calendarInviteEmptyText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
  },
  brandLockup: {
    gap: 8,
  },
  kicker: {
    color: '#ef5b3f',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  flowTitle: {
    color: '#182446',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 46,
  },
  flowText: {
    color: '#65748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    maxWidth: 310,
  },
  compactHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 10,
  },
  backText: {
    color: '#ef5b3f',
    fontSize: 14,
    fontWeight: '900',
  },
  compactTitle: {
    color: '#182446',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'right',
  },
  overviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    paddingTop: 12,
  },
  overviewBlank: {
    flexGrow: 1,
  },
  overviewSurface: {
    margin: -20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    gap: 18,
  },
  overviewTopLine: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  overviewHeaderStack: {
    gap: 0,
  },
  overviewHeaderTopRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 51,
  },
  overviewHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  overviewStudosCard: {
    gap: 16,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
  overviewStudosIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  overviewStudosCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  overviewStudosKicker: {
    color: STUDOS_THEME.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  overviewStudosName: {
    color: STUDOS_THEME.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  overviewStudosAwardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  overviewStudosAwardIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 18,
    height: 18,
  },
  overviewStudosAwardRibbonRow: {
    position: 'absolute',
    top: 1,
    flexDirection: 'row',
    gap: 1,
  },
  overviewStudosAwardRibbon: {
    width: 5,
    height: 9,
    borderRadius: 1,
  },
  overviewStudosAwardRibbonBlue: {
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-14deg' }],
  },
  overviewStudosAwardRibbonRed: {
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '14deg' }],
  },
  overviewStudosAwardMedal: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 8,
    width: 11,
    height: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: STUDOS_THEME.ink,
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewStudosAwardMedalDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.ink,
  },
  overviewStudosAwardText: {
    color: '#65748b',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  overviewStudosStats: {
    flexDirection: 'row',
    gap: 9,
  },
  overviewStudosStat: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 38,
    borderColor: '#EEF1F5',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 9,
  },
  overviewStudosStatValue: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewStudosStatLabel: {
    color: '#65748b',
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodCard: {
    gap: 12,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
  overviewMoodHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  overviewMoodHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewMoodKicker: {
    color: STUDOS_THEME.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  overviewMoodQuestion: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  overviewMoodUpdateButton: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 8,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  overviewMoodUpdateText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodCurrentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  overviewMoodCurrentBadge: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    borderColor: '#FFE1B1',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 12,
  },
  overviewMoodCurrentText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodSavedText: {
    color: '#65748b',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    maxWidth: 120,
    textAlign: 'right',
  },
  overviewMoodUpdatedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: -3,
  },
  overviewMoodUpdatedText: {
    color: '#65748b',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  overviewMoodOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  overviewMoodButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 38,
    borderColor: '#E5E8EF',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 8,
  },
  overviewMoodButtonActive: {
    borderColor: STUDOS_THEME.yellow,
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewMoodButtonText: {
    color: '#65748b',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodButtonTextActive: {
    color: STUDOS_THEME.ink,
  },
  overviewMoodModalPanel: {
    maxWidth: 420,
  },
  overviewMoodModalOptions: {
    gap: 10,
  },
  overviewMoodModalOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  overviewMoodModalOptionActive: {
    borderColor: STUDOS_THEME.yellow,
    backgroundColor: '#FFF8E8',
  },
  overviewMoodModalIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  overviewMoodModalIconActive: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewMoodModalOptionText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  overviewMoodModalOptionTextActive: {
    fontWeight: '900',
  },
  overviewClipCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 70,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 7,
  },
  overviewClipCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  overviewClipTitle: {
    color: STUDOS_THEME.yellow,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  overviewClipIconRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  overviewClipIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
  },
  overviewClipDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#A9B3C2',
  },
  overviewClipAddButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: STUDOS_THEME.yellow,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 4, height: 7 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 8,
  },
  overviewClipAddText: {
    color: STUDOS_THEME.ink,
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 36,
    marginTop: -5,
  },
  overviewPageTitleWrap: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingLeft: 8,
    paddingTop: 10,
  },
  overviewTitleLetterWrap: {
    position: 'relative',
  },
  overviewPageTitleLetter: {
    color: '#172143',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    zIndex: 4,
  },
  overviewPageTitleRest: {
    color: '#172143',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
  },
  calendarTitleGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 44,
    height: 38,
    marginLeft: 8,
    marginBottom: -2,
  },
  calendarTitleIconBack: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '8deg' }],
  },
  calendarTitleIconFace: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 2,
    top: 2,
    width: 35,
    height: 35,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
    transform: [{ rotate: '-4deg' }],
  },
  calendarTitleIconDate: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    bottom: -4,
    minWidth: 21,
    height: 17,
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.red,
  },
  calendarTitleIconDateText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
  },
  calendarTitleIconDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.blue,
  },
  studentCap: {
    position: 'absolute',
    top: -19,
    left: -8,
    width: 32,
    height: 34,
    transform: [{ rotate: '-7deg' }],
    zIndex: 1,
  },
  studentCapTop: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 30,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#75DED0',
    transform: [{ skewX: '-18deg' }],
    zIndex: 2,
  },
  studentCapTopShadow: {
    position: 'absolute',
    top: 14,
    left: 9,
    width: 14,
    height: 8,
    transform: [{ skewX: '-18deg' }],
    zIndex: 2,
  },
  studentCapTopShadowStep: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#172143',
  },
  studentCapTopShadowStepOne: {
    top: 0,
    left: 0,
    width: 14,
    opacity: 0.22,
  },
  studentCapTopShadowStepTwo: {
    top: 2,
    left: 1,
    width: 12,
    opacity: 0.14,
  },
  studentCapTopShadowStepThree: {
    top: 4,
    left: 2,
    width: 10,
    opacity: 0.08,
  },
  studentCapTopShadowStepFour: {
    top: 6,
    left: -11,
    width: 8,
    opacity: 0.04,
  },
  studentCapBand: {
    position: 'absolute',
    top: 13,
    left: 9,
    width: 15,
    height: 17,
    borderRadius: 2,
    backgroundColor: '#48C8BC',
    zIndex: 1,
  },
  studentCapDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#172143',
    zIndex: 4,
  },
  studentCapTassel: {
    position: 'absolute',
    top: 7,
    right: 2.65,
    alignItems: 'center',
    width: 2,
    height: 13,
    borderRadius: 2,
    backgroundColor: '#FF6F73',
    transform: [{ rotate: '-12deg' }],
    zIndex: 3,
  },
  studentCapTasselDot: {
    position: 'absolute',
    bottom: -5,
    width: 7,
    height: 7,
  },
  studentCapTasselPuff: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: '#FFD46D',
  },
  studentCapTasselPuffCenter: {
    top: 1,
    left: 2,
    width: 4,
    height: 4,
  },
  studentCapTasselPuffLeft: {
    top: 2,
    left: 0,
    width: 3,
    height: 3,
  },
  studentCapTasselPuffRight: {
    top: 2,
    right: 0,
    width: 3,
    height: 3,
  },
  studentCapTasselPuffBottom: {
    bottom: 0,
    left: 2,
    width: 3,
    height: 3,
  },
  overviewCountdown: {
    alignItems: 'flex-end',
    minWidth: 118,
  },
  overviewCountdownInline: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
    paddingBottom: 2,
    transform: [{ translateX: -8 }],
  },
  overviewCountdownNumber: {
    color: STUDOS_THEME.red,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 39,
    minWidth: 46,
    shadowColor: 'rgba(255, 212, 109, 0.62)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 7,
    textAlign: 'right',
  },
  overviewCountdownLabel: {
    color: '#172143',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
    minWidth: 76,
    paddingBottom: 4,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  overviewCodePill: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 9,
    minHeight: 46,
    borderColor: '#FFE3A1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 13,
    shadowColor: '#172143',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  overviewUserIdPill: {
    backgroundColor: '#FFF0F0',
  },
  overviewCodeDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  overviewUserIdDot: {
    backgroundColor: '#FF6F73',
  },
  overviewCodeLabel: {
    color: '#172143',
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewClassMetaValue: {
    color: '#FF6F73',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    maxWidth: 150,
    textAlign: 'right',
  },
  tabHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    paddingTop: 12,
  },
  headerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#182446',
  },
  title: {
    color: '#182446',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 48,
  },
  subtitle: {
    color: '#65748b',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  switchProfileButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 30,
    justifyContent: 'center',
  },
  switchProfileText: {
    color: '#ef5b3f',
    fontSize: 13,
    fontWeight: '900',
  },
  panel: {
    gap: 14,
    borderColor: '#ddd6c7',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#182446',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  label: {
    color: '#48566d',
    fontSize: 13,
    fontWeight: '900',
  },
  inviteInput: {
    minHeight: 58,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    color: '#182446',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 14,
  },
  formGrid: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 48,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    color: '#182446',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  selectButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    paddingHorizontal: 12,
  },
  selectButtonPressed: {
    opacity: 0.74,
  },
  selectValue: {
    color: '#182446',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  selectPlaceholder: {
    color: '#8b93a1',
  },
  selectOptions: {
    overflow: 'hidden',
    borderColor: '#e2dacb',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  selectOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  selectOptionActive: {
    backgroundColor: '#FFF0F0',
  },
  selectOptionText: {
    color: '#172143',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  selectOptionTextActive: {
    color: '#FF6F73',
    fontWeight: '900',
  },
  selectEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
  },
  photoPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    padding: 12,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 74,
    height: 74,
    borderColor: '#FFF4D8',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#182446',
  },
  photoPreview: {
    width: 74,
    height: 74,
    borderRadius: 8,
    backgroundColor: '#d7dce7',
  },
  photoInitials: {
    color: '#f6d36d',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  photoCopy: {
    flex: 1,
    gap: 3,
  },
  photoTitle: {
    color: '#182446',
    fontSize: 16,
    fontWeight: '900',
  },
  photoText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  accountProfilePanel: {
    alignItems: 'center',
    gap: 12,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 18,
  },
  accountProfilePhotoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  accountProfilePhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d7dce7',
  },
  accountProfilePhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    borderColor: '#FFF4D8',
    borderRadius: 48,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.ink,
  },
  accountProfilePhotoInitials: {
    color: STUDOS_THEME.yellow,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  accountProfileName: {
    color: STUDOS_THEME.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  accountProfileMeta: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -8,
  },
  consentList: {
    gap: 10,
  },
  consentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 30,
  },
  consentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderColor: '#cfc8b8',
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
  },
  consentBoxActive: {
    borderColor: '#FF6F73',
    backgroundColor: '#FF6F73',
  },
  consentText: {
    color: '#172143',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  emptyFeatureIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#fff4ee',
  },
  detailList: {
    gap: 10,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 30,
  },
  detailLabel: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
  },
  detailValue: {
    color: '#182446',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  chatTitleActions: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 118,
    height: 51,
  },
  chatTitleActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 34,
    height: 34,
  },
  chatTitleGroupButton: {
  },
  chatTitleDirectButton: {
  },
  chatTitleActionBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1FBF8',
  },
  chatTitleActionBadgeBlue: {
    backgroundColor: STUDOS_THEME.blue,
  },
  chatTitleActionBadgeYellow: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatTitleBubblePair: {
    position: 'relative',
    width: 48,
    height: 32,
    marginLeft: 10,
    marginBottom: 1,
  },
  chatTitleBubbleShape: {
    position: 'absolute',
    borderRadius: 8,
  },
  chatTitleBubbleBack: {
    right: 0,
    top: 0,
    width: 30,
    height: 21,
    borderWidth: 2,
    borderColor: STUDOS_THEME.ink,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingTop: 6,
    gap: 3,
  },
  chatTitleBubbleFront: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    left: 0,
    bottom: 0,
    width: 34,
    height: 23,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: STUDOS_THEME.blue,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 2,
  },
  chatTitleBubbleLine: {
    width: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: STUDOS_THEME.red,
  },
  chatTitleBubbleLineShort: {
    width: 9,
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatTitleBubbleDotStable: {
    width: 4,
    height: 4,
    borderRadius: 4,
  },
  chatTitleBubbleDotBlue: {
    backgroundColor: '#FFFFFF',
  },
  chatTitleBubbleDotYellow: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatTitleBubbleDotRed: {
    backgroundColor: STUDOS_THEME.red,
  },
  chatTitleBubbleTailStable: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  chatTitleBubbleTailBack: {
    right: 2,
    bottom: -4,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: STUDOS_THEME.ink,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '38deg' }],
  },
  chatTitleBubbleTailFront: {
    left: 4,
    bottom: -4,
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '42deg' }],
  },
  chatSearchField: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 46,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 13,
  },
  chatSearchInput: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 44,
    paddingVertical: 0,
  },
  chatExternalPrompt: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 11,
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  chatExternalPromptAction: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 44,
    paddingTop: 2,
  },
  chatExternalPromptIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 20,
  },
  chatExternalPromptActionText: {
    color: '#172143',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    marginTop: 0,
  },
  chatExternalPromptCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatExternalPromptTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  chatExternalPromptText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    marginTop: 1,
  },
  chatExternalPromptCode: {
    color: STUDOS_THEME.red,
    fontWeight: '900',
  },
  chatModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  chatModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 22, 0.34)',
  },
  chatModalPanel: {
    gap: 15,
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  chatModalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  chatModalKicker: {
    color: STUDOS_THEME.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  chatModalTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
  },
  chatCodeModalText: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
  chatModalCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1FBF8',
  },
  chatModalSearchField: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  chatModalSearchInput: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 42,
    paddingVertical: 0,
  },
  chatGroupPhotoPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chatGroupPhotoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderColor: '#FFF4D8',
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  chatGroupPhotoPreviewImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatGroupPhotoCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatGroupPhotoTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatGroupPhotoText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  chatModalMemberScroll: {
    maxHeight: 330,
  },
  chatModalMemberList: {
    gap: 8,
  },
  chatModalMemberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 52,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  chatModalMemberRowSelected: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: '#FFF4D8',
  },
  chatModalMemberName: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatGroupSelectionText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -6,
  },
  chatModalCheck: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderColor: '#DDE8E5',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  chatModalCheckSelected: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.red,
  },
  chatModalEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  chatActionConfirmPanel: {
    alignItems: 'center',
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  chatActionConfirmIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderColor: '#FFF4D8',
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  chatActionConfirmIconDanger: {
    borderColor: 'rgba(255, 111, 115, 0.32)',
    backgroundColor: STUDOS_THEME.red,
  },
  chatActionConfirmIconWarning: {
    borderColor: 'rgba(255, 212, 109, 0.55)',
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatActionConfirmIconCalm: {
    borderColor: 'rgba(117, 222, 208, 0.45)',
    backgroundColor: STUDOS_THEME.blue,
  },
  chatActionConfirmTitle: {
    textAlign: 'center',
  },
  chatActionConfirmText: {
    textAlign: 'center',
  },
  chatActionConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 2,
  },
  chatActionCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 46,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  chatActionCancelText: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatActionConfirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.ink,
    paddingHorizontal: 12,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  chatActionConfirmButtonDanger: {
    backgroundColor: STUDOS_THEME.red,
    shadowColor: STUDOS_THEME.red,
  },
  chatActionConfirmButtonWarning: {
    backgroundColor: STUDOS_THEME.yellow,
    shadowColor: STUDOS_THEME.yellow,
  },
  chatActionConfirmButtonCalm: {
    backgroundColor: STUDOS_THEME.blue,
    shadowColor: STUDOS_THEME.blue,
  },
  chatActionConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatActionConfirmButtonTextDark: {
    color: STUDOS_THEME.ink,
  },
  chatScreenRoot: {
    flex: 1,
    gap: 18,
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  chatListHeader: {
    position: 'absolute',
    top: -APP_SCREEN_TOP_PADDING,
    left: -APP_SCREEN_PADDING,
    right: -APP_SCREEN_PADDING,
    zIndex: 8,
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingTop: APP_SCREEN_TOP_PADDING,
    paddingBottom: 6,
    backgroundColor: '#F1FBF8',
    overflow: 'hidden',
  },
  chatListHeaderShadow: {
    position: 'absolute',
    top: -APP_SCREEN_TOP_PADDING,
    left: -APP_SCREEN_PADDING,
    right: -APP_SCREEN_PADDING,
    height: 12,
    backgroundColor: '#F1FBF8',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 16,
    zIndex: 7,
  },
  chatListHeaderContent: {
    gap: 0,
  },
  chatSearchCollapseSlot: {
    overflow: 'hidden',
  },
  chatSearchCollapseInner: {
    paddingTop: 14,
  },
  chatConversationScroll: {
    flex: 1,
    marginHorizontal: -APP_SCREEN_PADDING,
    minHeight: 0,
    overflow: 'visible',
  },
  chatThreadModalHost: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  chatThreadModalContent: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  chatThreadActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 80,
    elevation: 80,
  },
  chatThreadActionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 22, 0.34)',
  },
  chatThreadActionPanel: {
    width: '100%',
    maxWidth: 360,
    zIndex: 81,
    elevation: 81,
  },
  chatThreadOverlayHost: {
    position: 'absolute',
    top: -(APP_TOP_BAR_HEIGHT + APP_SCREEN_TOP_PADDING),
    right: -APP_SCREEN_PADDING,
    bottom: -(APP_FOOTER_HEIGHT + APP_SCREEN_PADDING),
    left: -APP_SCREEN_PADDING,
    overflow: 'hidden',
    elevation: 40,
    zIndex: 20,
  },
  chatThreadDraggable: {
    flex: 1,
    width: '100%',
    zIndex: 2,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: -12, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 18,
  },
  chatThreadFullscreen: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
    backgroundColor: '#F1FBF8',
    paddingHorizontal: 18,
    paddingTop: CHAT_THREAD_TOP_PADDING,
    paddingBottom: CHAT_THREAD_BOTTOM_PADDING,
  },
  chatThreadPageHeader: {
    alignItems: 'flex-start',
    backgroundColor: '#F1FBF8',
    borderBottomColor: STUDOS_THEME.ink,
    borderBottomWidth: 1.5,
    justifyContent: 'center',
    marginHorizontal: -18,
    marginTop: -CHAT_THREAD_TOP_PADDING,
    minHeight: CHAT_THREAD_TOP_PADDING + 104,
    paddingLeft: 56,
    paddingRight: 18,
    paddingTop: CHAT_THREAD_TOP_PADDING + 10,
    paddingBottom: 10,
    position: 'relative',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    zIndex: 3,
  },
  chatThreadCenteredIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    maxWidth: '100%',
    width: '100%',
  },
  chatThreadProfileSummary: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  chatThreadCounterGrid: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'flex-end',
    width: 102,
  },
  chatThreadCounterPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    width: 48,
    height: 22,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 248, 231, 0.9)',
    paddingHorizontal: 5,
  },
  chatThreadCounterText: {
    color: STUDOS_THEME.ink,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  chatThreadBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    top: CHAT_THREAD_TOP_PADDING + 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  chatThreadAvatarStatusWrap: {
    position: 'relative',
  },
  chatThreadOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 13,
    height: 13,
    borderColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#31D158',
  },
  chatThreadGroupAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  chatThreadGroupPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatThreadPageTitleWrap: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    maxWidth: 230,
  },
  chatThreadPageTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'left',
  },
  chatThreadPageMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
    maxWidth: '100%',
  },
  chatThreadAwardIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 16,
    height: 16,
  },
  chatThreadAwardRibbonRow: {
    position: 'absolute',
    top: 1,
    flexDirection: 'row',
    gap: 1,
  },
  chatThreadAwardRibbon: {
    width: 4,
    height: 8,
    borderRadius: 1,
  },
  chatThreadAwardRibbonLeft: {
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-14deg' }],
  },
  chatThreadAwardRibbonRight: {
    backgroundColor: STUDOS_THEME.red,
    transform: [{ rotate: '14deg' }],
  },
  chatThreadAwardMedal: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 7,
    width: 10,
    height: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatThreadAwardMedalDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.blue,
  },
  chatThreadPageMeta: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'left',
  },
  chatThreadLastActive: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
    textAlign: 'left',
  },
  chatThreadPageMessages: {
    flex: 1,
    flexGrow: 1,
    marginHorizontal: -18,
    minHeight: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  chatThreadPageMessagesContent: {
    flexGrow: 1,
    gap: 9,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  chatThreadEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
    paddingHorizontal: 22,
  },
  chatThreadEmptyTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  chatThreadEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 4,
    textAlign: 'center',
  },
  chatThreadPanel: {
    gap: 12,
    borderColor: '#ddd6c7',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  chatThreadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chatIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1FBF8',
  },
  chatThreadTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  chatThreadTitle: {
    color: '#172143',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatThreadMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 1,
  },
  chatActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    borderRadius: 8,
    borderColor: '#FFE0E0',
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  chatActionButtonText: {
    color: '#FF6F73',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatMessageList: {
    gap: 9,
    minHeight: 260,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 10,
  },
  chatMessageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
    width: '100%',
  },
  chatMessageRowMine: {
    justifyContent: 'flex-end',
  },
  chatMessageAvatarStatusWrap: {
    position: 'relative',
  },
  chatMessageOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1.5,
    backgroundColor: '#31D158',
    zIndex: 2,
  },
  chatBubble: {
    flexShrink: 1,
    maxWidth: '74%',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.13,
    shadowRadius: 13,
    elevation: 5,
  },
  chatBubbleHolding: {
    transform: [{ scale: 0.985 }],
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  chatBubbleHoldIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -8,
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F1FBF8',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.17,
    shadowRadius: 7,
    elevation: 5,
    zIndex: 5,
  },
  chatBubbleHoldIndicatorMine: {
    right: -4,
    backgroundColor: STUDOS_THEME.red,
  },
  chatBubbleHoldIndicatorOther: {
    left: -4,
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatBubbleTail: {
    position: 'absolute',
    bottom: 7,
    width: 17,
    height: 17,
    borderRadius: 6,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    transform: [{ rotate: '38deg' }],
    zIndex: -1,
  },
  chatBubbleTailOther: {
    left: -5,
    borderBottomColor: '#B8ECE4',
    borderBottomWidth: 1,
    borderLeftColor: '#B8ECE4',
    borderLeftWidth: 1,
    backgroundColor: '#EAF9F6',
  },
  chatBubbleTailMine: {
    right: -5,
    backgroundColor: '#172143',
  },
  chatBubbleMine: {
    backgroundColor: '#172143',
  },
  chatBubbleOther: {
    borderColor: '#B8ECE4',
    borderWidth: 1,
    backgroundColor: '#EAF9F6',
  },
  chatBubbleDeleted: {
    opacity: 0.64,
  },
  chatSenderName: {
    color: '#FF6F73',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 2,
  },
  chatMessageText: {
    color: STUDOS_THEME.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
  chatMessageTextMine: {
    color: '#FFF4D8',
  },
  chatBubbleMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  chatBubbleMeta: {
    color: '#5C7E83',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0,
  },
  chatBubbleMetaMine: {
    color: '#75DED0',
  },
  chatBubbleStatusIcon: {
    marginTop: 1,
  },
  chatComposer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    minHeight: 72,
    position: 'relative',
    zIndex: 2,
  },
  chatComposerSurface: {
    position: 'absolute',
    top: -12,
    right: -18,
    bottom: -16,
    left: -18,
    backgroundColor: 'transparent',
    elevation: 0,
    zIndex: 0,
  },
  chatComposerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    color: '#182446',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 1,
  },
  chatSendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    overflow: 'visible',
    zIndex: 1,
  },
  chatSendButtonSurface: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(117, 222, 208, 0.55)',
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: '#172143',
    shadowColor: '#101735',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 0,
  },
  chatSendButtonPressed: {
    transform: [{ scale: 0.92 }, { rotate: '-4deg' }],
  },
  chatSendButtonDisabled: {
  },
  chatSendButtonSurfaceDisabled: {
    borderColor: 'rgba(117, 222, 208, 0.24)',
    backgroundColor: '#172143',
    shadowOpacity: 0,
    elevation: 0,
  },
  chatSendRocketBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderColor: 'transparent',
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: 'transparent',
    elevation: 12,
    zIndex: 2,
  },
  chatSendRocketBadgeDisabled: {
    backgroundColor: 'transparent',
  },
  chatSendRocketImage: {
    width: 50,
    height: 50,
    zIndex: 3,
  },
  chatSendRocketImageDisabled: {
    opacity: 1,
  },
  chatSendSendingDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    elevation: 12,
    zIndex: 2,
  },
  chatSendSendingDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },
  chatSendDotBlue: {
    backgroundColor: STUDOS_THEME.blue,
  },
  chatSendDotYellow: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatSendDotWhite: {
    backgroundColor: '#FFFFFF',
  },
  chatConversationList: {
    flexGrow: 1,
    gap: 12,
    overflow: 'visible',
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingBottom: 18,
  },
  chatConversationAvatarStatusWrap: {
    position: 'relative',
  },
  chatConversationOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 12,
    height: 12,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: '#31D158',
  },
  chatConversationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 68,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    marginLeft: 7,
    overflow: 'visible',
    paddingHorizontal: 17,
    paddingVertical: 11,
    position: 'relative',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 13,
    elevation: 3,
  },
  chatConversationTail: {
    position: 'absolute',
    left: -4,
    bottom: 12,
    width: 17,
    height: 17,
    borderBottomColor: STUDOS_THEME.ink,
    borderBottomWidth: 1.5,
    borderLeftColor: STUDOS_THEME.ink,
    borderLeftWidth: 1.5,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '38deg' }],
  },
  chatConversationIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderColor: '#FFF4D8',
    borderRadius: 21,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  chatConversationGroupPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  chatConversationCopy: {
    flex: 1,
    minWidth: 0,
  },
  chatConversationTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  chatConversationTitleUnread: {
    fontWeight: '900',
  },
  chatConversationPreviewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 2,
    maxWidth: '86%',
  },
  chatConversationPreview: {
    color: '#65748b',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    maxWidth: '74%',
  },
  chatConversationPreviewDot: {
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#9aa3b4',
    marginHorizontal: 7,
  },
  chatConversationPreviewTime: {
    color: '#65748b',
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
  },
  chatConversationMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 26,
  },
  chatConversationChevronUnreadIcon: {
    textShadowColor: 'rgba(255, 111, 115, 0.7)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 9,
  },
  chatConversationHoldIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -9,
    right: 18,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: STUDOS_THEME.ink,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 4,
  },
  chatConversationActionMenuPanel: {
    gap: 17,
    paddingBottom: 16,
  },
  chatConversationActionMenuHeading: {
    flex: 1,
    minWidth: 0,
  },
  chatConversationActionMenuList: {
    gap: 9,
  },
  chatConversationActionMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 50,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
  },
  chatConversationActionMenuIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8E5',
    borderWidth: 1,
  },
  chatConversationActionMenuIconDanger: {
    borderColor: '#FF8B8E',
    backgroundColor: STUDOS_THEME.red,
  },
  chatConversationActionMenuIconWarning: {
    borderColor: '#FFE59E',
    backgroundColor: STUDOS_THEME.yellow,
  },
  chatConversationActionMenuIconCalm: {
    borderColor: '#BDEFE8',
    backgroundColor: STUDOS_THEME.blue,
  },
  chatConversationActionMenuText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatConversationTime: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0,
  },
  chatConversationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: 26,
    paddingTop: 22,
  },
  chatConversationEmptyIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 118,
    height: 104,
    marginBottom: 8,
  },
  chatConversationEmptySlash: {
    position: 'absolute',
    width: 108,
    height: 8,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.blue,
    transform: [{ rotate: '-34deg' }],
  },
  chatConversationEmptyTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  chatConversationEmptyBody: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 260,
    textAlign: 'center',
  },
  chatConversationEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    paddingVertical: 8,
  },
  chatUnreadBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -8,
    left: 0,
    minWidth: 26,
    height: 26,
    borderColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 6,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    transform: [{ translateX: -9 }],
    elevation: 7,
    zIndex: 4,
  },
  chatUnreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatMemberGrid: {
    gap: 8,
  },
  chatMemberButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  chatMemberName: {
    color: '#172143',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chatGroupMemberList: {
    gap: 8,
  },
  chatGroupMemberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 42,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  chatGroupMemberRowActive: {
    borderColor: '#FF6F73',
    backgroundColor: '#FFF0F0',
  },
  chatGroupMemberName: {
    color: '#172143',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  connectionList: {
    gap: 12,
  },
  connectionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    borderBottomColor: '#E5E8EF',
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  connectionAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#172143',
  },
  connectionAvatarText: {
    color: '#FFD46D',
    fontSize: 13,
    fontWeight: '900',
  },
  connectionCopy: {
    flex: 1,
    gap: 3,
  },
  connectionName: {
    color: '#172143',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  connectionMeta: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  connectionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  connectionActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  connectionAcceptButton: {
    backgroundColor: '#FF6F73',
  },
  connectionRejectButton: {
    borderColor: '#DCE7E4',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  connectionActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  connectionRejectText: {
    color: '#172143',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#ef5b3f',
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d38b7d',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    color: '#bd2f23',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  successText: {
    color: '#1b8a76',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  notice: {
    gap: 4,
    borderColor: '#f2cf79',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff8df',
    padding: 14,
  },
  noticeTitle: {
    color: '#76530d',
    fontSize: 15,
    fontWeight: '900',
  },
  noticeText: {
    color: '#76530d',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickTile: {
    flex: 1,
    borderColor: '#ddd6c7',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  deepTile: {
    borderColor: '#63d2bf',
    backgroundColor: '#effbf8',
  },
  tileNumber: {
    color: '#182446',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tileLabel: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#d7dce7',
  },
  avatarImageSmallCircle: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#d7dce7',
  },
  avatarImageChatCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderColor: '#DDE8E5',
    borderWidth: 1,
    backgroundColor: '#d7dce7',
  },
  avatarImageChatHeader: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d7dce7',
  },
  avatarImageChatMessage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#d7dce7',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderColor: '#FFF4D8',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#182446',
  },
  avatarFallbackSmallCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderColor: '#FFF4D8',
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#172143',
  },
  avatarFallbackChatCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderColor: '#FFF4D8',
    borderRadius: 21,
    borderWidth: 1.5,
    backgroundColor: STUDOS_THEME.ink,
  },
  avatarFallbackChatHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderColor: '#FFF4D8',
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.yellow,
  },
  avatarFallbackChatMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderColor: '#FFF4D8',
    borderRadius: 13,
    borderWidth: 1.5,
    backgroundColor: STUDOS_THEME.yellow,
  },
  avatarText: {
    color: '#f6d36d',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextSmallCircle: {
    color: '#FFD46D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextChatCircle: {
    color: STUDOS_THEME.yellow,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextChatHeader: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextChatMessage: {
    color: STUDOS_THEME.ink,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  mutedText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#ece5d8',
  },
  eventRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 4,
  },
  eventTitle: {
    color: '#182446',
    fontSize: 16,
    fontWeight: '900',
  },
  eventMeta: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  rsvp: {
    color: '#1b8a76',
    fontSize: 13,
    fontWeight: '900',
  },
  feedText: {
    color: '#65748b',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  memberName: {
    color: '#182446',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  memberStatus: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footerNav: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
    borderTopColor: STUDOS_THEME.ink,
    borderTopWidth: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: APP_FOOTER_PADDING_BOTTOM,
    marginBottom: APP_FOOTER_BOTTOM_PULL,
    overflow: 'visible',
    position: 'relative',
    elevation: 60,
    zIndex: 60,
  },
  footerItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 8,
    paddingTop: 12,
  },
  footerStandardItem: {
    transform: [{ translateY: -10 }],
  },
  footerFirstItem: {
    transform: [{ translateX: 10 }, { translateY: -10 }],
  },
  footerLastItem: {
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  footerCenterItem: {
    justifyContent: 'flex-end',
    minHeight: 52,
    overflow: 'visible',
    paddingBottom: 1,
    paddingTop: 0,
    position: 'relative',
  },
  footerCenterCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -35,
    left: '50%',
    marginLeft: -39,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#172143',
    borderWidth: 0,
    shadowColor: '#172143',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 14,
  },
  footerCenterCircleActive: {
    shadowColor: STUDOS_THEME.red,
    shadowOpacity: 0.52,
    shadowRadius: 22,
    elevation: 18,
  },
  footerOverviewIcon: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    width: 34,
    height: 31,
  },
  footerOverviewChimney: {
    position: 'absolute',
    top: 4,
    right: 7,
    width: 6,
    height: 11,
    borderRadius: 2,
    backgroundColor: STUDOS_THEME.blue,
    zIndex: 1,
  },
  footerOverviewRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: STUDOS_THEME.yellow,
    zIndex: 2,
  },
  footerOverviewHouse: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 22,
    height: 15,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#FFF4D8',
    marginTop: -1,
    paddingBottom: 0,
  },
  footerOverviewHouseActive: {
    backgroundColor: STUDOS_THEME.red,
  },
  footerOverviewDoor: {
    width: 6,
    height: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: STUDOS_THEME.ink,
  },
  footerCenterCircleLabel: {
    color: '#FFF4D8',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 12,
    marginTop: 2,
  },
  footerCenterCircleLabelActive: {
    color: '#FF6F73',
  },
  footerItemPressed: {
    opacity: 0.72,
  },
  footerLabel: {
    color: '#172143',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0,
  },
  footerLabelActive: {
    color: '#FF6F73',
  },
});
