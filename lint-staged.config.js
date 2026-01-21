const path = require('path');

module.exports = {
  // 1. Type Check: Run tsc on the whole project (files ignored intentionally)
  '**/*.{ts,tsx}': () => 'npx tsc --noEmit',

  // 2. Linting: Use 'eslint' directly instead of 'next lint'
  '**/*.{js,jsx,ts,tsx}': (filenames) => {
    const files = filenames
      .map((file) => `"${file}"`)
      .join(' ');

    return `npx eslint --fix ${files}`;
  },
};