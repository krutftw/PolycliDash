import { createApp } from './app.js';
import { appConfig } from './config.js';

const app = createApp();

app.listen(appConfig.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard running on http://localhost:${appConfig.port}`);
});

