const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ponytail: iOS-only app, but expo-sqlite's web backend imports a .wasm module.
// Register .wasm as an asset so Metro's web bundle resolves it instead of erroring.
config.resolver.assetExts.push('wasm');

module.exports = config;
