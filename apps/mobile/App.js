import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const SESSION_STORAGE_KEY = 'studos.session.v1';
const STUDOS_LOGO = require('./assets/icon.png');
const APP_TOP_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 58;
const APP_TOP_BAR_PADDING_TOP = Platform.OS === 'ios' ? 42 : 0;
const APP_TOP_BAR_PADDING_BOTTOM = Platform.OS === 'ios' ? 8 : 0;
const CREATE_CLASS_URL =
  process.env.EXPO_PUBLIC_CREATE_CLASS_URL
  ?? 'http://192.168.1.114/studenter-app/public/opret-klasse';
const API_BASE_URLS = [
  process.env.EXPO_PUBLIC_API_URL,
  'http://192.168.1.114/studenter-app/public/api',
  'http://localhost/studenter-app/public/api',
  'http://127.0.0.1/studenter-app/public/api',
  'http://MacBook-Air-tilhrende-Chris.local/studenter-app/public/api',
].filter(Boolean);
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

const daysUntil = (value) => {
  if (!value) {
    return 0;
  }

  const today = new Date();
  const target = new Date(`${value}T12:00:00`);
  const diff = target.getTime() - today.getTime();

  return Math.max(0, Math.ceil(diff / 86_400_000));
};

const initialsFor = (profile) =>
  `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || 'S';

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
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        ...options,
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};

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

  useEffect(() => {
    let isMounted = true;

    SecureStore.getItemAsync(SESSION_STORAGE_KEY)
      .then((storedSession) => {
        if (!storedSession || !isMounted) {
          return;
        }

        const parsedSession = JSON.parse(storedSession);

        if (!parsedSession?.session?.member || !parsedSession?.class) {
          return;
        }

        setSession(parsedSession.session);
        setSchoolClass(parsedSession.class);
        setProfile(profileFromMember(parsedSession.session.member));
        setActiveTab('overview');
        setStep('overview');
      })
      .catch(() => {
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
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify({
      session: data.session,
      class: data.class,
    }));
  };

  useEffect(() => {
    if (!session?.member?.id || !activeClass?.inviteCode) {
      return;
    }

    let isMounted = true;

    apiFetch(`/classes/invite/${encodeURIComponent(activeClass.inviteCode)}?memberId=${encodeURIComponent(session.member.id)}`)
      .then(async (data) => {
        if (!isMounted) {
          return;
        }

        const freshMember = data.class?.members?.find((member) => member.id === session.member.id);

        if (!freshMember) {
          return;
        }

        const nextSession = {
          ...session,
          member: {
            ...session.member,
            ...freshMember,
          },
        };

        setSession(nextSession);
        setSchoolClass(data.class);
        setProfile(profileFromMember(freshMember));

        await storeSession({
          session: nextSession,
          class: data.class,
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeClass?.inviteCode, session?.member?.id]);

  const clearSession = async () => {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
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
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      updateProfile('profilePhotoUrl', result.assets[0].uri);
    }
  };

  const submitProfile = async () => {
    const nextProfile = {
      schoolId: profile.schoolId,
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.trim(),
      birthday: profile.birthday.trim(),
      profilePhotoUrl: profile.profilePhotoUrl,
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
        <StatusBar barStyle="light-content" backgroundColor="#172143" />
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
            <ScrollView
              contentContainerStyle={styles.appScreen}
              keyboardShouldPersistTaps="handled"
              style={styles.appScroll}
            >
              <AppTabScreen
                activeMember={activeMember}
                activeMembers={activeMembers}
                activeTab={activeTab}
                countdown={countdown}
                events={events}
                nextEvent={nextEvent}
                pinnedContent={pinnedContent}
                profile={profile}
                schoolClass={activeClass}
              />
            </ScrollView>
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
  events,
  nextEvent,
  pinnedContent,
  profile,
  schoolClass,
}) {
  if (activeTab === 'chat') {
    return (
      <FeatureScreen
        icon="chatbubble-ellipses"
        kicker={schoolClass.className}
        title="Chat"
        emptyTitle="Ingen beskeder endnu"
        emptyText="Klassechatten bliver samlet her."
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
      <FeatureScreen
        icon="calendar"
        kicker={schoolClass.className}
        title="Kalender"
        emptyTitle="Ingen kalender endnu"
        emptyText="Klassens datoer og aftaler bliver samlet her."
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

function ConnectionsScreen({ activeMember, schoolClass }) {
  const [personalCode, setPersonalCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [submittingConnection, setSubmittingConnection] = useState(false);
  const [respondingConnectionId, setRespondingConnectionId] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');

  const loadConnections = async () => {
    if (!activeMember?.id) {
      return;
    }

    setLoadingConnections(true);

    try {
      const data = await apiFetch(`/members/${encodeURIComponent(activeMember.id)}/connections`);
      setConnections(data.connections ?? []);
    } catch (apiError) {
      setConnectionError(apiError.message || 'Connections kunne ikke hentes.');
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!activeMember?.id) {
      return () => {
        isMounted = false;
      };
    }

    setLoadingConnections(true);
    apiFetch(`/members/${encodeURIComponent(activeMember.id)}/connections`)
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
  }, [activeMember?.id]);

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
        method: 'POST',
        body: JSON.stringify({
          requesterMemberId: activeMember.id,
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
        method: 'POST',
        body: JSON.stringify({
          memberId: activeMember.id,
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
                <View style={styles.connectionAvatar}>
                  <Text style={styles.connectionAvatarText}>
                    {(otherMember?.firstName?.[0] ?? otherMember?.displayName?.[0] ?? 'S').toUpperCase()}
                  </Text>
                </View>
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
          <Pressable style={[styles.sidebarMenuItem, styles.sidebarProfileItem]}>
            <Avatar profile={memberProfile} variant="smallCircle" />
            <View style={styles.sidebarProfileCopy}>
              <Text numberOfLines={1} style={styles.sidebarProfileTitle}>
                {profileDisplayName}
              </Text>
              <Text style={styles.sidebarProfileSubtitle}>Min profil</Text>
            </View>
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
              <View style={styles.footerCenterCircle}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={28}
                  color={isActive ? '#FF6F73' : '#FFF4D8'}
                />
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
                size={22}
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
              <Text style={styles.photoInitials}>{initialsFor(profile)}</Text>
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

function OverviewScreen({ activeMember, countdown }) {
  return (
    <View style={[styles.overviewBlank, styles.overviewSurface]}>
      <View style={styles.overviewTopLine}>
        <OverviewTitle />
        <View style={styles.overviewCountdown}>
          <Text style={styles.overviewCountdownNumber}>{countdown}</Text>
          <Text style={styles.overviewCountdownLabel}>dage til kaos</Text>
        </View>
      </View>

      <View style={[styles.overviewCodePill, styles.overviewUserIdPill]}>
        <View style={[styles.overviewCodeDot, styles.overviewUserIdDot]} />
        <Text style={styles.overviewCodeLabel}>Din Studos-kode</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.overviewClassMetaValue}>
          {activeMember?.personalCode ?? 'Mangler'}
        </Text>
      </View>
    </View>
  );
}

function OverviewTitle() {
  return (
    <View accessible accessibilityLabel="Overblik" style={styles.overviewPageTitleWrap}>
      <View style={styles.overviewTitleLetterWrap}>
        <Text style={styles.overviewPageTitleLetter}>O</Text>
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
      </View>
      <Text style={styles.overviewPageTitleRest}>verblik</Text>
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
  const imageStyle = variant === 'smallCircle' ? styles.avatarImageSmallCircle : styles.avatarImage;
  const fallbackStyle = variant === 'smallCircle' ? styles.avatarFallbackSmallCircle : styles.avatarFallback;
  const textStyle = variant === 'smallCircle' ? styles.avatarTextSmallCircle : styles.avatarText;

  if (profile.profilePhotoUrl) {
    return <Image source={{ uri: profile.profilePhotoUrl }} style={imageStyle} />;
  }

  return (
    <View style={fallbackStyle}>
      <Text style={textStyle}>{initialsFor(profile)}</Text>
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
  },
  appScroll: {
    zIndex: 2,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
    elevation: 16,
    zIndex: 5,
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
    elevation: 15,
    zIndex: 4,
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
    transform: [{ translateY: -8 }],
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
    left: 3,
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
  overviewCountdownNumber: {
    color: '#FF6F73',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 39,
  },
  overviewCountdownLabel: {
    color: '#172143',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 12,
    textAlign: 'right',
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
    borderRadius: 8,
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
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#182446',
  },
  avatarFallbackSmallCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#172143',
  },
  avatarText: {
    color: '#f6d36d',
    fontSize: 23,
    fontWeight: '900',
  },
  avatarTextSmallCircle: {
    color: '#FFD46D',
    fontSize: 13,
    fontWeight: '900',
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
    borderTopColor: '#ddd6c7',
    borderTopWidth: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 8,
    overflow: 'visible',
    zIndex: 4,
  },
  footerItem: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 8,
    paddingTop: 11,
  },
  footerStandardItem: {
    transform: [{ translateY: -4 }],
  },
  footerFirstItem: {
    transform: [{ translateX: 10 }, { translateY: -4 }],
  },
  footerLastItem: {
    transform: [{ translateX: -10 }, { translateY: -4 }],
  },
  footerCenterItem: {
    justifyContent: 'flex-end',
    minHeight: 44,
    overflow: 'visible',
    paddingBottom: 1,
    paddingTop: 0,
    position: 'relative',
  },
  footerCenterCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#172143',
    borderWidth: 0,
    shadowColor: '#172143',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 14,
  },
  footerCenterCircleLabel: {
    color: '#FFF4D8',
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
  },
  footerLabelActive: {
    color: '#FF6F73',
  },
});
