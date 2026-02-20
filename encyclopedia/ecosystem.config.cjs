module.exports = {
  apps: [
    {
      name: 'lexicon',
      script: 'npx',
      args: 'vite --port 4173',
      cwd: __dirname,
    },
  ],
}
