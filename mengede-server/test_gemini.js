import './config-import-polyfill.js';
import { interact } from './lib/gemini.js';

(async function run(){
  try {
    const res = await interact({ input: 'Direct live test: say hello' });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERROR:', err?.message || err);
    process.exit(2);
  }
})();
