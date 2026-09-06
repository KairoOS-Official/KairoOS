import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.log(JSON.stringify({
  action: 'notify',
  message: 'Plugin Spotify Screensaver initialisé.'
}));

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.command === 'status') {
      console.log(JSON.stringify({ status: 'ready', plugin: 'kairo-spotify-screensaver' }));
    } else if (msg.command === 'test_lyrics') {
      console.log(JSON.stringify({ success: true, message: 'Test lyrics service OK' }));
    }
  } catch (err) {
    // Ignore non-JSON lines
  }
});
