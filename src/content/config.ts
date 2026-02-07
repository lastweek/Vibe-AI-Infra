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
    }))
  })
});

export const collections = { projects };
