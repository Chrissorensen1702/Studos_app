const appJson = require('./app.json');

const appVariant = process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE;
const isDevelopmentVariant = appVariant === 'development';

const config = {
  ...appJson.expo,
};

if (isDevelopmentVariant) {
  config.name = 'Studos-dev';
  config.scheme = 'studos-dev';
  config.android = {
    ...config.android,
    package: 'dk.studenterapp.mobile.dev',
  };
}

module.exports = {
  expo: config,
};
