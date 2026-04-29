const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const expectedConfigs = [
  {
    label: 'preview/APK',
    packageName: 'dk.studenterapp.mobile',
    files: ['google-services.json', 'google-services.prod.json'],
  },
  {
    label: 'development/dev-client',
    packageName: 'dk.studenterapp.mobile.dev',
    files: ['google-services.dev.json', 'google-services.json'],
  },
];

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(mobileRoot, filePath)} kunne ikke laeses som JSON: ${error.message}`);
  }
};

const packageNamesFromGoogleServices = (googleServices) => {
  const clients = Array.isArray(googleServices.client) ? googleServices.client : [];

  return clients
    .map((client) => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
};

const fail = (message) => {
  console.error(`Push config mangler: ${message}`);
  process.exitCode = 1;
};

const findConfigForPackage = (packageName, fileNames) => {
  for (const fileName of fileNames) {
    const filePath = path.join(mobileRoot, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const googleServices = readJson(filePath);
    const packageNames = packageNamesFromGoogleServices(googleServices);

    if (packageNames.includes(packageName)) {
      return { fileName, googleServices, packageNames };
    }
  }

  return null;
};

for (const expectedConfig of expectedConfigs) {
  const match = findConfigForPackage(expectedConfig.packageName, expectedConfig.files);

  if (!match) {
    fail(`${expectedConfig.label} mangler Firebase config for ${expectedConfig.packageName}.`);
    console.log(`Forventet en af disse filer: ${expectedConfig.files.join(', ')}`);
    continue;
  }

  console.log(`OK: ${expectedConfig.label} bruger ${match.fileName} for ${expectedConfig.packageName}.`);

  if (match.googleServices.project_info?.project_number) {
    console.log(`Firebase project_number: ${match.googleServices.project_info.project_number}`);
  }

  if (match.googleServices.project_info?.project_id) {
    console.log(`Firebase project_id: ${match.googleServices.project_info.project_id}`);
  }
}
