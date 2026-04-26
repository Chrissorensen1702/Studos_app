const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

module.exports = function withAndroidCleartext(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = getMainApplicationOrThrow(config.modResults);

    mainApplication.$['android:usesCleartextTraffic'] = 'true';

    return config;
  });
};
