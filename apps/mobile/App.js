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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const SESSION_STORAGE_KEY = 'studos.session.v1';
const ANDROID_NOTIFICATION_PROMPT_STORAGE_KEY = 'studos.androidNotificationPrompt.v1';
const OVERVIEW_MOOD_STORAGE_KEY = 'studos.overviewMood.v1';
const OVERVIEW_CLIPS_STORAGE_KEY = 'studos.overviewClips.v1';
const EARN_CAPS_CHECKIN_STORAGE_KEY = 'studos.earnCapsCheckIn.v1';
const STUDOS_LOGO = require('./assets/icon.png');
const CHAT_SEND_ROCKET = require('./assets/chat-send-rocket.png');
const CAPS_COIN = require('./assets/caps-coin.png');
const FOOTER_CALENDAR_ICON = require('./assets/footer-calendar.png');
const FOOTER_CHAT_ICON = require('./assets/footer-chat.png');
const FOOTER_WALLS_ICON = require('./assets/footer-walls.png');
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
const ANDROID_NOTIFICATIONS_ENABLED = Platform.OS === 'android' && !IS_WEB;
const STUDOS_NOTIFICATION_CHANNEL_ID = 'studos-default';
const STUDOS_EAS_PROJECT_ID = 'b4da2c62-b9cd-442c-b8da-facc8e6dc689';
const CHAT_LIST_HEADER_SCROLL_PADDING_TOP = 160;
const CHAT_LIST_HEADER_COLLAPSE_DISTANCE = 260;
const CHAT_LIST_HEADER_CLAMP_DISTANCE = 14;
const CHAT_LIST_SEARCH_COLLAPSE_DISTANCE = 58;
const CHAT_LIST_HEADER_EXPANDED_HEIGHT = APP_SCREEN_TOP_PADDING + CHAT_LIST_HEADER_SCROLL_PADDING_TOP;
const CHAT_LIST_HEADER_COLLAPSED_HEIGHT = CHAT_LIST_HEADER_EXPANDED_HEIGHT - CHAT_LIST_SEARCH_COLLAPSE_DISTANCE;
const OVERVIEW_HEADER_HEIGHT = APP_SCREEN_TOP_PADDING + 51 + 13;
const CHAT_THREAD_HEADER_COUNTERS = [
  { id: 'home', icon: 'home', value: '12' },
  { id: 'wave', icon: 'water', value: '8' },
  { id: 'bolt', icon: 'flash', value: '4' },
  { id: 'heart', icon: 'heart', value: '21' },
  { id: 'square', icon: 'square', value: '6' },
  { id: 'triangle', icon: 'triangle', value: '3' },
];
const OVERVIEW_STUDOS_BOTTOM_WAVE_CURVES = Array.from({ length: 10 }, (_, index) => index);
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
let androidNotificationHandlerConfigured = false;
let chatRealtimeFallbackLogged = false;

const androidExpoRuntimeReady = () => {
  if (!ANDROID_NOTIFICATIONS_ENABLED) {
    return false;
  }

  return Boolean(globalThis?.expo?.EventEmitter);
};

const loadAndroidExpoModule = (moduleName) => {
  if (!ANDROID_NOTIFICATIONS_ENABLED) {
    return null;
  }

  if (!androidExpoRuntimeReady()) {
    console.warn('Android Expo native runtime is not ready for notification modules.');
    return null;
  }

  try {
    switch (moduleName) {
      case 'expo-notifications':
        return require('expo-notifications');
      case 'expo-device':
        return require('expo-device');
      case 'expo-constants':
        return require('expo-constants');
      default:
        return null;
    }
  } catch (error) {
    console.warn(`${moduleName} is unavailable in this build.`, error);
    return null;
  }
};

const loadAndroidNotificationsModule = () => loadAndroidExpoModule('expo-notifications');
const loadAndroidDeviceModule = () => loadAndroidExpoModule('expo-device');
const loadAndroidConstantsModule = () => loadAndroidExpoModule('expo-constants');

const configureAndroidNotificationHandler = (notifications) => {
  if (!notifications || androidNotificationHandlerConfigured) {
    return Boolean(notifications);
  }

  try {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    androidNotificationHandlerConfigured = true;
    return true;
  } catch (error) {
    console.warn('Android notification handler could not be configured.', error);
    return false;
  }
};

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

const ensureTextEncoder = () => {
  if (typeof globalThis.TextEncoder !== 'undefined') {
    return;
  }

  globalThis.TextEncoder = class TextEncoder {
    encode(value = '') {
      const encoded = unescape(encodeURIComponent(String(value)));
      const bytes = new Uint8Array(encoded.length);

      for (let index = 0; index < encoded.length; index += 1) {
        bytes[index] = encoded.charCodeAt(index);
      }

      return bytes;
    }
  };
};

const encodeQrCells = (value) => {
  ensureTextEncoder();

  const { toQR } = require('toqr');

  return toQR(value || 'STUDOS');
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

const createWebPublicBaseUrl = () => {
  if (!IS_WEB || typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  return window.location.origin;
};

const WEB_PUBLIC_BASE_URL = createWebPublicBaseUrl();
const CREATE_CLASS_URL =
  process.env.EXPO_PUBLIC_CREATE_CLASS_URL
  ?? (WEB_PUBLIC_BASE_URL ? `${WEB_PUBLIC_BASE_URL}/opret-klasse` : 'http://MacBook-Air-tilhrende-Chris.local/studenter-app/public/opret-klasse');
const STUDOS_SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@studos.dk';
const WEB_SITE_URL =
  process.env.EXPO_PUBLIC_WEBSITE_URL
  ?? (WEB_PUBLIC_BASE_URL
    ? WEB_PUBLIC_BASE_URL
    : CREATE_CLASS_URL.replace(/\/opret-klasse\/?$/, '').replace(/\/$/, ''));
const STUDOS_TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? `${WEB_SITE_URL}/#det-med-smaat`;
const STUDOS_PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? `${WEB_SITE_URL}/#det-med-smaat`;
const EXPLICIT_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const LOCAL_API_BASE_URLS = [
  'http://MacBook-Air-tilhrende-Chris.local/studenter-app/public/api',
  'http://10.171.168.162/studenter-app/public/api',
  'http://localhost/studenter-app/public/api',
  'http://127.0.0.1/studenter-app/public/api',
];
const WEB_API_BASE_URL = WEB_PUBLIC_BASE_URL ? `${WEB_PUBLIC_BASE_URL}/api` : null;
const FALLBACK_CLOUD_API_BASE_URL = process.env.EXPO_PUBLIC_CLOUD_API_URL ?? 'https://studos.laravel.cloud/api';
const API_BASE_URLS = (EXPLICIT_API_BASE_URL
  ? [EXPLICIT_API_BASE_URL]
  : IS_WEB
    ? [WEB_API_BASE_URL]
    : [...LOCAL_API_BASE_URLS, FALLBACK_CLOUD_API_BASE_URL]
).filter(Boolean);
const UNIQUE_API_BASE_URLS = Array.from(new Set(API_BASE_URLS));
const REVERB_APP_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? 'studos-local-key';
const REVERB_HOST = process.env.EXPO_PUBLIC_REVERB_HOST ?? 'MacBook-Air-tilhrende-Chris.local';
const REVERB_PORT = Number(process.env.EXPO_PUBLIC_REVERB_PORT ?? 8080);
const REVERB_SCHEME = process.env.EXPO_PUBLIC_REVERB_SCHEME ?? 'http';
const REVERB_FORCE_TLS = REVERB_SCHEME === 'https' || REVERB_PORT === 443;
const STUDOS_THEME = {
  blue: '#75DED0',
  yellow: '#FFD46D',
  red: '#FF6F73',
  ink: '#172143',
};
const APP_TABS = [
  { id: 'calendar', label: 'Kalender', icon: 'calendar-outline', activeIcon: 'calendar', accentColor: STUDOS_THEME.blue },
  { id: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses', accentColor: STUDOS_THEME.red },
  { id: 'overview', label: 'Overblik', icon: 'home-outline', activeIcon: 'home' },
  { id: 'challenges', label: 'Duel', icon: 'flash-outline', activeIcon: 'flash', accentColor: STUDOS_THEME.red },
  { id: 'walls', label: 'Galleri', icon: 'images-outline', activeIcon: 'images', accentColor: STUDOS_THEME.yellow },
];
const CHAT_THREAD_BACK_SWIPE_ACTIVATION_DISTANCE = 18;
const CHAT_THREAD_BACK_SWIPE_DISTANCE = 72;
const CHAT_THREAD_BACK_SWIPE_FAST_DISTANCE = 48;
const CHAT_THREAD_BACK_SWIPE_VELOCITY = 0.26;
const CHAT_THREAD_BACK_SWIPE_VERTICAL_RATIO = 1.18;
const APP_DRAWER_SECTIONS = [
  {
    title: 'Din klasse',
    items: [
      { id: 'earnCaps', label: 'Optjen Caps', icon: 'sparkles-outline', activeIcon: 'sparkles', accentColor: STUDOS_THEME.yellow },
      { id: 'classBattle', label: 'Leaderboard', icon: 'podium-outline', activeIcon: 'podium', accentColor: STUDOS_THEME.yellow },
      { id: 'moodBoard', label: 'Stemningstavle', icon: 'happy-outline', activeIcon: 'happy', accentColor: STUDOS_THEME.yellow },
      { id: 'badges', label: 'Klasseawards', icon: 'ribbon-outline', activeIcon: 'ribbon', accentColor: STUDOS_THEME.yellow },
      { id: 'randomizer', label: 'Arcade Hub', icon: 'shuffle-outline', activeIcon: 'shuffle', accentColor: STUDOS_THEME.red },
      { id: 'activities', label: 'Aktiviteter', icon: 'pulse-outline', activeIcon: 'pulse', accentColor: STUDOS_THEME.blue },
    ],
  },
];

const GLOBAL_CLASS_BATTLE_PREVIEW_CLASSES = [
  { id: 'preview-3a', className: '3.A', schoolName: 'Århus Gymnasium', score: 18420, movement: '+2' },
  { id: 'preview-2b', className: '2.B', schoolName: 'Nørre Campus', score: 16880, movement: '+1' },
  { id: 'preview-3x', className: '3.X', schoolName: 'Køge HHX', score: 15460, movement: '-1' },
  { id: 'preview-2g', className: '2.G', schoolName: 'Roskilde Gymnasium', score: 13990, movement: 'ny' },
  { id: 'preview-3c', className: '3.C', schoolName: 'Viby Handelsgymnasium', score: 12630, movement: '-2' },
];

const emptyProfile = {
  schoolId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
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

const formatProfileDate = (value) => {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return 'Ikke angivet';
  }

  const dateFromYmd = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateFromYmd
    ? new Date(Number(dateFromYmd[1]), Number(dateFromYmd[2]) - 1, Number(dateFromYmd[3]))
    : new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return 'Ikke angivet';
  }

  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const PROFILE_ROLE_LABELS = {
  owner: 'Ejer',
  moderator: 'Moderator',
  student: 'Elev',
};

const PROFILE_STATUS_LABELS = {
  active: 'Aktiv',
  pending: 'Afventer',
  removed: 'Fjernet',
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
    coverImageTemplateId: '',
    coverImageMode: 'none',
    inviteScope: 'class',
    invitedMemberIds: [],
  };
};

const CALENDAR_WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const CALENDAR_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => `${index}`.padStart(2, '0'));
const CALENDAR_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => `${index}`.padStart(2, '0'));
const CALENDAR_TIME_WHEEL_ITEM_HEIGHT = 36;
const CALENDAR_DAY_RAIL_ITEM_WIDTH = 44;
const CALENDAR_DAY_RAIL_GAP = 4;
const CALENDAR_ATTENDEE_STACK_LIMIT = 7;
const CALENDAR_INVITE_SCOPE_OPTIONS = [
  { id: 'class', label: 'Hele klassen', icon: 'school' },
  { id: 'crew', label: 'Mit crew', icon: 'people' },
  { id: 'custom', label: 'Vælg personer', icon: 'person-add' },
];
const EVENT_COVER_TEMPLATES = [
  {
    id: 'sunset',
    label: 'Sommergilde',
    backgroundColor: '#FFE1B1',
    softColor: '#FFF4D8',
    accentColor: '#FF6F73',
    deepColor: '#172143',
    lineColor: '#75DED0',
    uploadAsset: require('./assets/event-cover-sunset.png'),
  },
  {
    id: 'cap',
    label: 'Dimission',
    backgroundColor: '#F7FAFA',
    softColor: '#BDEFE8',
    accentColor: '#172143',
    deepColor: '#75DED0',
    lineColor: '#FFD46D',
    uploadAsset: require('./assets/event-cover-cap.png'),
  },
  {
    id: 'night',
    label: 'Natfest',
    backgroundColor: '#172143',
    softColor: '#5C7E83',
    accentColor: '#FF6F73',
    deepColor: '#FFD46D',
    lineColor: '#BDEFE8',
    uploadAsset: require('./assets/event-cover-night.png'),
  },
  {
    id: 'garden',
    label: 'Havefest',
    backgroundColor: '#BDEFE8',
    softColor: '#F7FAFA',
    accentColor: '#75DED0',
    deepColor: '#172143',
    lineColor: '#FF9DA0',
    uploadAsset: require('./assets/event-cover-garden.png'),
  },
  {
    id: 'gold',
    label: 'Guldtime',
    backgroundColor: '#FFF4D8',
    softColor: '#FFD46D',
    accentColor: '#172143',
    deepColor: '#FF6F73',
    lineColor: '#75DED0',
    uploadAsset: require('./assets/event-cover-gold.png'),
  },
];

const eventCoverTemplateFor = (templateId) => (
  EVENT_COVER_TEMPLATES.find((template) => template.id === templateId) ?? null
);

const dataUrlFromBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const eventCoverTemplateUploadData = async (templateId) => {
  const template = eventCoverTemplateFor(templateId);

  if (!template?.uploadAsset) {
    return '';
  }

  const asset = Asset.fromModule(template.uploadAsset);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;

  if (!uri) {
    return '';
  }

  if (IS_WEB) {
    const response = await fetch(uri);
    const blob = await response.blob();

    return dataUrlFromBlob(blob);
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return `data:image/png;base64,${base64}`;
};

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
const addCalendarYears = (date, count) => new Date(date.getFullYear() + count, date.getMonth(), 1, 12);

const calendarDayKeysForMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => (
    formatInputDate(new Date(year, month, index + 1, 12))
  ));
};

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

const calendarDayKeyFor = (value) => {
  const text = String(value ?? '');

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const date = text ? new Date(text) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return formatInputDate(date);
};

const eventDayKeyFor = (event) => calendarDayKeyFor(event?.date ?? event?.startsAt);

const addCalendarDays = (date, count) => {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  nextDate.setDate(nextDate.getDate() + count);

  return nextDate;
};

const compareCalendarDayKeys = (first, second) => (
  Date.parse(`${first}T12:00:00`) - Date.parse(`${second}T12:00:00`)
);

const localCalendarTimestamp = (dayKey, time, endOfDay = false) => {
  const dayMatch = String(dayKey ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time ?? '').match(/^(\d{2}):(\d{2})$/);

  if (!dayMatch || (!timeMatch && !endOfDay)) {
    return Number.NaN;
  }

  const [, rawYear, rawMonth, rawDay] = dayMatch;
  const hour = endOfDay ? 23 : Number(timeMatch[1]);
  const minute = endOfDay ? 59 : Number(timeMatch[2]);
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const parsed = new Date(
    Number(rawYear),
    Number(rawMonth) - 1,
    Number(rawDay),
    hour,
    minute,
    second,
    millisecond,
  ).getTime();

  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const eventLocalStartsAtTime = (event) => {
  const dayKey = eventDayKeyFor(event);
  const eventTime = formatCalendarTime(event?.startsAt);
  const localTime = localCalendarTimestamp(dayKey, eventTime);

  if (Number.isFinite(localTime)) {
    return localTime;
  }

  const startsAt = event?.startsAt;

  if (startsAt) {
    const parsed = Date.parse(startsAt);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

const eventPastCutoffTime = (event) => {
  const startsAtTime = eventLocalStartsAtTime(event);

  if (Number.isFinite(startsAtTime)) {
    return startsAtTime;
  }

  const dayKey = eventDayKeyFor(event);
  const endOfDayTime = localCalendarTimestamp(dayKey, '', true);

  return Number.isFinite(endOfDayTime) ? endOfDayTime : Number.POSITIVE_INFINITY;
};

const eventIsPast = (event, nowMs = Date.now()) => {
  const cutoffTime = eventPastCutoffTime(event);

  return Number.isFinite(cutoffTime) && cutoffTime <= nowMs;
};

const calendarDayKeysBetween = (startKey, endKey) => {
  const start = dateFromInput(startKey);
  const end = dateFromInput(endKey);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const dayKeys = [];
  let current = start;

  while (current.getTime() <= end.getTime()) {
    dayKeys.push(formatInputDate(current));
    current = addCalendarDays(current, 1);
  }

  return dayKeys;
};

const formatCalendarRailWeekday = (date) => new Intl.DateTimeFormat('da-DK', {
  weekday: 'short',
}).format(date).replace('.', '');

const formatCalendarRailMonth = (date) => new Intl.DateTimeFormat('da-DK', {
  month: 'short',
}).format(date).replace('.', '');

const capitalizeCalendarLabel = (value) => (
  value ? `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}` : value
);

const defaultCalendarDayForMonth = (monthDate, events = [], todayKey) => {
  const monthDayKeys = calendarDayKeysForMonth(monthDate);
  const upcomingEventInMonth = events.find((event) => {
    const dayKey = eventDayKeyFor(event);

    return monthDayKeys.includes(dayKey) && compareCalendarDayKeys(dayKey, todayKey) >= 0;
  });

  if (upcomingEventInMonth) {
    return eventDayKeyFor(upcomingEventInMonth);
  }

  const eventInMonth = events.find((event) => monthDayKeys.includes(eventDayKeyFor(event)));

  if (monthDayKeys.includes(todayKey)) {
    return todayKey;
  }

  return eventDayKeyFor(eventInMonth) || monthDayKeys[0] || todayKey;
};

const isSameCalendarMonth = (firstDate, secondDate) => (
  firstDate.getFullYear() === secondDate.getFullYear()
  && firstDate.getMonth() === secondDate.getMonth()
);

const calendarRailOffsetForDayIndex = (dayIndex, railWidth) => {
  const itemCenter = APP_SCREEN_PADDING
    + (dayIndex * (CALENDAR_DAY_RAIL_ITEM_WIDTH + CALENDAR_DAY_RAIL_GAP))
    + (CALENDAR_DAY_RAIL_ITEM_WIDTH / 2);

  return Math.max(0, itemCenter - (railWidth / 2));
};

const calendarRailDayKeysFor = (eventDayKeys = [], selectedDayKey, todayKey) => {
  const anchorDayKeys = uniqueByKey(
    [todayKey, selectedDayKey, ...eventDayKeys].filter(Boolean),
    (dayKey) => dayKey,
  ).sort(compareCalendarDayKeys);

  if (!anchorDayKeys.length) {
    return calendarDayKeysForMonth(new Date());
  }

  const firstAnchor = anchorDayKeys[0];
  const lastAnchor = anchorDayKeys[anchorDayKeys.length - 1];
  const startKey = formatInputDate(addCalendarDays(dateFromInput(firstAnchor), -7));
  const endKey = formatInputDate(addCalendarDays(dateFromInput(lastAnchor), 7));

  return calendarDayKeysBetween(startKey, endKey);
};

const eventSortTime = (event) => {
  const startsAtTime = eventLocalStartsAtTime(event);

  if (Number.isFinite(startsAtTime)) {
    return startsAtTime;
  }

  const day = eventDayKeyFor(event);
  const dayStartTime = localCalendarTimestamp(day, '00:00');

  return Number.isFinite(dayStartTime) ? dayStartTime : Number.MAX_SAFE_INTEGER;
};

const uniqueByKey = (items = [], keyFor) => {
  const seen = new Set();

  return (items ?? []).filter((item, index) => {
    const rawKey = keyFor(item, index);

    if (rawKey === null || rawKey === undefined || rawKey === '') {
      return true;
    }

    const key = String(rawKey);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const uniqueById = (items = []) => uniqueByKey(items, (item) => item?.id);

const calendarDraftFromEvent = (event, activeMemberId) => {
  const activeMemberKey = String(activeMemberId ?? '');
  const invitedMemberIds = uniqueByKey(event?.invitees ?? [], (person) => person?.memberId ?? person?.id)
    .map((person) => String(person?.memberId ?? person?.id ?? ''))
    .filter((memberId) => memberId && memberId !== activeMemberKey);

  return {
    ...createCalendarDraft(),
    title: event?.title ?? '',
    eventDate: eventDayKeyFor(event) || formatInputDate(new Date()),
    eventTime: formatCalendarTime(event?.startsAt) || '19:00',
    location: event?.location ?? '',
    description: event?.description ?? '',
    coverImageUri: event?.coverImageUrl ?? '',
    coverImageData: '',
    coverImageTemplateId: event?.coverImageTemplateId ?? '',
    coverImageMode: event?.coverImageTemplateId ? 'template' : (event?.coverImageUrl ? 'upload' : 'none'),
    inviteScope: event?.inviteScope ?? 'class',
    invitedMemberIds,
  };
};

function EventCoverTemplateArt({ templateId, style }) {
  const template = eventCoverTemplateFor(templateId) ?? EVENT_COVER_TEMPLATES[0];

  return (
    <View style={[
      styles.eventCoverTemplateArt,
      style,
      { backgroundColor: template.backgroundColor },
    ]}>
      <View style={[
        styles.eventCoverTemplateSoftBlock,
        { backgroundColor: template.softColor },
      ]} />
      <View style={[
        styles.eventCoverTemplateAccentBlock,
        { backgroundColor: template.accentColor },
      ]} />
      <View style={[
        styles.eventCoverTemplateDeepCircle,
        { backgroundColor: template.deepColor },
      ]} />
      <View style={[
        styles.eventCoverTemplateLine,
        { backgroundColor: template.lineColor },
      ]} />
      <View style={[
        styles.eventCoverTemplateSmallMark,
        { backgroundColor: template.lineColor },
      ]} />
    </View>
  );
}

const mergeUniqueById = (items = [], nextItem) => {
  if (!nextItem?.id) {
    return uniqueById(nextItem ? [...(items ?? []), nextItem] : items);
  }

  let replaced = false;
  const merged = (items ?? []).map((item) => {
    if (item?.id === nextItem.id) {
      replaced = true;
      return nextItem;
    }

    return item;
  });

  if (!replaced) {
    merged.push(nextItem);
  }

  return uniqueById(merged);
};

const moduleDefault = (module) => module?.default ?? module;

const resolvePusherClient = (module) => (
  module?.default?.Pusher
  ?? module?.Pusher
  ?? module?.default
  ?? module
);

const formatMoodUpdatedAt = (date = new Date()) => new Intl.DateTimeFormat('da-DK', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(date);

const moodDayKeyFor = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
};

const dayNumberForDayKey = (dayKey) => {
  const [year, month, day] = String(dayKey ?? '').split('-').map((part) => Number(part));

  if (!year || !month || !day) {
    return null;
  }

  return Math.floor(new Date(year, month - 1, day).getTime() / 86400000);
};

const millisecondsUntilNextMidnight = (date = new Date()) => {
  const nextMidnight = new Date(date);

  nextMidnight.setHours(24, 0, 0, 0);

  return Math.max(1000, nextMidnight.getTime() - date.getTime());
};

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

  return errors[0] || payload?.message || 'Noget gik galt. Prøv igen.';
};

const isInviteCodeRequiredError = (message) => {
  const normalized = String(message ?? '').toLowerCase();

  return /invite\s*code/.test(normalized) && (
    normalized.includes('field is required')
    || normalized.includes('is required')
    || normalized.includes('skal angives')
    || normalized.includes('er påkrævet')
  );
};

const shouldRetryInviteErrorOnNextApi = (path, error) =>
  path === '/session/login'
  && isInviteCodeRequiredError(error?.message);

const apiFetch = async (path, options = {}) => {
  const { authToken, headers: optionHeaders, ...fetchOptions } = options;
  let lastError = null;

  for (let index = 0; index < UNIQUE_API_BASE_URLS.length; index += 1) {
    const baseUrl = UNIQUE_API_BASE_URLS[index];

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

      if (error.status && !shouldRetryInviteErrorOnNextApi(path, error)) {
        throw error;
      }

      if (error.status && index === UNIQUE_API_BASE_URLS.length - 1) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('API kunne ikke nås.');
};

const androidNotificationProjectId = (constants) =>
  constants?.expoConfig?.extra?.eas?.projectId
  ?? constants?.easConfig?.projectId
  ?? constants?.manifest2?.extra?.eas?.projectId
  ?? constants?.manifest?.extra?.eas?.projectId
  ?? STUDOS_EAS_PROJECT_ID;

const androidAppVariant = (constants) => {
  if (constants?.expoConfig?.name === 'Studos-dev') {
    return 'development';
  }

  return process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || 'local';
};

const ensureAndroidNotificationChannelAsync = async () => {
  if (!ANDROID_NOTIFICATIONS_ENABLED) {
    return;
  }

  const notifications = loadAndroidNotificationsModule();

  if (!notifications) {
    throw new Error('Android builden mangler Expo notification-runtime. Installer nyeste Android build og start Metro igen med clear cache.');
  }

  if (!configureAndroidNotificationHandler(notifications)) {
    throw new Error('Android notification-runtime kunne ikke startes i denne build.');
  }

  await notifications.setNotificationChannelAsync(STUDOS_NOTIFICATION_CHANNEL_ID, {
    name: 'Studos',
    importance: notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EF7476',
  });
};

const registerForAndroidPushNotificationsAsync = async () => {
  if (!ANDROID_NOTIFICATIONS_ENABLED) {
    return {
      supported: false,
      message: 'Push-notifikationer er kun slået til for Android lige nu.',
    };
  }

  await ensureAndroidNotificationChannelAsync();

  const notifications = loadAndroidNotificationsModule();
  const device = loadAndroidDeviceModule();
  const constants = loadAndroidConstantsModule();

  if (!notifications || !device || !constants) {
    return {
      supported: false,
      message: 'Android push kræver en ny build med notification-modulerne.',
    };
  }

  if (!device.isDevice) {
    return {
      supported: false,
      message: 'Android push kræver en fysisk enhed, ikke emulator.',
    };
  }

  const existingPermission = await notifications.getPermissionsAsync();
  let permissionStatus = existingPermission.status;

  if (permissionStatus !== 'granted') {
    const requestedPermission = await notifications.requestPermissionsAsync();
    permissionStatus = requestedPermission.status;
  }

  if (permissionStatus !== 'granted') {
    return {
      supported: true,
      permissionStatus,
      message: 'Notifikationer blev ikke tilladt på enheden.',
    };
  }

  const projectId = androidNotificationProjectId(constants);

  if (!projectId) {
    throw new Error('Expo projectId mangler i app-konfigurationen.');
  }

  const pushToken = await notifications.getExpoPushTokenAsync({ projectId });

  return {
    supported: true,
    permissionStatus,
    projectId,
    expoPushToken: pushToken.data,
    deviceName: device.deviceName || device.modelName || 'Android',
    appVariant: androidAppVariant(constants),
    nativeApplicationVersion: constants?.expoConfig?.version ?? null,
    nativeBuildVersion: constants?.nativeBuildVersion ?? null,
  };
};

const createChatEcho = (authToken) => {
  const isWeb = Platform.OS === 'web';

  if (!isWeb && !NativeModules?.RNCNetInfo) {
    return null;
  }

  try {
    const EchoModule = require('laravel-echo');
    const PusherModule = isWeb ? require('pusher-js') : require('pusher-js/react-native');
    const EchoClient = moduleDefault(EchoModule);
    const PusherClient = resolvePusherClient(PusherModule);

    if (typeof EchoClient !== 'function' || typeof PusherClient !== 'function') {
      throw new Error('Chat realtime client is not available in this runtime.');
    }

    globalThis.Pusher = PusherClient;

    if (typeof window !== 'undefined') {
      window.Pusher = PusherClient;
    }

    return new EchoClient({
      broadcaster: 'reverb',
      key: REVERB_APP_KEY,
      Pusher: PusherClient,
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
    if (!chatRealtimeFallbackLogged) {
      chatRealtimeFallbackLogged = true;
      console.log('Chat realtime fallback polling active.', error?.message ?? error);
    }

    return null;
  }
};

const chatUnreadCountForConversations = (conversations = []) =>
  conversations.reduce((total, conversation) => {
    const unreadCount = Number(conversation?.unreadCount ?? 0);

    return total + (Number.isFinite(unreadCount) ? unreadCount : 0);
  }, 0);

const formatUnreadBadgeCount = (count) => (count > 99 ? '99+' : String(count));

const profileFromMember = (member) => ({
  firstName: member?.firstName ?? '',
  lastName: member?.lastName ?? '',
  email: member?.email ?? '',
  phone: member?.phone ?? '',
  emergencyContactName: member?.emergencyContactName ?? '',
  emergencyContactPhone: member?.emergencyContactPhone ?? '',
  birthday: member?.birthday ?? '',
  profilePhotoUrl: member?.profilePhotoUrl ?? '',
});

export default function App() {
  const { height: viewportHeight } = useWindowDimensions();
  const [step, setStep] = useState('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [schoolClass, setSchoolClass] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [session, setSession] = useState(null);
  const [existingLogin, setExistingLogin] = useState({ email: '', password: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [calendarFocusTarget, setCalendarFocusTarget] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [pendingDirectChatMemberId, setPendingDirectChatMemberId] = useState('');
  const [notificationPromptVisible, setNotificationPromptVisible] = useState(false);
  const [weeklyCheckInReward, setWeeklyCheckInReward] = useState(null);
  const [weeklyCheckInSnapshot, setWeeklyCheckInSnapshot] = useState(null);
  const [notificationState, setNotificationState] = useState({
    expoPushToken: '',
    permissionStatus: 'unknown',
    registeredAt: '',
    message: ANDROID_NOTIFICATIONS_ENABLED
      ? 'Android push er ikke aktiveret på denne enhed endnu.'
      : 'Push-notifikationer er kun slået til for Android lige nu.',
    error: '',
    loading: false,
    testLoading: false,
  });
  const appScrollRef = useRef(null);
  const weeklyCheckInAutoRef = useRef('');

  const activeClass = schoolClass ?? session?.class;
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
  const appContentDetached = activeTab === 'chat'
    || activeTab === 'calendar'
    || activeTab === 'overview'
    || activeTab === 'earnCaps'
    || activeTab === 'classBattle'
    || activeTab === 'classmates';

  const scrollAppToTop = useCallback(() => {
    requestAnimationFrame(() => {
      appScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, []);

  const openCalendar = useCallback((target = null) => {
    const eventId = target?.eventId ? String(target.eventId) : '';
    const dayKey = target?.dayKey || '';

    if (eventId || dayKey) {
      setCalendarFocusTarget({
        eventId,
        dayKey,
        requestId: `${Date.now()}-${eventId || dayKey}`,
      });
    }

    setActiveTab('calendar');
  }, []);

  const openDirectChatForMember = useCallback((memberId) => {
    const normalizedMemberId = String(memberId ?? '').trim();

    if (!normalizedMemberId || !session?.token) {
      return;
    }

    setPendingDirectChatMemberId(normalizedMemberId);
    setActiveTab('chat');
  }, [session?.token]);

  const clearPendingDirectChatMemberId = useCallback(() => {
    setPendingDirectChatMemberId('');
  }, []);

  const updateActiveMemberCapsBalance = useCallback((capsBalance) => {
    const nextCapsBalance = Number(capsBalance);

    if (!Number.isFinite(nextCapsBalance) || !session?.member?.id) {
      return;
    }

    setSession((current) => {
      if (!current?.member) {
        return current;
      }

      return {
        ...current,
        member: {
          ...current.member,
          capsBalance: nextCapsBalance,
        },
      };
    });
    setSchoolClass((current) => {
      if (!current?.members) {
        return current;
      }

      return {
        ...current,
        members: current.members.map((member) => (
          String(member.id) === String(session.member.id)
            ? { ...member, capsBalance: nextCapsBalance }
            : member
        )),
      };
    });
  }, [session?.member?.id]);

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

  useEffect(() => {
    if (
      !ANDROID_NOTIFICATIONS_ENABLED
      || (!notificationState.expoPushToken && notificationState.permissionStatus !== 'granted')
    ) {
      return undefined;
    }

    const notifications = loadAndroidNotificationsModule();

    if (!notifications || !configureAndroidNotificationHandler(notifications)) {
      return undefined;
    }

    let receivedSubscription = null;
    let responseSubscription = null;

    try {
      receivedSubscription = notifications.addNotificationReceivedListener((notification) => {
        const title = notification?.request?.content?.title ?? 'Notifikation modtaget';

        setNotificationState((current) => ({
          ...current,
          message: `Senest modtaget: ${title}`,
        }));
      });
      responseSubscription = notifications.addNotificationResponseReceivedListener((response) => {
        const targetScreen = response?.notification?.request?.content?.data?.screen;

        if (targetScreen === 'chat' || targetScreen === 'calendar' || targetScreen === 'overview' || targetScreen === 'classBattle') {
          setActiveTab(targetScreen);
        }
      });
    } catch (error) {
      console.warn('Android notification listeners could not be registered.', error);
      return undefined;
    }

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [notificationState.expoPushToken, notificationState.permissionStatus]);

  useEffect(() => {
    let isMounted = true;

    if (
      !ANDROID_NOTIFICATIONS_ENABLED
      || step !== 'overview'
      || !session?.token
      || notificationState.expoPushToken
      || notificationState.permissionStatus === 'granted'
    ) {
      return () => {
        isMounted = false;
      };
    }

    SessionStore.getItemAsync(ANDROID_NOTIFICATION_PROMPT_STORAGE_KEY)
      .then((promptSeen) => {
        if (isMounted && promptSeen !== 'seen') {
          setNotificationPromptVisible(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotificationPromptVisible(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [notificationState.expoPushToken, notificationState.permissionStatus, session?.token, step]);

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

  useEffect(() => {
    if (step !== 'overview' || !session?.member?.id || !session?.token) {
      return undefined;
    }

    const dayKey = moodDayKeyFor();
    const autoCheckInKey = `${session.member.id}:${dayKey}`;

    if (weeklyCheckInAutoRef.current === autoCheckInKey) {
      return undefined;
    }

    weeklyCheckInAutoRef.current = autoCheckInKey;

    let cancelled = false;

    apiFetch('/check-ins/weekly', {
      authToken: session.token,
      method: 'POST',
    })
      .then(async (data) => {
        if (cancelled) {
          return;
        }

        const weeklyCheckIn = data?.weeklyCheckIn ?? {};
        const awardedCaps = Number(data?.awardedCaps ?? weeklyCheckIn?.awardedCaps ?? 0);
        const capsBalance = Number(weeklyCheckIn?.capsBalance);

        setWeeklyCheckInSnapshot(weeklyCheckIn);

        if (Number.isFinite(capsBalance)) {
          setSession((current) => {
            if (!current?.member) {
              return current;
            }

            return {
              ...current,
              member: {
                ...current.member,
                capsBalance,
              },
            };
          });
          setSchoolClass((current) => {
            if (!current?.members) {
              return current;
            }

            return {
              ...current,
              members: current.members.map((member) => (
                String(member.id) === String(session.member.id)
                  ? { ...member, capsBalance }
                  : member
              )),
            };
          });
        }

        if (awardedCaps > 0) {
          setWeeklyCheckInReward({
            amount: awardedCaps,
            streak: Number(weeklyCheckIn?.streak) || 7,
          });
        }
      })
      .catch(() => {
        weeklyCheckInAutoRef.current = '';
      });

    return () => {
      cancelled = true;
    };
  }, [session?.member?.id, session?.token, step]);

  useEffect(() => {
    let isMounted = true;
    const token = session?.token;

    if (!token || step !== 'overview') {
      setChatUnreadCount(0);

      return () => {
        isMounted = false;
      };
    }

    const refreshChatUnreadCount = async () => {
      try {
        const data = await apiFetch('/chat/conversations', {
          authToken: token,
        });

        if (isMounted) {
          setChatUnreadCount(chatUnreadCountForConversations(data.conversations ?? []));
        }
      } catch {
        // The chat screen surfaces fetch errors; the footer badge should stay quiet.
      }
    };

    refreshChatUnreadCount();
    const interval = setInterval(refreshChatUnreadCount, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session?.token, step]);

  const clearSession = async () => {
    await SessionStore.deleteItemAsync(SESSION_STORAGE_KEY);
    setSession(null);
    setSchoolClass(null);
    setProfile(emptyProfile);
    setInviteCode('');
    setExistingLogin({ email: '', password: '' });
    setActiveTab('overview');
    setSidebarOpen(false);
    setChatUnreadCount(0);
    setWeeklyCheckInSnapshot(null);
    setWeeklyCheckInReward(null);
    setNotificationState((current) => ({
      ...current,
      error: '',
      message: ANDROID_NOTIFICATIONS_ENABLED
        ? 'Android push er ikke aktiveret på denne enhed endnu.'
        : 'Push-notifikationer er kun slået til for Android lige nu.',
    }));
    setError('');
    setStep('invite');
  };

  const enableAndroidNotifications = useCallback(async () => {
    if (!session?.token) {
      setNotificationState((current) => ({
        ...current,
        error: 'Login mangler.',
      }));
      return;
    }

    setNotificationState((current) => ({
      ...current,
      error: '',
      loading: true,
      message: 'Gør Android push klar...',
    }));

    try {
      const registration = await registerForAndroidPushNotificationsAsync();

      if (!registration.expoPushToken) {
        setNotificationState((current) => ({
          ...current,
          error: registration.message ?? 'Kunne ikke hente Expo push token.',
          loading: false,
          permissionStatus: registration.permissionStatus ?? current.permissionStatus,
        }));
        return;
      }

      await apiFetch('/notifications/push-token', {
        authToken: session.token,
        method: 'POST',
        body: JSON.stringify({
          expoPushToken: registration.expoPushToken,
          platform: 'android',
          deviceName: registration.deviceName,
          projectId: registration.projectId,
          appVariant: registration.appVariant,
          nativeApplicationVersion: registration.nativeApplicationVersion,
          nativeBuildVersion: registration.nativeBuildVersion,
        }),
      });

      setNotificationState((current) => ({
        ...current,
        expoPushToken: registration.expoPushToken,
        permissionStatus: registration.permissionStatus,
        registeredAt: new Date().toISOString(),
        error: '',
        loading: false,
        message: 'Android push er aktiv og token er gemt.',
      }));
    } catch (notificationError) {
      setNotificationState((current) => ({
        ...current,
        error: notificationError.message || 'Android push kunne ikke aktiveres.',
        loading: false,
      }));
    }
  }, [session?.token]);

  const closeAndroidNotificationPrompt = useCallback(async () => {
    setNotificationPromptVisible(false);
    await SessionStore.setItemAsync(ANDROID_NOTIFICATION_PROMPT_STORAGE_KEY, 'seen');
  }, []);

  const enableAndroidNotificationsFromPrompt = useCallback(async () => {
    setNotificationPromptVisible(false);
    await SessionStore.setItemAsync(ANDROID_NOTIFICATION_PROMPT_STORAGE_KEY, 'seen');
    await enableAndroidNotifications();
  }, [enableAndroidNotifications]);

  const sendAndroidNotificationTest = useCallback(async () => {
    if (!session?.token) {
      setNotificationState((current) => ({
        ...current,
        error: 'Login mangler.',
      }));
      return;
    }

    setNotificationState((current) => ({
      ...current,
      error: '',
      testLoading: true,
      message: 'Sender testnotifikation...',
    }));

    try {
      const data = await apiFetch('/notifications/test', {
        authToken: session.token,
        method: 'POST',
        body: JSON.stringify({
          title: 'Studos tester lige 🔔',
          body: 'Hvis den her lander på Android, er push-vejen åben.',
        }),
      });

      setNotificationState((current) => ({
        ...current,
        error: '',
        testLoading: false,
        message: data.message ?? 'Testnotifikation sendt.',
      }));
    } catch (notificationError) {
      setNotificationState((current) => ({
        ...current,
        error: notificationError.message || 'Testnotifikationen kunne ikke sendes.',
        testLoading: false,
      }));
    }
  }, [session?.token]);

  const submitInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();

    if (!code) {
      setError('Indtast invitekode for at fortsætte.');
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
      const normalizedClassSchoolName = String(data.class?.schoolName ?? '').trim().toLocaleLowerCase('da-DK');
      const inferredSchoolId = data.class?.schoolId
        || schools.find((school) => String(school.name ?? '').trim().toLocaleLowerCase('da-DK') === normalizedClassSchoolName)?.id
        || '';
      const resolvedSchoolName = !!data.class?.schoolName;

      if (!inferredSchoolId) {
        setError(resolvedSchoolName
          ? 'Skolen for denne invitekode kunne ikke matches automatisk. Prøv igen eller kontakt support.'
          : 'Invitekoden mangler skoleoplysninger.');
        return;
      }

      setInviteCode(code);
      setSchoolClass(data.class);
      setProfile((current) => ({ ...current, schoolId: inferredSchoolId }));
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
      setError('Kunne ikke åbne klasseoprettelsen.');
    }
  };

  const showExistingLogin = () => {
    setExistingLogin({ email: '', password: '' });
    setError('');
    setStep('existingLogin');
  };

  const loginExistingProfile = async () => {
    const nextLogin = {
      email: existingLogin.email.trim().toLowerCase(),
      password: existingLogin.password,
    };
    const normalizedInviteCode = inviteCode.trim().toUpperCase();

    if (normalizedInviteCode) {
      nextLogin.inviteCode = normalizedInviteCode;
    }

    if (!nextLogin.email || !nextLogin.password) {
      setError('Indtast email og adgangskode.');
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
      setExistingLogin({ email: nextLogin.email, password: '' });
      setSession(data.session);
      setSchoolClass(data.class);
      setProfile(profileFromMember(data.session.member));
      setActiveTab('overview');
      setStep('overview');
    } catch (apiError) {
      const message = apiError?.message || 'Login mislykkedes.';
      setError(isInviteCodeRequiredError(message)
        ? 'Denne cloud-udgave kræver endnu invitekode. Prøv at skrive din invitekode, ellers brug en nyere App/Cloud-version.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  const pickProfilePhoto = async () => {
    setError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Studos skal have adgang til billeder for at vælge profilbillede.');
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
        body: JSON.stringify({ profilePhotoData }),
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

  const deleteCurrentAccount = async () => {
    if (!session?.token) {
      setError('Login mangler.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      await apiFetch('/members/me', {
        authToken: session.token,
        method: 'DELETE',
      });

      await clearSession();

      return true;
    } catch (apiError) {
      setError(apiError.message || 'Din konto kunne ikke slettes.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const syncActiveClass = async (nextClass) => {
    setSchoolClass(nextClass);

    if (session) {
      setSession((current) => (
        current?.class ? { ...current, class: nextClass } : current
      ));

      await storeSession({
        session: session.class ? { ...session, class: nextClass } : session,
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

  const updateCalendarEvent = async (eventId, eventPayload) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    const data = await apiFetch(`/events/${encodeURIComponent(eventId)}/update`, {
      authToken: session.token,
      method: 'POST',
      body: JSON.stringify(eventPayload),
    });

    if (data.class) {
      await syncActiveClass(data.class);
    }

    return data;
  };

  const deleteCalendarEvent = async (eventId) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    const data = await apiFetch(`/events/${encodeURIComponent(eventId)}/delete`, {
      authToken: session.token,
      method: 'POST',
    });

    if (data.class) {
      await syncActiveClass(data.class);
    }

    return data;
  };

  const reportCalendarEvent = async (eventId) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    return apiFetch(`/events/${encodeURIComponent(eventId)}/report`, {
      authToken: session.token,
      method: 'POST',
      body: JSON.stringify({
        reason: 'Begivenhed rapporteret',
        details: 'Rapporteret fra kalenderen i Studos.',
      }),
    });
  };

  const blockClassMember = async (memberId) => {
    if (!session?.token) {
      throw new Error('Login mangler.');
    }

    const data = await apiFetch(`/members/${encodeURIComponent(memberId)}/block`, {
      authToken: session.token,
      method: 'POST',
      body: JSON.stringify({
        reason: 'Blokeret fra kalender',
      }),
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
      emergencyContactName: profile.emergencyContactName.trim(),
      emergencyContactPhone: profile.emergencyContactPhone.trim(),
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
      setError('Udfyld navn, skole, email, fødselsdag og adgangskode.');
      return;
    }

    if (!nextProfile.termsAccepted || !nextProfile.privacyAccepted) {
      setError('Accepter vilkår og privatlivspolitik for at oprette profilen.');
      return;
    }

    if (nextProfile.password !== nextProfile.passwordConfirmation) {
      setError('Adgangskoderne skal være ens.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextProfile.birthday)) {
      setError('Skriv fødselsdag som YYYY-MM-DD.');
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
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingScreen}>
          <Image source={STUDOS_LOGO} style={styles.logoMark} />
          <ActivityIndicator color="#ef5b3f" />
        </View>
      </View>
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
                activeTab === 'overview' ? styles.appScreenDetached : null,
                activeTab === 'calendar' ? styles.appScreenDetached : null,
                activeTab === 'earnCaps' ? styles.appScreenDetached : null,
                activeTab === 'classmates' ? styles.appScreenCrewDetached : null,
                activeTab === 'classBattle' ? styles.appScreenClassBattleDetached : null,
                activeTab === 'calendar' ? styles.appScreenCalendarUnderFooter : null,
                activeTab === 'chat' ? styles.appScreenOverlayHost : null,
              ]}>
                <AppTabScreen
                  activeMember={activeMember}
                  activeMembers={activeMembers}
                  activeTab={activeTab}
                  calendarFocusTarget={calendarFocusTarget}
                  countdown={countdown}
                  error={error}
                  events={events}
                  loading={loading}
                  nextEvent={nextEvent}
                  onChatUnreadCountChange={setChatUnreadCount}
                  onDirectChatHandled={clearPendingDirectChatMemberId}
                  initialDirectChatMemberId={pendingDirectChatMemberId}
                  onChangeTab={setActiveTab}
                  onOpenDirectChat={openDirectChatForMember}
                  onOpenCalendar={openCalendar}
                  onCreateEvent={createCalendarEvent}
                  onDeleteEvent={deleteCalendarEvent}
                  onEnableAndroidNotifications={enableAndroidNotifications}
                  onBlockMember={blockClassMember}
                  onCapsBalanceChange={updateActiveMemberCapsBalance}
                  onProfilePhotoUpdate={updateCurrentProfilePhoto}
                  onLogout={clearSession}
                  onDeleteAccount={deleteCurrentAccount}
                  onRequestScrollTop={scrollAppToTop}
                  onReportEvent={reportCalendarEvent}
                  onRespondToEvent={respondToCalendarEvent}
                  onSendAndroidNotificationTest={sendAndroidNotificationTest}
                  onUpdateEvent={updateCalendarEvent}
                  pinnedContent={pinnedContent}
                  profile={profile}
                  schoolClass={activeClass}
                  sessionToken={session.token}
                  notificationState={notificationState}
                  weeklyCheckInSnapshot={weeklyCheckInSnapshot}
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
                  calendarFocusTarget={calendarFocusTarget}
                  countdown={countdown}
                  error={error}
                  events={events}
                  loading={loading}
                  nextEvent={nextEvent}
                  onChatUnreadCountChange={setChatUnreadCount}
                  onDirectChatHandled={clearPendingDirectChatMemberId}
                  initialDirectChatMemberId={pendingDirectChatMemberId}
                  onChangeTab={setActiveTab}
                  onOpenDirectChat={openDirectChatForMember}
                  onOpenCalendar={openCalendar}
                  onCreateEvent={createCalendarEvent}
                  onDeleteEvent={deleteCalendarEvent}
                  onEnableAndroidNotifications={enableAndroidNotifications}
                  onBlockMember={blockClassMember}
                  onCapsBalanceChange={updateActiveMemberCapsBalance}
                  onProfilePhotoUpdate={updateCurrentProfilePhoto}
                  onLogout={clearSession}
                  onDeleteAccount={deleteCurrentAccount}
                  onRequestScrollTop={scrollAppToTop}
                  onReportEvent={reportCalendarEvent}
                  onRespondToEvent={respondToCalendarEvent}
                  onSendAndroidNotificationTest={sendAndroidNotificationTest}
                  onUpdateEvent={updateCalendarEvent}
                  pinnedContent={pinnedContent}
                  profile={profile}
                  schoolClass={activeClass}
                  sessionToken={session.token}
                  notificationState={notificationState}
                  weeklyCheckInSnapshot={weeklyCheckInSnapshot}
                />
              </ScrollView>
            )}
            <FooterNav
              activeTab={activeTab}
              chatUnreadCount={chatUnreadCount}
              onChangeTab={setActiveTab}
            />
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
            <AndroidNotificationPromptModal
              loading={notificationState.loading}
              visible={notificationPromptVisible}
              onDismiss={closeAndroidNotificationPrompt}
              onEnable={enableAndroidNotificationsFromPrompt}
            />
            <WeeklyCheckInRewardModal
              reward={weeklyCheckInReward}
              visible={Boolean(weeklyCheckInReward)}
              onDismiss={() => setWeeklyCheckInReward(null)}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const isAuthEntryStep = step === 'invite' || step === 'existingLogin';

  return (
    <View style={isAuthEntryStep ? styles.safeAreaWhite : styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={isAuthEntryStep ? styles.keyboardViewWhite : styles.keyboardView}
      >
        {step === 'invite' ? (
          <View style={[styles.inviteScreenContainer, { height: viewportHeight, paddingHorizontal: 0 }]}>
            <InviteScreen
              error={error}
              inviteCode={inviteCode}
              loading={loading}
              onChangeInviteCode={(value) => setInviteCode(value.toUpperCase())}
              onCreateClass={openCreateClassPage}
              onExistingLogin={showExistingLogin}
              onSubmit={submitInviteCode}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={step === 'existingLogin' ? [styles.screen, styles.loginScreen] : styles.screen}
            keyboardShouldPersistTaps="handled"
          >
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
        )}
      </KeyboardAvoidingView>
    </View>
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
  const { height } = useWindowDimensions();
  const shellPadding = Math.max(12, Math.min(height * 0.08, 38));
  const contentOffset = Math.max(42, Math.min(height * 0.12, 92));

  return (
    <View style={[styles.inviteShell, { height, paddingTop: shellPadding, paddingBottom: shellPadding }]}>
      <View style={[styles.inviteMain, { marginTop: contentOffset }]}>
        <View style={styles.logoLockup}>
          <View style={styles.inviteLogoWrap}>
            <Image source={STUDOS_LOGO} style={styles.logoMark} />
          </View>
          <View style={styles.inviteWordmark}>
            <View style={styles.inviteWordmarkTextRow}>
              <Text numberOfLines={1} style={[styles.inviteWordmarkText, styles.inviteWordmarkTextLight]}>Stu</Text>
              <Text numberOfLines={1} style={styles.inviteWordmarkText}>dos</Text>
            </View>
            <View style={styles.inviteWordmarkUnderline} />
            <View style={styles.inviteWordmarkDot} />
          </View>
          <Text style={styles.inviteHeroText}>
            Indtast din invitekode, og kom i gang med din klasse på få sekunder.
          </Text>
        </View>

        <View style={styles.inviteFormCard}>
          <View style={styles.inviteForm}>
            <Text style={styles.inviteInputLabel}>Indtast invitekode</Text>
            <View style={styles.inviteInputWithIcon}>
              <View style={styles.inviteInputIconWrap}>
                <Ionicons name="key" size={18} color={STUDOS_THEME.red} />
              </View>
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
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inviteActionRow}>
            <Button label="Fortsæt til din klasse" loading={loading} onPress={onSubmit} />
          </View>

          <Pressable hitSlop={12} onPress={onExistingLogin} style={[styles.topLoginButton, { marginTop: 8 }]}>
            <Ionicons name="log-in-outline" size={14} color="#182446" />
            <Text style={styles.topLoginText}>Jeg har allerede en profil</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.createClassFooter}>
        <Pressable hitSlop={12} onPress={onCreateClass} style={styles.createClassLink}>
          <Text style={styles.createClassText}>Mangler din klasse?</Text>
          <View style={styles.createClassActionRow}>
            <Text style={styles.createClassAction}>Opret klassen her</Text>
            <Ionicons name="arrow-forward-outline" size={16} color="#ef5b3f" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function AppTabScreen({
  activeMember,
  activeMembers,
  activeTab,
  calendarFocusTarget,
  countdown,
  error,
  events,
  loading,
  nextEvent,
  initialDirectChatMemberId,
  onChatUnreadCountChange,
  onDirectChatHandled,
  onChangeTab,
  onOpenCalendar,
  onCreateEvent,
  onDeleteEvent,
  onEnableAndroidNotifications,
  onBlockMember,
  onCapsBalanceChange,
  onOpenDirectChat,
  onProfilePhotoUpdate,
  onLogout,
  onDeleteAccount,
  onRequestScrollTop,
  onReportEvent,
  onRespondToEvent,
  onSendAndroidNotificationTest,
  onUpdateEvent,
  pinnedContent,
  profile,
  schoolClass,
  sessionToken,
  notificationState,
  weeklyCheckInSnapshot,
}) {
  const [selectedMiniGame, setSelectedMiniGame] = useState(null);
  const openCalendarTab = (target) => {
    if (onOpenCalendar) {
      onOpenCalendar(target);
      return;
    }

    onChangeTab?.('calendar');
  };

  useEffect(() => {
    if (activeTab !== 'randomizer') {
      setSelectedMiniGame(null);
    }
  }, [activeTab]);

  if (activeTab === 'chat') {
    return (
      <ChatScreen
        activeMember={activeMember}
        activeMembers={activeMembers}
        schoolClass={schoolClass}
        sessionToken={sessionToken}
        initialDirectChatMemberId={initialDirectChatMemberId}
        onDirectChatHandled={onDirectChatHandled}
        onUnreadCountChange={onChatUnreadCountChange}
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
        onLogout={onLogout}
        onDeleteAccount={onDeleteAccount}
      />
    );
  }

  if (activeTab === 'walls') {
    return (
      <FeatureScreen
        icon="images"
        kicker={schoolClass.className}
        title="Galleri"
        emptyTitle="Galleriet er tomt endnu"
        emptyText="Billeder, minder og opslag fra klassen lander her."
      />
    );
  }

  if (activeTab === 'activities') {
    return (
      <FeatureScreen
        icon="pulse"
        kicker={schoolClass.className}
        title="Aktiviteter"
        emptyTitle="Ingen aktivitet endnu"
        emptyText="Nye opslag, billeder, challenges, Caps og klasseopdateringer samles her."
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
        focusTarget={calendarFocusTarget}
        events={events}
        onCreateEvent={onCreateEvent}
        onDeleteEvent={onDeleteEvent}
        onBlockMember={onBlockMember}
        onRequestScrollTop={onRequestScrollTop}
        onReportEvent={onReportEvent}
        onRespondToEvent={onRespondToEvent}
        onUpdateEvent={onUpdateEvent}
      />
    );
  }

  if (activeTab === 'wallet') {
    return (
      <FeatureScreen
        icon="wallet"
        locked
        kicker={schoolClass.className}
        title="Wallet"
        emptyTitle="Kommer snart"
        emptyText="Wallet åbner senere med rabatkort, elevbevis og fordele."
      />
    );
  }

  if (activeTab === 'bluebook') {
    return (
      <FeatureScreen
        icon="book"
        locked
        kicker={schoolClass.className}
        title="Blå bog"
        emptyTitle="Kommer snart"
        emptyText="Blå bog åbner senere med klasseprofiler, historier og de små legendariske detaljer."
      />
    );
  }

  if (activeTab === 'classBattle') {
    return (
      <ClassBattleScreen
        activeMember={activeMember}
        events={events}
        onOpenEarnCaps={() => onChangeTab?.('earnCaps')}
        schoolClass={schoolClass}
        sessionToken={sessionToken}
      />
    );
  }

  if (activeTab === 'earnCaps') {
    return (
      <EarnCapsScreen
        activeMember={activeMember}
        onCapsBalanceChange={onCapsBalanceChange}
        onOpenPointDuel={() => onChangeTab?.('challenges')}
        sessionToken={sessionToken}
        weeklyCheckInSnapshot={weeklyCheckInSnapshot}
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
      <CrewScreen
        activeMember={activeMember}
        activeMembers={activeMembers}
        onOpenDirectChat={onOpenDirectChat}
        schoolClass={schoolClass}
        sessionToken={sessionToken}
      />
    );
  }

  if (activeTab === 'randomizer') {
    if (selectedMiniGame === 'bottle-pointer') {
      return <BottlePointerScreen onBack={() => setSelectedMiniGame(null)} />;
    }

    return (
      <MiniGamesScreen
        onOpenGame={setSelectedMiniGame}
        emptyTitle="Ingen challenges endnu"
        emptyText="Indholdet er på vej med små spil og spontane udfordringer for klassen."
      />
    );
  }

  if (activeTab === 'challenges') {
    return (
      <FeatureScreen
        icon="flash"
        kicker={schoolClass.className}
        title="Pointduel"
        emptyTitle="Ingen pointdueller endnu"
        emptyText="Udfordr hinanden med Caps, og følg aktive dueller her."
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

  if (activeTab === 'settings') {
    return (
      <SettingsScreen
        notificationState={notificationState}
        schoolClass={schoolClass}
        onEnableAndroidNotifications={onEnableAndroidNotifications}
        onSendAndroidNotificationTest={onSendAndroidNotificationTest}
      />
    );
  }

  if (activeTab === 'emergencyContacts') {
    return (
      <FeatureScreen
        icon="call"
        kicker={schoolClass.className}
        title="Nødkontakter"
        emptyTitle="Kommer snart"
        emptyText="Vigtige kontaktpersoner og hjælp samles her."
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
      onOpenCalendar={openCalendarTab}
      onOpenEarnCaps={() => onChangeTab?.('earnCaps')}
      onOpenPointDuel={() => onChangeTab?.('challenges')}
      onOpenActivities={() => onChangeTab?.('activities')}
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
  initialDirectChatMemberId,
  onDirectChatHandled,
  onUnreadCountChange,
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
  const hasSyncedConversationsRef = useRef(false);

  const chatMembers = useMemo(
    () => uniqueById(activeMembers ?? []).filter((member) => member.id !== activeMember?.id),
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

  useEffect(() => {
    if (!hasSyncedConversationsRef.current) {
      hasSyncedConversationsRef.current = true;
      return;
    }

    onUnreadCountChange?.(chatUnreadCountForConversations(conversations));
  }, [conversations, onUnreadCountChange]);
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
      const nextConversations = uniqueById(data.conversations ?? []);

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
      const nextMessages = uniqueById(data.messages ?? []);
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
          setConversations(uniqueById(data.conversations ?? []));
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

  const pendingDirectChatMemberId = String(initialDirectChatMemberId ?? '').trim();

  useEffect(() => {
    if (!pendingDirectChatMemberId || !sessionToken) {
      return undefined;
    }

    let active = true;

    startDirectChat(pendingDirectChatMemberId)
      .finally(() => {
        if (active) {
          onDirectChatHandled?.();
        }
      });

    return () => {
      active = false;
    };
  }, [pendingDirectChatMemberId, onDirectChatHandled, sessionToken]);

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
      setMessages((current) => mergeUniqueById(current, data.message));
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

    setConversations((current) => uniqueById(current.map((conversation) => (
      conversation.id === nextConversation.id ? nextConversation : conversation
    ))));

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
        <View style={[styles.chatModalRoot, styles.luckyAddPlayerModalRoot]}>
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
        <View style={[styles.chatModalRoot, styles.luckyAddPlayerModalRoot]}>
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
  focusTarget,
  events,
  onCreateEvent,
  onDeleteEvent,
  onBlockMember,
  onRequestScrollTop,
  onReportEvent,
  onRespondToEvent,
  onUpdateEvent,
}) {
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [draft, setDraft] = useState(() => createCalendarDraft());
  const [visibleMonth, setVisibleMonth] = useState(() => dateFromInput(createCalendarDraft().eventDate));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [selectingInvitees, setSelectingInvitees] = useState(false);
  const [editingEventId, setEditingEventId] = useState('');
  const [invitePeopleSearch, setInvitePeopleSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [calendarStatus, setCalendarStatus] = useState('');
  const [deleteEventError, setDeleteEventError] = useState('');
  const [calendarHeaderScrolled, setCalendarHeaderScrolled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState('');
  const [reportingEventId, setReportingEventId] = useState('');
  const [blockingMemberId, setBlockingMemberId] = useState('');
  const [respondingEventId, setRespondingEventId] = useState('');
  const [pendingResponsePageOpen, setPendingResponsePageOpen] = useState(false);
  const [pastEventsPageOpen, setPastEventsPageOpen] = useState(false);
  const [calendarAttendanceEventId, setCalendarAttendanceEventId] = useState('');
  const [calendarActionEventId, setCalendarActionEventId] = useState('');
  const [calendarDeleteEventId, setCalendarDeleteEventId] = useState('');
  const calendarHeaderScrolledRef = useRef(false);
  const calendarScrollY = useRef(new Animated.Value(0)).current;
  const calendarGridScrollRef = useRef(null);
  const calendarDayRailRef = useRef(null);
  const calendarEventLayoutsRef = useRef({});
  const handledCalendarFocusRequestRef = useRef('');
  const hourWheelRef = useRef(null);
  const minuteWheelRef = useRef(null);
  const calendarSubpageDragX = useRef(new Animated.Value(0)).current;
  const calendarSubpageWidthRef = useRef(APP_WINDOW_WIDTH);
  const calendarSubpageTouchStartRef = useRef(null);
  const calendarSubpageTouchLatestRef = useRef(null);
  const calendarSubpageSwipeActiveRef = useRef(false);
  const calendarRailProgrammaticScrollRef = useRef(false);
  const calendarRailLastJumpAtRef = useRef(0);
  const calendarRailDragStartXRef = useRef(0);
  const [calendarDayRailWidth, setCalendarDayRailWidth] = useState(0);
  const visibleMonthDays = useMemo(() => calendarDaysForMonth(visibleMonth), [visibleMonth]);
  const selectedTime = useMemo(() => splitCalendarTime(draft.eventTime), [draft.eventTime]);
  const selectedCoverTemplate = useMemo(
    () => EVENT_COVER_TEMPLATES.find((template) => template.id === draft.coverImageTemplateId),
    [draft.coverImageTemplateId],
  );
  const invitableMembers = useMemo(
    () => uniqueById(activeMembers ?? [])
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
  const [currentCalendarTime, setCurrentCalendarTime] = useState(() => Date.now());
  const todayKey = useMemo(() => formatInputDate(new Date(currentCalendarTime)), [currentCalendarTime]);
  const sortedEvents = useMemo(
    () => uniqueById(events ?? []).sort((first, second) => {
      const firstTime = eventSortTime(first);
      const secondTime = eventSortTime(second);

      return (Number.isFinite(firstTime) ? firstTime : 0) - (Number.isFinite(secondTime) ? secondTime : 0);
    }),
    [events],
  );
  const upcomingEvents = useMemo(
    () => sortedEvents.filter((event) => !eventIsPast(event, currentCalendarTime)),
    [currentCalendarTime, sortedEvents],
  );
  const pastEvents = useMemo(
    () => sortedEvents
      .filter((event) => eventIsPast(event, currentCalendarTime))
      .sort((first, second) => eventSortTime(second) - eventSortTime(first)),
    [currentCalendarTime, sortedEvents],
  );
  const initialSelectedCalendarDay = useMemo(() => {
    const upcomingEvent = upcomingEvents.find((event) => {
      const dayKey = eventDayKeyFor(event);

      return dayKey && compareCalendarDayKeys(dayKey, todayKey) >= 0;
    });

    return eventDayKeyFor(upcomingEvent) || todayKey;
  }, [todayKey, upcomingEvents]);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(initialSelectedCalendarDay);
  const [calendarRailMonth, setCalendarRailMonth] = useState(() => dateFromInput(initialSelectedCalendarDay));
  const selectedCalendarDayTouchedRef = useRef(false);
  const eventCountByDay = useMemo(() => upcomingEvents.reduce((counts, event) => {
    const dayKey = eventDayKeyFor(event);

    if (!dayKey) {
      return counts;
    }

    return {
      ...counts,
      [dayKey]: (counts[dayKey] ?? 0) + 1,
    };
  }, {}), [upcomingEvents]);
  const calendarEventDayKeys = useMemo(() => uniqueByKey(
    upcomingEvents
      .map((event) => eventDayKeyFor(event))
      .filter(Boolean),
    (dayKey) => dayKey,
  ).sort(compareCalendarDayKeys), [upcomingEvents]);
  const calendarRailMonthTitle = capitalizeCalendarLabel(monthTitle(calendarRailMonth));
  const calendarRailDays = useMemo(() => {
    return calendarRailDayKeysFor(calendarEventDayKeys, selectedCalendarDay, todayKey)
      .map((dayKey) => {
        const date = dateFromInput(dayKey);

        return {
          id: dayKey,
          day: new Intl.DateTimeFormat('da-DK', { day: '2-digit' }).format(date).replace('.', ''),
          eventCount: eventCountByDay[dayKey] ?? 0,
          isToday: dayKey === todayKey,
          month: formatCalendarRailMonth(date),
          weekday: formatCalendarRailWeekday(date),
        };
      });
  }, [calendarEventDayKeys, eventCountByDay, selectedCalendarDay, todayKey]);
  const calendarRailSnapOffsets = useMemo(() => {
    if (!calendarDayRailWidth) {
      return [];
    }

    return calendarRailDays.reduce((offsets, day, index) => {
      if (!day.eventCount) {
        return offsets;
      }

      return [...offsets, calendarRailOffsetForDayIndex(index, calendarDayRailWidth)];
    }, []);
  }, [calendarDayRailWidth, calendarRailDays]);
  const selectedCalendarDayEvents = useMemo(
    () => upcomingEvents.filter((event) => eventDayKeyFor(event) === selectedCalendarDay),
    [selectedCalendarDay, upcomingEvents],
  );
  const memberOwnsEvent = useCallback((event) => (
    Boolean(event?.createdByMemberId && activeMember?.id)
    && String(event.createdByMemberId) === String(activeMember.id)
  ), [activeMember?.id]);
  const calendarActionEvent = useMemo(
    () => sortedEvents.find((event) => event.id === calendarActionEventId) ?? null,
    [calendarActionEventId, sortedEvents],
  );
  const calendarDeleteEvent = useMemo(
    () => sortedEvents.find((event) => event.id === calendarDeleteEventId) ?? null,
    [calendarDeleteEventId, sortedEvents],
  );
  const calendarAttendanceEvent = useMemo(
    () => sortedEvents.find((event) => event.id === calendarAttendanceEventId) ?? null,
    [calendarAttendanceEventId, sortedEvents],
  );
  const calendarAttendancePeople = useMemo(() => {
    if (!calendarAttendanceEvent) {
      return [];
    }

    const memberIdFor = (person) => String(person?.memberId ?? person?.id ?? '');
    const attendingIds = new Set((calendarAttendanceEvent.attendees ?? []).map(memberIdFor).filter(Boolean));
    const declinedIds = new Set((calendarAttendanceEvent.declines ?? []).map(memberIdFor).filter(Boolean));
    const pendingIds = new Set((calendarAttendanceEvent.pendingInvitees ?? []).map(memberIdFor).filter(Boolean));
    const fallbackInvitees = activeMembers
      .filter((member) => member.status === 'active')
      .map((member) => ({
        memberId: member.id,
        displayName: member.displayName,
        profilePhotoUrl: member.profilePhotoUrl,
      }));
    const baseInvitees = calendarAttendanceEvent.invitees?.length
      ? calendarAttendanceEvent.invitees
      : fallbackInvitees;

    return uniqueByKey([
      ...baseInvitees,
      ...(calendarAttendanceEvent.attendees ?? []),
      ...(calendarAttendanceEvent.declines ?? []),
      ...(calendarAttendanceEvent.pendingInvitees ?? []),
    ], memberIdFor)
      .map((person) => {
        const memberId = memberIdFor(person);
        const status = attendingIds.has(memberId)
          ? 'attending'
          : declinedIds.has(memberId)
            ? 'not_attending'
            : pendingIds.has(memberId)
              ? 'pending'
              : 'pending';

        return {
          ...person,
          memberId,
          status,
        };
      })
      .sort((first, second) => {
        const statusOrder = { attending: 0, pending: 1, not_attending: 2 };
        const statusDelta = (statusOrder[first.status] ?? 9) - (statusOrder[second.status] ?? 9);

        if (statusDelta !== 0) {
          return statusDelta;
        }

        return String(first.displayName ?? '').localeCompare(String(second.displayName ?? ''), 'da');
      });
  }, [activeMembers, calendarAttendanceEvent]);
  const pendingResponseEvents = useMemo(
    () => upcomingEvents.filter((event) => event.myInviteStatus === 'invited' && !event.myRsvp),
    [upcomingEvents],
  );
  const pendingResponseCount = pendingResponseEvents.length;
  const pendingResponseSummary = pendingResponseCount
    ? `${pendingResponseCount} ${pendingResponseCount === 1 ? 'begivenhed' : 'begivenheder'}`
    : 'Ingen afventer';
  const calendarSubpageMode = pendingResponsePageOpen
    ? 'pendingResponses'
    : pastEventsPageOpen
      ? 'pastEvents'
    : creatingEvent && selectingInvitees
      ? 'invitees'
      : creatingEvent
        ? 'create'
        : '';
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
  const calendarSubpageDragStyle = useMemo(() => ({
    transform: [{ translateX: calendarSubpageDragX }],
  }), [calendarSubpageDragX]);

  const handleCalendarSubpageLayout = useCallback((event) => {
    calendarSubpageWidthRef.current = Math.max(event.nativeEvent.layout.width, 1);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCalendarTime(Date.now());
    }, 15_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (creatingEvent && selectingInvitees) {
      onRequestScrollTop?.();
    }
  }, [creatingEvent, onRequestScrollTop, selectingInvitees]);

  useEffect(() => {
    if (!calendarSubpageMode) {
      return;
    }

    calendarSubpageSwipeActiveRef.current = false;
    calendarSubpageDragX.stopAnimation();
    calendarSubpageDragX.setValue(Math.max(calendarSubpageWidthRef.current, APP_WINDOW_WIDTH));

    requestAnimationFrame(() => {
      Animated.timing(calendarSubpageDragX, {
        toValue: 0,
        duration: 285,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: false,
      }).start();
    });
  }, [calendarSubpageDragX, calendarSubpageMode]);

  useEffect(() => {
    if (selectedCalendarDayTouchedRef.current || selectedCalendarDay === initialSelectedCalendarDay) {
      return;
    }

    setSelectedCalendarDay(initialSelectedCalendarDay);
    setCalendarRailMonth(dateFromInput(initialSelectedCalendarDay));
  }, [initialSelectedCalendarDay, selectedCalendarDay]);

  const centerCalendarDayInRail = useCallback((dayKey, animated = true) => {
    if (!calendarDayRailWidth) {
      return;
    }

    const dayIndex = calendarRailDays.findIndex((day) => day.id === dayKey);

    if (dayIndex < 0) {
      return;
    }

    const x = calendarRailOffsetForDayIndex(dayIndex, calendarDayRailWidth);

    setTimeout(() => {
      calendarRailProgrammaticScrollRef.current = true;
      calendarDayRailRef.current?.scrollTo({ x, animated });
      setTimeout(() => {
        calendarRailProgrammaticScrollRef.current = false;
      }, 420);
    }, 0);
  }, [calendarDayRailWidth, calendarRailDays]);

  useEffect(() => {
    if (!isSameCalendarMonth(calendarRailMonth, dateFromInput(selectedCalendarDay))) {
      return;
    }

    centerCalendarDayInRail(selectedCalendarDay);
  }, [calendarRailMonth, centerCalendarDayInRail, selectedCalendarDay]);

  const selectCalendarDay = useCallback((dayKey) => {
    selectedCalendarDayTouchedRef.current = true;
    setSelectedCalendarDay(dayKey);
    setCalendarRailMonth(dateFromInput(dayKey));
  }, []);

  const shiftCalendarRailMonth = useCallback((count) => {
    const nextMonth = addCalendarMonths(calendarRailMonth, count);

    selectedCalendarDayTouchedRef.current = true;
    setCalendarRailMonth(nextMonth);
    setSelectedCalendarDay(defaultCalendarDayForMonth(nextMonth, upcomingEvents, todayKey));
  }, [calendarRailMonth, todayKey, upcomingEvents]);

  const jumpCalendarRailToEventDay = useCallback((dayKey) => {
    if (!dayKey || dayKey === selectedCalendarDay) {
      return;
    }

    calendarRailLastJumpAtRef.current = Date.now();
    selectedCalendarDayTouchedRef.current = true;
    setSelectedCalendarDay(dayKey);
    setCalendarRailMonth(dateFromInput(dayKey));
  }, [selectedCalendarDay]);

  const openPendingResponsePage = useCallback(() => {
    if (!pendingResponseEvents.length) {
      return;
    }
    setCalendarError('');
    setCalendarStatus('');
    setCreatingEvent(false);
    setSelectingInvitees(false);
    setPastEventsPageOpen(false);
    setPendingResponsePageOpen(true);
  }, [pendingResponseEvents]);

  const openPastEventsPage = useCallback(() => {
    setCalendarError('');
    setCalendarStatus('');
    setCreatingEvent(false);
    setSelectingInvitees(false);
    setPendingResponsePageOpen(false);
    setPastEventsPageOpen(true);
  }, []);

  const handleCalendarDayRailScrollBeginDrag = useCallback((event) => {
    calendarRailProgrammaticScrollRef.current = false;
    calendarRailDragStartXRef.current = event.nativeEvent.contentOffset?.x ?? 0;
  }, []);

  const handleCalendarDayRailScrollEnd = useCallback((event) => {
    if (calendarRailProgrammaticScrollRef.current) {
      return;
    }

    const now = Date.now();

    if (now - calendarRailLastJumpAtRef.current < 450) {
      return;
    }

    const {
      contentOffset,
      contentSize,
      layoutMeasurement,
    } = event.nativeEvent;
    const maxX = Math.max(0, (contentSize?.width ?? 0) - (layoutMeasurement?.width ?? 0));
    const x = contentOffset?.x ?? 0;
    const edgeThreshold = CALENDAR_DAY_RAIL_ITEM_WIDTH;
    const deltaX = x - calendarRailDragStartXRef.current;
    const eventSwipeThreshold = 14;

    if (Math.abs(deltaX) >= eventSwipeThreshold) {
      const targetEventDayKey = deltaX > 0
        ? calendarEventDayKeys.find((dayKey) => compareCalendarDayKeys(dayKey, selectedCalendarDay) > 0)
        : [...calendarEventDayKeys].reverse().find((dayKey) => compareCalendarDayKeys(dayKey, selectedCalendarDay) < 0);

      if (targetEventDayKey) {
        jumpCalendarRailToEventDay(targetEventDayKey);
        return;
      }
    }

    if (maxX <= 0) {
      centerCalendarDayInRail(selectedCalendarDay);
      return;
    }

    if (x >= maxX - edgeThreshold) {
      const nextEventDayKey = calendarEventDayKeys.find((dayKey) => (
        compareCalendarDayKeys(dayKey, selectedCalendarDay) > 0
      ));

      jumpCalendarRailToEventDay(nextEventDayKey);
      return;
    }

    if (x <= edgeThreshold) {
      const previousEventDayKey = [...calendarEventDayKeys].reverse().find((dayKey) => (
        compareCalendarDayKeys(dayKey, selectedCalendarDay) < 0
      ));

      jumpCalendarRailToEventDay(previousEventDayKey);
      return;
    }

    centerCalendarDayInRail(selectedCalendarDay);
  }, [calendarEventDayKeys, centerCalendarDayInRail, jumpCalendarRailToEventDay, selectedCalendarDay]);

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

  const scrollCalendarToY = useCallback((y, animated = true) => {
    const scrollTarget = { y: Math.max(0, y), animated };
    const scrollRef = calendarGridScrollRef.current;

    if (typeof scrollRef?.scrollTo === 'function') {
      scrollRef.scrollTo(scrollTarget);
    } else if (typeof scrollRef?.getNode === 'function') {
      scrollRef.getNode()?.scrollTo?.(scrollTarget);
    }

    updateCalendarHeaderScrolled(scrollTarget.y > 6);
  }, [updateCalendarHeaderScrolled]);

  const scrollCalendarToEventCard = useCallback((eventId, attempt = 0) => {
    const eventKey = String(eventId || '');
    const layout = calendarEventLayoutsRef.current[eventKey];

    if (layout) {
      scrollCalendarToY(layout.y - 90, true);
      return;
    }

    if (attempt >= 8) {
      return;
    }

    setTimeout(() => {
      scrollCalendarToEventCard(eventKey, attempt + 1);
    }, 80);
  }, [scrollCalendarToY]);

  useEffect(() => {
    const requestId = focusTarget?.requestId;

    if (!requestId || handledCalendarFocusRequestRef.current === requestId) {
      return;
    }

    const eventId = focusTarget?.eventId ? String(focusTarget.eventId) : '';
    const targetEvent = eventId
      ? upcomingEvents.find((event) => String(event.id) === eventId)
      : null;
    const dayKey = focusTarget?.dayKey || eventDayKeyFor(targetEvent);

    if (!dayKey) {
      return;
    }

    handledCalendarFocusRequestRef.current = requestId;
    calendarEventLayoutsRef.current = {};
    setCalendarError('');
    setCalendarStatus('');
    setCreatingEvent(false);
    setSelectingInvitees(false);
    setPendingResponsePageOpen(false);
    setPastEventsPageOpen(false);
    selectCalendarDay(dayKey);
    scrollCalendarToY(0, false);

    if (eventId) {
      requestAnimationFrame(() => {
        scrollCalendarToEventCard(eventId);
      });
    }
  }, [focusTarget, scrollCalendarToEventCard, scrollCalendarToY, selectCalendarDay, upcomingEvents]);

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

    setEditingEventId('');
    setDraft(nextDraft);
    setVisibleMonth(dateFromInput(nextDraft.eventDate));
    setDatePickerOpen(false);
    setCoverPickerOpen(false);
    setSelectingInvitees(false);
    setInvitePeopleSearch('');
    setCalendarError('');
    setCalendarStatus('');
    setFormError('');
    setDeleteEventError('');
    setPendingResponsePageOpen(false);
    setPastEventsPageOpen(false);
    resetCalendarHeaderScroll();
    setCreatingEvent(true);
    scrollTimeWheelsTo(nextDraft.eventTime);
  };

  const openEditPage = (event) => {
    if (!memberOwnsEvent(event)) {
      return;
    }

    const nextDraft = calendarDraftFromEvent(event, activeMember?.id);

    setCalendarActionEventId('');
    setEditingEventId(event.id);
    setDraft(nextDraft);
    setVisibleMonth(dateFromInput(nextDraft.eventDate));
    setDatePickerOpen(false);
    setCoverPickerOpen(false);
    setSelectingInvitees(false);
    setInvitePeopleSearch('');
    setCalendarError('');
    setCalendarStatus('');
    setFormError('');
    setDeleteEventError('');
    setPendingResponsePageOpen(false);
    setPastEventsPageOpen(false);
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
    setEditingEventId('');
    setDatePickerOpen(false);
    setCoverPickerOpen(false);
    setSelectingInvitees(false);
    setInvitePeopleSearch('');
    setFormError('');
    resetCalendarHeaderScroll();
  };

  const resetCalendarSubpageDrag = useCallback(() => {
    calendarSubpageSwipeActiveRef.current = false;

    Animated.spring(calendarSubpageDragX, {
      toValue: 0,
      tension: 135,
      friction: 19,
      useNativeDriver: false,
    }).start();
  }, [calendarSubpageDragX]);

  const returnFromCalendarSubpage = useCallback((onBack) => {
    Keyboard.dismiss();

    Animated.timing(calendarSubpageDragX, {
      toValue: Math.max(calendarSubpageWidthRef.current, APP_WINDOW_WIDTH),
      duration: 245,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      const didLeave = onBack?.();

      if (didLeave === false) {
        resetCalendarSubpageDrag();
        return;
      }

      requestAnimationFrame(() => {
        calendarSubpageSwipeActiveRef.current = false;
        calendarSubpageDragX.setValue(0);
      });
    });
  }, [calendarSubpageDragX, resetCalendarSubpageDrag]);

  const createCalendarSubpageTouchHandlers = useCallback((onBack) => {
    const touchFromEvent = (event) => event.nativeEvent.touches?.[0] ?? event.nativeEvent;

    const releaseCalendarSubpageSwipe = () => {
      const latest = calendarSubpageTouchLatestRef.current;
      const start = calendarSubpageTouchStartRef.current;

      if (!latest || !start || !calendarSubpageSwipeActiveRef.current) {
        calendarSubpageTouchStartRef.current = null;
        calendarSubpageTouchLatestRef.current = null;
        calendarSubpageSwipeActiveRef.current = false;
        return;
      }

      const elapsed = Math.max(1, latest.time - start.time);
      const velocityX = latest.dx / elapsed;
      const movedFarEnough = latest.dx > Math.max(
        CHAT_THREAD_BACK_SWIPE_DISTANCE,
        calendarSubpageWidthRef.current * 0.08,
      );
      const flickedRight = latest.dx > CHAT_THREAD_BACK_SWIPE_FAST_DISTANCE
        && velocityX > CHAT_THREAD_BACK_SWIPE_VELOCITY;

      calendarSubpageTouchStartRef.current = null;
      calendarSubpageTouchLatestRef.current = null;
      calendarSubpageSwipeActiveRef.current = false;

      if (movedFarEnough || flickedRight) {
        returnFromCalendarSubpage(onBack);
        return;
      }

      resetCalendarSubpageDrag();
    };

    return {
      onTouchStart: (event) => {
        const touch = touchFromEvent(event);

        if (!Number.isFinite(touch?.pageX) || !Number.isFinite(touch?.pageY)) {
          return;
        }

        calendarSubpageTouchStartRef.current = {
          x: touch.pageX,
          y: touch.pageY,
          time: Date.now(),
        };
        calendarSubpageTouchLatestRef.current = null;
        calendarSubpageSwipeActiveRef.current = false;
      },
      onTouchMove: (event) => {
        const start = calendarSubpageTouchStartRef.current;
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

        const isSwipeIntent = calendarSubpageSwipeActiveRef.current
          || (
            absDx > CHAT_THREAD_BACK_SWIPE_ACTIVATION_DISTANCE
            && absDx > absDy * CHAT_THREAD_BACK_SWIPE_VERTICAL_RATIO
          );

        if (!isSwipeIntent) {
          return;
        }

        if (!calendarSubpageSwipeActiveRef.current) {
          Keyboard.dismiss();
          calendarSubpageDragX.stopAnimation();
          calendarSubpageSwipeActiveRef.current = true;
        }

        calendarSubpageTouchLatestRef.current = {
          dx,
          dy,
          time: Date.now(),
        };
        calendarSubpageDragX.setValue(Math.min(Math.max(dx, 0), calendarSubpageWidthRef.current));
      },
      onTouchEnd: releaseCalendarSubpageSwipe,
      onTouchCancel: releaseCalendarSubpageSwipe,
    };
  }, [calendarSubpageDragX, resetCalendarSubpageDrag, returnFromCalendarSubpage]);

  const pickEventCoverImage = async () => {
    setFormError('');
    setCoverPickerOpen(false);

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
      coverImageTemplateId: '',
      coverImageMode: 'upload',
    }));
  };

  const selectEventCoverTemplate = (template) => {
    setFormError('');
    setCoverPickerOpen(false);
    setDraft((current) => ({
      ...current,
      coverImageUri: '',
      coverImageData: '',
      coverImageTemplateId: template.id,
      coverImageMode: 'template',
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

    if (draft.coverImageTemplateId) {
      nextDraft.coverImageMode = 'template';
      nextDraft.coverImageTemplateId = draft.coverImageTemplateId;

      const templateUploadData = draft.coverImageData
        || await eventCoverTemplateUploadData(draft.coverImageTemplateId);

      if (templateUploadData) {
        nextDraft.coverImageData = templateUploadData;
      }
    } else if (draft.coverImageData) {
      nextDraft.coverImageMode = 'upload';
      nextDraft.coverImageData = draft.coverImageData;
    } else {
      nextDraft.coverImageMode = editingEventId ? 'keep' : 'none';
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
    setCalendarStatus('');

    try {
      if (editingEventId) {
        await onUpdateEvent(editingEventId, nextDraft);
      } else {
        await onCreateEvent(nextDraft);
      }

      setDraft(createCalendarDraft());
      setCreatingEvent(false);
      setEditingEventId('');
      setDatePickerOpen(false);
      setCoverPickerOpen(false);
      setSelectingInvitees(false);
      setInvitePeopleSearch('');
      selectCalendarDay(nextDraft.eventDate);
      resetCalendarHeaderScroll();
    } catch (apiError) {
      setFormError(apiError.message || (editingEventId
        ? 'Begivenheden kunne ikke gemmes.'
        : 'Begivenheden kunne ikke oprettes.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!calendarDeleteEvent || deletingEventId) {
      return;
    }

    const deletedEventId = calendarDeleteEvent.id;
    const deletedEventDay = eventDayKeyFor(calendarDeleteEvent);

    setDeletingEventId(deletedEventId);
    setDeleteEventError('');

    try {
      await onDeleteEvent(deletedEventId);
      setCalendarDeleteEventId('');
      setCalendarActionEventId('');
      setCalendarAttendanceEventId((current) => (current === deletedEventId ? '' : current));

      if (deletedEventDay === selectedCalendarDay) {
        const nextEvent = upcomingEvents.find((event) => (
          event.id !== deletedEventId
          && eventDayKeyFor(event)
          && compareCalendarDayKeys(eventDayKeyFor(event), selectedCalendarDay) >= 0
        )) ?? upcomingEvents.find((event) => event.id !== deletedEventId && eventDayKeyFor(event));

        if (nextEvent) {
          selectCalendarDay(eventDayKeyFor(nextEvent));
        }
      }
    } catch (apiError) {
      setDeleteEventError(apiError.message || 'Begivenheden kunne ikke slettes.');
    } finally {
      setDeletingEventId('');
    }
  };

  const reportEvent = async (event) => {
    if (!event || reportingEventId) {
      return;
    }

    setReportingEventId(event.id);
    setCalendarError('');
    setCalendarStatus('');

    try {
      await onReportEvent(event.id);
      setCalendarActionEventId('');
      setCalendarStatus('Tak - begivenheden er rapporteret til moderation.');
    } catch (apiError) {
      setCalendarError(apiError.message || 'Begivenheden kunne ikke rapporteres.');
    } finally {
      setReportingEventId('');
    }
  };

  const blockEventCreator = async (event) => {
    const creatorId = event?.createdByMemberId ?? event?.creator?.id;

    if (!event || !creatorId || blockingMemberId) {
      return;
    }

    setBlockingMemberId(String(creatorId));
    setCalendarError('');
    setCalendarStatus('');

    try {
      await onBlockMember(String(creatorId));
      setCalendarActionEventId('');
      setCalendarAttendanceEventId((current) => (current === event.id ? '' : current));
      setCalendarStatus('Arrangøren er blokeret, og begivenheder fra personen er skjult.');
    } catch (apiError) {
      setCalendarError(apiError.message || 'Personen kunne ikke blokeres.');
    } finally {
      setBlockingMemberId('');
    }
  };

  const respondToEvent = async (eventId, status) => {
    setRespondingEventId(`${eventId}:${status}`);
    setCalendarError('');
    setCalendarStatus('');

    try {
      await onRespondToEvent(eventId, status);
      if (pendingResponsePageOpen && pendingResponseCount <= 1) {
        setPendingResponsePageOpen(false);
      }
    } catch (apiError) {
      setCalendarError(apiError.message || 'Dit svar kunne ikke gemmes.');
    } finally {
      setRespondingEventId('');
    }
  };

  const renderCalendarEventCard = (event, { past = false } = {}) => {
    const dateParts = formatCalendarDateParts(event.date);
    const eventTime = formatCalendarTime(event.startsAt);
    const attendingCount = event.attendingCount ?? event.rsvpCount ?? 0;
    const notAttendingCount = event.notAttendingCount ?? 0;
    const attendeePreview = uniqueByKey(event.attendees ?? [], (person) => person?.memberId).slice(0, CALENDAR_ATTENDEE_STACK_LIMIT);
    const attendeeOverflowCount = Math.max(0, attendingCount - attendeePreview.length);
    const attendingLoading = respondingEventId === `${event.id}:attending`;
    const notAttendingLoading = respondingEventId === `${event.id}:not_attending`;
    const ownsEvent = memberOwnsEvent(event);
    const canRespond = !past && !ownsEvent;
    const eventCoverTemplate = eventCoverTemplateFor(event.coverImageTemplateId);
    const hasEventCover = Boolean(event.coverImageUrl || eventCoverTemplate);

    return (
      <View key={event.id} style={[styles.calendarEventCard, past ? styles.calendarEventCardPast : null]}>
        {hasEventCover ? (
          <View style={styles.calendarEventCoverWrap}>
            {eventCoverTemplate ? (
              <EventCoverTemplateArt
                templateId={eventCoverTemplate.id}
                style={styles.calendarEventCoverImage}
              />
            ) : (
              <Image
                resizeMode="cover"
                source={{ uri: event.coverImageUrl }}
                style={styles.calendarEventCoverImage}
              />
            )}
            <View style={styles.calendarEventCoverShade} pointerEvents="none" />
            <View style={[
              styles.calendarEventCoverTitleBlock,
              event.creator ? styles.calendarEventCoverTitleBlockWithAvatar : null,
            ]}>
              <Text numberOfLines={2} style={styles.calendarEventCoverTitle}>
                {event.title}
              </Text>
            </View>
            {!past ? (
              <Pressable
                accessibilityLabel={`Handlinger for ${event.title}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setCalendarActionEventId(event.id)}
                style={({ pressed }) => [
                  styles.calendarEventCoverActionButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}
            {event.creator ? (
              <View style={styles.calendarEventCreatorAvatar}>
                <Avatar profile={event.creator} variant="calendarCreator" />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.calendarEventBody}>
          <View style={[
            styles.calendarEventTopRow,
            hasEventCover ? styles.calendarEventTopRowCentered : null,
          ]}>
            <View style={[
              styles.calendarDateBadge,
              past ? styles.calendarDateBadgePast : null,
              hasEventCover && event.creator ? styles.calendarDateBadgeUnderAvatar : null,
            ]}>
              <Text style={[styles.calendarDateDay, past ? styles.calendarDateDayPast : null]}>{dateParts.day}</Text>
              <Text style={styles.calendarDateMonth}>{dateParts.month}</Text>
            </View>
            <View style={[
              styles.calendarEventCopy,
              hasEventCover ? styles.calendarEventCopyBesideDate : null,
            ]}>
              {!hasEventCover ? (
                <View style={styles.calendarEventTitleRow}>
                  <Text numberOfLines={2} style={styles.calendarEventTitle}>
                    {event.title}
                  </Text>
                  {!past ? (
                    <Pressable
                      accessibilityLabel={`Handlinger for ${event.title}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setCalendarActionEventId(event.id)}
                      style={({ pressed }) => [
                        styles.calendarEventActionButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {event.creator?.displayName ? (
                <Text numberOfLines={1} style={styles.calendarCreatorText}>
                  Oprettet af {event.creator.displayName}
                </Text>
              ) : null}
              {past ? (
                <View style={styles.calendarPastEventBadge}>
                  <Ionicons name="checkmark-done" size={12} color={STUDOS_THEME.ink} />
                  <Text numberOfLines={1} style={styles.calendarPastEventBadgeText}>Afholdt</Text>
                </View>
              ) : null}
              <View style={styles.calendarMetaLine}>
                <Ionicons name="calendar" size={14} color={past ? '#8B94A6' : STUDOS_THEME.red} />
                <Text numberOfLines={1} style={styles.calendarMetaText}>
                  {dateParts.weekday}{eventTime ? ` kl. ${eventTime}` : ''}
                </Text>
              </View>
              {event.location ? (
                <View style={styles.calendarMetaLine}>
                  <Ionicons name="location" size={14} color={STUDOS_THEME.ink} />
                  <Text numberOfLines={1} style={styles.calendarMetaText}>
                    {event.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {event.description ? (
            <Text style={styles.calendarDescription}>{event.description}</Text>
          ) : null}

          <Pressable
            accessibilityLabel={`Vis svar for ${event.title}`}
            accessibilityRole="button"
            onPress={() => setCalendarAttendanceEventId(event.id)}
            style={({ pressed }) => [
              styles.calendarStatsRow,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <View style={styles.calendarAttendeeStack}>
              {attendeePreview.map((person, index) => (
                <View
                  key={person.memberId ? `${person.memberId}-${index}` : `attendee-${index}`}
                  style={[
                    styles.calendarAttendeeStackItem,
                    index ? styles.calendarAttendeeStackItemOverlap : null,
                    { zIndex: index + 1 },
                  ]}
                >
                  <Avatar
                    profile={{
                      displayName: person.displayName ?? 'Ukendt',
                      profilePhotoUrl: person.profilePhotoUrl,
                    }}
                    variant="calendarAttendeeCard"
                  />
                </View>
              ))}
              {attendeeOverflowCount > 0 ? (
                <View
                  style={[
                    styles.calendarAttendeeOverflowCard,
                    attendeePreview.length ? styles.calendarAttendeeStackItemOverlap : null,
                    { zIndex: attendeePreview.length + 1 },
                  ]}
                >
                  <Text numberOfLines={1} style={styles.calendarAttendeeOverflowText}>
                    +{attendeeOverflowCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.calendarStatTextGroup}>
              <Text style={styles.calendarStatText}>
                {attendingCount} {past ? 'deltog' : 'deltager'}
              </Text>
              <View style={styles.calendarStatDot} />
              <Text style={styles.calendarStatText}>
                {notAttendingCount} {past ? 'deltog ikke' : 'kan ikke'}
              </Text>
            </View>
          </Pressable>

          {canRespond ? (
            <View style={styles.calendarRsvpRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => respondToEvent(event.id, 'attending')}
                style={({ pressed }) => [
                  styles.calendarRsvpButton,
                  event.myRsvp === 'attending' ? styles.calendarRsvpButtonAttending : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                {attendingLoading ? (
                  <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={17}
                      color={event.myRsvp === 'attending' ? STUDOS_THEME.ink : STUDOS_THEME.blue}
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
                onPress={() => respondToEvent(event.id, 'not_attending')}
                style={({ pressed }) => [
                  styles.calendarRsvpButton,
                  event.myRsvp === 'not_attending' ? styles.calendarRsvpButtonDeclined : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                {notAttendingLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={event.myRsvp === 'not_attending' ? '#FFFFFF' : STUDOS_THEME.red}
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
          ) : null}
        </View>
      </View>
    );
  };

  const calendarAttendanceModal = (
    <Modal
      animationType="fade"
      onRequestClose={() => setCalendarAttendanceEventId('')}
      transparent
      visible={Boolean(calendarAttendanceEvent)}
    >
      <View style={styles.chatModalRoot}>
        <Pressable
          accessibilityLabel="Luk deltagere"
          onPress={() => setCalendarAttendanceEventId('')}
          style={styles.chatModalBackdrop}
        />
        <View style={[styles.chatModalPanel, styles.calendarAttendanceModalPanel]}>
          <View style={styles.chatModalHeader}>
            <View style={styles.calendarAttendanceModalTitleWrap}>
              <Text style={styles.chatModalKicker}>Svar</Text>
              <Text numberOfLines={1} style={styles.chatModalTitle}>
                {calendarAttendanceEvent?.title ?? 'Deltagere'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Luk"
              accessibilityRole="button"
              onPress={() => setCalendarAttendanceEventId('')}
              style={({ pressed }) => [
                styles.chatModalCloseButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.calendarAttendanceList}
            showsVerticalScrollIndicator={false}
            style={styles.calendarAttendanceScroll}
          >
            {calendarAttendancePeople.length ? calendarAttendancePeople.map((person) => {
              const statusConfig = {
                attending: {
                  icon: 'checkmark',
                  label: 'Deltager',
                  tagStyle: styles.calendarAttendanceTagAttending,
                  style: styles.calendarAttendanceStatusAttending,
                  color: '#FFFFFF',
                },
                not_attending: {
                  icon: 'close',
                  label: 'Deltager ikke',
                  tagStyle: styles.calendarAttendanceTagDeclined,
                  style: styles.calendarAttendanceStatusDeclined,
                  color: STUDOS_THEME.ink,
                },
                pending: {
                  icon: 'remove',
                  label: 'Mangler svar',
                  tagStyle: styles.calendarAttendanceTagPending,
                  style: styles.calendarAttendanceStatusPending,
                  color: '#65748b',
                },
              }[person.status] ?? {
                icon: 'remove',
                label: 'Mangler svar',
                tagStyle: styles.calendarAttendanceTagPending,
                style: styles.calendarAttendanceStatusPending,
                color: '#65748b',
              };
              const displayName = person.displayName ?? 'Ukendt';

              return (
                <View
                  accessible
                  accessibilityLabel={`${displayName}, ${statusConfig.label}`}
                  key={person.memberId || displayName}
                  style={[styles.calendarAttendanceTag, statusConfig.tagStyle]}
                >
                  <Avatar
                    profile={{
                      displayName,
                      profilePhotoUrl: person.profilePhotoUrl,
                    }}
                    variant="calendarAttendanceTag"
                  />
                  <Text numberOfLines={1} style={styles.calendarAttendanceName}>
                    {displayName}
                  </Text>
                  <View style={[styles.calendarAttendanceStatusIcon, statusConfig.style]}>
                    <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                  </View>
                </View>
              );
            }) : (
              <View style={styles.calendarPendingResponseEmpty}>
                <Ionicons name="people" size={28} color={STUDOS_THEME.blue} />
                <Text style={styles.calendarPendingResponseEmptyText}>
                  Ingen deltagere er fundet endnu.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (pastEventsPageOpen) {
    const closePastEventsPage = () => {
      setPastEventsPageOpen(false);
      return true;
    };
    const calendarSubpageTouchHandlers = createCalendarSubpageTouchHandlers(closePastEventsPage);

    return (
      <Modal
        animationType="none"
        onRequestClose={() => returnFromCalendarSubpage(closePastEventsPage)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={pastEventsPageOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.calendarSubpageModalHost}
        >
          <View
            onLayout={handleCalendarSubpageLayout}
            style={styles.calendarSubpageModalContent}
          >
      <Animated.View
        {...calendarSubpageTouchHandlers}
        style={[
          styles.calendarSubpageFullscreen,
          styles.calendarSubpageDraggable,
          calendarSubpageDragStyle,
        ]}
      >
        <ScrollView
          {...calendarSubpageTouchHandlers}
          contentContainerStyle={styles.calendarScreenScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.calendarScreenScroll}
        >
          <View style={styles.calendarCreatePageHeader} {...calendarSubpageTouchHandlers}>
            <Pressable
              accessibilityLabel="Tilbage til kalender"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => returnFromCalendarSubpage(closePastEventsPage)}
              style={({ pressed }) => [
                styles.calendarCreateBackButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
              <Text style={styles.calendarCreateBackText}>Kalender</Text>
            </Pressable>
            <Text style={styles.calendarCreatePageTitle}>Tidligere events</Text>
          </View>

          <View style={styles.calendarPastEventsPage}>
            <Text style={styles.calendarPastEventsPageSummary}>
              {pastEvents.length
                ? `${pastEvents.length} ${pastEvents.length === 1 ? 'afholdt event' : 'afholdte events'}`
                : 'Ingen afholdte events endnu'}
            </Text>
            {pastEvents.length ? (
              <View style={styles.calendarEventList}>
                {pastEvents.map((event) => renderCalendarEventCard(event, { past: true }))}
              </View>
            ) : (
              <View style={styles.calendarPendingResponseEmpty}>
                <Ionicons name="archive" size={28} color={STUDOS_THEME.blue} />
                <Text style={styles.calendarPendingResponseEmptyText}>
                  Afholdte events lander her, når deres tidspunkt er passeret.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>
      {calendarAttendanceModal}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (pendingResponsePageOpen) {
    const closePendingResponsePage = () => {
      setPendingResponsePageOpen(false);
      return true;
    };
    const calendarSubpageTouchHandlers = createCalendarSubpageTouchHandlers(closePendingResponsePage);

    return (
      <Modal
        animationType="none"
        onRequestClose={() => returnFromCalendarSubpage(closePendingResponsePage)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={pendingResponsePageOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.calendarSubpageModalHost}
        >
          <View
            onLayout={handleCalendarSubpageLayout}
            style={styles.calendarSubpageModalContent}
          >
      <Animated.View
        {...calendarSubpageTouchHandlers}
        style={[
          styles.calendarSubpageFullscreen,
          styles.calendarSubpageDraggable,
          calendarSubpageDragStyle,
        ]}
      >
        <ScrollView
          {...calendarSubpageTouchHandlers}
          contentContainerStyle={styles.calendarScreenScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.calendarScreenScroll}
        >
          <View style={styles.calendarCreatePageHeader} {...calendarSubpageTouchHandlers}>
            <Pressable
              accessibilityLabel="Tilbage til kalender"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => returnFromCalendarSubpage(closePendingResponsePage)}
              style={({ pressed }) => [
                styles.calendarCreateBackButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
              <Text style={styles.calendarCreateBackText}>Kalender</Text>
            </Pressable>
            <Text style={styles.calendarCreatePageTitle}>Afventer svar</Text>
          </View>

        {calendarError ? <Text style={styles.errorText}>{calendarError}</Text> : null}
        {calendarStatus ? <Text style={styles.successText}>{calendarStatus}</Text> : null}

        <View style={styles.calendarPendingResponsePage}>
          <Text style={styles.calendarPendingResponsePageSummary}>
            {pendingResponseSummary}
          </Text>

          {pendingResponseEvents.length ? (
            <View style={styles.calendarPendingResponseList}>
              {pendingResponseEvents.map((event) => {
                const dateParts = formatCalendarDateParts(event.date);
                const eventTime = formatCalendarTime(event.startsAt);
                const attendingLoading = respondingEventId === `${event.id}:attending`;
                const notAttendingLoading = respondingEventId === `${event.id}:not_attending`;
                const ownsEvent = memberOwnsEvent(event);
                const canRespond = !ownsEvent;

                return (
                  <View key={event.id} style={styles.calendarPendingResponseRow}>
                    <View style={styles.calendarPendingResponseDateStack}>
                      <View style={styles.calendarPendingResponseDate}>
                        <Text style={styles.calendarPendingResponseDateDay}>{dateParts.day}</Text>
                        <Text style={styles.calendarPendingResponseDateMonth}>{dateParts.month}</Text>
                      </View>
                      {event.creator ? (
                        <View style={styles.calendarPendingResponseCreatorAvatar}>
                          <Avatar profile={event.creator} variant="calendarPendingResponseCreator" />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.calendarPendingResponseCopy}>
                      <Text numberOfLines={1} style={styles.calendarPendingResponseTitle}>
                        {event.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.calendarPendingResponseMeta}>
                        {dateParts.weekday}{eventTime ? ` kl. ${eventTime}` : ''}
                      </Text>
                    </View>
                    {canRespond ? (
                      <View style={styles.calendarPendingResponseActions}>
                        <Pressable
                          accessibilityLabel={`Deltager i ${event.title}`}
                          accessibilityRole="button"
                          onPress={() => respondToEvent(event.id, 'attending')}
                          style={({ pressed }) => [
                            styles.calendarPendingResponseActionButton,
                            styles.calendarPendingResponseActionAccept,
                            pressed ? styles.footerItemPressed : null,
                          ]}
                        >
                          {attendingLoading ? (
                            <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                          ) : (
                            <Ionicons name="checkmark" size={17} color={STUDOS_THEME.ink} />
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Deltager ikke i ${event.title}`}
                          accessibilityRole="button"
                          onPress={() => respondToEvent(event.id, 'not_attending')}
                          style={({ pressed }) => [
                            styles.calendarPendingResponseActionButton,
                            styles.calendarPendingResponseActionDecline,
                            pressed ? styles.footerItemPressed : null,
                          ]}
                        >
                          {notAttendingLoading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Ionicons name="close" size={17} color="#FFFFFF" />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.calendarPendingResponseEmpty}>
              <Ionicons name="checkmark-circle" size={28} color={STUDOS_THEME.blue} />
              <Text style={styles.calendarPendingResponseEmptyText}>
                Du mangler ikke at svare på noget lige nu.
              </Text>
            </View>
          )}
        </View>
        </ScrollView>
      </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (creatingEvent && selectingInvitees) {
    const closeInviteeSelectPage = () => {
      setSelectingInvitees(false);
      return true;
    };
    const calendarSubpageTouchHandlers = createCalendarSubpageTouchHandlers(closeInviteeSelectPage);

    return (
      <Modal
        animationType="none"
        onRequestClose={() => returnFromCalendarSubpage(closeInviteeSelectPage)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={creatingEvent && selectingInvitees}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.calendarSubpageModalHost}
        >
          <View
            onLayout={handleCalendarSubpageLayout}
            style={styles.calendarSubpageModalContent}
          >
      <Animated.View
        {...calendarSubpageTouchHandlers}
        style={[
          styles.calendarSubpageFullscreen,
          styles.calendarSubpageDraggable,
          calendarSubpageDragStyle,
        ]}
      >
        <ScrollView
          {...calendarSubpageTouchHandlers}
          contentContainerStyle={styles.calendarScreenScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.calendarScreenScroll}
        >
          <View style={styles.calendarCreatePageHeader} {...calendarSubpageTouchHandlers}>
            <Pressable
              accessibilityLabel={editingEventId ? 'Tilbage til rediger gilde' : 'Tilbage til opret gilde'}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => returnFromCalendarSubpage(closeInviteeSelectPage)}
              style={({ pressed }) => [
                styles.calendarCreateBackButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
              <Text style={styles.calendarCreateBackText}>
                {editingEventId ? 'Rediger gilde' : 'Opret gilde'}
              </Text>
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

          <Button label="Færdig" onPress={() => returnFromCalendarSubpage(closeInviteeSelectPage)} />
        </View>
        </ScrollView>
      </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (creatingEvent) {
    const closeCreatePage = () => {
      if (saving) {
        return false;
      }

      closeCreate();
      return true;
    };
    const calendarSubpageTouchHandlers = createCalendarSubpageTouchHandlers(closeCreatePage);

    return (
      <Modal
        animationType="none"
        onRequestClose={() => returnFromCalendarSubpage(closeCreatePage)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={creatingEvent}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.calendarSubpageModalHost}
        >
          <View
            onLayout={handleCalendarSubpageLayout}
            style={styles.calendarSubpageModalContent}
          >
      <Animated.View
        {...calendarSubpageTouchHandlers}
        style={[
          styles.calendarSubpageFullscreen,
          styles.calendarSubpageDraggable,
          calendarSubpageDragStyle,
        ]}
      >
        <ScrollView
          {...calendarSubpageTouchHandlers}
          contentContainerStyle={styles.calendarScreenScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.calendarScreenScroll}
        >
          <View style={styles.calendarCreatePageHeader} {...calendarSubpageTouchHandlers}>
            <Pressable
              accessibilityLabel="Tilbage til kalender"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => returnFromCalendarSubpage(closeCreatePage)}
              style={({ pressed }) => [
                styles.calendarCreateBackButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={STUDOS_THEME.ink} />
              <Text style={styles.calendarCreateBackText}>Kalender</Text>
            </Pressable>
            <Text style={styles.calendarCreatePageTitle}>
              {editingEventId ? 'Rediger gilde' : 'Opret gilde'}
            </Text>
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
              onPress={() => setCoverPickerOpen(true)}
              style={({ pressed }) => [
                styles.calendarCoverPicker,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              {selectedCoverTemplate ? (
                <EventCoverTemplateArt
                  templateId={selectedCoverTemplate.id}
                  style={styles.calendarCoverPreview}
                />
              ) : draft.coverImageUri ? (
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
                  {selectedCoverTemplate?.label ?? (draft.coverImageUri ? 'Cover valgt' : 'Vælg et cover')}
                </Text>
                <Text style={styles.calendarCoverText}>
                  Billedet vises øverst på begivenheden.
                </Text>
              </View>
              <View style={styles.calendarCoverAction}>
                <Ionicons name={draft.coverImageUri || selectedCoverTemplate ? 'swap-horizontal' : 'add'} size={18} color="#FFFFFF" />
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

          <Button
            label={editingEventId ? 'Gem ændringer' : 'Opret gilde'}
            loading={saving}
            onPress={submitEvent}
          />
        </View>
        </ScrollView>
        {coverPickerOpen ? (
          <View style={styles.calendarCoverPickerLayer}>
            <Pressable
              accessibilityLabel="Luk covervalg"
              onPress={() => setCoverPickerOpen(false)}
              style={styles.calendarCoverPickerBackdrop}
            />
            <View style={[styles.chatModalPanel, styles.calendarCoverTemplatePanel]}>
              <View style={styles.chatModalHeader}>
                <View>
                  <Text style={styles.chatModalKicker}>Cover</Text>
                  <Text style={styles.chatModalTitle}>Vælg billede</Text>
                </View>
                <Pressable
                  accessibilityLabel="Luk"
                  accessibilityRole="button"
                  onPress={() => setCoverPickerOpen(false)}
                  style={({ pressed }) => [
                    styles.chatModalCloseButton,
                    pressed ? styles.footerItemPressed : null,
                  ]}
                >
                  <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={pickEventCoverImage}
                style={({ pressed }) => [
                  styles.calendarCoverUploadOption,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <View style={styles.calendarCoverUploadIcon}>
                  <Ionicons name="cloud-upload" size={18} color={STUDOS_THEME.ink} />
                </View>
                <View style={styles.calendarCoverUploadCopy}>
                  <Text style={styles.calendarCoverUploadTitle}>Upload selv</Text>
                  <Text style={styles.calendarCoverUploadText}>Vælg et billede fra telefonen</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8B94A6" />
              </Pressable>

              <View style={styles.calendarCoverTemplateGrid}>
                {EVENT_COVER_TEMPLATES.map((template) => {
                  const selected = draft.coverImageTemplateId === template.id;

                  return (
                    <Pressable
                      accessibilityLabel={`Vælg ${template.label}`}
                      accessibilityRole="button"
                      key={template.id}
                      onPress={() => selectEventCoverTemplate(template)}
                      style={({ pressed }) => [
                        styles.calendarCoverTemplateCard,
                        selected ? styles.calendarCoverTemplateCardSelected : null,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <EventCoverTemplateArt
                        templateId={template.id}
                        style={styles.calendarCoverTemplateImage}
                      />
                      <Text numberOfLines={1} style={styles.calendarCoverTemplateLabel}>
                        {template.label}
                      </Text>
                      {selected ? (
                        <View style={styles.calendarCoverTemplateCheck}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <View style={[styles.calendarScreen, styles.calendarMainScreen]}>
      <Animated.ScrollView
        contentContainerStyle={styles.calendarGridScrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleCalendarGridScroll}
        ref={calendarGridScrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.calendarGridScroll}
      >
      <View style={styles.calendarDayRailBlock}>
        <View style={styles.calendarMonthLine}>
          <Pressable
            accessibilityLabel="Forrige måned"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shiftCalendarRailMonth(-1)}
            style={({ pressed }) => [
              styles.calendarMonthLineButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="chevron-back" size={15} color={STUDOS_THEME.ink} />
          </Pressable>
          <Text numberOfLines={1} style={styles.calendarMonthLineTitle}>
            {calendarRailMonthTitle}
          </Text>
          <Pressable
            accessibilityLabel="Næste måned"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shiftCalendarRailMonth(1)}
            style={({ pressed }) => [
              styles.calendarMonthLineButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="chevron-forward" size={15} color={STUDOS_THEME.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.calendarDayRailContent}
          decelerationRate="fast"
          horizontal
          onLayout={(event) => setCalendarDayRailWidth(event.nativeEvent.layout.width)}
          onMomentumScrollEnd={handleCalendarDayRailScrollEnd}
          onScrollBeginDrag={handleCalendarDayRailScrollBeginDrag}
          onScrollEndDrag={handleCalendarDayRailScrollEnd}
          ref={calendarDayRailRef}
          showsHorizontalScrollIndicator={false}
          snapToOffsets={calendarRailSnapOffsets.length ? calendarRailSnapOffsets : undefined}
        >
          {calendarRailDays.map((day) => {
            const active = selectedCalendarDay === day.id;
            const empty = !day.eventCount;

            return (
              <Pressable
                accessibilityLabel={`${day.weekday} ${day.day}. ${day.month}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: empty, selected: active }}
                disabled={empty}
                key={day.id}
                onPress={() => selectCalendarDay(day.id)}
                style={({ pressed }) => [
                  styles.calendarDayRailItem,
                  active ? styles.calendarDayRailItemActive : null,
                  day.isToday && !active ? styles.calendarDayRailItemToday : null,
                  empty ? styles.calendarDayRailItemMuted : null,
                  pressed && !empty ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={[
                  styles.calendarDayRailWeekday,
                  active ? styles.calendarDayRailTextActive : null,
                ]}>
                  {day.weekday}
                </Text>
                <Text style={[
                  styles.calendarDayRailNumber,
                  active ? styles.calendarDayRailTextActive : null,
                ]}>
                  {day.day}
                </Text>
                <View style={[
                  styles.calendarDayRailSignal,
                  day.eventCount ? styles.calendarDayRailSignalFilled : null,
                ]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {calendarError ? <Text style={styles.errorText}>{calendarError}</Text> : null}
      {calendarStatus ? <Text style={styles.successText}>{calendarStatus}</Text> : null}

      {upcomingEvents.length ? (
        selectedCalendarDayEvents.length ? (
        <View style={styles.calendarEventList}>
          {selectedCalendarDayEvents.map((event) => {
            const dateParts = formatCalendarDateParts(event.date);
            const eventTime = formatCalendarTime(event.startsAt);
            const attendingCount = event.attendingCount ?? event.rsvpCount ?? 0;
            const notAttendingCount = event.notAttendingCount ?? 0;
            const attendeePreview = uniqueByKey(event.attendees ?? [], (person) => person?.memberId).slice(0, CALENDAR_ATTENDEE_STACK_LIMIT);
            const attendeeOverflowCount = Math.max(0, attendingCount - attendeePreview.length);
            const attendingLoading = respondingEventId === `${event.id}:attending`;
            const notAttendingLoading = respondingEventId === `${event.id}:not_attending`;
            const ownsEvent = memberOwnsEvent(event);
            const canRespond = !ownsEvent;
            const eventCoverTemplate = eventCoverTemplateFor(event.coverImageTemplateId);
            const hasEventCover = Boolean(event.coverImageUrl || eventCoverTemplate);

            return (
              <View
                key={event.id}
                onLayout={(layoutEvent) => {
                  calendarEventLayoutsRef.current[String(event.id)] = layoutEvent.nativeEvent.layout;
                }}
                style={styles.calendarEventCard}
              >
                {hasEventCover ? (
                  <View style={styles.calendarEventCoverWrap}>
                    {eventCoverTemplate ? (
                      <EventCoverTemplateArt
                        templateId={eventCoverTemplate.id}
                        style={styles.calendarEventCoverImage}
                      />
                    ) : (
                      <Image
                        resizeMode="cover"
                        source={{ uri: event.coverImageUrl }}
                        style={styles.calendarEventCoverImage}
                      />
                    )}
                    <View style={styles.calendarEventCoverShade} pointerEvents="none" />
                    <View style={[
                      styles.calendarEventCoverTitleBlock,
                      event.creator ? styles.calendarEventCoverTitleBlockWithAvatar : null,
                    ]}>
                      <Text numberOfLines={2} style={styles.calendarEventCoverTitle}>
                        {event.title}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Handlinger for ${event.title}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setCalendarActionEventId(event.id)}
                      style={({ pressed }) => [
                        styles.calendarEventCoverActionButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
                    </Pressable>
                    {event.creator ? (
                      <View style={styles.calendarEventCreatorAvatar}>
                        <Avatar profile={event.creator} variant="calendarCreator" />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.calendarEventBody}>
                  <View style={[
                    styles.calendarEventTopRow,
                    hasEventCover ? styles.calendarEventTopRowCentered : null,
                  ]}>
                    <View style={[
                      styles.calendarDateBadge,
                      hasEventCover && event.creator ? styles.calendarDateBadgeUnderAvatar : null,
                    ]}>
                      <Text style={styles.calendarDateDay}>{dateParts.day}</Text>
                      <Text style={styles.calendarDateMonth}>{dateParts.month}</Text>
                    </View>
                    <View style={[
                      styles.calendarEventCopy,
                      hasEventCover ? styles.calendarEventCopyBesideDate : null,
                    ]}>
                      {!hasEventCover ? (
                        <View style={styles.calendarEventTitleRow}>
                          <Text numberOfLines={2} style={styles.calendarEventTitle}>
                            {event.title}
                          </Text>
                          <Pressable
                            accessibilityLabel={`Handlinger for ${event.title}`}
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => setCalendarActionEventId(event.id)}
                            style={({ pressed }) => [
                              styles.calendarEventActionButton,
                              pressed ? styles.footerItemPressed : null,
                            ]}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color={STUDOS_THEME.ink} />
                          </Pressable>
                        </View>
                      ) : null}
                      {event.creator?.displayName ? (
                        <Text numberOfLines={1} style={styles.calendarCreatorText}>
                          Oprettet af {event.creator.displayName}
                        </Text>
                      ) : null}
                      <View style={styles.calendarMetaLine}>
                        <Ionicons name="calendar" size={14} color={STUDOS_THEME.red} />
                        <Text numberOfLines={1} style={styles.calendarMetaText}>
                          {dateParts.weekday}{eventTime ? ` kl. ${eventTime}` : ''}
                        </Text>
                      </View>
                      {event.location ? (
                        <View style={styles.calendarMetaLine}>
                          <Ionicons name="location" size={14} color={STUDOS_THEME.ink} />
                          <Text numberOfLines={1} style={styles.calendarMetaText}>
                            {event.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {event.description ? (
                    <Text style={styles.calendarDescription}>{event.description}</Text>
                  ) : null}

                  <Pressable
                    accessibilityLabel={`Vis svar for ${event.title}`}
                    accessibilityRole="button"
                    onPress={() => setCalendarAttendanceEventId(event.id)}
                    style={({ pressed }) => [
                      styles.calendarStatsRow,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <View style={styles.calendarAttendeeStack}>
                      {attendeePreview.map((person, index) => (
                        <View
                          key={person.memberId ? `${person.memberId}-${index}` : `attendee-${index}`}
                          style={[
                            styles.calendarAttendeeStackItem,
                            index ? styles.calendarAttendeeStackItemOverlap : null,
                            { zIndex: index + 1 },
                          ]}
                        >
                          <Avatar
                            profile={{
                              displayName: person.displayName ?? 'Ukendt',
                              profilePhotoUrl: person.profilePhotoUrl,
                            }}
                            variant="calendarAttendeeCard"
                          />
                        </View>
                      ))}
                      {attendeeOverflowCount > 0 ? (
                        <View
                          style={[
                            styles.calendarAttendeeOverflowCard,
                            attendeePreview.length ? styles.calendarAttendeeStackItemOverlap : null,
                            { zIndex: attendeePreview.length + 1 },
                          ]}
                        >
                          <Text numberOfLines={1} style={styles.calendarAttendeeOverflowText}>
                            +{attendeeOverflowCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.calendarStatTextGroup}>
                      <Text style={styles.calendarStatText}>{attendingCount} deltager</Text>
                      <View style={styles.calendarStatDot} />
                      <Text style={styles.calendarStatText}>{notAttendingCount} kan ikke</Text>
                    </View>
                  </Pressable>

                  {!canRespond ? null : (
                    <View style={styles.calendarRsvpRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => respondToEvent(event.id, 'attending')}
                        style={({ pressed }) => [
                          styles.calendarRsvpButton,
                          event.myRsvp === 'attending' ? styles.calendarRsvpButtonAttending : null,
                          pressed ? styles.footerItemPressed : null,
                        ]}
                      >
                        {attendingLoading ? (
                          <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                        ) : (
                          <Ionicons
                            name="checkmark-circle"
                            size={17}
                            color={event.myRsvp === 'attending' ? STUDOS_THEME.ink : STUDOS_THEME.blue}
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
                        onPress={() => respondToEvent(event.id, 'not_attending')}
                        style={({ pressed }) => [
                          styles.calendarRsvpButton,
                          event.myRsvp === 'not_attending' ? styles.calendarRsvpButtonDeclined : null,
                          pressed ? styles.footerItemPressed : null,
                        ]}
                      >
                        {notAttendingLoading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Ionicons
                            name="close-circle"
                            size={17}
                            color={event.myRsvp === 'not_attending' ? '#FFFFFF' : STUDOS_THEME.red}
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
                  )}
                </View>
              </View>
            );
          })}
        </View>
        ) : (
          <View style={styles.calendarDayEmptyState}>
            <View style={styles.calendarDayEmptyIcon}>
              <Ionicons name="sparkles" size={26} color={STUDOS_THEME.red} />
            </View>
            <Text style={styles.calendarDayEmptyTitle}>Fri bane den dag</Text>
            <Text style={styles.calendarDayEmptyText}>
              Vælg en dato med markering i rækken, eller opret et nyt gilde på dagen.
            </Text>
          </View>
        )
      ) : sortedEvents.length ? (
        <View style={styles.calendarDayEmptyState}>
          <View style={styles.calendarDayEmptyIcon}>
            <Ionicons name="checkmark-done" size={26} color={STUDOS_THEME.red} />
          </View>
          <Text style={styles.calendarDayEmptyTitle}>Ingen kommende events</Text>
          <Text style={styles.calendarDayEmptyText}>
            Alle oprettede events er afholdt. Du kan stadig finde dem under tidligere events.
          </Text>
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
      <Pressable
        accessibilityLabel={`Åbn tidligere events, ${pastEvents.length} afholdte events`}
        accessibilityRole="button"
        onPress={openPastEventsPage}
        style={({ pressed }) => [
          styles.calendarPastEventsButton,
          pressed ? styles.footerItemPressed : null,
        ]}
      >
        <View style={styles.calendarPastEventsButtonIcon}>
          <Ionicons name="archive" size={19} color={STUDOS_THEME.ink} />
        </View>
        <View style={styles.calendarPastEventsButtonCopy}>
          <Text numberOfLines={1} style={styles.calendarPastEventsButtonTitle}>
            Tidligere events
          </Text>
          <Text numberOfLines={1} style={styles.calendarPastEventsButtonMeta}>
            {pastEvents.length} {pastEvents.length === 1 ? 'afholdt event' : 'afholdte events'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={STUDOS_THEME.red} />
      </Pressable>
      </Animated.ScrollView>

      {calendarAttendanceModal}

      <Modal
        animationType="fade"
        onRequestClose={() => setCalendarActionEventId('')}
        transparent
        visible={Boolean(calendarActionEvent)}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk begivenhedsmenu"
            onPress={() => setCalendarActionEventId('')}
            style={styles.chatModalBackdrop}
          />
          <View style={[styles.chatModalPanel, styles.chatConversationActionMenuPanel]}>
            <View style={styles.chatModalHeader}>
              <View style={styles.chatConversationActionMenuHeading}>
                <Text style={styles.chatModalKicker}>Begivenhed</Text>
                <Text numberOfLines={1} style={styles.chatModalTitle}>
                  {calendarActionEvent?.title ?? 'Gilde'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                onPress={() => setCalendarActionEventId('')}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>

            <View style={styles.chatConversationActionMenuList}>
              {calendarActionEvent && memberOwnsEvent(calendarActionEvent) ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEditPage(calendarActionEvent)}
                    style={({ pressed }) => [
                      styles.chatConversationActionMenuItem,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconWarning]}>
                      <Ionicons name="pencil" size={18} color={STUDOS_THEME.ink} />
                    </View>
                    <Text style={styles.chatConversationActionMenuText}>Rediger</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!calendarActionEvent) {
                        return;
                      }

                      setDeleteEventError('');
                      setCalendarDeleteEventId(calendarActionEvent.id);
                      setCalendarActionEventId('');
                    }}
                    style={({ pressed }) => [
                      styles.chatConversationActionMenuItem,
                      pressed ? styles.footerItemPressed : null,
                    ]}
                  >
                    <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconDanger]}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.chatConversationActionMenuText}>Slet begivenhed</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                  </Pressable>
                </>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(reportingEventId)}
                onPress={() => reportEvent(calendarActionEvent)}
                style={({ pressed }) => [
                  styles.chatConversationActionMenuItem,
                  pressed && !reportingEventId ? styles.footerItemPressed : null,
                ]}
              >
                <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconWarning]}>
                  <Ionicons name="flag" size={18} color={STUDOS_THEME.ink} />
                </View>
                <Text style={styles.chatConversationActionMenuText}>Rapportér begivenhed</Text>
                {reportingEventId === calendarActionEvent?.id ? (
                  <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                )}
              </Pressable>
              {calendarActionEvent?.createdByMemberId
                && String(calendarActionEvent.createdByMemberId) !== String(activeMember?.id ?? '') ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(blockingMemberId)}
                  onPress={() => blockEventCreator(calendarActionEvent)}
                  style={({ pressed }) => [
                    styles.chatConversationActionMenuItem,
                    pressed && !blockingMemberId ? styles.footerItemPressed : null,
                  ]}
                >
                  <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconDanger]}>
                    <Ionicons name="person-remove" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.chatConversationActionMenuText}>Blokér arrangør</Text>
                  {blockingMemberId === String(calendarActionEvent.createdByMemberId) ? (
                    <ActivityIndicator color={STUDOS_THEME.ink} size="small" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deletingEventId) {
            setCalendarDeleteEventId('');
            setDeleteEventError('');
          }
        }}
        transparent
        visible={Boolean(calendarDeleteEvent)}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk slet begivenhed"
            disabled={Boolean(deletingEventId)}
            onPress={() => {
              if (!deletingEventId) {
                setCalendarDeleteEventId('');
                setDeleteEventError('');
              }
            }}
            style={styles.chatModalBackdrop}
          />
          <View style={[styles.chatModalPanel, styles.chatActionConfirmPanel]}>
            <View style={[styles.chatActionConfirmIcon, styles.chatActionConfirmIconDanger]}>
              <Ionicons name="trash" size={24} color="#FFFFFF" />
            </View>
            <Text style={[styles.chatModalTitle, styles.chatActionConfirmTitle]}>
              Slet begivenhed?
            </Text>
            <Text style={[styles.chatCodeModalText, styles.chatActionConfirmText]}>
              {calendarDeleteEvent?.title
                ? `Sletter "${calendarDeleteEvent.title}" for alle inviterede. Det kan ikke fortrydes.`
                : 'Begivenheden slettes for alle inviterede. Det kan ikke fortrydes.'}
            </Text>
            {deleteEventError ? <Text style={styles.errorText}>{deleteEventError}</Text> : null}
            <View style={styles.chatActionConfirmButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(deletingEventId)}
                onPress={() => {
                  setCalendarDeleteEventId('');
                  setDeleteEventError('');
                }}
                style={({ pressed }) => [
                  styles.chatActionCancelButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.chatActionCancelText}>Annuller</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(deletingEventId)}
                onPress={deleteEvent}
                style={({ pressed }) => [
                  styles.chatActionConfirmButton,
                  styles.chatActionConfirmButtonDanger,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                {deletingEventId ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.chatActionConfirmButtonText}>Slet</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Animated.View style={[
        styles.calendarFloatingHeader,
        calendarHeaderContainerStyle,
        calendarHeaderScrolled ? styles.calendarFloatingHeaderScrolled : null,
      ]}>
        <Animated.View style={[styles.overviewTopLine, calendarHeaderContentStyle]}>
          <CalendarTitle />
          <View style={styles.calendarHeaderActions}>
            <Pressable
              accessibilityLabel={`${pendingResponseCount} events afventer svar`}
              accessibilityRole="button"
              accessibilityState={{ disabled: pendingResponseCount === 0 }}
              disabled={pendingResponseCount === 0}
              onPress={openPendingResponsePage}
              style={({ pressed }) => [
                styles.calendarPendingResponseButton,
                pendingResponseCount === 0 ? styles.calendarPendingResponseButtonDisabled : null,
                pressed && pendingResponseCount > 0 ? styles.footerItemPressed : null,
              ]}
            >
              {pendingResponseCount > 0 ? (
                <View style={styles.calendarPendingResponseBadge}>
                  <Text style={styles.calendarPendingResponseBadgeText}>
                    {pendingResponseCount > 9 ? '9+' : pendingResponseCount}
                  </Text>
                </View>
              ) : null}
              <Ionicons name="hourglass-outline" size={15} color={STUDOS_THEME.ink} />
              <Text style={styles.calendarPendingResponseText}>Svar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Opret gilde"
              accessibilityRole="button"
              onPress={openCreatePage}
              style={({ pressed }) => [
                styles.calendarCreateButton,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="add" size={23} color={STUDOS_THEME.ink} />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function ClassBattleScreen({ activeMember, events = [], onOpenEarnCaps, schoolClass, sessionToken }) {
  const leaderboardScrollRef = useRef(null);
  const [leaderboardScope, setLeaderboardScope] = useState('global');
  const [classBattleData, setClassBattleData] = useState(null);
  const [classBattleRowsScrolled, setClassBattleRowsScrolled] = useState(false);
  const activeMembers = schoolClass?.members?.filter((member) => member.status === 'active') ?? [];
  const currentMember = activeMembers.find((member) => String(member.id) === String(activeMember?.id));
  const capsForMember = (member) => {
    const capsSource = member?.capsBalance ?? member?.points;

    return Number.isFinite(Number(capsSource)) ? Number(capsSource) : 1000;
  };
  const classScoreMembers = activeMembers.length ? activeMembers : activeMember ? [activeMember] : [];
  const localClassTotalCaps = classScoreMembers.reduce((total, member) => total + capsForMember(member), 0);
  const localClassMemberCount = Math.max(1, classScoreMembers.length);
  const localClassScore = Math.round(localClassTotalCaps / localClassMemberCount);
  const schoolYear = (() => {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    return `${startYear}/${String(startYear + 1).slice(-2)}`;
  })();
  const fallbackRows = [
    {
      id: schoolClass?.id ?? 'current-class',
      className: schoolClass?.className ?? 'Din klasse',
      schoolName: schoolClass?.schoolName ?? 'Din skole',
      activeMembers: localClassMemberCount,
      totalCaps: localClassTotalCaps,
      score: localClassScore,
      current: true,
    },
    ...GLOBAL_CLASS_BATTLE_PREVIEW_CLASSES,
  ];
  const apiRows = Array.isArray(classBattleData?.classes) ? classBattleData.classes : [];
  const rows = (apiRows.length ? apiRows : fallbackRows)
    .map((row) => {
      const activeMemberCount = Number(row.activeMembers);
      const totalCaps = Number(row.totalCaps);
      const score = Number(row.score);

      return {
        ...row,
        activeMembers: Number.isFinite(activeMemberCount) ? activeMemberCount : null,
        totalCaps: Number.isFinite(totalCaps) ? totalCaps : null,
        score: Number.isFinite(score) ? score : 0,
        current: Boolean(row.current) || String(row.id) === String(schoolClass?.id),
      };
    })
    .sort((left, right) => (
      (right.score - left.score)
      || ((right.totalCaps ?? 0) - (left.totalCaps ?? 0))
      || String(left.className ?? '').localeCompare(String(right.className ?? ''), 'da')
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const memberNameFor = (member) => {
    const fullName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();

    return member?.displayName || fullName || member?.email || 'Ukendt elev';
  };
  const classRows = classScoreMembers
    .map((member) => ({
      id: member?.id ?? member?.email ?? memberNameFor(member),
      className: memberNameFor(member),
      schoolName: schoolClass?.className ?? 'Din klasse',
      score: capsForMember(member),
      current: String(member?.id) === String(activeMember?.id),
      currentPillText: 'Dig',
    }))
    .sort((left, right) => (
      (right.score - left.score)
      || String(left.className ?? '').localeCompare(String(right.className ?? ''), 'da')
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const isClassLeaderboard = leaderboardScope === 'class';
  const visibleRows = isClassLeaderboard ? classRows : rows;
  const currentRow = rows.find((row) => row.current) ?? rows[0];
  const visibleCurrentRow = visibleRows.find((row) => row.current) ?? currentRow ?? visibleRows[0];
  const visibleCurrentRowIndex = visibleRows.findIndex((row) => row.current);
  const currentClassTotalCaps = Number.isFinite(Number(currentRow?.totalCaps))
    ? Number(currentRow.totalCaps)
    : localClassTotalCaps;
  const memberCapsFromApi = Number(classBattleData?.currentMember?.capsBalance);
  const memberCaps = Number.isFinite(memberCapsFromApi) ? memberCapsFromApi : capsForMember(currentMember ?? activeMember);
  const memberClassShare = currentClassTotalCaps > 0
    ? Math.min(100, Math.max(0, (memberCaps / currentClassTotalCaps) * 100))
    : 0;
  const formatNumber = (value) => new Intl.NumberFormat('da-DK').format(value);
  const formatPercent = (value) => new Intl.NumberFormat('da-DK', {
    maximumFractionDigits: 1,
  }).format(value);
  useEffect(() => {
    if (!sessionToken) {
      setClassBattleData(null);
      return undefined;
    }

    let cancelled = false;

    apiFetch('/class-battle', { authToken: sessionToken })
      .then((data) => {
        if (!cancelled) {
          setClassBattleData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClassBattleData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);
  const changeLeaderboardScope = (nextScope) => {
    setLeaderboardScope(nextScope);
    setClassBattleRowsScrolled(false);
    leaderboardScrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const scrollToCurrentLeaderboardRow = () => {
    if (visibleCurrentRowIndex < 0) {
      return;
    }

    leaderboardScrollRef.current?.scrollTo({
      y: Math.max(0, visibleCurrentRowIndex * 72 - 8),
      animated: true,
    });
  };
  const updateClassBattleRowsScrolled = useCallback((event) => {
    const scrolled = event.nativeEvent.contentOffset.y > 4;

    setClassBattleRowsScrolled((current) => (current === scrolled ? current : scrolled));
  }, []);

  return (
    <View style={styles.classBattleScreen}>
      <View>
        <View style={styles.classBattleHeroHeader}>
          <View style={styles.classBattleHeroCopy}>
            <ClassBattleTitle />
            <Text style={styles.classBattleIntroText}>
              Hvem har udført flest gode gerninger og vundet flest dueller?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenEarnCaps}
              style={({ pressed }) => [
                styles.classBattleGoodDeedCard,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <View style={styles.classBattleGoodDeedCardTop}>
                <View style={styles.classBattleGoodDeedIcon}>
                  <Ionicons name="sparkles" size={15} color={STUDOS_THEME.ink} />
                </View>
                <Text numberOfLines={1} style={styles.classBattleGoodDeedKicker}>
                  OPTJEN FLERE CAPS
                </Text>
              </View>
              <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.classBattleGoodDeedTitle}>
                Gode gerninger, streaks og check-ins
              </Text>
              <View style={styles.classBattleGoodDeedFooter}>
                <View style={[styles.classBattleGoodDeedButton, styles.classBattleGoodDeedButtonWide]}>
                  <Ionicons name="sparkles" size={13} color={STUDOS_THEME.yellow} />
                  <Text style={styles.classBattleGoodDeedButtonText}>Åbn Optjen Caps</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.classBattleHeroStats}>
            <View style={styles.classBattleHeaderStatCard}>
              <Text style={styles.classBattleStatLabel}>Placering</Text>
              <Text style={styles.classBattleStatValue}>#{visibleCurrentRow?.rank ?? '-'}</Text>
            </View>
            <View style={styles.classBattleHeaderStatCard}>
              <Text style={styles.classBattleStatLabel}>Dine Caps</Text>
              <View style={styles.classBattleStatValueRow}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={[styles.classBattleStatValue, styles.classBattleCapsStatValue]}
                >
                  {formatNumber(memberCaps)}
                </Text>
                <Image source={CAPS_COIN} resizeMode="contain" style={styles.classBattleStatCoinImage} />
              </View>
            </View>
            <View style={styles.classBattleHeaderStatCard}>
              <Text style={styles.classBattleStatLabel}>Klasseandel</Text>
              <Text style={styles.classBattleStatValue}>{formatPercent(memberClassShare)}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.classBattleHeroLeaderboardHeader}>
          <Text style={styles.classBattleSectionTitle}>
            {isClassLeaderboard ? 'Min klasse' : 'Alle klasser'}
          </Text>
          <Text style={styles.classBattleSectionMeta}>
            {isClassLeaderboard ? (schoolClass?.className ?? 'Din klasse') : `Skoleåret ${schoolYear}`}
          </Text>
        </View>
      </View>

      <View style={styles.classBattleLeaderboardCard}>
        <View style={styles.classBattleScopeSwitch}>
          {[
            { id: 'global', label: 'Alle klasser' },
            { id: 'class', label: 'Min klasse' },
          ].map((scope) => {
            const selected = leaderboardScope === scope.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={scope.id}
                onPress={() => changeLeaderboardScope(scope.id)}
                style={({ pressed }) => [
                  styles.classBattleScopeSwitchItem,
                  selected ? styles.classBattleScopeSwitchItemActive : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={[
                  styles.classBattleScopeSwitchText,
                  selected ? styles.classBattleScopeSwitchTextActive : null,
                ]}>
                  {scope.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[
          styles.classBattleLeaderboardTopBar,
          classBattleRowsScrolled ? styles.classBattleLeaderboardTopBarScrolled : null,
        ]}>
          <Pressable
            accessibilityLabel={isClassLeaderboard ? 'Find mig i klassens rangliste' : 'Find min klasse i ranglisten'}
            accessibilityRole="button"
            onPress={scrollToCurrentLeaderboardRow}
            style={({ pressed }) => [
              styles.classBattleJumpButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Ionicons name="locate" size={13} color={STUDOS_THEME.ink} />
            <Text numberOfLines={1} style={styles.classBattleJumpButtonText}>
              {isClassLeaderboard ? 'Find mig' : 'Find min klasse'}
            </Text>
          </Pressable>
          <View style={styles.classBattleResetInfo}>
            <Ionicons name="refresh" size={12} color="#65748b" />
            <Text numberOfLines={2} style={styles.classBattleResetInfoText}>
              {isClassLeaderboard ? 'Rangeret efter Caps' : 'Rangliste nulstilles d. 1 august'}
            </Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.classBattleRows}
          ref={leaderboardScrollRef}
          nestedScrollEnabled
          onScroll={updateClassBattleRowsScrolled}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.classBattleRowsScroll}
        >
          {visibleRows.map((row) => (
            <View
              key={`${leaderboardScope}-${row.id}`}
              style={[
                styles.classBattleRow,
                row.current ? styles.classBattleRowCurrent : null,
              ]}
            >
              <View style={[
                styles.classBattleRankBadge,
                row.rank === 1 ? styles.classBattleRankBadgeFirst : null,
                row.rank === 2 ? styles.classBattleRankBadgeSecond : null,
                row.rank === 3 ? styles.classBattleRankBadgeThird : null,
              ]}>
                <Text style={[
                  styles.classBattleRankText,
                  row.rank === 1 ? styles.classBattleRankTextFirst : null,
                  row.rank === 2 ? styles.classBattleRankTextSecond : null,
                  row.rank === 3 ? styles.classBattleRankTextThird : null,
                ]}>
                  {row.rank}
                </Text>
              </View>

              <View style={styles.classBattleRowCopy}>
                <View style={styles.classBattleRowTitleLine}>
                  <Text numberOfLines={1} style={styles.classBattleRowTitle}>{row.className}</Text>
                  {row.current ? (
                    <View style={styles.classBattleCurrentPill}>
                      <Text style={styles.classBattleCurrentPillText}>
                        {row.currentPillText ?? 'Din klasse'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.classBattleRowMeta}>{row.schoolName}</Text>
              </View>

              <View style={styles.classBattleScoreBlock}>
                <View style={styles.classBattleScoreValueRow}>
                  <Text style={styles.classBattleScoreText}>{formatNumber(row.score)}</Text>
                  <Image source={CAPS_COIN} resizeMode="contain" style={styles.classBattleScoreCoinImage} />
                </View>
                {isClassLeaderboard ? null : (
                  <Text numberOfLines={1} style={styles.classBattleScoreMetricText}>pr. elev</Text>
                )}
                {!isClassLeaderboard && Number.isFinite(Number(row.totalCaps)) ? (
                  <Text numberOfLines={1} style={styles.classBattleScoreTotalText}>
                    {formatNumber(row.totalCaps)} samlet
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function FeatureScreen({ emptyText, emptyTitle, icon, kicker, locked = false, title }) {
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
        <View style={[
          styles.emptyFeatureIcon,
          locked ? styles.emptyFeatureIconLocked : null,
        ]}>
          <Ionicons
            name={locked ? 'lock-closed' : icon}
            size={locked ? 28 : 30}
            color={locked ? STUDOS_THEME.ink : '#ef5b3f'}
          />
        </View>
        <Text style={styles.sectionTitle}>{emptyTitle}</Text>
        <Text style={styles.feedText}>{emptyText}</Text>
      </View>
    </View>
  );
}

function MiniGamesScreen({ emptyText, emptyTitle, onOpenGame }) {
  const miniGames = [
    {
      id: 'bottle-pointer',
      title: 'Flaskehalsen peger på',
      description: 'Vælg random, og lad flaskens retning afgøre dagens sjove opgave. Klar til at tage imod udfordringen?',
    },
    {
      id: 'lie-truth',
      title: 'Snyd (terninger)',
      description: 'Spillere siger sandheder eller løgne, og gruppen skal gennemskue, hvem der sniger med. Hvem tager pointet for det skarpeste bluff?',
    },
  ];

  return (
    <View style={styles.flowStack}>
      <View style={styles.tabHeader}>
        <View style={styles.miniGamesScreenHeader}>
          <View style={styles.miniGamesTitleWithLogoRow}>
            <Text style={[styles.title, styles.titleSmallHeader, styles.miniGamesHeaderTitle]} numberOfLines={1}>
              Arcade Hub
            </Text>
            <MiniGamesHeaderLogo style={styles.miniGamesHeaderLogoInTitle} />
          </View>
          <Text style={[styles.miniGamesHeaderBody, styles.miniGamesHeaderBodySmall]}>
            Spil, konkurrér og grin — og find ud af, hvem i din gruppe der leverer det skarpeste comeback i hver mini-game-runde.
          </Text>
        </View>
      </View>
      <View style={styles.miniGamesGameList}>
        {miniGames.map((game) => (
          <Pressable
            key={game.id}
            onPress={() => onOpenGame?.(game.id)}
            style={({ pressed }) => [
              styles.panel,
              styles.miniGamesCardPanel,
              styles.miniGamesCardRow,
              pressed ? styles.miniGamesCardPressed : null,
            ]}
          >
            <View style={styles.miniGamesCardTextWrap}>
              <View style={styles.miniGamesCardTitleRow}>
                <Text style={[styles.sectionTitle, styles.miniGamesCardTitle]}>{game.title}</Text>
                {game.id === 'bottle-pointer' ? (
                  <MiniGamesBottleIcon style={styles.miniGamesBottleIconInTitle} />
                ) : null}
              </View>
              <Text style={[styles.feedText, styles.miniGamesCardBody]}>{game.description}</Text>
            </View>
            <View style={styles.miniGamesCardChevronWrap}>
              <Ionicons name="chevron-forward-outline" size={20} color={STUDOS_THEME.red} style={styles.miniGamesCardChevronIcon} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BottlePointerScreen({ onBack }) {
  const [players, setPlayers] = useState(['Sara', 'Jonas', 'Mia', 'Mikkel']);
  const [draftPlayer, setDraftPlayer] = useState('');
  const [spinResult, setSpinResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinOffsetRef = useRef(0);
  const wheelSize = 296;
  const halfWheel = wheelSize / 2;

  useEffect(() => {
    const spinListener = spinValue.addListener(({ value }) => {
      spinOffsetRef.current = value;
    });

    return () => {
      spinValue.removeListener(spinListener);
      spinValue.stopAnimation();
    };
  }, [spinValue]);

  const playerCount = players.length;
  const canSpin = playerCount > 1 && !spinning;
  const canAddPlayer = draftPlayer.trim().length > 0;
  const segmentAngle = playerCount > 0 ? 360 / playerCount : 0;
  const labelRadius = halfWheel - 30;

  const spinAngle = useMemo(() => spinValue.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  }), [spinValue]);

  const addPlayer = () => {
    const nextPlayer = draftPlayer.trim();

    if (!nextPlayer) {
      return;
    }

    setPlayers((currentPlayers) => [...currentPlayers, nextPlayer]);
    setDraftPlayer('');
    setSpinResult(null);
    setAddPlayerModalOpen(false);
  };

  const removePlayer = (indexToRemove) => {
    setPlayers((currentPlayers) => currentPlayers.filter((_, index) => index !== indexToRemove));
    setSpinResult(null);
  };

  const closeAddPlayerModal = () => {
    setAddPlayerModalOpen(false);
    setDraftPlayer('');
  };

  const spinWheel = () => {
    if (!canSpin) {
      return;
    }

    const winnerIndex = Math.floor(Math.random() * playerCount);
    const winnerName = players[winnerIndex];
    const fullTurns = 3 + Math.floor(Math.random() * 3);
    const jitter = playerCount > 1 ? (Math.random() - 0.5) * segmentAngle * 0.12 : 0;
    const winnerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetAngle = spinOffsetRef.current + fullTurns * 360 - winnerAngle + jitter;

    setSpinning(true);
    setSpinResult({ name: winnerName, index: winnerIndex });

    Animated.timing(spinValue, {
      toValue: targetAngle,
      duration: 3400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSpinning(false);
      }
    });
  };

  return (
    <View style={styles.flowStack}>
        <View style={styles.tabHeader}>
        <View style={styles.miniGamesScreenHeader}>
          <View style={[styles.miniGamesTitleWithLogoRow, styles.miniGamesPointerHeaderRow]}>
            <Pressable onPress={onBack} hitSlop={10} style={styles.miniGamesBackButton}>
              <Ionicons name="arrow-back" size={20} color={STUDOS_THEME.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddPlayerModalOpen(true)}
              style={({ pressed }) => [
                styles.luckyTopAddButton,
                pressed ? styles.luckyTopAddButtonPressed : null,
              ]}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeAddPlayerModal}
        transparent
        visible={addPlayerModalOpen}
      >
        <View style={[styles.chatModalRoot, styles.luckyAddPlayerModalRoot]}>
          <Pressable
            accessibilityLabel="Luk tilføj spiller"
            style={styles.chatModalBackdrop}
            onPress={closeAddPlayerModal}
          />
          <View style={[styles.chatModalPanel, styles.luckyAddPlayerModal]}>
            <Text style={styles.sectionTitle}>Tilføj spiller</Text>
            <Text style={[styles.feedText, styles.luckyAddModalDesc]}>
              Skriv navnet på spilleren, og tryk derefter “Tilføj”.
            </Text>
            <TextInput
              autoCapitalize="words"
              placeholder="Navn på spiller"
              value={draftPlayer}
              onChangeText={setDraftPlayer}
                onSubmitEditing={addPlayer}
                returnKeyType="done"
                style={[styles.input, styles.luckyAddModalInput]}
              />
            <View style={styles.luckyModalPlayerSection}>
              <Text style={styles.luckyModalPlayerTitle}>
                Tilføjede spillere ({players.length})
              </Text>
              {players.length ? (
                <View style={styles.luckyPlayerListWrap}>
                  {players.map((player, index) => (
                    <View key={`pill-${player}-${index}`} style={styles.luckyPlayerPill}>
                      <Text numberOfLines={1} style={styles.luckyPlayerPillText}>{player}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => removePlayer(index)}
                        disabled={spinning}
                        style={styles.luckyPlayerPillRemove}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={spinning ? '#aeb4c3' : '#A94D53'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.feedText, styles.luckyEmptyText]}>Ingen spillere endnu.</Text>
              )}
            </View>
            <View style={styles.luckyAddModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeAddPlayerModal}
                style={({ pressed }) => [
                  styles.luckyAddModalGhostButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.luckyAddModalGhostButtonText}>Annuller</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canAddPlayer}
                onPress={addPlayer}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.luckyAddModalPrimaryButton,
                  pressed && canAddPlayer ? styles.primaryButtonPressed : null,
                  !canAddPlayer ? styles.primaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>Tilføj</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.luckyWheelContainer}>
        <View style={styles.luckyPointer} />
        <View
          style={[
            styles.luckyWheelShell,
            {
              width: wheelSize,
              height: wheelSize,
              borderRadius: halfWheel,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.luckyWheel,
              {
                width: wheelSize,
                height: wheelSize,
                borderRadius: halfWheel,
                transform: [{ rotate: spinAngle }],
              },
            ]}
          >
            <View style={styles.luckyWheelPatternLayer}>
              <View style={styles.luckyWheelPatternBandOne} />
              <View style={styles.luckyWheelPatternBandTwo} />
              <View style={styles.luckyWheelPatternBandThree} />
            </View>
            {playerCount > 1 ? players.map((_, index) => (
              <View
                key={`marker-${index}`}
                style={[
                  styles.luckyWheelMarker,
                  { transform: [{ rotate: `${index * segmentAngle}deg` }]},
                ]}
              >
                <View style={styles.luckyWheelMarkerLine} />
              </View>
            )) : null}
            {players.map((player, index) => {
              const markerAngle = segmentAngle * index - 90 + segmentAngle / 2;

              return (
                <View
                  key={`player-${index}-${player}`}
                  style={[
                    styles.luckyWheelPlayerWrap,
                    {
                      left: halfWheel - 62,
                      top: halfWheel - 12,
                      transform: [
                        { rotate: `${markerAngle}deg` },
                        { translateY: -labelRadius },
                        { rotate: `${-markerAngle}deg` },
                      ],
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={styles.luckyWheelPlayerLabel}>
                    {player}
                  </Text>
                </View>
              );
            })}
            <View style={styles.luckyWheelCenterLogoWrap}>
              <Image
                resizeMode="contain"
                source={STUDOS_LOGO}
                style={styles.luckyWheelCenterLogo}
              />
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.luckyContent}>
        <View style={styles.luckyActionBlock}>
          <Pressable
            accessibilityRole="button"
            onPress={spinWheel}
            disabled={!canSpin}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.luckySpinButton,
              pressed && canSpin ? styles.luckySpinButtonPressed : null,
              pressed && canSpin ? styles.primaryButtonPressed : null,
              !canSpin ? styles.primaryButtonDisabled : null,
            ]}
          >
            <View style={styles.luckySpinButtonLabel}>
              <Text style={[styles.primaryButtonText, styles.luckySpinButtonText]}>Spin</Text>
              <View style={styles.luckySpinWordmark}>
                <View style={styles.luckySpinWordmarkTextRow}>
                  <Text numberOfLines={1} style={[styles.luckySpinWordmarkText, styles.loginWordmarkTextLight]}>Stu</Text>
                  <Text numberOfLines={1} style={[styles.luckySpinWordmarkText, styles.luckySpinWordmarkTextWhite]}>dos</Text>
                </View>
                <View style={styles.luckySpinWordmarkUnderline} />
                <View style={styles.luckySpinWordmarkDot} />
              </View>
              <Text style={[styles.primaryButtonText, styles.luckySpinButtonText]}>hjulet</Text>
            </View>
          </Pressable>

          <Text style={styles.luckyWheelHint}>
            {canSpin ? `Spillere: ${playerCount}` : 'Tilføj mindst 2 spillere, så vi kan spinne.'}
          </Text>
        </View>

      </View>
    </View>
  );
}

function MiniGamesHeaderLogo({ style }) {
  return (
    <View style={[styles.miniGamesHeaderLogo, style]}>
      <View style={styles.miniGamesHeaderLogoDice}>
        <View style={styles.sidebarDiceIcon}>
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipTopLeft]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipTopRight]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipCenter]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipBottomLeft]} />
          <View style={[styles.sidebarDicePip, styles.sidebarDicePipBottomRight]} />
        </View>
      </View>
    </View>
  );
}

function MiniGamesBottleIcon({ style }) {
  return (
    <View style={[styles.miniGamesBottleIcon, style]}>
      <Ionicons name="wine-outline" size={16} color={STUDOS_THEME.red} />
      <View style={styles.miniGamesBottleBadge}>
        <Text style={styles.miniGamesBottleLogoText}>S</Text>
      </View>
    </View>
  );
}

function EarnCapsScreen({
  activeMember,
  onCapsBalanceChange,
  onOpenPointDuel,
  sessionToken,
  weeklyCheckInSnapshot,
}) {
  const todayDayKey = moodDayKeyFor();
  const checkInStorageKey = useMemo(
    () => `${EARN_CAPS_CHECKIN_STORAGE_KEY}.${activeMember?.id ?? activeMember?.email ?? 'guest'}`,
    [activeMember?.email, activeMember?.id],
  );
  const [checkInState, setCheckInState] = useState({
    completedWeeks: 0,
    lastDayKey: '',
    streak: 0,
  });
  const [checkInError, setCheckInError] = useState('');
  const [earnCapsGoodDeed, setEarnCapsGoodDeed] = useState(null);
  const [earnCapsGoodDeedError, setEarnCapsGoodDeedError] = useState('');
  const [earnCapsGoodDeedReward, setEarnCapsGoodDeedReward] = useState(null);
  const [earnCapsGoodDeedSubmitting, setEarnCapsGoodDeedSubmitting] = useState(false);
  const normalizeCheckInState = useCallback((payload = {}) => ({
    completedWeeks: Math.max(0, Number(payload.completedWeeks) || 0),
    lastDayKey: payload.lastDayKey ? String(payload.lastDayKey) : '',
    streak: Math.min(7, Math.max(0, Number(payload.streak) || 0)),
  }), []);
  useEffect(() => {
    if (weeklyCheckInSnapshot) {
      setCheckInState(normalizeCheckInState(weeklyCheckInSnapshot));
      setCheckInError('');
    }
  }, [normalizeCheckInState, weeklyCheckInSnapshot]);
  useEffect(() => {
    let cancelled = false;

    if (sessionToken) {
      apiFetch('/check-ins/weekly', { authToken: sessionToken })
        .then((data) => {
          if (!cancelled) {
            setCheckInState(normalizeCheckInState(data?.weeklyCheckIn));
            setCheckInError('');
          }
        })
        .catch((apiError) => {
          if (!cancelled) {
            setCheckInError(apiError.message || 'Check-in kunne ikke hentes.');
          }
        });

      return () => {
        cancelled = true;
      };
    }

    SessionStore.getItemAsync(checkInStorageKey)
      .then((storedCheckIn) => {
        if (cancelled || !storedCheckIn) {
          return;
        }

        let parsedCheckIn = null;

        try {
          parsedCheckIn = JSON.parse(storedCheckIn);
        } catch {
          parsedCheckIn = null;
        }

        if (!parsedCheckIn || typeof parsedCheckIn !== 'object') {
          return;
        }

        setCheckInState(normalizeCheckInState(parsedCheckIn));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [checkInStorageKey, normalizeCheckInState, sessionToken]);

  const todayDayNumber = dayNumberForDayKey(todayDayKey);
  const lastCheckInDayNumber = dayNumberForDayKey(checkInState.lastDayKey);
  const checkedInToday = checkInState.lastDayKey === todayDayKey;
  const checkInStreak = (() => {
    const storedStreak = Math.min(7, Math.max(0, Number(checkInState.streak) || 0));

    if (!storedStreak || !lastCheckInDayNumber || !todayDayNumber) {
      return 0;
    }

    if (checkedInToday || lastCheckInDayNumber === todayDayNumber - 1) {
      if (!checkedInToday && storedStreak >= 7) {
        return 0;
      }

      return storedStreak;
    }

    return 0;
  })();
  const refreshEarnCapsGoodDeed = useCallback(async () => {
    if (!sessionToken) {
      setEarnCapsGoodDeed(null);
      return null;
    }

    try {
      const data = await apiFetch('/good-deeds/current', { authToken: sessionToken });
      const nextGoodDeed = data?.goodDeed ?? null;

      setEarnCapsGoodDeed(nextGoodDeed);
      setEarnCapsGoodDeedError('');
      return nextGoodDeed;
    } catch (apiError) {
      setEarnCapsGoodDeed(null);
      setEarnCapsGoodDeedError(apiError.message || 'Ugens gode gerning kunne ikke hentes.');
      return null;
    }
  }, [sessionToken]);
  useEffect(() => {
    refreshEarnCapsGoodDeed();
  }, [refreshEarnCapsGoodDeed]);

  const earnCapsGoodDeedClaim = earnCapsGoodDeed?.myClaim ?? null;
  const earnCapsGoodDeedBaseCaps = Number.isFinite(Number(earnCapsGoodDeed?.week?.baseCaps))
    ? Number(earnCapsGoodDeed.week.baseCaps)
    : 25;
  const canClaimEarnCapsGoodDeed = Boolean(sessionToken)
    && !earnCapsGoodDeedSubmitting
    && !earnCapsGoodDeedClaim;
  const claimEarnCapsGoodDeed = async () => {
    if (!canClaimEarnCapsGoodDeed) {
      return;
    }

    setEarnCapsGoodDeedSubmitting(true);
    setEarnCapsGoodDeedError('');

    try {
      const data = await apiFetch('/good-deeds/claims', {
        authToken: sessionToken,
        method: 'POST',
        body: JSON.stringify({}),
      });

      setEarnCapsGoodDeed(data?.goodDeed ?? null);
      setEarnCapsGoodDeedReward({
        amount: Number(data?.awardedCaps ?? data?.goodDeed?.myClaim?.totalCaps ?? earnCapsGoodDeedBaseCaps) || earnCapsGoodDeedBaseCaps,
      });
      if (Number.isFinite(Number(data?.capsBalance))) {
        onCapsBalanceChange?.(Number(data.capsBalance));
      }
    } catch (apiError) {
      setEarnCapsGoodDeedError(apiError.message || 'Ugens gode gerning kunne ikke claimes.');
    } finally {
      setEarnCapsGoodDeedSubmitting(false);
    }
  };
  const methods = [
    {
      id: 'weekly',
      actionDisabled: !canClaimEarnCapsGoodDeed,
      actionDone: Boolean(earnCapsGoodDeedClaim),
      actionLabel: earnCapsGoodDeedClaim ? 'Claimet' : 'Claim',
      actionLoading: earnCapsGoodDeedSubmitting,
      actionVariant: 'claim',
      icon: 'heart',
      missionLabel: 'Denne uges gerning',
      reward: `+${earnCapsGoodDeedBaseCaps}`,
      statusText: earnCapsGoodDeedError,
      subtitle: earnCapsGoodDeed?.week?.title ?? 'Henter ugens gerning...',
      title: 'Ugens gode gerning',
      onPress: claimEarnCapsGoodDeed,
    },
    {
      id: 'check-in',
      actionAlignRight: true,
      actionDisabled: true,
      actionIconRight: 'camera',
      actionLabel: 'Kommer snart',
      icon: 'qr-code',
      reward: '+50',
      subtitle: 'Tjek ind ved fitness, klubber og events ved at scanne QR-koden.',
      title: 'Check-in',
      onPress: () => {},
    },
    {
      id: 'duels',
      actionAlignRight: true,
      actionIconRight: 'shield',
      actionLabel: 'Åbn dueller',
      icon: 'shield',
      reward: 'Indsats',
      subtitle: 'Udfordr dit crew i challenges. I bestemmer indsats og udfordring.',
      title: 'Dueller om Caps',
      onPress: onOpenPointDuel,
      swords: true,
    },
  ];

  return (
    <>
      <GoodDeedClaimRewardModal
        reward={earnCapsGoodDeedReward}
        visible={Boolean(earnCapsGoodDeedReward)}
        onDismiss={() => setEarnCapsGoodDeedReward(null)}
      />
      <View style={styles.earnCapsScreen}>
      <View style={styles.earnCapsHeroHeader}>
        <View style={styles.earnCapsHeroCopy}>
          <EarnCapsTitle />
          <Text style={styles.earnCapsIntroText}>
            Optjenes gennem gode gerninger, crew-challenges, weekly streaks og check-ins.
          </Text>
        </View>
      </View>
      <View style={styles.earnCapsCheckInCard}>
        <View style={styles.earnCapsCheckInHeader}>
          <View style={styles.earnCapsCheckInIconWrap}>
            <Image source={STUDOS_LOGO} resizeMode="contain" style={styles.earnCapsCheckInLogo} />
          </View>
          <View style={styles.earnCapsCheckInCopy}>
            <Text numberOfLines={1} style={styles.earnCapsCheckInTitle}>
              Weekly streak
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={styles.earnCapsCheckInText}
            >
              Åbn appen 7 dage i træk og få 100 Caps.
            </Text>
          </View>
          <View style={styles.earnCapsCheckInRewardPill}>
            <Text numberOfLines={1} style={styles.earnCapsCheckInRewardText}>+100</Text>
            <Image source={CAPS_COIN} resizeMode="contain" style={styles.earnCapsCheckInRewardCoin} />
          </View>
        </View>
        <View style={styles.earnCapsCheckInDays}>
          {Array.from({ length: 7 }, (_, index) => {
            const dayNumber = index + 1;
            const completed = dayNumber <= checkInStreak;
            const current = !checkedInToday && dayNumber === Math.min(7, checkInStreak + 1);

            return (
              <View
                key={dayNumber}
                style={[
                  styles.earnCapsCheckInDay,
                  completed ? styles.earnCapsCheckInDayDone : null,
                  current ? styles.earnCapsCheckInDayCurrent : null,
                ]}
              >
                {completed ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.earnCapsCheckInDayText,
                    current ? styles.earnCapsCheckInDayTextCurrent : null,
                  ]}>
                    {dayNumber}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        {checkInError ? (
          <Text style={styles.earnCapsCheckInError}>{checkInError}</Text>
        ) : null}
      </View>
      <View style={styles.earnCapsMethodsPanel}>
        <View style={styles.earnCapsMethodsPanelHeader}>
          <Text numberOfLines={1} style={styles.earnCapsMethodsPanelTitle}>
            Andre måder at optjene Caps
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.earnCapsMethodStack}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={styles.earnCapsMethodsScroll}
        >
          {methods.map((method) => (
            <View key={method.id} style={styles.earnCapsMethodCard}>
              <View style={styles.earnCapsMethodIconWrap}>
                {method.swords ? (
                  <View style={styles.earnCapsDuelIcon}>
                    <Ionicons name="shield" size={24} color={STUDOS_THEME.yellow} />
                    <MaterialCommunityIcons
                      name="sword-cross"
                      size={17}
                      color={STUDOS_THEME.red}
                      style={styles.earnCapsDuelSwords}
                    />
                  </View>
                ) : (
                  <Ionicons name={method.icon} size={23} color={STUDOS_THEME.red} />
                )}
              </View>
              <View style={styles.earnCapsMethodCopy}>
                <View style={styles.earnCapsMethodTitleLine}>
                  <Text numberOfLines={1} style={styles.earnCapsMethodTitle}>{method.title}</Text>
                  <View style={styles.earnCapsRewardPill}>
                    <Text numberOfLines={1} style={styles.earnCapsRewardText}>{method.reward}</Text>
                    {method.reward.startsWith('+') ? (
                      <Image source={CAPS_COIN} resizeMode="contain" style={styles.earnCapsRewardCoin} />
                    ) : null}
                  </View>
                </View>
                {method.missionLabel ? (
                  <View style={styles.earnCapsWeeklyMission}>
                    <Text numberOfLines={1} style={styles.earnCapsWeeklyMissionLabel}>
                      {method.missionLabel}
                    </Text>
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                      numberOfLines={1}
                      style={styles.earnCapsWeeklyMissionText}
                    >
                      {method.subtitle}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.earnCapsMethodText}>{method.subtitle}</Text>
                )}
                {method.statusText ? (
                  <Text numberOfLines={2} style={styles.earnCapsMethodError}>
                    {method.statusText}
                  </Text>
                ) : null}
                {typeof method.onPress === 'function' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(method.actionDisabled)}
                    onPress={method.onPress}
                    style={({ pressed }) => [
                      method.actionVariant === 'claim' ? styles.classBattleGoodDeedButton : styles.earnCapsMethodAction,
                      method.actionVariant === 'claim' ? styles.earnCapsClaimAction : null,
                      method.actionAlignRight ? styles.earnCapsMethodActionRight : null,
                      method.actionDisabled
                        ? method.actionVariant === 'claim'
                          ? styles.classBattleGoodDeedButtonDisabled
                          : styles.earnCapsMethodActionDisabled
                        : null,
                      pressed && !method.actionDisabled ? styles.footerItemPressed : null,
                    ]}
                  >
                    {method.actionLoading ? (
                      <ActivityIndicator
                        color={method.actionVariant === 'claim' ? STUDOS_THEME.yellow : '#FFFFFF'}
                        size="small"
                      />
                    ) : (
                      <>
                        {method.actionVariant === 'claim' ? (
                          <Ionicons
                            name={method.actionDone ? 'checkmark-circle' : 'sparkles'}
                            size={13}
                            color={method.actionDisabled ? '#65748b' : STUDOS_THEME.yellow}
                          />
                        ) : null}
                        <Text style={[
                          method.actionVariant === 'claim'
                            ? styles.classBattleGoodDeedButtonText
                            : styles.earnCapsMethodActionText,
                          method.actionVariant === 'claim' && method.actionDisabled
                            ? styles.classBattleGoodDeedButtonTextDisabled
                            : null,
                        ]}>
                          {method.actionLabel}
                        </Text>
                        {method.actionVariant === 'claim' ? null : (
                          method.actionIconRight === 'shield' ? (
                            <View style={styles.earnCapsActionDuelIcon}>
                              <Ionicons name="shield" size={15} color="#FFFFFF" />
                              <MaterialCommunityIcons
                                name="sword-cross"
                                size={11}
                                color={STUDOS_THEME.red}
                                style={styles.earnCapsActionDuelSwords}
                              />
                            </View>
                          ) : (
                            <Ionicons
                              name={method.actionIconRight ?? (method.actionDone ? 'checkmark' : 'chevron-forward')}
                              size={15}
                              color="#FFFFFF"
                            />
                          )
                        )}
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      </View>
    </>
  );
}

function SettingsScreen({
  notificationState,
  schoolClass,
  onEnableAndroidNotifications,
  onSendAndroidNotificationTest,
}) {
  const tokenPreview = notificationState?.expoPushToken
    ? notificationState.expoPushToken
    : 'Ikke gemt endnu';

  return (
    <View style={styles.flowStack}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={styles.kicker}>{schoolClass.className}</Text>
          <Text style={styles.title}>Indstillinger</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="settings" size={28} color="#f6d36d" />
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.settingsNotificationHeader}>
          <View style={styles.settingsNotificationIcon}>
            <Ionicons name="shield-checkmark" size={24} color={STUDOS_THEME.red} />
          </View>
          <View style={styles.settingsNotificationCopy}>
            <Text style={styles.sectionTitle}>Kontakt og moderation</Text>
            <Text style={styles.feedText}>Kontakt Studos ved sikkerhed, rapporter eller spørgsmål.</Text>
          </View>
        </View>
        <View style={styles.settingsNotificationTokenBox}>
          <Text style={styles.settingsNotificationTokenLabel}>Support</Text>
          <Text selectable style={styles.settingsNotificationTokenText}>{STUDOS_SUPPORT_EMAIL}</Text>
        </View>
        <Button
          label="Skriv til support"
          onPress={() => Linking.openURL(`mailto:${STUDOS_SUPPORT_EMAIL}?subject=${encodeURIComponent('Studos support')}`)}
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.settingsNotificationHeader}>
          <View style={styles.settingsNotificationIcon}>
            <Ionicons name="notifications" size={24} color={STUDOS_THEME.red} />
          </View>
          <View style={styles.settingsNotificationCopy}>
            <Text style={styles.sectionTitle}>Android push</Text>
            <Text style={styles.feedText}>Status: {notificationState?.permissionStatus ?? 'unknown'}</Text>
          </View>
        </View>

        {notificationState?.error ? <Text style={styles.errorText}>{notificationState.error}</Text> : null}
        {notificationState?.message ? <Text style={styles.successText}>{notificationState.message}</Text> : null}

        {ANDROID_NOTIFICATIONS_ENABLED ? (
          <>
            <Button
              label={notificationState?.expoPushToken ? 'Opdater Android token' : 'Aktivér Android push'}
              loading={notificationState?.loading}
              onPress={onEnableAndroidNotifications}
            />
            <Button
              label="Send testnotifikation"
              loading={notificationState?.testLoading}
              onPress={onSendAndroidNotificationTest}
            />
            <View style={styles.settingsNotificationTokenBox}>
              <Text style={styles.settingsNotificationTokenLabel}>Expo push token</Text>
              <Text selectable style={styles.settingsNotificationTokenText}>{tokenPreview}</Text>
            </View>
          </>
        ) : (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Android only</Text>
            <Text style={styles.noticeText}>
              iOS springes over, indtil Apple Developer-kontoen er klar.
            </Text>
          </View>
        )}
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

function CrewScreen({
  activeMember,
  activeMembers = [],
  onOpenDirectChat,
  schoolClass,
  sessionToken,
}) {
  const rawMembers = Array.isArray(activeMembers) ? activeMembers : [];
  const activeMemberId = String(activeMember?.id ?? '');
  const [crewSource, setCrewSource] = useState('class');
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState('');
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [phoneModalName, setPhoneModalName] = useState('');
  const [phoneModalNumber, setPhoneModalNumber] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (!activeMember?.id || !sessionToken) {
      if (isMounted) {
        setConnections([]);
        setConnectionsError('');
        setConnectionsLoading(false);
      }

      return () => {
        isMounted = false;
      };
    }

    setConnectionsLoading(true);
    setConnectionsError('');

    apiFetch(`/members/${encodeURIComponent(activeMember.id)}/connections`, {
      authToken: sessionToken,
    })
      .then((data) => {
        if (isMounted) {
          setConnections(data.connections ?? []);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setConnectionsError(error.message || 'Kunne ikke hente venner.');
          setConnections([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setConnectionsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeMember?.id, sessionToken]);

  const crewMembers = useMemo(() => {
    const normalizedMembers = uniqueById(rawMembers);
    const withoutSelf = activeMemberId
      ? normalizedMembers.filter((member) => String(member.id ?? '') !== activeMemberId)
      : normalizedMembers;

    return withoutSelf.sort((left, right) => {
      const leftRoleOrder = left.role === 'owner' ? 0 : (left.role === 'moderator' ? 1 : 2);
      const rightRoleOrder = right.role === 'owner' ? 0 : (right.role === 'moderator' ? 1 : 2);

      if (leftRoleOrder !== rightRoleOrder) {
        return leftRoleOrder - rightRoleOrder;
      }

      const leftName = String(left.displayName || `${left.firstName ?? ''} ${left.lastName ?? ''}` || '').trim();
      const rightName = String(right.displayName || `${right.firstName ?? ''} ${right.lastName ?? ''}` || '').trim();

      return leftName.localeCompare(rightName, 'da');
    });
  }, [rawMembers, activeMemberId]);

  const classRows = useMemo(() => crewMembers.map((member) => {
    const displayName = member.displayName
      || `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
      || 'Ukendt medlem';

    return {
      displayName,
      meta: PROFILE_ROLE_LABELS[member.role] || 'Elev',
      profile: member,
    };
  }), [crewMembers]);

  const friendRows = useMemo(() => {
    const acceptedFriends = (Array.isArray(connections) ? connections : [])
      .filter((connection) => connection?.status === 'accepted')
      .map((connection) => connection?.otherMember ?? connection?.member)
      .filter(Boolean);

    return uniqueById(acceptedFriends)
      .map((member) => {
        const displayName = member.displayName
          || `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
          || 'Ukendt medlem';
        const connectionClassName = member?.class?.className;

        return {
          displayName,
          meta: connectionClassName ? `Klasse: ${connectionClassName}` : 'Ven',
          profile: member,
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'da'));
  }, [connections]);

  const showClassCrew = crewSource === 'class';
  const currentRows = showClassCrew ? classRows : friendRows;
  return (
    <View style={[styles.flowStack, styles.crewScreen]}>
      <View style={styles.tabHeader}>
        <View style={styles.titleWithLogoRow}>
          <Text style={[styles.title, styles.titleSmallHeader]}>Mit crew</Text>
          <CrewTitleGraphic />
        </View>
      </View>
      <Text style={styles.feedText}>
        Her kan du se hele dit crew, både fra klassen og eksterne connections
      </Text>

      <View style={[styles.panel, styles.crewPanel]}>
        <View style={styles.crewSourceTabs}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCrewSource('class')}
            style={({ pressed }) => [
              styles.crewSourceTab,
              showClassCrew ? styles.crewSourceTabActive : null,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Text style={[
              styles.crewSourceTabText,
              showClassCrew ? styles.crewSourceTabTextActive : null,
            ]}>
              Min klasse
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCrewSource('friends')}
            style={({ pressed }) => [
              styles.crewSourceTab,
              !showClassCrew ? styles.crewSourceTabActive : null,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Text style={[
              styles.crewSourceTabText,
              !showClassCrew ? styles.crewSourceTabTextActive : null,
            ]}>
              Andre venner
            </Text>
          </Pressable>
        </View>
        {connectionsError && !showClassCrew ? <Text style={styles.errorText}>{connectionsError}</Text> : null}
        {connectionsLoading && !showClassCrew ? <ActivityIndicator color={STUDOS_THEME.ink} /> : null}
        {currentRows.length ? (
          <ScrollView
            contentContainerStyle={styles.crewMemberList}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.crewMemberListScroll}
          >
            {currentRows.map((entry) => {
              const displayName = entry.displayName;
              const metaText = entry.meta;
              const profile = entry.profile;
              const rawPhone = String(profile?.phone ?? '').trim();
              const normalizedPhone = rawPhone.replace(/[^\d+]/g, '');
              const canCall = Boolean(normalizedPhone.length);
              return (
                <View
                  key={profile.id || profile.email || displayName}
                  style={styles.connectionRow}
                >
                  <Avatar profile={profile} variant="smallCircle" />
                  <View style={styles.connectionCopy}>
                    <Text numberOfLines={1} style={styles.connectionName}>
                      {displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.connectionMeta}>
                      {metaText}
                    </Text>
                  </View>
                  <View style={styles.crewMemberActionIcons}>
                    {onOpenDirectChat && profile?.id ? (
                      <Pressable
                        accessibilityLabel={`Åbn chat med ${displayName}`}
                        accessibilityRole="button"
                        onPress={() => onOpenDirectChat(profile.id)}
                        style={({ pressed }) => [
                          styles.crewMemberChatIconButton,
                          pressed ? styles.footerItemPressed : null,
                        ]}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={21} color={STUDOS_THEME.red} />
                        <View style={styles.crewMemberChatIconBadge}>
                          <Ionicons name="add" size={9} color={STUDOS_THEME.ink} />
                        </View>
                      </Pressable>
                    ) : null}
                  <Pressable
                    accessibilityLabel={`Ring til ${displayName}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setPhoneModalName(displayName);
                      setPhoneModalNumber(rawPhone || 'Ikke angivet');
                      setPhoneModalVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.crewMemberMobileIconButton,
                      pressed && canCall ? styles.footerItemPressed : null,
                    ]}
                  >
                    <Ionicons
                        name="call"
                        size={18}
                        color="#75DED0"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>
            {showClassCrew ? 'Der er ingen aktive crew-medlemmer at vise.' : 'Du har ingen venner på Studos endnu.'}
          </Text>
        )}
        {phoneModalVisible ? (
          <View style={styles.crewPhoneModalOverlay}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPhoneModalVisible(false)}
              style={styles.crewPhoneModalBackdrop}
            >
              <View style={styles.crewPhoneModalPanel}>
                <Text style={styles.crewPhoneModalTitle}>Mobilnummer</Text>
                <Text style={styles.crewPhoneModalName} numberOfLines={1}>
                  {phoneModalName}
                </Text>
                <Text style={styles.crewPhoneModalNumber} numberOfLines={1}>
                  {phoneModalNumber}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPhoneModalVisible(false)}
                  style={styles.crewPhoneModalCloseButton}
                >
                  <Text style={styles.crewPhoneModalCloseText}>Luk</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AppTopBar({ className, menuOpen, onToggleMenu, schoolName }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        <Pressable
          accessibilityLabel={menuOpen ? 'Luk menu' : 'Åbn menu'}
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

function StudosWordmark({ compact = false, showDot = true, tone = 'dark' }) {
  const wordmarkTextColor = tone === 'light' ? styles.wordmarkTextDark : null;

  return (
    <View style={[styles.wordmark, compact ? styles.wordmarkCompact : null]}>
      <View style={styles.wordmarkTextRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.wordmarkText,
            compact ? styles.wordmarkTextCompact : null,
            styles.wordmarkTextLight,
          ]}
        >
          Stu
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.wordmarkText,
            compact ? styles.wordmarkTextCompact : null,
            wordmarkTextColor,
          ]}
        >
          dos
        </Text>
      </View>
      <View style={[styles.wordmarkUnderline, compact ? styles.wordmarkUnderlineCompact : null]} />
      {showDot ? (
        <View style={[styles.wordmarkDot, compact ? styles.wordmarkDotCompact : null]} />
      ) : null}
    </View>
  );
}

function SidebarMenuIcon({ active = false, item }) {
  if (item.id === 'earnCaps') {
    return (
      <View style={styles.sidebarMenuIconWrap}>
        <View style={styles.sidebarEarnCapsIcon}>
          <View style={styles.sidebarEarnCapsIconBack} />
          <View style={styles.sidebarEarnCapsIconFace}>
            <Image source={CAPS_COIN} resizeMode="contain" style={styles.sidebarEarnCapsIconCoin} />
          </View>
          <View style={styles.sidebarEarnCapsIconPlus}>
            <Ionicons name="add" size={8} color={STUDOS_THEME.ink} />
          </View>
          <View style={styles.sidebarEarnCapsIconDot} />
        </View>
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
        {item.locked ? <LockBadge style={styles.sidebarLockBadge} /> : null}
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
      {item.locked ? <LockBadge style={styles.sidebarLockBadge} /> : null}
    </View>
  );
}

function LockBadge({ style }) {
  return (
    <View style={[styles.lockBadge, style]}>
      <Ionicons name="lock-closed" size={8} color={STUDOS_THEME.ink} />
    </View>
  );
}

function AndroidNotificationPromptModal({ loading, visible, onDismiss, onEnable }) {
  if (!ANDROID_NOTIFICATIONS_ENABLED) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View style={styles.chatModalRoot}>
        <Pressable
          accessibilityLabel="Luk notifikationer"
          style={styles.chatModalBackdrop}
          onPress={onDismiss}
        />
        <View style={[styles.chatModalPanel, styles.notificationPromptPanel]}>
          <View style={styles.notificationPromptIcon}>
            <Ionicons name="notifications" size={28} color={STUDOS_THEME.red} />
          </View>
          <View style={styles.notificationPromptCopy}>
            <Text style={styles.chatModalKicker}>Notifikationer</Text>
            <Text style={styles.notificationPromptTitle}>Skal Studos prikke dig?</Text>
            <Text style={styles.notificationPromptText}>
              Få besked, når der lander nye chats og vigtige ting fra klassen.
            </Text>
          </View>
          <View style={styles.notificationPromptActions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.notificationPromptSecondaryButton,
                pressed && !loading ? styles.footerItemPressed : null,
              ]}
            >
              <Text style={styles.notificationPromptSecondaryText}>Ikke nu</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onEnable}
              style={({ pressed }) => [
                styles.notificationPromptPrimaryButton,
                pressed && !loading ? styles.footerItemPressed : null,
                loading ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.notificationPromptPrimaryText}>
                {loading ? 'Åbner...' : 'Slå til'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WeeklyCheckInRewardModal({ reward, visible, onDismiss }) {
  const amount = Number(reward?.amount) || 100;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View style={styles.chatModalRoot}>
        <Pressable
          accessibilityLabel="Luk ugentlig check-in reward"
          style={styles.chatModalBackdrop}
          onPress={onDismiss}
        />
        <View style={[styles.chatModalPanel, styles.weeklyCheckInRewardPanel]}>
          <View style={styles.weeklyCheckInRewardIcon}>
            <Image source={CAPS_COIN} resizeMode="contain" style={styles.weeklyCheckInRewardCoin} />
            <View style={styles.weeklyCheckInRewardPlus}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.notificationPromptCopy}>
            <Text style={styles.chatModalKicker}>Weekly streak</Text>
            <Text style={styles.notificationPromptTitle}>Tillykke, du gjorde det!</Text>
            <Text style={styles.notificationPromptText}>
              Du har åbnet Studos 7 dage i træk. Der er tilføjet {amount} Caps til din konto.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.weeklyCheckInRewardButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Text style={styles.notificationPromptPrimaryText}>Fedt</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function GoodDeedClaimRewardModal({ reward, visible, onDismiss }) {
  const amount = Number(reward?.amount) || 25;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <View style={styles.chatModalRoot}>
        <Pressable
          accessibilityLabel="Luk claim reward"
          style={styles.chatModalBackdrop}
          onPress={onDismiss}
        />
        <View style={[styles.chatModalPanel, styles.weeklyCheckInRewardPanel]}>
          <View style={styles.weeklyCheckInRewardIcon}>
            <Image source={CAPS_COIN} resizeMode="contain" style={styles.weeklyCheckInRewardCoin} />
            <View style={styles.goodDeedClaimRewardPlus}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.notificationPromptCopy}>
            <Text style={styles.chatModalKicker}>Ugens gode gerning</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.notificationPromptTitle, styles.goodDeedClaimRewardTitle]}
            >
              Tak fordi du gør en forskel ❤
            </Text>
            <View style={styles.goodDeedClaimRewardTextLine}>
              <Text style={styles.notificationPromptText}>Der er tilføjet</Text>
              <Text style={[styles.notificationPromptText, styles.goodDeedClaimRewardAmount]}>+{amount}</Text>
              <Image source={CAPS_COIN} resizeMode="contain" style={styles.goodDeedClaimRewardInlineCoin} />
              <Text style={styles.notificationPromptText}>til din konto.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.weeklyCheckInRewardButton,
              pressed ? styles.footerItemPressed : null,
            ]}
          >
            <Text style={styles.notificationPromptPrimaryText}>Fedt</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  const emergencyActive = activeRoute === 'emergencyContacts';
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
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.sidebarPanelScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.sidebarPanelScroll}
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

            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect('emergencyContacts')}
              style={({ pressed }) => [
                styles.sidebarMenuItem,
                styles.sidebarEmergencyItem,
                pressed ? styles.sidebarMenuItemPressed : null,
              ]}
            >
              <SidebarMenuIcon
                item={{ id: 'emergencyContacts', icon: 'call-outline', activeIcon: 'call', accentColor: STUDOS_THEME.red }}
                active={emergencyActive}
              />
              <Text style={[
                styles.sidebarMenuText,
                emergencyActive ? styles.sidebarMenuTextActive : null,
              ]}>
                Nødkontakter
              </Text>
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
                      {item.id === 'randomizer' ? (
                        <View style={[
                          styles.sidebarArcadeHubTextWrap,
                          isActive ? styles.sidebarArcadeHubTextWrapActive : null,
                        ]}>
                          <Text
                            style={[
                              styles.sidebarMenuText,
                              styles.sidebarMenuTextArcadeHub,
                              isActive ? styles.sidebarMenuTextArcadeHubActive : null,
                              item.locked ? styles.lockedNavigationText : null,
                            ]}
                          >
                            {item.label.toUpperCase()}
                          </Text>
                          <View style={[
                            styles.sidebarArcadeHubMarker,
                            isActive ? styles.sidebarArcadeHubMarkerActive : null,
                          ]} />
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.sidebarMenuText,
                            item.locked ? styles.lockedNavigationText : null,
                            isActive ? styles.sidebarMenuTextActive : null,
                          ]}
                        >
                          {item.label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.sidebarBottomNav}>
            <View style={styles.sidebarSectionDivider} />
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect('settings')}
              style={({ pressed }) => [
                styles.sidebarMenuItem,
                pressed ? styles.sidebarMenuItemPressed : null,
              ]}
            >
              <SidebarMenuIcon item={{ id: 'settings', icon: 'settings-outline', activeIcon: 'settings', accentColor: STUDOS_THEME.blue }} />
              <Text style={styles.sidebarMenuText}>Indstillinger</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function FooterNav({ activeTab, chatUnreadCount = 0, onChangeTab }) {
  return (
    <View style={styles.footerNav}>
      {APP_TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isCenterAction = tab.id === 'overview';
        const isFirstItem = index === 0;
        const isLastItem = index === APP_TABS.length - 1;
        const tabUnreadCount = tab.id === 'chat' ? chatUnreadCount : 0;
        const hasUnreadBadge = tabUnreadCount > 0;
        const tabAccentColor = tab.accentColor ?? '#FF6F73';

        return (
          <Pressable
            accessibilityLabel={hasUnreadBadge ? `${tab.label}, ${tabUnreadCount} ulæste` : tab.label}
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
              <View style={styles.footerIconWrap}>
                <FooterTabIcon tab={tab} active={isActive} />
                {tab.locked ? <LockBadge style={styles.footerLockBadge} /> : null}
                {hasUnreadBadge ? (
                  <View style={styles.footerUnreadBadge}>
                    <Text numberOfLines={1} style={styles.footerUnreadText}>
                      {formatUnreadBadgeCount(tabUnreadCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
            {!isCenterAction ? (
              <Text style={[
                styles.footerLabel,
                tab.locked ? styles.lockedNavigationText : null,
                isActive ? { color: tabAccentColor } : null,
              ]}>
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

function FooterTabIcon({ active, tab }) {
  if (tab.id === 'calendar') {
    return <FooterCalendarIcon active={active} />;
  }

  if (tab.id === 'chat') {
    return <FooterChatIcon active={active} />;
  }

  if (tab.id === 'challenges') {
    return <FooterPointDuelIcon active={active} />;
  }

  if (tab.id === 'walls') {
    return <FooterWallsIcon active={active} />;
  }

  return (
    <Ionicons
      name={active ? tab.activeIcon : tab.icon}
      size={25}
      color={tab.accentColor ?? STUDOS_THEME.ink}
    />
  );
}

function FooterCalendarIcon({ active }) {
  return (
    <Image
      source={FOOTER_CALENDAR_ICON}
      resizeMode="contain"
      style={[
        styles.footerRasterIcon,
        active ? styles.footerRasterIconActive : null,
      ]}
    />
  );
}

function FooterChatIcon({ active }) {
  return (
    <Image
      source={FOOTER_CHAT_ICON}
      resizeMode="contain"
      style={[
        styles.footerRasterIcon,
        active ? styles.footerRasterIconActive : null,
      ]}
    />
  );
}

function FooterPointDuelIcon({ active }) {
  return (
    <View style={[
      styles.overviewCapsDuelMark,
      styles.footerPointDuelIcon,
      active ? styles.footerPointDuelIconActive : null,
    ]}>
      <Ionicons
        name="shield"
        size={24}
        color={STUDOS_THEME.ink}
        style={styles.footerPointDuelShieldOutline}
      />
      <Ionicons
        name="shield"
        size={20}
        color="#FFFFFF"
        style={styles.footerPointDuelShieldFill}
      />
      <MaterialCommunityIcons
        name="sword-cross"
        size={18}
        color={STUDOS_THEME.red}
        style={[styles.overviewCapsDuelSwords, styles.footerPointDuelSwords]}
      />
    </View>
  );
}

function FooterWallsIcon({ active }) {
  return (
    <Image
      source={FOOTER_WALLS_ICON}
      resizeMode="contain"
      style={[
        styles.footerRasterIcon,
        active ? styles.footerRasterIconActive : null,
      ]}
    />
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
  const { height } = useWindowDimensions();
  const flowTopPadding = Math.max(36, Math.min(height * 0.07, 56));

  return (
    <View style={[styles.loginFlow, { paddingTop: flowTopPadding }]}>
      <Pressable hitSlop={12} onPress={onBack} style={styles.loginBackRow}>
        <Ionicons name="chevron-back" size={16} color="#ef5b3f" />
        <Text style={styles.backText}>Tilbage</Text>
      </Pressable>

      <View style={styles.loginBrandSection}>
        <View style={styles.loginLogoWrap}>
          <Image source={STUDOS_LOGO} style={styles.loginLogo} />
        </View>
        <View style={styles.loginWordmark}>
          <View style={styles.loginWordmarkTextRow}>
            <Text numberOfLines={1} style={[styles.loginWordmarkText, styles.loginWordmarkTextLight]}>Stu</Text>
            <Text numberOfLines={1} style={styles.loginWordmarkText}>dos</Text>
          </View>
          <View style={styles.loginWordmarkUnderline} />
          <View style={styles.loginWordmarkDot} />
        </View>
        <Text style={styles.loginHeadline}>Log ind på din profil</Text>
        <Text style={styles.loginLead}>
          Brug din email og adgangskode for at komme sikkert ind.
        </Text>
      </View>

      <View style={styles.loginCard}>
        <Text style={styles.sectionTitle}>Eksisterende profil</Text>
        <Text style={styles.loginCardHelp}>Indtast dine oplysninger for at logge ind sikkert.</Text>
        <View style={styles.formGrid}>
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="navn@eksempel.dk"
            onChangeText={(value) => onChangeLogin('email', value)}
            textContentType="emailAddress"
            value={login.email}
          />
          <Field
            autoCapitalize="none"
            label="Adgangskode"
            placeholder="••••••••"
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
  schoolClass,
  onBack,
  onChangeProfile,
  onPickPhoto,
  onSubmit,
}) {
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [birthdayVisibleMonth, setBirthdayVisibleMonth] = useState(() => dateFromInput(profile.birthday || formatInputDate(new Date())));
  const visibleBirthdayDays = useMemo(() => calendarDaysForMonth(birthdayVisibleMonth), [birthdayVisibleMonth]);
  const birthdayDisplayValue = profile.birthday ? formatProfileDate(profile.birthday) : 'Vælg fødselsdag';
  const birthdayVisibleMonthLabel = new Intl.DateTimeFormat('da-DK', { month: 'long' }).format(birthdayVisibleMonth);

  const selectBirthday = (value) => {
    onChangeProfile('birthday', value);
    setBirthdayVisibleMonth(dateFromInput(value));
    setBirthdayPickerOpen(false);
  };

  const toggleBirthdayPicker = () => setBirthdayPickerOpen((current) => {
    if (!current) {
      const nextVisibleMonth = dateFromInput(profile.birthday || formatInputDate(new Date()));

      setBirthdayVisibleMonth(nextVisibleMonth);
    }

    return !current;
  });
  const jumpBirthdayYear = (years) => {
    setBirthdayVisibleMonth((current) => addCalendarYears(current, years));
  };
  const openTerms = () => {
    Linking.openURL(STUDOS_TERMS_URL).catch(() => {});
  };
  const openPrivacy = () => {
    Linking.openURL(STUDOS_PRIVACY_URL).catch(() => {});
  };

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
            <Text style={styles.photoText}>Valgfrit - du kan altid tilføje et senere</Text>
          </View>
        </Pressable>

        <View style={styles.formGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>Skole</Text>
            <View style={styles.staticField}>
              <Text style={[styles.selectValue, !schoolClass?.schoolName ? styles.selectPlaceholder : null]}>
                {schoolClass?.schoolName || 'Skole ikke angivet'}
              </Text>
            </View>
          </View>
          <Field
            label="Fornavn og mellemnavne"
            placeholder="Mette A."
            onChangeText={(value) => onChangeProfile('firstName', value)}
            textContentType="givenName"
            value={profile.firstName}
          />
          <Field
            label="Efternavn"
            placeholder="Jensen"
            onChangeText={(value) => onChangeProfile('lastName', value)}
            textContentType="familyName"
            value={profile.lastName}
          />
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="din.email@eksempel.dk"
            onChangeText={(value) => onChangeProfile('email', value)}
            textContentType="emailAddress"
            value={profile.email}
          />
          <Field
            keyboardType="phone-pad"
            label="Telefon (valgfri)"
            placeholder="+45 20 12 34 56"
            onChangeText={(value) => onChangeProfile('phone', value)}
            textContentType="telephoneNumber"
            value={profile.phone}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Fødselsdag</Text>
            <Pressable
              accessibilityRole="button"
              onPress={toggleBirthdayPicker}
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
                  {birthdayDisplayValue}
                </Text>
              </View>
              <Ionicons
                name={birthdayPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#65748b"
              />
            </Pressable>
            {birthdayPickerOpen ? (
              <View style={styles.calendarPickerBlock}>
                <View style={styles.calendarPickerHeader}>
                  <View style={styles.calendarYearControls}>
                    <Pressable
                      accessibilityLabel="Forrige år"
                      accessibilityRole="button"
                      onPress={() => jumpBirthdayYear(-1)}
                      style={({ pressed }) => [
                        styles.calendarMonthButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="chevron-back" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                    <Text numberOfLines={1} style={styles.calendarMonthTitle}>
                      {birthdayVisibleMonth.getFullYear()}
                    </Text>
                    <Pressable
                      accessibilityLabel="Næste år"
                      accessibilityRole="button"
                      onPress={() => jumpBirthdayYear(1)}
                      style={({ pressed }) => [
                        styles.calendarMonthButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="chevron-forward" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                  </View>
                  <View style={styles.calendarMonthControls}>
                    <Pressable
                      accessibilityLabel="Forrige måned"
                      accessibilityRole="button"
                      onPress={() => setBirthdayVisibleMonth((current) => addCalendarMonths(current, -1))}
                      style={({ pressed }) => [
                        styles.calendarMonthButton,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      <Ionicons name="chevron-back" size={18} color={STUDOS_THEME.ink} />
                    </Pressable>
                    <Text numberOfLines={1} style={styles.calendarMonthTitle}>
                      {birthdayVisibleMonthLabel}
                    </Text>
                    <Pressable
                      accessibilityLabel="Næste måned"
                      accessibilityRole="button"
                      onPress={() => setBirthdayVisibleMonth((current) => addCalendarMonths(current, 1))}
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
                  {visibleBirthdayDays.map((day) => {
                    if (day.empty) {
                      return <View key={day.id} style={styles.calendarDayCell} />;
                    }

                    const active = profile.birthday === day.value;

                    return (
                      <View key={day.id} style={styles.calendarDayCell}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => selectBirthday(day.value)}
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
          <Field
            autoCapitalize="none"
            label="Adgangskode"
            placeholder="Mindst 6 tegn"
            onChangeText={(value) => onChangeProfile('password', value)}
            secureTextEntry
            textContentType="newPassword"
            value={profile.password}
          />
          <Field
            autoCapitalize="none"
            label="Gentag adgangskode"
            placeholder="••••••••"
            onChangeText={(value) => onChangeProfile('passwordConfirmation', value)}
            secureTextEntry
            textContentType="newPassword"
            value={profile.passwordConfirmation}
          />
        </View>
        <View style={styles.emergencyContactContainer}>
          <Text style={styles.emergencyContactTitle}>Nødkontakt (valgfri)</Text>
          <Text style={styles.emergencyContactBody}>
            Vi anbefaler, at du angiver en nødkontakt, så din klasse kan hjælpe dig i en vanskelig situation.
            {'\n'}
            {'\n'}
            I appen kan du selv styre, hvem der kan se din nødkontakt.
          </Text>
          <Field
            label="Fulde navn"
            placeholder="Mette Nielsen"
            onChangeText={(value) => onChangeProfile('emergencyContactName', value)}
            value={profile.emergencyContactName}
          />
          <Field
            keyboardType="phone-pad"
            label="Mobilnummer"
            placeholder="+45 30 40 50 60"
            onChangeText={(value) => onChangeProfile('emergencyContactPhone', value)}
            textContentType="telephoneNumber"
            value={profile.emergencyContactPhone}
          />
        </View>

        <View style={styles.consentList}>
          <ConsentRow
            active={profile.termsAccepted}
            onPress={() => onChangeProfile('termsAccepted', !profile.termsAccepted)}
          >
            Jeg accepterer{' '}
            <Text style={styles.consentLinkText} onPress={openTerms}>
              vilkårene
            </Text>
          </ConsentRow>
          <ConsentRow
            active={profile.privacyAccepted}
            onPress={() => onChangeProfile('privacyAccepted', !profile.privacyAccepted)}
          >
            Jeg accepterer{' '}
            <Text style={styles.consentLinkText} onPress={openPrivacy}>
              privatlivspolitikken
            </Text>
          </ConsentRow>
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
  onLogout,
  onDeleteAccount,
}) {
  const [localPreview, setLocalPreview] = useState('');
  const [localError, setLocalError] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false);
  const [emailChangeNoticeOpen, setEmailChangeNoticeOpen] = useState(false);
  const [profilePhotoMenuOpen, setProfilePhotoMenuOpen] = useState(false);
  const profileNumberFormat = useMemo(() => new Intl.NumberFormat('da-DK'), []);
  const displayProfile = {
    ...profile,
    ...activeMember,
    profilePhotoUrl: localPreview || activeMember?.profilePhotoUrl || profile.profilePhotoUrl,
  };
  const hasCurrentProfilePhoto = Boolean(localPreview || activeMember?.profilePhotoUrl || profile.profilePhotoUrl);
  const profileName = displayProfile.displayName
    || [displayProfile.firstName, displayProfile.lastName].filter(Boolean).join(' ')
    || 'Min profil';
  const profileRole = PROFILE_ROLE_LABELS[displayProfile.role] || 'Elev';
  const profileStatus = PROFILE_STATUS_LABELS[displayProfile.status] || 'Aktiv';
  const capsBalance = Number.isFinite(Number(displayProfile.capsBalance ?? displayProfile.points))
    ? Number(displayProfile.capsBalance ?? displayProfile.points)
    : 0;
  const formattedCapsBalance = profileNumberFormat.format(capsBalance);

  const pickAndUploadPhoto = async () => {
    setProfilePhotoMenuOpen(false);
    setLocalError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Studos skal have adgang til billeder for at vælge profilbillede.');
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
      setLocalError('Billedet kunne ikke læses.');
      return;
    }

    setLocalPreview(asset.uri);

    const mimeType = asset.mimeType || 'image/jpeg';
    const saved = await onProfilePhotoUpdate(`data:${mimeType};base64,${asset.base64}`);

    if (saved) {
      setLocalPreview('');
    }
  };

  const removeProfilePhoto = async () => {
    setProfilePhotoMenuOpen(false);
    setLocalError('');

    const saved = await onProfilePhotoUpdate(null);

    if (saved) {
      setLocalPreview('');
    }
  };

  const handleOpenDeleteAccount = () => {
    setDeleteAccountError('');
    setDeleteAccountConfirmOpen(true);
  };

  const handleLogout = () => {
    if (loading || deleteAccountLoading) {
      return;
    }

    onLogout?.();
  };

  const handleDeleteAccount = async () => {
    if (!onDeleteAccount || deleteAccountLoading) {
      return;
    }

    setDeleteAccountLoading(true);
    setDeleteAccountError('');

    try {
      const deleted = await onDeleteAccount();

      if (!deleted) {
        setDeleteAccountError('Kontoen kunne ikke blive slettet. Prøv igen.');
        return;
      }

      setDeleteAccountConfirmOpen(false);
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const profileRows = useMemo(() => ([
    { key: 'class', label: 'Klasse', value: schoolClass.className || 'Ikke angivet' },
    { key: 'school', label: 'Skole', value: schoolClass.schoolName || 'Ikke angivet' },
    { key: 'email', label: 'Email', value: displayProfile.email || 'Ikke angivet' },
    { key: 'phone', label: 'Telefon', value: displayProfile.phone || 'Ikke angivet' },
    { key: 'birthday', label: 'Fødselsdag', value: formatProfileDate(displayProfile.birthday) },
    { key: 'personalCode', label: 'Studos-kode', value: displayProfile.personalCode || 'Ikke angivet' },
    { key: 'role', label: 'Rolle', value: profileRole },
    { key: 'status', label: 'Status', value: profileStatus },
    { key: 'joinedAt', label: 'Medlem siden', value: formatProfileDate(displayProfile.joinedAt) },
  ]), [
    displayProfile.birthday,
    displayProfile.email,
    displayProfile.joinedAt,
    displayProfile.phone,
    displayProfile.personalCode,
    displayProfile.role,
    displayProfile.status,
    schoolClass.className,
    schoolClass.schoolName,
  ]);

  return (
    <View style={[styles.overviewBlank, styles.overviewSurface]}>
      <View style={styles.tabHeader}>
        <View>
          <Text style={styles.kicker}>{schoolClass.className}</Text>
          <Text style={styles.title}>Min profil</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="person" size={28} color="#f6d36d" />
        </View>
      </View>

      <View style={styles.accountProfilePanel}>
        <Pressable
          accessibilityLabel="Profilbillede menu"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => setProfilePhotoMenuOpen(true)}
          style={styles.accountProfilePhotoPressable}
        >
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
            <View style={styles.accountProfilePhotoActionBadge}>
              <Ionicons name="camera" size={14} color={STUDOS_THEME.ink} />
            </View>
          </View>
        </Pressable>
        <Text numberOfLines={1} style={styles.accountProfileName}>{profileName}</Text>
        <Text numberOfLines={1} style={styles.accountProfileMeta}>
          {schoolClass.className}
        </Text>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setProfilePhotoMenuOpen(false)}
        transparent
        visible={profilePhotoMenuOpen}
      >
        <View style={styles.chatModalRoot}>
            <Pressable
            accessibilityLabel="Luk profilbilledemenu"
            onPress={() => setProfilePhotoMenuOpen(false)}
            style={styles.chatModalBackdrop}
          />
          <View style={[styles.chatModalPanel, styles.chatConversationActionMenuPanel]}>
            <View style={styles.chatModalHeader}>
              <View style={styles.chatConversationActionMenuHeading}>
                <Text style={styles.chatModalKicker}>Profilbillede</Text>
                <Text numberOfLines={1} style={styles.chatModalTitle}>
                  {hasCurrentProfilePhoto ? 'Skift eller fjern billede' : 'Vælg profilbillede'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                onPress={() => setProfilePhotoMenuOpen(false)}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>

            <View style={styles.chatConversationActionMenuList}>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={pickAndUploadPhoto}
                style={({ pressed }) => [styles.chatConversationActionMenuItem, pressed ? styles.footerItemPressed : null]}
              >
                <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconCalm]}>
                  <Ionicons name="image-outline" size={18} color={STUDOS_THEME.ink} />
                </View>
                <Text style={styles.chatConversationActionMenuText}>
                  {hasCurrentProfilePhoto ? 'Ændre profilbillede' : 'Tilføj profilbillede'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
              </Pressable>
              {hasCurrentProfilePhoto ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={removeProfilePhoto}
                  style={({ pressed }) => [styles.chatConversationActionMenuItem, pressed ? styles.footerItemPressed : null]}
                >
                  <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconDanger]}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.chatConversationActionMenuText}>Fjern profilbillede</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9aa3b4" />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setProfilePhotoMenuOpen(false)}
                style={({ pressed }) => [styles.chatConversationActionMenuItem, pressed ? styles.footerItemPressed : null]}
              >
                <View style={[styles.chatConversationActionMenuIcon, styles.chatConversationActionMenuIconWarning]}>
                  <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
                </View>
                <Text style={styles.chatConversationActionMenuText}>Annuller</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setEmailChangeNoticeOpen(false)}
        transparent
        visible={emailChangeNoticeOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk e-mail meddelelse"
            onPress={() => setEmailChangeNoticeOpen(false)}
            style={styles.chatModalBackdrop}
          />
          <View style={styles.chatModalPanel}>
            <View style={styles.chatModalHeader}>
              <Text numberOfLines={1} style={styles.chatModalTitle}>Skift e-mail</Text>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                onPress={() => setEmailChangeNoticeOpen(false)}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={18} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>
            <Text style={styles.chatCodeModalText}>
              E-mail er i øjeblikket låst til din konto. Når ændring bliver aktiveret, kommer der en rigtig
              redigeringsknap her.
            </Text>
            <Button label="Forstået" onPress={() => setEmailChangeNoticeOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deleteAccountLoading) {
            setDeleteAccountConfirmOpen(false);
            setDeleteAccountError('');
          }
        }}
        transparent
        visible={deleteAccountConfirmOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk kontosletning"
            disabled={deleteAccountLoading}
            onPress={() => {
              if (!deleteAccountLoading) {
                setDeleteAccountConfirmOpen(false);
                setDeleteAccountError('');
              }
            }}
            style={styles.chatModalBackdrop}
          />
          <View style={[styles.chatModalPanel, styles.chatActionConfirmPanel]}>
            <View style={[styles.chatActionConfirmIcon, styles.chatActionConfirmIconDanger]}>
              <Ionicons name="trash" size={24} color="#FFFFFF" />
            </View>
            <Text style={[styles.chatModalTitle, styles.chatActionConfirmTitle]}>Slet konto?</Text>
            <Text style={[styles.chatCodeModalText, styles.chatActionConfirmText]}>
              Sletning af din konto er permanent. Vi anonymiserer dine personoplysninger og markerer
              kontoen som slettet, så den ikke længere kan bruges. Login-sessioner og adgangskode
              bliver slettet, og handlingen kan ikke fortrydes.
            </Text>
            {deleteAccountError ? <Text style={styles.errorText}>{deleteAccountError}</Text> : null}
            <View style={styles.chatActionConfirmButtons}>
              <Pressable
                accessibilityLabel="Annuller slet konto"
                accessibilityRole="button"
                disabled={deleteAccountLoading}
                onPress={() => {
                  setDeleteAccountConfirmOpen(false);
                  setDeleteAccountError('');
                }}
                style={({ pressed }) => [
                  styles.chatActionCancelButton,
                  styles.accountProfileActionButtonRow,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Text style={styles.chatActionCancelText}>Annuller</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Bekræft slet konto"
                accessibilityRole="button"
                disabled={deleteAccountLoading}
                onPress={handleDeleteAccount}
                style={({ pressed }) => [
                  styles.chatActionConfirmButton,
                  styles.chatActionConfirmButtonDanger,
                  styles.accountProfileActionButtonRow,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                {deleteAccountLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.chatActionConfirmButtonText}>Slet konto</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Profiloplysninger</Text>
        <View style={styles.detailList}>
          {profileRows.map((row) => (
            <View key={row.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <View style={styles.accountProfileDetailValueWrap}>
                <Text numberOfLines={1} style={styles.detailValue}>
                  {row.value}
                </Text>
                {row.key === 'email' ? (
                  <Pressable
                    accessibilityLabel="Skift e-mail"
                    accessibilityRole="button"
                    onPress={() => setEmailChangeNoticeOpen(true)}
                    style={({ pressed }) => [styles.accountProfileDetailAction, pressed ? styles.footerItemPressed : null]}
                  >
                    <Ionicons name="create-outline" size={16} color={STUDOS_THEME.ink} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Caps</Text>
            <View style={styles.accountProfileCapsValue}>
              <Text numberOfLines={1} style={styles.accountProfileCapsAmount}>
                {formattedCapsBalance}
              </Text>
              <Image source={CAPS_COIN} resizeMode="contain" style={styles.accountProfileCapsCoin} />
            </View>
          </View>
        </View>
      </View>

      {localError || error ? <Text style={styles.errorText}>{localError || error}</Text> : null}

      <View style={styles.accountProfileBottomActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log ud"
          disabled={loading || deleteAccountLoading}
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.chatActionCancelButton,
            styles.accountProfileActionButtonRow,
            pressed && !loading ? styles.footerItemPressed : null,
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={STUDOS_THEME.ink} />
          <Text style={styles.chatActionCancelText}>Log ud</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Slet konto"
          disabled={loading || deleteAccountLoading}
          onPress={handleOpenDeleteAccount}
          style={({ pressed }) => [
            styles.chatActionConfirmButton,
            styles.chatActionConfirmButtonDanger,
            styles.accountProfileActionButtonRow,
            pressed && !loading ? styles.footerItemPressed : null,
          ]}
        >
          <Ionicons name="trash" size={18} color="#FFFFFF" />
          <Text style={styles.chatActionConfirmButtonText}>Slet konto</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OverviewScreen({
  activeMember,
  countdown,
  events = [],
  onOpenActivities,
  onOpenCalendar,
  onOpenEarnCaps,
  onOpenPointDuel,
}) {
  const [selectedMood, setSelectedMood] = useState('klar');
  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [moodUpdatedAt, setMoodUpdatedAt] = useState(null);
  const [currentMoodDayKey, setCurrentMoodDayKey] = useState(() => moodDayKeyFor());
  const [completedClipIds, setCompletedClipIds] = useState([]);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [studosCodeModalOpen, setStudosCodeModalOpen] = useState(false);
  const [overviewHeaderScrolled, setOverviewHeaderScrolled] = useState(false);
  const [overviewCardLayouts, setOverviewCardLayouts] = useState({});
  const [currentOverviewTime, setCurrentOverviewTime] = useState(() => Date.now());
  const overviewScrollY = useRef(new Animated.Value(0)).current;
  const profileName = activeMember?.displayName
    || [activeMember?.firstName, activeMember?.lastName].filter(Boolean).join(' ')
    || 'Din profil';
  const personalStudosCode = activeMember?.personalCode ?? 'Mangler';
  const overviewNumberFormat = useMemo(() => new Intl.NumberFormat('da-DK'), []);
  const formatOverviewNumber = useCallback((value) => overviewNumberFormat.format(value), [overviewNumberFormat]);
  const capsBalance = Number.isFinite(Number(activeMember?.capsBalance ?? activeMember?.points))
    ? Number(activeMember?.capsBalance ?? activeMember?.points)
    : 1000;
  const formattedCapsBalance = formatOverviewNumber(capsBalance);
  const overviewStats = [
    { id: 'challenges', icon: 'flash', label: 'Udfordringer', value: '4', color: STUDOS_THEME.red },
    { id: 'parties', icon: 'wine', label: 'Gilder', value: '3', color: STUDOS_THEME.yellow },
    { id: 'memories', icon: 'images', label: 'Minder', value: '21', color: STUDOS_THEME.blue },
  ];
  const overviewMoods = [
    { id: 'klar', icon: 'sunny', label: 'Klar' },
    { id: 'kaos', icon: 'flash', label: 'Kaos' },
    { id: 'træt', icon: 'moon', label: 'Træt' },
    { id: 'glad', icon: 'happy', label: 'Glad' },
    { id: 'presset', icon: 'alarm', label: 'Presset' },
    { id: 'chill', icon: 'leaf', label: 'Chill' },
  ];
  const validMoodIds = useMemo(() => new Set(overviewMoods.map((mood) => mood.id)), []);
  const moodStorageKey = useMemo(
    () => `${OVERVIEW_MOOD_STORAGE_KEY}.${activeMember?.id ?? 'guest'}`,
    [activeMember?.id],
  );
  const validClipIds = useMemo(() => new Set(CHAT_THREAD_HEADER_COUNTERS.map((counter) => counter.id)), []);
  const clipsStorageKey = useMemo(
    () => `${OVERVIEW_CLIPS_STORAGE_KEY}.${activeMember?.id ?? 'guest'}`,
    [activeMember?.id],
  );
  const activeMood = overviewMoods.find((mood) => mood.id === selectedMood) ?? overviewMoods[0];
  const overviewTodayKey = useMemo(() => formatInputDate(new Date(currentOverviewTime)), [currentOverviewTime]);
  const upcomingCalendarEvents = useMemo(() => {
    return uniqueById(events ?? [])
      .filter((event) => !eventIsPast(event, currentOverviewTime))
      .sort((left, right) => eventSortTime(left) - eventSortTime(right));
  }, [currentOverviewTime, events]);
  const todayUpcomingCalendarEvents = useMemo(
    () => upcomingCalendarEvents.filter((event) => eventDayKeyFor(event) === overviewTodayKey),
    [overviewTodayKey, upcomingCalendarEvents],
  );
  const futureUpcomingCalendarEvents = useMemo(
    () => upcomingCalendarEvents.filter((event) => {
      const dayKey = eventDayKeyFor(event);

      return dayKey && compareCalendarDayKeys(dayKey, overviewTodayKey) > 0;
    }),
    [overviewTodayKey, upcomingCalendarEvents],
  );
  const visibleFutureUpcomingCalendarEvents = futureUpcomingCalendarEvents.slice(0, 3);
  const hasCheckedInToday = Boolean(moodUpdatedAt) && moodDayKeyFor(moodUpdatedAt) === currentMoodDayKey;
  const overviewMoodQuestion = hasCheckedInToday ? 'Din vibe er live 🥳' : 'Hvordan er din vibe i dag?';
  const overviewMoodUpdatedText = hasCheckedInToday
    ? `Sidst opdateret: ${formatMoodUpdatedAt(moodUpdatedAt)}`
    : 'Ikke checket ind endnu';
  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextDayKey = moodDayKeyFor();

      setCurrentMoodDayKey(nextDayKey);
      setSelectedMood('klar');
      setMoodUpdatedAt(null);
      SessionStore.deleteItemAsync(moodStorageKey).catch(() => {});
    }, millisecondsUntilNextMidnight());

    return () => clearTimeout(timeout);
  }, [currentMoodDayKey, moodStorageKey]);

  useEffect(() => {
    let cancelled = false;

    SessionStore.getItemAsync(moodStorageKey)
      .then((storedMood) => {
        if (cancelled || !storedMood) {
          if (!cancelled) {
            setSelectedMood('klar');
            setMoodUpdatedAt(null);
          }

          return;
        }

        let parsedMood = null;

        try {
          parsedMood = JSON.parse(storedMood);
        } catch {
          parsedMood = null;
        }

        const updatedAt = parsedMood?.updatedAt ? new Date(parsedMood.updatedAt) : null;
        const storedDayKey = parsedMood?.dayKey || moodDayKeyFor(updatedAt);
        const validStoredMood = parsedMood?.moodId && validMoodIds.has(parsedMood.moodId);

        if (validStoredMood && storedDayKey === moodDayKeyFor()) {
          setSelectedMood(parsedMood.moodId);
          setMoodUpdatedAt(updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : new Date());
          setCurrentMoodDayKey(storedDayKey);
          return;
        }

        setSelectedMood('klar');
        setMoodUpdatedAt(null);
        SessionStore.deleteItemAsync(moodStorageKey).catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [moodStorageKey, validMoodIds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentOverviewTime(Date.now());
    }, 15_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const liveDayKey = moodDayKeyFor(new Date(currentOverviewTime));

    if (!liveDayKey || liveDayKey === currentMoodDayKey) {
      return;
    }

    setCurrentMoodDayKey(liveDayKey);
    setSelectedMood('klar');
    setMoodUpdatedAt(null);
    SessionStore.deleteItemAsync(moodStorageKey).catch(() => {});
  }, [currentMoodDayKey, currentOverviewTime, moodStorageKey]);

  useEffect(() => {
    let cancelled = false;

    SessionStore.getItemAsync(clipsStorageKey)
      .then((storedClips) => {
        if (cancelled || !storedClips) {
          if (!cancelled) {
            setCompletedClipIds([]);
          }

          return;
        }

        let parsedClips = null;

        try {
          parsedClips = JSON.parse(storedClips);
        } catch {
          parsedClips = null;
        }

        const completedIds = Array.isArray(parsedClips?.completedClipIds)
          ? parsedClips.completedClipIds
          : Array.isArray(parsedClips)
            ? parsedClips
            : [];
        const validCompletedIds = uniqueByKey(
          completedIds.map((clipId) => String(clipId)).filter((clipId) => validClipIds.has(clipId)),
          (clipId) => clipId,
        );

        setCompletedClipIds(validCompletedIds);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [clipsStorageKey, validClipIds]);

  const updateMood = (moodId) => {
    if (!validMoodIds.has(moodId)) {
      return;
    }

    const updatedAt = new Date();
    const dayKey = moodDayKeyFor(updatedAt);

    setSelectedMood(moodId);
    setMoodUpdatedAt(updatedAt);
    setCurrentMoodDayKey(dayKey);
    setMoodModalOpen(false);
    SessionStore.setItemAsync(moodStorageKey, JSON.stringify({
      moodId,
      dayKey,
      updatedAt: updatedAt.toISOString(),
    })).catch(() => {});
  };
  const selectedClipIndex = CHAT_THREAD_HEADER_COUNTERS.findIndex((counter) => counter.id === selectedClipId);
  const selectedClip = selectedClipIndex >= 0 ? CHAT_THREAD_HEADER_COUNTERS[selectedClipIndex] : null;
  const selectedClipCompleted = selectedClip ? completedClipIds.includes(selectedClip.id) : false;
  const updateClipCompleted = (completed) => {
    if (!selectedClip) {
      return;
    }

    setCompletedClipIds((current) => {
      let nextCompletedClipIds;

      if (completed) {
        nextCompletedClipIds = current.includes(selectedClip.id) ? current : [...current, selectedClip.id];
      } else {
        nextCompletedClipIds = current.filter((id) => id !== selectedClip.id);
      }

      SessionStore.setItemAsync(clipsStorageKey, JSON.stringify({
        completedClipIds: nextCompletedClipIds,
        updatedAt: new Date().toISOString(),
      })).catch(() => {});

      return nextCompletedClipIds;
    });
    setSelectedClipId(null);
  };
  const handleOverviewScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: overviewScrollY } } }],
    {
      listener: (event) => {
        const scrolled = event.nativeEvent.contentOffset.y > 6;
        setOverviewHeaderScrolled((current) => (current === scrolled ? current : scrolled));
      },
      useNativeDriver: false,
    },
  ), [overviewScrollY]);
  const overviewHeaderContainerStyle = useMemo(() => ({
    transform: [
      {
        translateY: overviewScrollY.interpolate({
          inputRange: [0, 44],
          outputRange: [0, -7],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [overviewScrollY]);
  const overviewHeaderContentStyle = useMemo(() => ({
    transform: [
      {
        translateY: overviewScrollY.interpolate({
          inputRange: [0, 44],
          outputRange: [0, -7],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [overviewScrollY]);
  const setOverviewCardLayout = useCallback((cardId) => (event) => {
    const { height, y } = event.nativeEvent.layout;

    setOverviewCardLayouts((current) => {
      const previous = current[cardId];

      if (previous && Math.abs(previous.y - y) < 1 && Math.abs(previous.height - height) < 1) {
        return current;
      }

      return {
        ...current,
        [cardId]: { height, y },
      };
    });
  }, []);
  const overviewCardScrollStyle = useCallback((cardId) => {
    const layout = overviewCardLayouts[cardId];

    if (!layout) {
      return null;
    }

    const effectStart = Math.max(0, layout.y - OVERVIEW_HEADER_HEIGHT + 4);
    const effectEnd = effectStart + Math.min(260, Math.max(170, layout.height * 0.64));

    return {
      transform: [
        {
          scale: overviewScrollY.interpolate({
            inputRange: [effectStart, effectEnd],
            outputRange: [1, 0.84],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [overviewCardLayouts, overviewScrollY]);
  const renderUpcomingCalendarEvent = (event, featured = false) => {
    const eventTime = formatCalendarTime(event.startsAt);
    const eventDayKey = eventDayKeyFor(event);
    const dateParts = formatCalendarDateParts(eventDayKey);
    const isToday = eventDayKey === overviewTodayKey;
    const eventMetaText = event.location || '';

    return (
      <Pressable
        accessibilityHint="Åbner kalenderen indtil eventsiderne er klar"
        accessibilityLabel={`Åbn event ${event.title || 'Aftale'}`}
        accessibilityRole="button"
        key={event.id}
        onPress={() => onOpenCalendar?.({ eventId: event.id, dayKey: eventDayKey })}
        style={({ pressed }) => [
          styles.overviewTodayCalendarEventRow,
          featured ? styles.overviewTodayCalendarEventRowFeatured : null,
          pressed ? styles.footerItemPressed : null,
        ]}
      >
        <View style={styles.overviewTodayCalendarPillGroup}>
          <View
            style={[
              styles.overviewTodayCalendarTimePill,
              !isToday ? styles.overviewTodayCalendarDatePill : null,
              featured ? styles.overviewTodayCalendarTimePillFeatured : null,
            ]}
          >
            {isToday ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.overviewTodayCalendarTimeText,
                  featured ? styles.overviewTodayCalendarTimeTextFeatured : null,
                ]}
              >
                {eventTime || 'I dag'}
              </Text>
            ) : (
              <>
                <Text numberOfLines={1} style={styles.overviewTodayCalendarDateDayText}>
                  {dateParts.day}
                </Text>
                <Text numberOfLines={1} style={styles.overviewTodayCalendarDateMonthText}>
                  {dateParts.month}
                </Text>
              </>
            )}
          </View>
          {!isToday && eventTime ? (
            <View style={styles.overviewTodayCalendarClockPill}>
              <Text numberOfLines={1} style={styles.overviewTodayCalendarClockText}>
                {eventTime}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.overviewTodayCalendarEventCopy}>
          <Text numberOfLines={1} style={styles.overviewTodayCalendarEventTitle}>
            {event.title || 'Aftale'}
          </Text>
          {eventMetaText ? (
            <View style={styles.overviewTodayCalendarEventMetaRow}>
              <Ionicons name={isToday ? 'location' : 'calendar'} size={11} color={STUDOS_THEME.red} />
              <Text numberOfLines={1} style={styles.overviewTodayCalendarEventMeta}>
                {eventMetaText}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={featured ? STUDOS_THEME.red : '#A9B3C2'}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.overviewScreenRoot}>
      <Animated.View style={[
        styles.overviewHeaderStack,
        overviewHeaderContainerStyle,
        overviewHeaderScrolled ? styles.overviewHeaderStackScrolled : null,
      ]}>
        <Animated.View style={[styles.overviewHeaderTopRow, overviewHeaderContentStyle]}>
          <OverviewTitle />
          <View style={styles.overviewCountdownInline}>
            <Text style={styles.overviewCountdownNumber}>{countdown}</Text>
            <Text style={styles.overviewCountdownLabel}>dage til{'\n'}studenterugen</Text>
          </View>
        </Animated.View>
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={styles.overviewScrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleOverviewScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.overviewScroll}
      >
        <View pointerEvents="none" style={styles.overviewHeaderSpacer} />
        <Animated.View
          onLayout={setOverviewCardLayout('studos')}
          style={overviewCardScrollStyle('studos')}
        >
          <View style={styles.overviewStudosCard}>
            <View pointerEvents="none" style={styles.overviewStudosAccentRail}>
              <View style={[styles.overviewStudosAccentSegment, styles.overviewStudosAccentRed]} />
              <View style={[styles.overviewStudosAccentSegment, styles.overviewStudosAccentYellow]} />
              <View style={[styles.overviewStudosAccentSegment, styles.overviewStudosAccentBlue]} />
            </View>
            <Pressable
              accessibilityLabel="Vis QR-kode"
              accessibilityRole="button"
              disabled={!activeMember?.personalCode}
              onPress={() => setStudosCodeModalOpen(true)}
              style={({ pressed }) => [
                styles.overviewStudosQrCornerButton,
                !activeMember?.personalCode ? styles.overviewStudosQrButtonDisabled : null,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name="qr-code" size={18} color={STUDOS_THEME.ink} />
            </Pressable>
            <View style={styles.overviewStudosTopRow}>
              <View style={styles.overviewStudosIdentity}>
                <View style={styles.overviewStudosCopy}>
                  <View style={styles.overviewStudosAvatarTop}>
                    <Avatar profile={activeMember ?? { displayName: profileName }} variant="chatHeader" />
                  </View>
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
              <View style={styles.overviewClipIconGrid}>
                {CHAT_THREAD_HEADER_COUNTERS.map((counter, index) => {
                  const completed = completedClipIds.includes(counter.id);

                  return (
                    <Pressable
                      accessibilityLabel={`Klip ${index + 1}${completed ? ', gennemført' : ', ikke gennemført'}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      key={counter.id}
                      onPress={() => setSelectedClipId(counter.id)}
                      style={({ pressed }) => [
                        styles.overviewClipIconButton,
                        completed ? styles.overviewClipIconButtonCompleted : null,
                        pressed ? styles.footerItemPressed : null,
                      ]}
                    >
                      {counter.id === 'wave' ? (
                        <MaterialCommunityIcons
                          name="waves"
                          size={24}
                          color={completed ? '#1F9D55' : STUDOS_THEME.ink}
                        />
                      ) : (
                        <Ionicons
                          name={counter.icon}
                          size={23}
                          color={completed ? '#1F9D55' : STUDOS_THEME.ink}
                        />
                      )}
                      {completed ? (
                        <View style={styles.overviewClipCompletedMark}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.overviewClipAddMark}>
                          <Ionicons name="add" size={14} color={STUDOS_THEME.ink} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.overviewStudosStats}>
              {overviewStats.map((stat) => {
                return (
                  <View key={stat.id} style={styles.overviewStudosStat}>
                    <Ionicons name={stat.icon} size={13} color={stat.color} />
                    <Text style={styles.overviewStudosStatValue}>{stat.value}</Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                      style={styles.overviewStudosStatLabel}
                    >
                      {stat.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.overviewStudosCapsBottomRow}>
              <View style={styles.overviewStudosCapsBottomCoinShell}>
                <Image
                  source={CAPS_COIN}
                  resizeMethod="resize"
                  resizeMode="contain"
                  style={styles.overviewStudosCapsBottomCoin}
                />
              </View>
              <View style={styles.overviewStudosCapsBottomCopy}>
                <Text numberOfLines={1} style={styles.overviewStudosCapsBottomLabel}>
                  DINE CAPS
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  style={styles.overviewStudosCapsBottomValue}
                >
                  {formattedCapsBalance}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Åbn Optjen Caps"
                accessibilityRole="button"
                onPress={onOpenEarnCaps}
                style={({ pressed }) => [
                  styles.overviewStudosCapsEarnButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <View style={styles.overviewStudosCapsEarnIconWrap}>
                  <Ionicons name="sparkles" size={18} color={STUDOS_THEME.yellow} />
                  <View style={styles.overviewStudosCapsEarnPlus}>
                    <Ionicons name="add" size={10} color={STUDOS_THEME.ink} />
                  </View>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74} style={styles.overviewStudosCapsEarnText}>
                  Optjen Caps
                </Text>
              </Pressable>
            </View>
            <View pointerEvents="none" style={styles.overviewStudosBottomWave}>
              {OVERVIEW_STUDOS_BOTTOM_WAVE_CURVES.map((curve) => (
                <View
                  key={curve}
                  style={[
                    styles.overviewStudosBottomWaveCurve,
                    curve % 2 ? styles.overviewStudosBottomWaveCurveDeep : styles.overviewStudosBottomWaveCurveSoft,
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
        <Animated.View
          onLayout={setOverviewCardLayout('dailyMood')}
          style={overviewCardScrollStyle('dailyMood')}
        >
          <View style={styles.overviewMoodStandaloneCard}>
            <View style={styles.overviewMoodHeaderCopy}>
              <Text numberOfLines={1} style={styles.overviewMoodQuestion}>
                {overviewMoodQuestion}
              </Text>
              <Text numberOfLines={1} style={styles.overviewMoodUpdatedText}>
                {overviewMoodUpdatedText}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Vælg stemning"
              accessibilityRole="button"
              onPress={() => setMoodModalOpen(true)}
              style={({ pressed }) => [
                styles.overviewMoodCurrentBadge,
                hasCheckedInToday
                  ? styles.overviewMoodCurrentBadgeCheckedIn
                  : styles.overviewMoodCurrentBadgeNeedsCheckIn,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Ionicons name={activeMood.icon} size={18} color={hasCheckedInToday ? STUDOS_THEME.ink : '#FFFFFF'} />
              <Text
                numberOfLines={1}
                style={[
                  styles.overviewMoodCurrentText,
                  hasCheckedInToday
                    ? styles.overviewMoodCurrentTextOnBlue
                    : styles.overviewMoodCurrentTextOnAccent,
                ]}
              >
                {activeMood.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={hasCheckedInToday ? STUDOS_THEME.ink : '#FFFFFF'} />
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View
          onLayout={setOverviewCardLayout('todayCalendar')}
          style={overviewCardScrollStyle('todayCalendar')}
        >
          <View style={styles.overviewTodayCalendarCard}>
            <View style={styles.overviewTodayCalendarHeader}>
              <CalendarTitleGraphic iconSize={24} style={styles.overviewTodayCalendarGraphic} />
              <View style={styles.overviewTodayCalendarCopy}>
                <Text numberOfLines={1} style={styles.overviewTodayCalendarTitle}>
                  Min kommende kalender
                </Text>
                <Text numberOfLines={1} style={styles.overviewTodayCalendarMeta}>
                  {upcomingCalendarEvents.length
                    ? `${upcomingCalendarEvents.length} ${upcomingCalendarEvents.length === 1 ? 'kommende event' : 'kommende events'}`
                    : 'Ingen kommende events'}
                </Text>
              </View>
              <View style={styles.overviewTodayCalendarCountPill}>
                <Text style={styles.overviewTodayCalendarCountText}>{upcomingCalendarEvents.length}</Text>
              </View>
            </View>
            {upcomingCalendarEvents.length ? (
              <View style={styles.overviewTodayCalendarList}>
                <View style={styles.overviewTodayCalendarSection}>
                  <Text style={styles.overviewTodayCalendarSectionTitle}>Dagens events</Text>
                  {todayUpcomingCalendarEvents.length ? (
                    todayUpcomingCalendarEvents.map((event, index) => renderUpcomingCalendarEvent(event, index === 0))
                  ) : (
                    <Text style={styles.overviewTodayCalendarNoMoreText}>
                      Ingen flere events i dag.
                    </Text>
                  )}
                </View>
                <View style={styles.overviewTodayCalendarSection}>
                  <Text style={styles.overviewTodayCalendarSectionTitle}>Kommende events</Text>
                  {futureUpcomingCalendarEvents.length ? (
                    visibleFutureUpcomingCalendarEvents.map((event) => renderUpcomingCalendarEvent(event))
                  ) : (
                    <Text style={styles.overviewTodayCalendarNoMoreText}>
                      Der er ikke flere kommende events efter i dag.
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.overviewTodayCalendarEmpty}>
                <Text style={styles.overviewTodayCalendarEmptyText}>
                  Der er ingen kommende events i kalenderen lige nu.
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenCalendar?.()}
              style={({ pressed }) => [
                styles.overviewTodayCalendarAction,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Text style={styles.overviewTodayCalendarActionText}>Se hele kalenderen</Text>
              <Ionicons name="chevron-forward" size={16} color={STUDOS_THEME.red} />
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View
          onLayout={setOverviewCardLayout('wallsActivity')}
          style={overviewCardScrollStyle('wallsActivity')}
        >
          <View style={styles.overviewWallsActivityCard}>
            <View style={styles.overviewWallsActivityHeader}>
              <View style={styles.overviewWallsActivityIconWrap}>
                <Ionicons name="pulse" size={25} color={STUDOS_THEME.ink} />
              </View>
              <View style={styles.overviewWallsActivityCopy}>
                <Text numberOfLines={1} style={styles.overviewWallsActivityTitle}>
                  Seneste aktivitet
                </Text>
                <Text numberOfLines={1} style={styles.overviewWallsActivityMeta}>
                  Opslag, billeder, challenges og Caps fra klassen
                </Text>
              </View>
            </View>
            <View style={styles.overviewWallsActivityEmpty}>
              <View style={styles.overviewWallsActivityEmptyIcon}>
                <Ionicons name="sparkles" size={18} color={STUDOS_THEME.red} />
              </View>
              <View style={styles.overviewWallsActivityEmptyCopy}>
                <Text numberOfLines={1} style={styles.overviewWallsActivityEmptyTitle}>
                  Ingen ny aktivitet endnu
                </Text>
                <Text style={styles.overviewWallsActivityEmptyText}>
                  Når der sker nyt i klassen, vises det her.
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenActivities}
              style={({ pressed }) => [
                styles.overviewWallsActivityAction,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Text style={styles.overviewWallsActivityActionText}>Åbn aktiviteter</Text>
              <Ionicons name="chevron-forward" size={16} color={STUDOS_THEME.red} />
            </Pressable>
          </View>
        </Animated.View>
        <Animated.View
          onLayout={setOverviewCardLayout('classDuels')}
          style={overviewCardScrollStyle('classDuels')}
        >
          <View style={styles.overviewClassDuelsCard}>
            <View style={styles.overviewClassDuelsHeader}>
              <View style={styles.overviewClassDuelsIconWrap}>
                <View style={styles.overviewClassDuelsIcon}>
                  <Ionicons
                    name="shield"
                    size={25}
                    color={STUDOS_THEME.ink}
                    style={styles.overviewClassDuelsShieldOutline}
                  />
                  <Ionicons
                    name="shield"
                    size={21}
                    color="#FFFFFF"
                    style={styles.overviewClassDuelsShieldFill}
                  />
                  <MaterialCommunityIcons
                    name="sword-cross"
                    size={18}
                    color={STUDOS_THEME.red}
                    style={styles.overviewClassDuelsSwords}
                  />
                </View>
              </View>
              <View style={styles.overviewClassDuelsCopy}>
                <Text numberOfLines={1} style={styles.overviewClassDuelsTitle}>
                  Klassedueller
                </Text>
                <Text numberOfLines={1} style={styles.overviewClassDuelsMeta}>
                  Udfordringer, Caps og rivaliseringer i klassen
                </Text>
              </View>
            </View>
            <View style={styles.overviewClassDuelsStatsRow}>
              <View style={styles.overviewClassDuelsStat}>
                <Text style={styles.overviewClassDuelsStatValue}>0</Text>
                <Text numberOfLines={1} style={styles.overviewClassDuelsStatLabel}>Aktive</Text>
              </View>
              <View style={styles.overviewClassDuelsDivider} />
              <View style={styles.overviewClassDuelsStat}>
                <Text style={styles.overviewClassDuelsStatValue}>0</Text>
                <Text numberOfLines={1} style={styles.overviewClassDuelsStatLabel}>Afventer</Text>
              </View>
              <View style={styles.overviewClassDuelsDivider} />
              <View style={styles.overviewClassDuelsStat}>
                <Text style={styles.overviewClassDuelsStatValue}>1.000</Text>
                <Text numberOfLines={1} style={styles.overviewClassDuelsStatLabel}>Caps</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenPointDuel}
              style={({ pressed }) => [
                styles.overviewClassDuelsAction,
                pressed ? styles.footerItemPressed : null,
              ]}
            >
              <Text style={styles.overviewClassDuelsActionText}>Åbn Duel</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setStudosCodeModalOpen(false)}
        transparent
        visible={studosCodeModalOpen}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk Studos-kode"
            style={styles.chatModalBackdrop}
            onPress={() => setStudosCodeModalOpen(false)}
          />
          <View style={[styles.chatModalPanel, styles.overviewStudosCodeModalPanel]}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Del mit Studos</Text>
                <Text style={styles.chatModalTitle}>Scan og tilføj</Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setStudosCodeModalOpen(false)}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>
            <View style={styles.overviewStudosShareCard}>
              <Avatar profile={activeMember ?? { displayName: profileName }} variant="chatHeader" />
              <Text numberOfLines={1} style={styles.overviewStudosShareName}>
                {profileName}
              </Text>
              <View style={styles.overviewStudosShareCodePill}>
                <Text selectable style={styles.overviewStudosShareCodeText}>
                  {personalStudosCode}
                </Text>
              </View>
              <StudosCodeQr value={personalStudosCode} />
            </View>
          </View>
        </View>
      </Modal>
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
      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedClipId(null)}
        transparent
        visible={Boolean(selectedClip)}
      >
        <View style={styles.chatModalRoot}>
          <Pressable
            accessibilityLabel="Luk klipstatus"
            style={styles.chatModalBackdrop}
            onPress={() => setSelectedClipId(null)}
          />
          <View style={[styles.chatModalPanel, styles.overviewClipModalPanel]}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>Klipstatus</Text>
                <Text style={styles.chatModalTitle}>
                  {selectedClip ? `Klip ${selectedClipIndex + 1}` : 'Klip'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Luk"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setSelectedClipId(null)}
                style={({ pressed }) => [
                  styles.chatModalCloseButton,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={STUDOS_THEME.ink} />
              </Pressable>
            </View>
            <View style={styles.overviewClipModalIconWrap}>
              {selectedClip?.id === 'wave' ? (
                <MaterialCommunityIcons name="waves" size={28} color={STUDOS_THEME.ink} />
              ) : selectedClip ? (
                <Ionicons name={selectedClip.icon} size={28} color={STUDOS_THEME.ink} />
              ) : null}
            </View>
            <View style={styles.overviewClipModalOptions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => updateClipCompleted(true)}
                style={({ pressed }) => [
                  styles.overviewClipModalOption,
                  selectedClipCompleted ? styles.overviewClipModalOptionActive : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons
                  name={selectedClipCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={22}
                  color={selectedClipCompleted ? STUDOS_THEME.red : STUDOS_THEME.ink}
                />
                <Text style={[
                  styles.overviewClipModalOptionText,
                  selectedClipCompleted ? styles.overviewClipModalOptionTextActive : null,
                ]}>
                  Gennemført
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => updateClipCompleted(false)}
                style={({ pressed }) => [
                  styles.overviewClipModalOption,
                  !selectedClipCompleted ? styles.overviewClipModalOptionActive : null,
                  pressed ? styles.footerItemPressed : null,
                ]}
              >
                <Ionicons
                  name={!selectedClipCompleted ? 'ellipse' : 'ellipse-outline'}
                  size={22}
                  color={!selectedClipCompleted ? STUDOS_THEME.red : STUDOS_THEME.ink}
                />
                <Text style={[
                  styles.overviewClipModalOptionText,
                  !selectedClipCompleted ? styles.overviewClipModalOptionTextActive : null,
                ]}>
                  Ikke gennemført
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StudosCodeQr({ value }) {
  const qr = useMemo(() => {
    try {
      const cells = encodeQrCells(value || 'STUDOS');
      const size = Math.sqrt(cells.length);

      if (!Number.isInteger(size)) {
        return { cells: [], size: 0, moduleSize: 0 };
      }

      return {
        cells: Array.from(cells),
        size,
        moduleSize: Math.max(3, Math.floor(156 / size)),
      };
    } catch {
      return { cells: [], size: 0, moduleSize: 0 };
    }
  }, [value]);

  if (!qr.size) {
    return (
      <View style={styles.overviewStudosQrFallback}>
        <Ionicons name="qr-code" size={56} color={STUDOS_THEME.ink} />
      </View>
    );
  }

  const qrSize = qr.size * qr.moduleSize;

  return (
    <View style={styles.overviewStudosQrShell}>
      <View style={[styles.overviewStudosQrGrid, { width: qrSize, height: qrSize }]}>
        {qr.cells.map((cell, index) => {
          if (!cell) {
            return null;
          }

          return (
            <View
              key={`${index}`}
              style={[
                styles.overviewStudosQrCell,
                {
                  left: (index % qr.size) * qr.moduleSize,
                  top: Math.floor(index / qr.size) * qr.moduleSize,
                  width: qr.moduleSize,
                  height: qr.moduleSize,
                },
              ]}
            />
          );
        })}
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

function CalendarTitleGraphic({ iconSize = 29, style }) {
  return (
    <View style={[styles.calendarTitleGraphic, style]} pointerEvents="none">
      <View style={styles.calendarTitleIconBack} />
      <View style={styles.calendarTitleIconFace}>
        <Ionicons name="calendar-clear" size={iconSize} color={STUDOS_THEME.ink} />
        <View style={styles.calendarTitleIconDate}>
          <Text style={styles.calendarTitleIconDateText}>19</Text>
        </View>
      </View>
      <View style={styles.calendarTitleIconDot} />
    </View>
  );
}

function CalendarTitle() {
  return (
    <View accessible accessibilityLabel="Kalender" style={styles.overviewPageTitleWrap}>
      <Text style={styles.overviewPageTitleRest}>Kalender</Text>
      <CalendarTitleGraphic />
    </View>
  );
}

function CrewTitleGraphic() {
  return (
    <View style={styles.crewTitleGraphic} pointerEvents="none">
      <View style={styles.crewTitleGraphicBack} />
      <View style={styles.crewTitleGraphicFace}>
        <View style={styles.crewTitleGraphicPeople}>
          <Ionicons name="person-circle" size={16} color={STUDOS_THEME.ink} />
          <View style={styles.crewTitleGraphicDotRow}>
            <View style={[styles.crewTitleGraphicDot, styles.crewTitleGraphicDotBlue]} />
            <View style={[styles.crewTitleGraphicDot, styles.crewTitleGraphicDotYellow]} />
            <View style={[styles.crewTitleGraphicDot, styles.crewTitleGraphicDotRed]} />
          </View>
        </View>
      </View>
      <View style={[styles.crewTitleGraphicDot, styles.crewTitleGraphicOuterDot]} />
    </View>
  );
}

function EarnCapsTitleGraphic({ style }) {
  return (
    <View style={[styles.earnCapsTitleGraphic, style]} pointerEvents="none">
      <View style={styles.earnCapsTitleGraphicBack} />
      <View style={styles.earnCapsTitleCoinFace}>
        <Image source={CAPS_COIN} resizeMode="contain" style={styles.earnCapsTitleCoinImage} />
      </View>
      <View style={styles.earnCapsTitlePlusBadge}>
        <Ionicons name="add" size={10} color={STUDOS_THEME.ink} />
      </View>
      <View style={styles.earnCapsTitleGraphicDot} />
    </View>
  );
}

function EarnCapsTitle() {
  return (
    <View accessible accessibilityLabel="Optjen Caps" style={[styles.overviewPageTitleWrap, styles.earnCapsPageTitleWrap]}>
      <Text style={[styles.overviewPageTitleRest, styles.earnCapsPageTitleText]}>Optjen Caps</Text>
      <EarnCapsTitleGraphic />
    </View>
  );
}

function ClassBattleTitleGraphic({ style }) {
  return (
    <View style={[styles.classBattleTitleGraphic, style]} pointerEvents="none">
      <View style={styles.classBattleTitleGraphicBack} />
      <View style={styles.classBattleTitlePodiumFace}>
        <View style={[styles.classBattleTitlePodiumBar, styles.classBattleTitlePodiumBarSecond]} />
        <View style={[styles.classBattleTitlePodiumBar, styles.classBattleTitlePodiumBarFirst]} />
        <View style={[styles.classBattleTitlePodiumBar, styles.classBattleTitlePodiumBarThird]} />
        <View style={styles.classBattleTitlePodiumBase} />
      </View>
      <View style={styles.classBattleTitleGraphicDot} />
    </View>
  );
}

function ClassBattleTitle() {
  return (
    <View accessible accessibilityLabel="Leaderboard" style={[styles.overviewPageTitleWrap, styles.classBattlePageTitleWrap]}>
      <Text style={[styles.overviewPageTitleRest, styles.classBattlePageTitleText]}>Leaderboard</Text>
      <ClassBattleTitleGraphic />
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
          {selectedSchool?.name ?? 'Vælg skole'}
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

function ConsentRow({ active, children, label, onPress }) {
  return (
    <View style={styles.consentRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}
        onPress={onPress}
        style={({ pressed }) => [
          pressed ? styles.footerItemPressed : null,
        ]}
      >
        <View style={[styles.consentBox, active ? styles.consentBoxActive : null]}>
          {active ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
      <Text onPress={onPress} style={styles.consentText}>
        {children ?? label}
      </Text>
    </View>
  );
}

function Field({ label, placeholder, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCorrect={false}
        placeholder={placeholder}
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
      : variant === 'calendarCreator'
        ? styles.avatarImageCalendarCreator
      : variant === 'calendarPendingResponseCreator'
        ? styles.avatarImageCalendarPendingResponseCreator
      : variant === 'calendarAttendanceTag'
        ? styles.avatarImageCalendarAttendanceTag
      : variant === 'calendarAttendeeCard'
        ? styles.avatarImageCalendarAttendeeCard
      : variant === 'smallCircle'
        ? styles.avatarImageSmallCircle
        : styles.avatarImage;
  const fallbackStyle = variant === 'chatHeader'
    ? styles.avatarFallbackChatHeader
    : variant === 'chatMessage'
      ? styles.avatarFallbackChatMessage
    : variant === 'chatCircle'
      ? styles.avatarFallbackChatCircle
      : variant === 'calendarCreator'
        ? styles.avatarFallbackCalendarCreator
      : variant === 'calendarPendingResponseCreator'
        ? styles.avatarFallbackCalendarPendingResponseCreator
      : variant === 'calendarAttendanceTag'
        ? styles.avatarFallbackCalendarAttendanceTag
      : variant === 'calendarAttendeeCard'
        ? styles.avatarFallbackCalendarAttendeeCard
      : variant === 'smallCircle'
        ? styles.avatarFallbackSmallCircle
        : styles.avatarFallback;
  const textStyle = variant === 'chatHeader'
    ? styles.avatarTextChatHeader
    : variant === 'chatMessage'
      ? styles.avatarTextChatMessage
    : variant === 'chatCircle'
      ? styles.avatarTextChatCircle
      : variant === 'calendarCreator'
        ? styles.avatarTextCalendarCreator
      : variant === 'calendarPendingResponseCreator'
        ? styles.avatarTextCalendarPendingResponseCreator
      : variant === 'calendarAttendanceTag'
        ? styles.avatarTextCalendarAttendanceTag
      : variant === 'calendarAttendeeCard'
        ? styles.avatarTextCalendarAttendeeCard
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
  safeAreaWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#F1FBF8',
  },
  keyboardViewWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screen: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  loginScreen: {
    alignItems: 'stretch',
    minHeight: '100%',
    paddingTop: 6,
  },
  inviteScreenContainer: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
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
  appScreenDetached: {
    flex: 1,
  },
  appScreenCalendarUnderFooter: {
    marginBottom: -APP_FOOTER_HEIGHT,
    paddingBottom: 0,
  },
  appScreenClassBattleDetached: {
    flex: 1,
    paddingBottom: 0,
  },
  appScreenCrewDetached: {
    paddingBottom: 0,
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
    width: 74,
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
  wordmarkTextDark: {
    color: STUDOS_THEME.ink,
  },
  wordmarkTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  wordmarkUnderline: {
    width: 40,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.red,
    marginTop: -1,
    transform: [{ rotate: '-3deg' }],
  },
  wordmarkCompact: {
    width: 52,
    minHeight: 28,
  },
  wordmarkUnderlineCompact: {
    width: 28,
    height: 2,
    marginTop: -1,
    transform: [{ rotate: '-2.5deg' }],
  },
  wordmarkDot: {
    position: 'absolute',
    right: 5,
    top: -3,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
  },
  wordmarkDotCompact: {
    right: 3,
    top: -2,
    width: 5,
    height: 5,
    borderRadius: 5,
  },
  sidebarRoot: {
    position: 'absolute',
    top: APP_TOP_BAR_HEIGHT,
    right: 0,
    bottom: 0,
    left: 0,
    elevation: 70,
    zIndex: 70,
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
    zIndex: 1,
  },
  sidebarPanelScroll: {
    flex: 1,
  },
  sidebarPanelScrollContent: {
    flexGrow: 1,
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sidebarPrimaryNav: {
    flexShrink: 1,
    gap: 10,
  },
  sidebarBottomNav: {
    gap: 6,
  },
  sidebarNavSection: {
    gap: 12,
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
  sidebarEmergencyItem: {
    borderColor: 'rgba(255, 111, 115, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 111, 115, 0.1)',
    paddingHorizontal: 8,
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
  sidebarEarnCapsIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 34,
    height: 34,
  },
  sidebarEarnCapsIconBack: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 22,
    height: 21,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '8deg' }],
  },
  sidebarEarnCapsIconFace: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 4,
    top: 4,
    width: 25,
    height: 24,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 7,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    transform: [{ rotate: '-4deg' }],
  },
  sidebarEarnCapsIconCoin: {
    width: 29,
    height: 29,
  },
  sidebarEarnCapsIconPlus: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    bottom: 3,
    width: 13,
    height: 13,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: STUDOS_THEME.red,
  },
  sidebarEarnCapsIconDot: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: STUDOS_THEME.blue,
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
  sidebarMenuTextArcadeHub: {
    color: '#172143',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(255, 111, 115, 0.33)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sidebarMenuTextArcadeHubActive: {
    color: '#FF6F73',
    fontWeight: '900',
  },
  sidebarArcadeHubTextWrap: {
    flex: 1,
    gap: 6,
  },
  sidebarArcadeHubTextWrapActive: {
    transform: [{ translateX: 2 }],
  },
  sidebarArcadeHubMarker: {
    width: 58,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 111, 115, 0.32)',
  },
  sidebarArcadeHubMarkerActive: {
    backgroundColor: STUDOS_THEME.red,
  },
  lockedNavigationText: {
    opacity: 0.68,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  topLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 244, 216, 0.7)',
    shadowColor: '#0f1629',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  topLoginText: {
    color: '#182446',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  inviteMain: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 18,
    width: '92%',
    maxWidth: 420,
    zIndex: 2,
  },
  logoLockup: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 300,
  },
  inviteLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 114,
    height: 114,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderColor: '#E6ECF8',
    borderWidth: 1,
    shadowColor: '#0f1d3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  inviteWordmark: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    position: 'relative',
  },
  inviteWordmarkTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  inviteWordmarkText: {
    color: '#172143',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 42,
  },
  inviteWordmarkTextLight: {
    color: STUDOS_THEME.blue,
  },
  inviteWordmarkUnderline: {
    width: 44,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.red,
    marginTop: -2,
    transform: [{ rotate: '-3deg' }],
  },
  inviteWordmarkDot: {
    position: 'absolute',
    right: 2,
    top: -4,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
  },
  inviteTitle: {
    color: '#172143',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
    letterSpacing: 0,
    textAlign: 'center',
  },
  inviteHeroText: {
    color: '#5F6A7B',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  inviteFormCard: {
    width: '100%',
    gap: 14,
    marginTop: 2,
    borderColor: 'rgba(255, 111, 115, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    paddingTop: 16,
    shadowColor: '#0f1a39',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    zIndex: 2,
  },
  inviteForm: {
    alignSelf: 'stretch',
    gap: 10,
  },
  inviteInputLabel: {
    color: '#2C3D58',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  inviteInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#cfc8b8',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    paddingHorizontal: 12,
    minHeight: 56,
  },
  inviteInputIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 111, 115, 0.14)',
  },
  inviteActionRow: {
    marginTop: 2,
  },
  createClassFooter: {
    alignSelf: 'center',
    paddingBottom: 2,
  },
  createClassLink: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 0,
  },
  createClassText: {
    color: '#6F7684',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  createClassAction: {
    color: '#ef5b3f',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  createClassActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  centeredFlow: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
    minHeight: 680,
  },
  loginFlow: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: 16,
    alignItems: 'stretch',
  },
  flowStack: {
    gap: 16,
  },
  classBattleScreen: {
    flex: 1,
    gap: 16,
  },
  classBattleHeroHeader: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
  },
  classBattleHeroCopy: {
    flex: 1,
    gap: 10,
    minWidth: 0,
    paddingRight: 4,
  },
  classBattleHeroStats: {
    flexShrink: 0,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  classBattleIntroText: {
    color: '#6B7688',
    fontSize: 13.5,
    fontWeight: '650',
    letterSpacing: 0,
    lineHeight: 19,
    maxWidth: 228,
  },
  classBattleGoodDeedCard: {
    gap: 8,
    maxWidth: 236,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 9,
  },
  classBattleGoodDeedCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  classBattleGoodDeedIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FFF3CD',
  },
  classBattleGoodDeedKicker: {
    color: STUDOS_THEME.red,
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  classBattleGoodDeedCapsPill: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#E3F8EF',
    paddingHorizontal: 6,
  },
  classBattleGoodDeedCapsText: {
    color: '#1F9D55',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleGoodDeedCapsCoin: {
    width: 15,
    height: 15,
  },
  classBattleGoodDeedTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  classBattleGoodDeedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  classBattleGoodDeedStatusPill: {
    flexShrink: 1,
    minHeight: 20,
    borderRadius: 8,
    backgroundColor: '#FFF4D8',
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  classBattleGoodDeedStatusPillApproved: {
    backgroundColor: '#E3F8EF',
  },
  classBattleGoodDeedStatusPillMuted: {
    backgroundColor: '#EEF1F5',
  },
  classBattleGoodDeedStatusText: {
    color: STUDOS_THEME.ink,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
  },
  classBattleGoodDeedButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 32,
    borderColor: STUDOS_THEME.yellow,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: STUDOS_THEME.ink,
    paddingHorizontal: 11,
    shadowColor: '#1F9D55',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  classBattleGoodDeedButtonWide: {
    alignSelf: 'stretch',
    width: '100%',
  },
  classBattleGoodDeedButtonDisabled: {
    borderColor: '#DDE3EA',
    backgroundColor: '#E5E8EF',
    shadowOpacity: 0,
    elevation: 0,
  },
  classBattleGoodDeedButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleGoodDeedButtonTextDisabled: {
    color: '#65748b',
  },
  classBattleVerificationStack: {
    gap: 6,
    borderTopColor: '#EEF1F5',
    borderTopWidth: 1,
    paddingTop: 7,
  },
  classBattleVerificationKicker: {
    color: '#65748b',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  classBattleVerificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minWidth: 0,
  },
  classBattleVerificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  classBattleVerificationName: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
  },
  classBattleVerificationMeta: {
    color: '#65748b',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 11,
  },
  classBattleVerificationIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF1F5',
  },
  classBattleVerificationApproveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 28,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.red,
  },
  classBattleGoodDeedInlineError: {
    color: STUDOS_THEME.red,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
  classBattleGoodDeedsProgress: {
    gap: 7,
    maxWidth: 236,
    paddingTop: 4,
  },
  classBattleHeroLeaderboardHeader: {
    gap: 1,
    marginTop: 10,
  },
  classBattleGoodDeedsText: {
    color: STUDOS_THEME.ink,
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  classBattleGoodDeedsTrack: {
    height: 18,
    borderRadius: 8,
    backgroundColor: '#DDEBE8',
    justifyContent: 'center',
    overflow: 'visible',
  },
  classBattleGoodDeedsFill: {
    height: 8,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.yellow,
  },
  classBattleGoodDeedsBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -1,
    minWidth: 38,
    height: 24,
    marginLeft: -19,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.ink,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
  },
  classBattleGoodDeedsBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  classBattleHeaderStatCard: {
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
    width: 102,
    minHeight: 58,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
  },
  classBattleStatValue: {
    color: STUDOS_THEME.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  classBattleStatValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },
  classBattleCapsStatValue: {
    flexShrink: 1,
    maxWidth: 62,
    minWidth: 0,
    textAlign: 'right',
  },
  classBattleStatCoinImage: {
    flexShrink: 0,
    width: 18,
    height: 18,
  },
  classBattleStatLabel: {
    color: '#65748b',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    textAlign: 'center',
  },
  classBattleLeaderboardCard: {
    flex: 1,
    gap: 10,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  classBattleScopeSwitch: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#F0F5F3',
    padding: 4,
  },
  classBattleScopeSwitchItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  classBattleScopeSwitchItemActive: {
    backgroundColor: STUDOS_THEME.ink,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  classBattleScopeSwitchText: {
    color: '#65748b',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
  },
  classBattleScopeSwitchTextActive: {
    color: '#FFFFFF',
  },
  classBattleLeaderboardTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingBottom: 1,
    zIndex: 2,
  },
  classBattleLeaderboardTopBarScrolled: {
    borderBottomColor: 'rgba(23, 33, 67, 0.08)',
    borderBottomWidth: 1,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  classBattleJumpButton: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
  },
  classBattleJumpButtonText: {
    color: STUDOS_THEME.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  classBattleResetInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  classBattleResetInfoText: {
    color: '#65748b',
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: '850',
    letterSpacing: 0,
    lineHeight: 11,
    textAlign: 'right',
  },
  classBattleSectionTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  classBattleSectionMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  classBattleRows: {
    gap: 8,
    paddingBottom: 2,
  },
  classBattleRowsScroll: {
    flex: 1,
  },
  classBattleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    borderColor: '#EEF1F5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  classBattleRowCurrent: {
    borderColor: '#FFD0D2',
    backgroundColor: '#FFF6F6',
  },
  classBattleRankBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  classBattleRankBadgeFirst: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  classBattleRankBadgeSecond: {
    backgroundColor: '#DDE3EA',
  },
  classBattleRankBadgeThird: {
    backgroundColor: '#D99A5B',
  },
  classBattleRankText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleRankTextFirst: {
    color: STUDOS_THEME.ink,
  },
  classBattleRankTextSecond: {
    color: STUDOS_THEME.ink,
  },
  classBattleRankTextThird: {
    color: '#FFFFFF',
  },
  classBattleRowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  classBattleRowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  classBattleRowTitle: {
    color: STUDOS_THEME.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  classBattleCurrentPill: {
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  classBattleCurrentPillText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleRowMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  classBattleScoreBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 76,
  },
  classBattleScoreValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  classBattleScoreText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  classBattleScoreMetricText: {
    color: '#65748b',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 10,
    textAlign: 'right',
  },
  classBattleScoreTotalText: {
    color: STUDOS_THEME.red,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 10,
    textAlign: 'right',
  },
  classBattleScoreCoinImage: {
    width: 17,
    height: 17,
  },
  classBattleGoodDeedModalPanel: {
    maxHeight: '86%',
  },
  classBattleGoodDeedModalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  classBattleGoodDeedRewardLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  classBattleGoodDeedRewardPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: '#E3F8EF',
    paddingHorizontal: 9,
  },
  classBattleGoodDeedRewardText: {
    color: '#1F9D55',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleGoodDeedRewardCoin: {
    width: 18,
    height: 18,
  },
  classBattleGoodDeedPhotoBonusPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: '#F1FBF8',
    paddingHorizontal: 9,
  },
  classBattleGoodDeedPhotoBonusText: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleGoodDeedBuddyScroll: {
    maxHeight: 230,
  },
  classBattleGoodDeedBuddyList: {
    gap: 8,
  },
  classBattleBuddyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 54,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  classBattleBuddyRowSelected: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: '#FFF4D8',
  },
  classBattleBuddyRowDisabled: {
    opacity: 0.48,
  },
  classBattleBuddyCopy: {
    flex: 1,
    minWidth: 0,
  },
  classBattleBuddyName: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  classBattleBuddyMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  classBattleGoodDeedPhotoPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  classBattleGoodDeedPhotoPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  classBattleGoodDeedPhotoPreviewImage: {
    width: 44,
    height: 44,
  },
  classBattleGoodDeedPhotoCopy: {
    flex: 1,
    minWidth: 0,
  },
  classBattleGoodDeedPhotoTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  classBattleGoodDeedPhotoText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 1,
  },
  classBattleGoodDeedPhotoRemove: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF1F5',
  },
  classBattleGoodDeedError: {
    color: STUDOS_THEME.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  classBattleGoodDeedSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 14,
  },
  classBattleGoodDeedSubmitButtonDisabled: {
    backgroundColor: '#DDE3EA',
  },
  classBattleGoodDeedSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
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
  calendarSubpageModalHost: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  calendarSubpageModalContent: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  calendarSubpageDraggable: {
    flex: 1,
    width: '100%',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: -12, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 18,
  },
  calendarSubpageFullscreen: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: '#F1FBF8',
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingTop: APP_SCREEN_TOP_PADDING,
    paddingBottom: APP_FOOTER_PADDING_BOTTOM || 16,
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
    gap: 12,
    paddingTop: 72,
    paddingBottom: APP_FOOTER_HEIGHT + 16,
  },
  calendarDayRailBlock: {
    gap: 5,
    marginHorizontal: -APP_SCREEN_PADDING,
  },
  calendarMonthLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: APP_SCREEN_PADDING,
  },
  calendarMonthLineTitle: {
    color: STUDOS_THEME.ink,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    maxWidth: '72%',
    textAlign: 'center',
  },
  calendarMonthLineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  calendarDayRailContent: {
    gap: CALENDAR_DAY_RAIL_GAP,
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingBottom: 0,
  },
  calendarDayRailItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: CALENDAR_DAY_RAIL_ITEM_WIDTH,
    minHeight: 44,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  calendarDayRailItemActive: {
    backgroundColor: 'transparent',
  },
  calendarDayRailItemToday: {
    backgroundColor: 'transparent',
  },
  calendarDayRailItemMuted: {
    opacity: 0.44,
  },
  calendarDayRailWeekday: {
    color: '#65748b',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 10,
    textTransform: 'uppercase',
  },
  calendarDayRailNumber: {
    color: STUDOS_THEME.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
  },
  calendarDayRailTextActive: {
    color: STUDOS_THEME.ink,
  },
  calendarDayRailSignal: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(23, 33, 67, 0.22)',
    marginTop: 3,
  },
  calendarDayRailSignalFilled: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.red,
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
  calendarHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  calendarPendingResponseButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 36,
    borderColor: '#DDE8E5',
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    position: 'relative',
  },
  calendarPendingResponseButtonDisabled: {
    opacity: 0.48,
  },
  calendarPendingResponseText: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarPendingResponseBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  calendarPendingResponseBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
  },
  calendarPendingResponsePage: {
    gap: 12,
  },
  calendarPendingResponsePageSummary: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  calendarPendingResponseList: {
    gap: 9,
    paddingBottom: 2,
  },
  calendarPendingResponseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  calendarPendingResponseDateStack: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    minHeight: 56,
    position: 'relative',
  },
  calendarPendingResponseDate: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: 42,
    minHeight: 46,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingLeft: 7,
    paddingTop: 5,
  },
  calendarPendingResponseCreatorAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    bottom: -3,
    width: 26,
    height: 26,
    borderColor: '#F7FAFA',
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  calendarPendingResponseDateDay: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
    textAlign: 'left',
  },
  calendarPendingResponseDateMonth: {
    color: '#65748b',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 9,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  calendarPendingResponseCopy: {
    flex: 1,
    gap: 2,
    marginLeft: 6,
    minWidth: 0,
  },
  calendarPendingResponseTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  calendarPendingResponseMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
    textTransform: 'capitalize',
  },
  calendarPendingResponseActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  calendarPendingResponseActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  calendarPendingResponseActionAccept: {
    backgroundColor: STUDOS_THEME.blue,
  },
  calendarPendingResponseActionDecline: {
    backgroundColor: STUDOS_THEME.red,
  },
  calendarPendingResponseEmpty: {
    alignItems: 'center',
    gap: 8,
    minHeight: 96,
    justifyContent: 'center',
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 16,
  },
  calendarPendingResponseEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: 'center',
  },
  calendarCreateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: STUDOS_THEME.yellow,
    shadowColor: '#D9A83B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  calendarEventList: {
    gap: 12,
  },
  calendarPastEventsButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  calendarPastEventsButtonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  calendarPastEventsButtonCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  calendarPastEventsButtonTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  calendarPastEventsButtonMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  calendarPastEventsPage: {
    gap: 12,
  },
  calendarPastEventsPageSummary: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
  },
  calendarEventCard: {
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 17,
    elevation: 5,
  },
  calendarEventCardPast: {
    borderColor: '#DDE8E5',
    backgroundColor: '#FBFCFC',
  },
  calendarEventCoverWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2.35,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#F7FAFA',
    overflow: 'visible',
  },
  calendarEventCoverImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#F7FAFA',
  },
  calendarEventCoverShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(12, 18, 32, 0.22)',
  },
  calendarEventCoverTitleBlock: {
    position: 'absolute',
    right: 54,
    bottom: 8,
    left: 14,
    maxWidth: '78%',
  },
  calendarEventCoverTitleBlockWithAvatar: {
    left: 104,
  },
  calendarEventCoverTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 21,
    textShadowColor: 'rgba(12, 18, 32, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  calendarEventCoverActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(12, 18, 32, 0.58)',
  },
  calendarEventCreatorAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 16,
    bottom: -26,
    width: 76,
    height: 76,
    borderColor: '#FFFFFF',
    borderRadius: 38,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 11,
    elevation: 6,
  },
  calendarEventBody: {
    gap: 10,
    padding: 12,
    paddingTop: 34,
  },
  calendarEventTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  calendarEventTopRowCentered: {
    alignItems: 'center',
  },
  calendarDateBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    width: 49,
    minHeight: 54,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  calendarDateBadgePast: {
    borderColor: '#DDE8E5',
    backgroundColor: '#F7FAFA',
  },
  calendarDateBadgeUnderAvatar: {
    marginLeft: 14,
    marginTop: 0,
  },
  calendarDateDay: {
    color: STUDOS_THEME.red,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  calendarDateDayPast: {
    color: '#65748b',
  },
  calendarDateMonth: {
    color: STUDOS_THEME.ink,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  calendarEventCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  calendarEventCopyBesideDate: {
    justifyContent: 'center',
    minHeight: 54,
  },
  calendarEventTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  calendarEventActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
  },
  calendarEventTitle: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  calendarMetaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  calendarMetaText: {
    color: '#46546B',
    flex: 1,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'capitalize',
  },
  calendarCreatorText: {
    color: '#8B94A6',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0,
  },
  calendarPastEventBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 22,
    borderColor: '#DDE8E5',
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  calendarPastEventBadgeText: {
    color: STUDOS_THEME.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarDescription: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
  },
  calendarStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 38,
  },
  calendarAttendeeStack: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 38,
    paddingRight: 2,
  },
  calendarAttendeeStackItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
  },
  calendarAttendeeStackItemOverlap: {
    marginLeft: -18,
  },
  calendarAttendeeOverflowCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#F7FAFA',
  },
  calendarAttendeeOverflowText: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarStatTextGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
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
  calendarAttendanceModalPanel: {
    gap: 13,
    maxWidth: 390,
  },
  calendarAttendanceModalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  calendarAttendanceScroll: {
    maxHeight: 360,
  },
  calendarAttendanceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 2,
  },
  calendarAttendanceTag: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 34,
    borderColor: '#E5E8EF',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  calendarAttendanceTagAttending: {
    borderColor: '#FFD5D7',
    backgroundColor: '#FFF3F3',
  },
  calendarAttendanceTagDeclined: {
    borderColor: '#BDEEE7',
    backgroundColor: '#F0FCFA',
  },
  calendarAttendanceTagPending: {
    borderColor: '#E5E8EF',
    backgroundColor: '#FFFFFF',
  },
  calendarAttendanceName: {
    color: STUDOS_THEME.ink,
    flexShrink: 1,
    maxWidth: 156,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 15,
  },
  calendarAttendanceStatusIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  calendarAttendanceStatusAttending: {
    backgroundColor: STUDOS_THEME.red,
  },
  calendarAttendanceStatusDeclined: {
    backgroundColor: STUDOS_THEME.blue,
  },
  calendarAttendanceStatusPending: {
    borderColor: '#DDE8E5',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
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
    borderColor: STUDOS_THEME.blue,
    backgroundColor: STUDOS_THEME.blue,
  },
  calendarRsvpButtonDeclined: {
    borderColor: STUDOS_THEME.red,
    backgroundColor: STUDOS_THEME.red,
  },
  calendarRsvpText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarRsvpTextActive: {
    color: STUDOS_THEME.ink,
  },
  calendarRsvpTextDeclined: {
    color: '#FFFFFF',
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
    marginBottom: 18,
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
  calendarDayEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 245,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  calendarDayEmptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFF0F0',
    marginBottom: 14,
  },
  calendarDayEmptyTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 25,
    textAlign: 'center',
  },
  calendarDayEmptyText: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
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
    gap: 9,
    minHeight: 66,
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
  eventCoverTemplateArt: {
    position: 'relative',
    overflow: 'hidden',
  },
  eventCoverTemplateSoftBlock: {
    position: 'absolute',
    left: '-6%',
    right: '-6%',
    bottom: '-14%',
    height: '48%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    opacity: 0.95,
  },
  eventCoverTemplateAccentBlock: {
    position: 'absolute',
    left: '8%',
    top: '18%',
    width: '42%',
    height: '34%',
    borderRadius: 8,
    transform: [{ rotate: '-4deg' }],
  },
  eventCoverTemplateDeepCircle: {
    position: 'absolute',
    right: '-9%',
    top: '-22%',
    width: '46%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.94,
  },
  eventCoverTemplateLine: {
    position: 'absolute',
    left: '13%',
    right: '12%',
    bottom: '24%',
    height: 8,
    borderRadius: 8,
    opacity: 0.9,
    transform: [{ rotate: '-2deg' }],
  },
  eventCoverTemplateSmallMark: {
    position: 'absolute',
    right: '15%',
    bottom: '36%',
    width: '12%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.86,
  },
  calendarCoverTemplatePanel: {
    maxWidth: 430,
  },
  calendarCoverPickerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    elevation: 60,
    paddingHorizontal: 20,
  },
  calendarCoverPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 22, 0.34)',
  },
  calendarCoverUploadOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 58,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  calendarCoverUploadIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.yellow,
  },
  calendarCoverUploadCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  calendarCoverUploadTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  calendarCoverUploadText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  calendarCoverTemplateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  calendarCoverTemplateCard: {
    position: 'relative',
    width: '48%',
    minHeight: 96,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  calendarCoverTemplateCardSelected: {
    borderColor: STUDOS_THEME.red,
    borderWidth: 2,
  },
  calendarCoverTemplateImage: {
    width: '100%',
    height: 72,
    backgroundColor: '#F7FAFA',
  },
  calendarCoverTemplateLabel: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  calendarCoverTemplateCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
  calendarYearControls: {
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
    paddingTop: Math.max(16, APP_TOP_BAR_PADDING_TOP),
  },
  loginBackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  loginBrandSection: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  loginLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#FFFCF2',
    borderColor: '#E6ECF8',
    borderWidth: 1,
    shadowColor: '#0f1d3f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  loginLogo: {
    width: 46,
    height: 46,
    borderRadius: 7,
  },
  loginWordmark: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: -2,
  },
  loginWordmarkTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  loginWordmarkText: {
    color: '#172143',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
  },
  loginWordmarkTextLight: {
    color: STUDOS_THEME.blue,
  },
  loginWordmarkUnderline: {
    width: 34,
    height: 3,
    borderRadius: 3,
    backgroundColor: STUDOS_THEME.red,
    marginTop: -1,
    transform: [{ rotate: '-3deg' }],
  },
  loginWordmarkDot: {
    position: 'absolute',
    right: 2,
    top: -4,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
  },
  loginHeadline: {
    color: '#172143',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    lineHeight: 30,
  },
  loginLead: {
    color: '#5F6A7B',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  loginCard: {
    gap: 14,
    width: '100%',
    borderColor: 'rgba(255, 111, 115, 0.28)',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#0f1a39',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  loginCardHelp: {
    color: '#6F7684',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
    backgroundColor: '#F1FBF8',
    gap: 18,
  },
  overviewScreenRoot: {
    flex: 1,
    marginHorizontal: -APP_SCREEN_PADDING,
    marginTop: -APP_SCREEN_TOP_PADDING,
    marginBottom: -20,
    position: 'relative',
    backgroundColor: '#F1FBF8',
  },
  overviewScroll: {
    flex: 1,
  },
  overviewScrollContent: {
    flexGrow: 1,
    gap: 18,
    paddingHorizontal: APP_SCREEN_PADDING,
    paddingBottom: 20,
  },
  overviewHeaderSpacer: {
    height: OVERVIEW_HEADER_HEIGHT,
  },
  overviewTopLine: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  overviewHeaderStack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: APP_SCREEN_TOP_PADDING,
    paddingBottom: 13,
    backgroundColor: '#F1FBF8',
    zIndex: 8,
  },
  overviewHeaderStackScrolled: {
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 9,
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
    position: 'relative',
    marginBottom: 22,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
    paddingHorizontal: 15,
    paddingBottom: 14,
    paddingTop: 22,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
  overviewStudosAccentRail: {
    flexDirection: 'row',
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    height: 5,
    overflow: 'hidden',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    zIndex: 2,
  },
  overviewStudosAccentSegment: {
    flex: 1,
  },
  overviewStudosAccentBlue: {
    backgroundColor: STUDOS_THEME.blue,
  },
  overviewStudosAccentYellow: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewStudosAccentRed: {
    backgroundColor: STUDOS_THEME.red,
  },
  overviewStudosBottomWave: {
    flexDirection: 'row',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -17,
    height: 36,
    overflow: 'hidden',
    zIndex: 2,
  },
  overviewStudosBottomWaveCurve: {
    flex: 1,
    height: 36,
    marginHorizontal: -4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  overviewStudosBottomWaveCurveSoft: {
    transform: [{ translateY: 0 }],
  },
  overviewStudosBottomWaveCurveDeep: {
    transform: [{ translateY: -4 }],
  },
  overviewStudosQrCornerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 21,
    left: 14,
    width: 32,
    height: 32,
    borderColor: '#FFE1B1',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    shadowColor: STUDOS_THEME.yellow,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.36,
    shadowRadius: 13,
    elevation: 9,
    zIndex: 4,
  },
  overviewStudosTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 3,
  },
  overviewStudosIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 0,
  },
  overviewStudosCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  overviewStudosAvatarTop: {
    marginBottom: 1,
  },
  overviewStudosName: {
    color: STUDOS_THEME.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
    maxWidth: '100%',
    textAlign: 'center',
  },
  overviewStudosAwardRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 2,
    maxWidth: '100%',
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
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  overviewStudosQrButtonDisabled: {
    opacity: 0.48,
  },
  overviewStudosCodeModalPanel: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 360,
  },
  overviewStudosShareCard: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  overviewStudosShareName: {
    color: STUDOS_THEME.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    maxWidth: '100%',
    textAlign: 'center',
  },
  overviewStudosShareCodePill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderColor: '#FFE1B1',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 14,
  },
  overviewStudosShareCodeText: {
    color: STUDOS_THEME.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewStudosQrShell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  overviewStudosQrGrid: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  overviewStudosQrCell: {
    position: 'absolute',
    backgroundColor: STUDOS_THEME.ink,
  },
  overviewStudosQrFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 184,
    height: 184,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  overviewStudosStats: {
    alignSelf: 'stretch',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'relative',
    width: '100%',
    zIndex: 3,
  },
  overviewStudosStat: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 29,
    minWidth: 0,
    borderColor: '#EEF1F5',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 6,
  },
  overviewStudosStatValue: {
    color: STUDOS_THEME.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewStudosStatLabel: {
    color: '#65748b',
    flex: 1,
    fontSize: 8.9,
    fontWeight: '900',
    letterSpacing: 0,
    minWidth: 0,
  },
  overviewStudosCapsBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    position: 'relative',
    zIndex: 3,
    minHeight: 54,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  overviewStudosCapsBottomCoinShell: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 39,
    height: 39,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overviewStudosCapsBottomCopy: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  overviewStudosCapsBottomLabel: {
    color: '#65748b',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 11,
  },
  overviewStudosCapsBottomMeta: {
    color: '#65748b',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 10,
  },
  overviewStudosCapsBottomValue: {
    color: STUDOS_THEME.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    minWidth: 0,
  },
  overviewStudosCapsBottomCoin: {
    width: 45,
    height: 45,
  },
  overviewStudosCapsEarnButton: {
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
    justifyContent: 'center',
    width: 66,
    minHeight: 43,
    borderColor: STUDOS_THEME.yellow,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: STUDOS_THEME.ink,
    paddingHorizontal: 6,
    paddingVertical: 5,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 5,
  },
  overviewStudosCapsEarnIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 21,
    height: 20,
  },
  overviewStudosCapsEarnPlus: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    right: -7,
    width: 16,
    height: 16,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: STUDOS_THEME.red,
  },
  overviewStudosCapsEarnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodStandaloneCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  overviewCapsDuelMark: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 22,
    height: 20,
  },
  overviewCapsDuelSwords: {
    position: 'absolute',
    top: 2,
  },
  overviewTodayCalendarCard: {
    gap: 16,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  overviewTodayCalendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  overviewTodayCalendarGraphic: {
    flexShrink: 0,
    width: 42,
    height: 37,
    marginLeft: 0,
    marginBottom: 0,
  },
  overviewTodayCalendarCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewTodayCalendarTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  overviewTodayCalendarMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewTodayCalendarCountPill: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
    height: 30,
    borderColor: '#FFE1B1',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 10,
  },
  overviewTodayCalendarCountText: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewTodayCalendarList: {
    gap: 14,
  },
  overviewTodayCalendarSection: {
    gap: 8,
  },
  overviewTodayCalendarSectionTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewTodayCalendarEventRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 42,
    borderColor: '#EEF1F5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 11,
  },
  overviewTodayCalendarEventRowFeatured: {
    minHeight: 48,
    borderColor: '#FFD0D2',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  overviewTodayCalendarPillGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
  },
  overviewTodayCalendarTimePill: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.blue,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  overviewTodayCalendarDatePill: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewTodayCalendarClockPill: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.blue,
    paddingHorizontal: 7,
  },
  overviewTodayCalendarClockText: {
    color: STUDOS_THEME.ink,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 12,
  },
  overviewTodayCalendarTimePillFeatured: {
    minWidth: 52,
    minHeight: 30,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 9,
  },
  overviewTodayCalendarTimeText: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewTodayCalendarTimeTextFeatured: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  overviewTodayCalendarDateDayText: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 12,
  },
  overviewTodayCalendarDateMonthText: {
    color: STUDOS_THEME.ink,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 9,
    textTransform: 'lowercase',
  },
  overviewTodayCalendarEventCopy: {
    flex: 1,
    minWidth: 0,
  },
  overviewTodayCalendarEventTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  overviewTodayCalendarEventMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    minWidth: 0,
  },
  overviewTodayCalendarEventMeta: {
    color: '#65748b',
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 13,
  },
  overviewTodayCalendarMoreText: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'right',
  },
  overviewTodayCalendarNoMoreText: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
  },
  overviewTodayCalendarEmpty: {
    minHeight: 42,
    justifyContent: 'center',
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  overviewTodayCalendarEmptyText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  overviewTodayCalendarAction: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 10,
  },
  overviewTodayCalendarActionText: {
    color: STUDOS_THEME.ink,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewWallsActivityCard: {
    gap: 14,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  overviewWallsActivityHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  overviewWallsActivityIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  overviewWallsActivityIcon: {
    width: 31,
    height: 31,
  },
  overviewWallsActivityCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewWallsActivityTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  overviewWallsActivityMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewWallsActivityEmpty: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 62,
    borderColor: '#EEF1F5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  overviewWallsActivityEmptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFE4E5',
  },
  overviewWallsActivityEmptyCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewWallsActivityEmptyTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  overviewWallsActivityEmptyText: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
  },
  overviewWallsActivityAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    borderColor: '#FFD0D2',
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: '#FFF6F6',
    paddingHorizontal: 13,
  },
  overviewWallsActivityActionText: {
    color: STUDOS_THEME.red,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewClassDuelsCard: {
    gap: 14,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  overviewClassDuelsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  overviewClassDuelsIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderColor: '#FFD0D2',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF6F6',
  },
  overviewClassDuelsIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 27,
    height: 25,
  },
  overviewClassDuelsShieldOutline: {
    position: 'absolute',
    top: -2,
    zIndex: 1,
  },
  overviewClassDuelsShieldFill: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  overviewClassDuelsSwords: {
    position: 'absolute',
    top: 3,
    zIndex: 3,
  },
  overviewClassDuelsCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewClassDuelsTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  overviewClassDuelsMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewClassDuelsStatsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    borderColor: '#EEF1F5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 10,
  },
  overviewClassDuelsStat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  overviewClassDuelsStatValue: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  overviewClassDuelsStatLabel: {
    color: '#65748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  overviewClassDuelsDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E5E8EF',
  },
  overviewClassDuelsAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: STUDOS_THEME.ink,
    paddingHorizontal: 13,
  },
  overviewClassDuelsActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewDailyMoodCard: {
    gap: 14,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  overviewDailyMoodHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  overviewDailyMoodIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  overviewDailyMoodCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewDailyMoodTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  overviewDailyMoodMeta: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewDailyMoodCurrent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overviewDailyMoodCurrentNeedsCheckIn: {
    backgroundColor: STUDOS_THEME.red,
  },
  overviewDailyMoodCurrentCheckedIn: {
    backgroundColor: STUDOS_THEME.blue,
  },
  overviewDailyMoodCurrentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  overviewDailyMoodCurrentCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  overviewDailyMoodCurrentLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  overviewDailyMoodCurrentLabelCheckedIn: {
    color: STUDOS_THEME.ink,
  },
  overviewDailyMoodCurrentText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewDailyMoodCurrentTextCheckedIn: {
    color: STUDOS_THEME.ink,
  },
  overviewStudosMoodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
    zIndex: 3,
  },
  overviewMoodHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  overviewMoodHeaderCopy: {
    alignSelf: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 38,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 14,
  },
  overviewMoodCurrentRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
  },
  overviewMoodCurrentBadge: {
    alignItems: 'center',
    flexShrink: 0,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    maxWidth: 150,
    minWidth: 0,
    minHeight: 38,
    borderColor: '#FFE1B1',
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 12,
  },
  overviewMoodCurrentBadgeNeedsCheckIn: {
    borderColor: '#FF9DA0',
    backgroundColor: STUDOS_THEME.red,
  },
  overviewMoodCurrentBadgeCheckedIn: {
    borderColor: '#9DF0E7',
    backgroundColor: STUDOS_THEME.blue,
  },
  overviewMoodCurrentText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  overviewMoodCurrentTextOnAccent: {
    color: '#FFFFFF',
  },
  overviewMoodCurrentTextOnBlue: {
    color: STUDOS_THEME.ink,
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 13,
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
  earnCapsHeroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
  },
  earnCapsScreen: {
    flex: 1,
    gap: 16,
  },
  earnCapsHeroCopy: {
    flex: 1,
    gap: 10,
    minWidth: 0,
    paddingRight: 4,
  },
  earnCapsIntroText: {
    alignSelf: 'stretch',
    color: '#6B7688',
    fontSize: 13.5,
    fontWeight: '650',
    letterSpacing: 0,
    lineHeight: 19,
    marginLeft: 8,
    marginRight: 8,
  },
  earnCapsCheckInCard: {
    gap: 12,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  earnCapsCheckInHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  earnCapsCheckInIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    width: 42,
    height: 42,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: STUDOS_THEME.ink,
    overflow: 'hidden',
  },
  earnCapsCheckInLogo: {
    width: 40,
    height: 40,
  },
  earnCapsCheckInCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  earnCapsCheckInTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  earnCapsCheckInText: {
    color: '#65748b',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 15,
  },
  earnCapsCheckInRewardPill: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
    minHeight: 26,
    borderRadius: 8,
    backgroundColor: '#E3F8EF',
    paddingHorizontal: 8,
  },
  earnCapsCheckInRewardText: {
    color: '#1F9D55',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0,
  },
  earnCapsCheckInRewardCoin: {
    width: 17,
    height: 17,
  },
  earnCapsCheckInDays: {
    flexDirection: 'row',
    gap: 6,
  },
  earnCapsCheckInDay: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    aspectRatio: 1,
    minWidth: 0,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
  },
  earnCapsCheckInDayCurrent: {
    borderColor: STUDOS_THEME.yellow,
    backgroundColor: '#FFF8E8',
  },
  earnCapsCheckInDayDone: {
    borderColor: '#1F9D55',
    backgroundColor: '#1F9D55',
  },
  earnCapsCheckInDayText: {
    color: '#65748b',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0,
  },
  earnCapsCheckInDayTextCurrent: {
    color: STUDOS_THEME.ink,
  },
  earnCapsCheckInError: {
    color: STUDOS_THEME.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  earnCapsMethodsPanel: {
    flex: 1,
    minHeight: 286,
    gap: 10,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  earnCapsMethodsPanelHeader: {
    minHeight: 20,
    justifyContent: 'center',
  },
  earnCapsMethodsPanelTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  earnCapsMethodsScroll: {
    flex: 1,
  },
  earnCapsMethodStack: {
    gap: 10,
    paddingBottom: 1,
  },
  earnCapsMethodCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 12,
  },
  earnCapsMethodIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 42,
    height: 42,
    borderColor: '#FFD0D2',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF6F6',
  },
  earnCapsDuelIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 27,
    height: 25,
  },
  earnCapsDuelSwords: {
    position: 'absolute',
    top: 4,
  },
  earnCapsMethodCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  earnCapsMethodTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  earnCapsMethodTitle: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
  },
  earnCapsRewardPill: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
    minHeight: 24,
    borderRadius: 8,
    backgroundColor: '#E3F8EF',
    paddingHorizontal: 7,
  },
  earnCapsRewardText: {
    color: '#1F9D55',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  earnCapsRewardCoin: {
    width: 16,
    height: 16,
  },
  earnCapsMethodText: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 16,
  },
  earnCapsWeeklyMission: {
    gap: 3,
    borderColor: '#FFE1B1',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  earnCapsWeeklyMissionLabel: {
    color: STUDOS_THEME.red,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  earnCapsWeeklyMissionText: {
    color: STUDOS_THEME.ink,
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
  },
  earnCapsMethodError: {
    color: STUDOS_THEME.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
  },
  earnCapsMethodAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.ink,
    paddingHorizontal: 10,
  },
  earnCapsMethodActionRight: {
    alignSelf: 'flex-end',
  },
  earnCapsMethodActionDisabled: {
    backgroundColor: '#8D96A8',
  },
  earnCapsClaimAction: {
    alignSelf: 'flex-end',
  },
  earnCapsMethodActionText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0,
  },
  earnCapsActionDuelIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 18,
    height: 17,
  },
  earnCapsActionDuelSwords: {
    position: 'absolute',
    top: 3,
  },
  overviewClipIconGrid: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    position: 'relative',
    width: 84,
    zIndex: 3,
  },
  overviewClipIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  overviewClipIconButtonCompleted: {
    borderColor: '#91E6B6',
    borderWidth: 1,
    backgroundColor: '#F1FFF7',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 11,
    elevation: 7,
  },
  overviewClipCompletedMark: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -4,
    right: -3,
    width: 19,
    height: 19,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#22C55E',
  },
  overviewClipAddMark: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -4,
    right: -3,
    width: 19,
    height: 19,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.yellow,
  },
  overviewClipDot: {
    width: 3,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#A9B3C2',
  },
  overviewClipModalPanel: {
    gap: 14,
    maxWidth: 360,
  },
  overviewClipModalIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderColor: '#DDE8E5',
    borderRadius: 29,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  overviewClipModalOptions: {
    gap: 9,
  },
  overviewClipModalOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    minHeight: 52,
    borderColor: '#DDE8E5',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  overviewClipModalOptionActive: {
    borderColor: STUDOS_THEME.yellow,
    backgroundColor: '#FFF8E8',
  },
  overviewClipModalOptionText: {
    color: STUDOS_THEME.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  overviewClipModalOptionTextActive: {
    fontWeight: '900',
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
  crewTitleGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 47,
    height: 40,
    marginLeft: 8,
    marginBottom: -2,
  },
  crewTitleGraphicBack: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '8deg' }],
  },
  crewTitleGraphicFace: {
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
  crewTitleGraphicPeople: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 31,
  },
  crewTitleGraphicDotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginTop: -3,
  },
  crewTitleGraphicDot: {
    width: 7,
    height: 7,
    borderRadius: 8,
  },
  crewTitleGraphicDotBlue: {
    backgroundColor: STUDOS_THEME.blue,
  },
  crewTitleGraphicDotYellow: {
    backgroundColor: STUDOS_THEME.yellow,
  },
  crewTitleGraphicDotRed: {
    backgroundColor: STUDOS_THEME.red,
  },
  crewTitleGraphicOuterDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: STUDOS_THEME.yellow,
  },
  earnCapsPageTitleText: {
    fontSize: 29,
  },
  earnCapsPageTitleWrap: {
    flex: 0,
  },
  earnCapsTitleGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 48,
    height: 40,
    marginLeft: 8,
    marginBottom: -2,
  },
  earnCapsTitleGraphicBack: {
    position: 'absolute',
    right: 2,
    bottom: 1,
    width: 33,
    height: 31,
    borderRadius: 10,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '8deg' }],
  },
  earnCapsTitleCoinFace: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 2,
    top: 2,
    width: 38,
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
    overflow: 'hidden',
    transform: [{ rotate: '-4deg' }],
  },
  earnCapsTitleCoinImage: {
    width: 42,
    height: 42,
  },
  earnCapsTitlePlusBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 17,
    height: 17,
    borderColor: STUDOS_THEME.ink,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: STUDOS_THEME.red,
  },
  earnCapsTitleGraphicDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.blue,
  },
  classBattlePageTitleText: {
    fontSize: 28,
  },
  classBattlePageTitleWrap: {
    flex: 0,
  },
  classBattleTitleGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 48,
    height: 40,
    marginLeft: 8,
    marginBottom: -2,
  },
  classBattleTitleGraphicBack: {
    position: 'absolute',
    right: 2,
    bottom: 1,
    width: 33,
    height: 31,
    borderRadius: 10,
    backgroundColor: STUDOS_THEME.yellow,
    transform: [{ rotate: '8deg' }],
  },
  classBattleTitlePodiumFace: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 38,
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
  classBattleTitlePodiumBar: {
    position: 'absolute',
    bottom: 8,
    width: 7,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  classBattleTitlePodiumBarFirst: {
    left: 15,
    height: 18,
    backgroundColor: STUDOS_THEME.yellow,
  },
  classBattleTitlePodiumBarSecond: {
    left: 7,
    height: 13,
    backgroundColor: STUDOS_THEME.blue,
  },
  classBattleTitlePodiumBarThird: {
    right: 7,
    height: 10,
    backgroundColor: STUDOS_THEME.red,
  },
  classBattleTitlePodiumBase: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    left: 6,
    height: 3,
    borderRadius: 999,
    backgroundColor: STUDOS_THEME.ink,
    opacity: 0.16,
  },
  classBattleTitleGraphicDot: {
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
  titleSmallHeader: {
    fontSize: 30,
    lineHeight: 34,
  },
  miniGamesHeaderLogo: {
    position: 'relative',
    width: 38,
    height: 38,
    marginLeft: 8,
    marginBottom: -1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniGamesHeaderLogoDice: {
    transform: [{ scale: 1.35 }],
  },
  miniGamesScreenHeader: {
    gap: 0,
  },
  miniGamesHeaderBody: {
    color: '#65748b',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0,
    marginTop: 10,
  },
  miniGamesHeaderTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  miniGamesHeaderBodySmall: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  miniGamesTitleWithLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    gap: 8,
  },
  miniGamesPointerHeaderRow: {
    justifyContent: 'space-between',
  },
  miniGamesHeaderLogoInTitle: {
    marginLeft: 8,
  },
  miniGamesCardTitle: {
    fontSize: 15,
    lineHeight: 18,
  },
  miniGamesCardBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  miniGamesCardPanel: {
    gap: 0,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd6c7',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  miniGamesCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.996 }],
  },
  miniGamesCardTextWrap: {
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  miniGamesCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniGamesBottleIcon: {
    position: 'relative',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniGamesBottleIconInTitle: {
    marginBottom: 2,
    marginLeft: 2,
  },
  miniGamesBottleBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: STUDOS_THEME.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniGamesBottleLogoText: {
    color: STUDOS_THEME.red,
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '900',
  },
  miniGamesCardRow: {
    alignItems: 'center',
  },
  miniGamesCardChevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 115, 0.35)',
    shadowColor: '#172143',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  miniGamesCardChevronIcon: {
    transform: [{ translateX: 1 }],
  },
  miniGamesBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: '#fff7ee',
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 115, 0.35)',
  },
  luckyTopAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f9d55',
    borderWidth: 1,
    borderColor: '#1f9d55',
    shadowColor: '#1f9d55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  luckyTopAddButtonPressed: {
    transform: [{ scale: 0.96 }],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  luckyWheelContainer: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transform: [{ translateY: 46 }],
    width: '100%',
    minHeight: 320,
  },
  luckyPointer: {
    position: 'absolute',
    top: -20,
    left: '50%',
    transform: [{ translateX: -12 }],
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopWidth: 24,
    borderTopColor: STUDOS_THEME.ink,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 3,
  },
  luckyWheel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: STUDOS_THEME.red,
    backgroundColor: '#FFFAF0',
    overflow: 'hidden',
  },
  luckyWheelShell: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.52,
    shadowRadius: 16,
    elevation: 14,
    backgroundColor: 'transparent',
  },
  luckyWheelPatternLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  luckyWheelPatternBandOne: {
    position: 'absolute',
    width: '190%',
    height: '32%',
    borderRadius: 999,
    top: '8%',
    backgroundColor: 'rgba(117, 222, 208, 0.22)',
    transform: [{ rotate: '18deg' }],
  },
  luckyWheelPatternBandTwo: {
    position: 'absolute',
    width: '180%',
    height: '30%',
    borderRadius: 999,
    top: '42%',
    backgroundColor: 'rgba(255, 212, 109, 0.22)',
    transform: [{ rotate: '-12deg' }],
  },
  luckyWheelPatternBandThree: {
    position: 'absolute',
    width: '200%',
    height: '28%',
    borderRadius: 999,
    top: '70%',
    backgroundColor: 'rgba(255, 111, 115, 0.20)',
    transform: [{ rotate: '36deg' }],
  },
  luckyWheelMarker: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  luckyWheelMarkerLine: {
    width: 1,
    height: '48%',
    backgroundColor: 'rgba(23, 33, 67, 0.16)',
  },
  luckyWheelPlayerWrap: {
    position: 'absolute',
    width: 124,
    alignItems: 'center',
  },
  luckyWheelPlayerLabel: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderColor: 'rgba(255, 111, 115, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  luckyWheelCenterLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: STUDOS_THEME.ink,
    shadowColor: STUDOS_THEME.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 7,
    elevation: 6,
  },
  luckyWheelCenterLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  luckyContent: {
    marginTop: 16,
    gap: 10,
  },
  luckyLead: {
    color: '#65748b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  luckyAddPlayerModal: {
    width: '92%',
    maxWidth: 420,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd6c7',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  luckyAddPlayerModalRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  luckyAddModalDesc: {
    color: '#65748b',
    fontSize: 13,
    lineHeight: 18,
  },
  luckyModalPlayerSection: {
    marginTop: 2,
    gap: 8,
  },
  luckyModalPlayerTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  luckyAddModalInput: {
    fontSize: 16,
  },
  luckyAddModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  luckyAddModalGhostButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfc8b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf9f5',
  },
  luckyAddModalGhostButtonText: {
    color: '#172143',
    fontSize: 15,
    fontWeight: '900',
  },
  luckyAddModalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
  },
  luckyPlayerListWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  luckyPlayerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e4d8c4',
    backgroundColor: '#ffffff',
  },
  luckyPlayerPillText: {
    color: STUDOS_THEME.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  luckyPlayerPillRemove: {
    marginLeft: -2,
    marginTop: -1,
  },
  luckyEmptyText: {
    color: '#8a93a4',
    fontStyle: 'italic',
  },
  luckyActionBlock: {
    gap: 8,
    marginTop: 96,
    alignItems: 'center',
  },
  luckySpinButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: STUDOS_THEME.yellow,
    borderWidth: 1.5,
    borderColor: STUDOS_THEME.red,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
  luckySpinButtonPressed: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  luckySpinButtonText: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  luckySpinButtonLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  luckySpinWordmark: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  luckySpinWordmarkTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  luckySpinWordmarkText: {
    color: STUDOS_THEME.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  luckySpinWordmarkTextWhite: {
    color: '#ffffff',
  },
  luckySpinWordmarkUnderline: {
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: STUDOS_THEME.red,
    marginTop: -1,
    transform: [{ rotate: '-3deg' }],
  },
  luckySpinWordmarkDot: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: STUDOS_THEME.yellow,
  },
  luckyWheelHint: {
    color: '#8a93a4',
    fontSize: 12,
    fontWeight: '700',
  },
  luckyResultPanel: {
    marginTop: 10,
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 115, 0.35)',
    backgroundColor: '#fff4ea',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  luckyResultLabel: {
    color: '#7a5b2a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  luckyResultName: {
    color: STUDOS_THEME.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  miniGamesGameList: {
    gap: 12,
    marginTop: 6,
  },
  titleWithLogoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  crewScreen: {
    flex: 1,
    gap: 16,
    minHeight: 0,
  },
  crewPanel: {
    flex: 1,
    minHeight: 0,
    marginTop: 2,
  },
  crewSourceTabs: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    padding: 2,
    borderRadius: 10,
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#e2e6ee',
  },
  crewSourceTab: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  crewSourceTabActive: {
    backgroundColor: '#172143',
  },
  crewSourceTabText: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  crewSourceTabTextActive: {
    color: '#ffffff',
  },
  crewMemberListScroll: {
    flex: 1,
    minHeight: 0,
  },
  crewHeaderWordmark: {
    marginBottom: 2,
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
  settingsNotificationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  settingsNotificationIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#FFF4EE',
  },
  settingsNotificationCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  settingsNotificationTokenBox: {
    gap: 6,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    padding: 12,
  },
  settingsNotificationTokenLabel: {
    color: '#65748b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  settingsNotificationTokenText: {
    color: STUDOS_THEME.ink,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  notificationPromptPanel: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  notificationPromptIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderColor: '#FFE1B1',
    borderRadius: 29,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
  },
  notificationPromptCopy: {
    alignItems: 'center',
    gap: 5,
    width: '100%',
  },
  notificationPromptTitle: {
    color: STUDOS_THEME.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
    textAlign: 'center',
  },
  notificationPromptText: {
    color: '#65748b',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'center',
  },
  notificationPromptActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  notificationPromptSecondaryButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    borderColor: '#E5E8EF',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F7FAFA',
    paddingHorizontal: 12,
  },
  notificationPromptPrimaryButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 12,
  },
  notificationPromptSecondaryText: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  notificationPromptPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  weeklyCheckInRewardPanel: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  weeklyCheckInRewardIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 72,
    height: 72,
    borderColor: '#FFE1B1',
    borderRadius: 36,
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
    overflow: 'hidden',
  },
  weeklyCheckInRewardCoin: {
    width: 78,
    height: 78,
  },
  weeklyCheckInRewardPlus: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: '#1F9D55',
  },
  goodDeedClaimRewardPlus: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.red,
  },
  goodDeedClaimRewardAmount: {
    color: '#1F9D55',
    fontWeight: '900',
  },
  goodDeedClaimRewardInlineCoin: {
    width: 19,
    height: 19,
    marginHorizontal: -1,
  },
  goodDeedClaimRewardTextLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  goodDeedClaimRewardTitle: {
    fontSize: 19,
    lineHeight: 23,
  },
  weeklyCheckInRewardButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: '#182446',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  emergencyContactContainer: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 115, 0.28)',
    backgroundColor: 'rgba(255, 111, 115, 0.1)',
    padding: 12,
    marginTop: 8,
  },
  emergencyContactTitle: {
    color: '#7e242f',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  emergencyContactBody: {
    color: '#7e5d65',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  label: {
    color: '#48566d',
    fontSize: 13,
    fontWeight: '900',
  },
  inviteInput: {
    flex: 1,
    minHeight: 52,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: '#182446',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    paddingHorizontal: 10,
    paddingVertical: 0,
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
  staticField: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    borderColor: '#cfc8b8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fbfaf6',
    paddingHorizontal: 12,
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
  accountProfilePhotoPressable: {
    alignItems: 'center',
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
  accountProfilePhotoActionBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4D8',
    borderColor: '#FFFFFF',
    borderWidth: 2,
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
  accountProfileCapsAmount: {
    color: '#182446',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  accountProfileCapsCoin: {
    width: 18,
    height: 18,
  },
  accountProfileCapsValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    flexShrink: 1,
    justifyContent: 'flex-end',
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
  consentLinkText: {
    color: '#1f64cc',
    textDecorationLine: 'underline',
  },
  emptyFeatureIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#fff4ee',
  },
  emptyFeatureIconLocked: {
    borderColor: '#FFE1B1',
    borderWidth: 1,
    backgroundColor: '#FFF8E8',
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
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  accountProfileDetailValueWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
    minHeight: 30,
  },
  accountProfileDetailAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1FBF8',
  },
  accountProfileBottomActions: {
    gap: 10,
  },
  accountProfileActionButtonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
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
  crewMemberList: {
    gap: 10,
  },
  connectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    borderBottomColor: '#E5E8EF',
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  crewSelfMember: {
    backgroundColor: '#FFF7EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  crewMemberChatIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 0,
    marginLeft: 0,
    padding: 0,
    position: 'relative',
  },
  crewMemberActionIcons: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: -4,
    alignItems: 'center',
  },
  crewMemberMobileIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 0,
    padding: 0,
  },
  crewMemberMobileIconButtonDisabled: {
    opacity: 0.5,
  },
  crewMemberChatIconBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: STUDOS_THEME.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 2,
  },
  crewPhoneModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  crewPhoneModalBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(23, 33, 67, 0.42)',
  },
  crewPhoneModalPanel: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  crewPhoneModalTitle: {
    color: '#172143',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  crewPhoneModalName: {
    color: '#172143',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  crewPhoneModalNumber: {
    color: '#FF6F73',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  crewPhoneModalCloseButton: {
    marginTop: 6,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: STUDOS_THEME.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  crewPhoneModalCloseText: {
    color: STUDOS_THEME.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
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
  avatarImageCalendarPendingResponseCreator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d7dce7',
  },
  avatarImageCalendarAttendanceTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d7dce7',
  },
  avatarImageCalendarAttendeeCard: {
    width: 38,
    height: 38,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#d7dce7',
  },
  avatarImageCalendarCreator: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
  avatarFallbackCalendarPendingResponseCreator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: STUDOS_THEME.ink,
  },
  avatarFallbackCalendarAttendanceTag: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: STUDOS_THEME.ink,
  },
  avatarFallbackCalendarAttendeeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.ink,
  },
  avatarFallbackCalendarCreator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
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
  avatarTextCalendarPendingResponseCreator: {
    color: STUDOS_THEME.yellow,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextCalendarAttendanceTag: {
    color: STUDOS_THEME.yellow,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextCalendarAttendeeCard: {
    color: STUDOS_THEME.yellow,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarTextCalendarCreator: {
    color: STUDOS_THEME.yellow,
    fontSize: 22,
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
    gap: 0,
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
  footerRasterIcon: {
    width: 34,
    height: 34,
  },
  footerRasterIconActive: {
    transform: [{ translateY: -1 }, { scale: 1.04 }],
  },
  footerPointDuelIcon: {
    width: 26,
    height: 24,
    transform: [{ scale: 1.14 }],
  },
  footerPointDuelIconActive: {
    transform: [{ scale: 1.2 }],
  },
  footerPointDuelShieldOutline: {
    position: 'absolute',
    top: -2,
    zIndex: 1,
  },
  footerPointDuelShieldFill: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  footerPointDuelSwords: {
    zIndex: 3,
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
  footerIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 36,
    height: 34,
  },
  lockBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 15,
    height: 15,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: STUDOS_THEME.yellow,
    shadowColor: STUDOS_THEME.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  sidebarLockBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  footerLockBadge: {
    position: 'absolute',
    top: -6,
    right: -5,
  },
  footerUnreadBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -8,
    left: -7,
    minWidth: 22,
    height: 22,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: STUDOS_THEME.red,
    paddingHorizontal: 5,
    shadowColor: STUDOS_THEME.red,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 7,
    zIndex: 4,
  },
  footerUnreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
  },
  footerLabel: {
    color: '#172143',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 12,
    marginTop: -2,
  },
  footerLabelActive: {
    color: '#FF6F73',
  },
});
