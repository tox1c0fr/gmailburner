const { spawn } = require('child_process');

function copyToClipboard(text) {
  return new Promise((resolve) => {
    try {
      const proc = spawn('clip');
      proc.stdin.write(text);
      proc.stdin.end();
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      proc.on('error', () => {
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

module.exports = { copyToClipboard };
