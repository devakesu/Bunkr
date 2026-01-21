module.exports = {
  // 1. Type Check: Runs on the whole project
  '**/*.{ts,tsx}': () => 'npx tsc --noEmit',

  // 2. Linting: Runs on the WHOLE project (ignoring specific staged files)
  '**/*.{js,jsx,ts,tsx}': () => {
    return 'npx eslint . --fix';
  },
};