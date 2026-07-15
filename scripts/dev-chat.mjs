import { serveBundledExample } from './dev-example.mjs';

await serveBundledExample({
  exampleName: 'chat',
  label: 'Swarm Kit live chat demo',
  defaultPort: 4177,
  portEnv: 'SWARM_KIT_CHAT_PORT',
});
