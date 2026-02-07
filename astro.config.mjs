import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  base: '/Vibe-AI-Infra/',
  integrations: [react()],
  output: 'static',
});
