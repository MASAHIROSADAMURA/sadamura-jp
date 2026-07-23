import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const authorSchema = z.object({
  name: z.string(),
  isSelf: z.boolean()
});

const papers = defineCollection({
  loader: file('src/data/papers.json'),
  schema: z.object({
    id: z.string(),
    key: z.string(),
    type: z.string(),
    pubtype: z.enum(['article', 'conference', 'other', 'book']),
    language: z.enum(['ja', 'en']),
    title: z.string(),
    titleEn: z.string().nullable(),
    authors: z.array(authorSchema),
    editor: z.string().nullable(),
    role: z.string().nullable(),
    year: z.number().int(),
    yearText: z.string().nullable(),
    month: z.string().nullable(),
    monthNum: z.number().int().nullable(),
    day: z.string().nullable(),
    venue: z.string(),
    venueEn: z.string().nullable(),
    volume: z.string().nullable(),
    number: z.string().nullable(),
    pages: z.string().nullable(),
    doi: z.string().nullable(),
    url: z.string().nullable(),
    note: z.string().nullable(),
    publisher: z.string().nullable(),
    topics: z.array(z.string()),
    firstAuthor: z.boolean(),
    soloAuthor: z.boolean()
  })
});

export const collections = { papers };
