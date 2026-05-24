import { serveBundledExample } from './dev-example.mjs';

await serveBundledExample({
  exampleName: 'epoch-feed-smoke',
  label: 'Swarm Kit playground',
  defaultPort: 4173,
  portEnv: 'SWARM_KIT_SMOKE_PORT',
});
