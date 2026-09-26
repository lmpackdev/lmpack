// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  integrations: [
    starlight({
      title: 'lmpack',
      description:
        'Pack a codebase into one file for a language model, within a token budget, with a report of what was left out.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/lmpackdev/lmpack' }],
      editLink: { baseUrl: 'https://github.com/lmpackdev/lmpack/edit/main/docs/' },
      lastUpdated: false,
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', slug: 'index' },
            { slug: 'installation' },
            { slug: 'quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/budget' },
            { slug: 'guides/profiles' },
            { slug: 'guides/security-filter' },
            { slug: 'guides/recipes' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/cli' },
            { slug: 'reference/configuration' },
            { slug: 'reference/tokenizers' },
          ],
        },
        {
          label: 'Project',
          items: [{ slug: 'faq' }, { slug: 'changelog' }],
        },
      ],
    }),
  ],
  vite: {
    // changelog.mdx imports ../CHANGELOG.md from the repository root.
    server: { fs: { allow: ['..'] } },
  },
});
