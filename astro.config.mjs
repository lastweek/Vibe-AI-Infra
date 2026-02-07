import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  base: '/',
  integrations: [react()],
  output: 'static',
});
