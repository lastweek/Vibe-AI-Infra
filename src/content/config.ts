import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'data',
  schema: z.object({
    category: z.string(),
    projects: z.array(z.object({
      name: z.string(),
      repo: z.string().optional(),
      description: z.string(),
      goals: z.array(z.string()).optional(),
      status: z.enum(['TBD', 'WIP', 'Done']),
      intro: z.string().optional(),
      architecture: z.string().optional(),
    }))
  })
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    summary: z.string().optional(),
    draft: z.boolean().default(false),
    showInNav: z.boolean().default(false),
    navLabel: z.string().optional(),
    navOrder: z.number().default(100),
    updated: z.coerce.date().optional(),
  }),
});

const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    draft: z.boolean().default(false),
    status: z.enum(['planned', 'active', 'published']).default('published'),
    publishDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const til = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { projects, pages, insights, til };
