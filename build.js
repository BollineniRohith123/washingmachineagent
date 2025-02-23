const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Clean up previous build
try {
  fs.rmSync('build', { recursive: true, force: true });
  fs.rmSync('node_modules/.cache', { recursive: true, force: true });
} catch (e) {
  console.log('Clean up error:', e);
}

// Set environment variables
process.env.REACT_APP_GEMINI_API_KEY = 'AIzaSyBZ_eTrH5cVXR3UmwAFmIb_DAVhvLVClJk';
process.env.NODE_ENV = 'production';
process.env.CI = 'false';
process.env.GENERATE_SOURCEMAP = 'false';

try {
  execSync('node node_modules/react-scripts/scripts/build.js', {
    stdio: 'inherit',
    env: process.env
  });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
