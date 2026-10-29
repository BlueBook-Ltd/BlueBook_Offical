export type PlaceContent = {
  title: string;
  body: string;
  cta?: { to: string; label: string };
};

/** Placeholder copy for each place until the real content is provided. */
export const PLACE_CONTENT: Record<string, PlaceContent> = {
  services: {
    title: 'Services',
    body: 'Digital consultancy, WhatsApp agents, document extraction, and workflow automation. Clarify where to begin before you commit to a tool.',
  },
  practice: {
    title: 'Practice',
    body: 'Our team works as an extension of the operation: mapping the real workflow and owning the outcome with you.',
  },
  contact: {
    title: 'Start with one process.',
    body: 'We open with the bottleneck, not a package. The first conversation is about the work.',
    cta: { to: '/en/contact/', label: 'Start with one process' },
  },
};
