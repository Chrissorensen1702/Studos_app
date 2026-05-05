const fs = require('fs');
const path = require('path');

const PROD_ANDROID_PACKAGE = 'dk.studenterapp.mobile';
const DEV_ANDROID_PACKAGE = 'dk.studenterapp.mobile.dev';
const appVariant = process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE;
const isDevelopmentVariant = appVariant === 'development';
const targetPlatform = process.env.EAS_BUILD_PLATFORM || process.env.EXPO_OS || '';
const enableAndroidNotifications = targetPlatform === 'android'
  || process.env.STUDOS_ENABLE_ANDROID_NOTIFICATIONS === '1';

const readJsonFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const googleServicesContainsPackage = (filePath, packageName) => {
  const googleServices = readJsonFile(filePath);
  const clients = Array.isArray(googleServices?.client) ? googleServices.client : [];

  return clients.some((client) =>
    client?.client_info?.android_client_info?.package_name === packageName);
};

const androidGoogleServicesFileFor = (packageName) => {
  const candidates = packageName === DEV_ANDROID_PACKAGE
    ? ['./google-services.dev.json', './google-services.json']
    : ['./google-services.json', './google-services.prod.json'];

  return candidates.find((candidate) => {
    const filePath = path.join(__dirname, candidate);

    return fs.existsSync(filePath) && googleServicesContainsPackage(filePath, packageName);
  }) ?? null;
};

module.exports = ({ config: staticConfig }) => {
  const androidPackage = isDevelopmentVariant ? DEV_ANDROID_PACKAGE : PROD_ANDROID_PACKAGE;
  const androidGoogleServicesFile = androidGoogleServicesFileFor(androidPackage);
  const config = {
    ...staticConfig,
  };

  if (isDevelopmentVariant) {
    config.name = 'Studos-dev';
    config.scheme = 'studos-dev';
    config.ios = {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        NSLocalNetworkUsageDescription: 'Studos bruger lokal netværksadgang til at forbinde dev-buildet med udviklingsserveren på din Mac.',
      },
    };
    config.android = {
      ...config.android,
      package: 'dk.studenterapp.mobile.dev',
    };
  } else if (config.ios?.infoPlist?.NSLocalNetworkUsageDescription) {
    config.ios = {
      ...config.ios,
      infoPlist: {
        ...config.ios.infoPlist,
      },
    };
    delete config.ios.infoPlist.NSLocalNetworkUsageDescription;
  }

  if (enableAndroidNotifications && androidGoogleServicesFile) {
    config.android = {
      ...config.android,
      googleServicesFile: androidGoogleServicesFile,
    };
  }

  config.plugins = [
    ...(config.plugins ?? []),
    '@react-native-community/datetimepicker',
  ];

  if (enableAndroidNotifications) {
    config.plugins = [
      ...(config.plugins ?? []),
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#EF7476',
          defaultChannel: 'studos-default',
        },
      ],
    ];
  }

  return config;
};
