import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repository ? `/${repository}/` : '/';

export default defineConfig({
  base,
});
