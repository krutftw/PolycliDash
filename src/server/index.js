import { createApp } from './app.js';
import { appConfig } from './config.js';

const app = createApp();

const server = app.listen(appConfig.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard running on http://localhost:${appConfig.port}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal} — shutting down gracefully…`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('Server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('Force-exiting after timeout.');
    process.exit(1);
  }, 8_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

