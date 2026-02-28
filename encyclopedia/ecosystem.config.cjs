module.exports = {
  apps: [
    {
      name: 'lexicon',
      script: 'npx',
      args: 'vite --port 4173',
      cwd: __dirname,
    },
    {
      name: 'push-word',
      script: 'node',
      args: 'src/server/push-word.mjs',
      cwd: __dirname,
    },
  ],
}
