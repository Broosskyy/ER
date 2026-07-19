import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as Record<string, unknown>;
}

function main(): void {
  const appConfigSource = readFileSync(path.join(root, 'app.config.ts'), 'utf8');
  const eas = readJson('eas.json');
  const pkg = readJson('package.json') as { scripts?: Record<string, string> };

  const requiredConfigSnippets = [
    "bundleIdentifier: 'com.eternalrave.app'",
    "buildNumber:",
    "scheme: 'eternal-rave'",
    "userInterfaceStyle: 'dark'",
    "expo-splash-screen",
    "expo-build-properties",
    "deploymentTarget: '15.1'",
    "LSApplicationQueriesSchemes",
    'ITSAppUsesNonExemptEncryption: false',
  ];

  for (const snippet of requiredConfigSnippets) {
    if (!appConfigSource.includes(snippet)) {
      throw new Error(`app.config.ts missing iOS requirement: ${snippet}`);
    }
  }

  const requiredAssets = [
    'assets/images/icon.png',
    'assets/images/splash-icon.png',
    'assets/images/favicon.png',
  ];

  for (const asset of requiredAssets) {
    if (!existsSync(path.join(root, asset))) {
      throw new Error(`Missing required asset: ${asset}`);
    }
  }

  const buildProfiles = (eas.build ?? {}) as Record<string, unknown>;
  for (const profile of ['development', 'preview', 'production']) {
    if (!(profile in buildProfiles)) {
      throw new Error(`eas.json missing build profile: ${profile}`);
    }
  }

  if (!pkg.scripts?.ios) {
    throw new Error('package.json missing ios script');
  }

  console.log('iOS release configuration validated.');
}

main();
