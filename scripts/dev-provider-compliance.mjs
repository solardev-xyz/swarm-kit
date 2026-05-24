import { serveBundledExample } from './dev-example.mjs';

await serveBundledExample({
  exampleName: 'provider-compliance',
  label: 'Swarm Kit provider compliance',
  defaultPort: 4175,
  portEnv: 'SWARM_KIT_PROVIDER_COMPLIANCE_PORT',
});
