import { serveBundledExample } from './dev-example.mjs';

await serveBundledExample({
  exampleName: 'test-center',
  label: 'Swarm Kit provider test center',
  defaultPort: 4176,
  portEnv: 'SWARM_KIT_TEST_CENTER_PORT',
});
