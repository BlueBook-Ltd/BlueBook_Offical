export type ArticleChannel = "news" | "culture";

export type Article = {
  slug: string;
  image?: string;
  tag: string;
  tags?: readonly string[];
  date?: string;
  publishDate?: string | null;
  title: string;
  summary?: string;
  /** Pin thumbnail aspect-ratio (CSS), drives masonry height. */
  ratio?: string;
  featured?: "main" | "secondary-top" | "secondary-bottom";
  /** Full case-study layout when true. */
  caseStudy?: boolean;
  readTime?: number;
  /** Which listings include this post. Default: both. */
  channels?: ArticleChannel[];
  /** Present when loaded from CMS markdown body. */
  content?: { node: unknown };
  source?: "cms" | "static";
};

export const articles: Article[] = [
  {
    slug: "dismantling-the-monolith",
    image: "/assets/figma/insights/hero.png",
    tag: "Architecture",
    date: "Oct 24, 2023",
    title: "Dismantling the Monolith: A Phased Approach",
    summary:
      "Moving away from legacy monolithic systems isn't just about microservices. It's about decoupling organizational structure…",
    ratio: "4 / 5",
    featured: "main",
    caseStudy: true,
    readTime: 10,
    channels: ["news", "culture"],
  },
  {
    slug: "agility-is-a-myth-without-architecture",
    image: "/assets/figma/insights/thumb-1.png",
    tag: "Architecture",
    date: "Oct 18, 2023",
    title: "Agility is a Myth Without Architecture",
    summary:
      "True agility requires a foundation that anticipates change. Exploring the tension between rapid feature delivery and architectural integrity in high-growth B2B environments.",
    ratio: "1 / 1",
    featured: "secondary-top",
    readTime: 8,
    channels: ["news", "culture"],
  },
  {
    slug: "the-latency-tax",
    image: "/assets/figma/insights/thumb-2.png",
    tag: "Performance",
    date: "Oct 12, 2023",
    title: "The Latency Tax: Unseen Costs",
    summary:
      "Micro-delays compound into macro-failures. An in-depth analysis of how unoptimized data pipelines erode user trust and systemic reliability in enterprise applications.",
    ratio: "3 / 4",
    readTime: 12,
    channels: ["news", "culture"],
  },
  {
    slug: "architectures-of-change",
    image: "/assets/figma/insights/thumb-3.png",
    tag: "Strategy",
    date: "Sep 28, 2023",
    title: "Architectures of Change",
    summary:
      "Designing systems for scenarios that don't exist yet. How forward-thinking CTOs are leveraging domain-driven design to future-proof their core infrastructure.",
    ratio: "3 / 4",
    readTime: 6,
    channels: ["news", "culture"],
  },
  {
    slug: "introducing-kinetic-integration-models",
    image: "/assets/bluebook/news/article-02.png",
    tag: "Release",
    date: "Oct 08, 2023",
    title: "Introducing Kinetic Integration Models",
    summary: "A practical model for connecting AI, automation, and existing business systems.",
    ratio: "3 / 4",
    featured: "secondary-bottom",
    readTime: 5,
    channels: ["news", "culture"],
  },
  {
    slug: "silicon-sovereignty",
    image: "/assets/bluebook/news/article-05.png",
    tag: "Hardware",
    date: "Oct 28, 2023",
    title: "Silicon Sovereignty in the Age of AI",
    summary: "What compute strategy means for teams adopting AI into daily operations.",
    ratio: "4 / 5",
    readTime: 7,
    channels: ["news", "culture"],
  },
  {
    slug: "brutalist-interfaces",
    image: "/assets/bluebook/news/article-06.png",
    tag: "Design",
    date: "Oct 22, 2023",
    title: "Brutalist Interfaces: Function Over Form",
    summary: "Designing operational tools that prioritize clarity over decorative complexity.",
    ratio: "1 / 1",
    readTime: 6,
    channels: ["culture", "news"],
  },
  {
    slug: "quarterly-security-audit-q3",
    image: "/assets/bluebook/news/article-04.png",
    tag: "Brief",
    date: "Oct 15, 2023",
    title: "Quarterly Security Audit: Q3 Findings",
    summary: "Key findings from recent operational security reviews across client systems.",
    ratio: "5 / 4",
    readTime: 4,
    channels: ["news"],
  },
  {
    slug: "death-of-the-open-plan-office",
    image: "/assets/bluebook/news/article-07.png",
    tag: "Culture",
    date: "Oct 21, 2023",
    title: "The Death of the Open Plan Office",
    summary: "How workplace design affects coordination, focus, and digital workflow adoption.",
    ratio: "2 / 3",
    readTime: 9,
    channels: ["culture"],
  },
  {
    slug: "automating-the-inevitable-failure",
    image: "/assets/bluebook/news/article-08.png",
    tag: "Report",
    date: "Oct 19, 2023",
    title: "Automating the Inevitable Failure",
    summary: "Why automating a broken process only accelerates the same failure mode.",
    ratio: "4 / 3",
    readTime: 8,
    channels: ["news", "culture"],
  },
  {
    slug: "thermodynamics-of-the-modern-web",
    image: "/assets/bluebook/news/article-09.png",
    tag: "Energy",
    date: "Oct 12, 2023",
    title: "Thermodynamics of the Modern Web",
    summary: "Energy cost, latency, and the operational trade-offs behind always-on systems.",
    ratio: "3 / 4",
    readTime: 7,
    channels: ["news", "culture"],
  },
  {
    slug: "why-we-still-use-mainframes",
    image: "/assets/bluebook/news/article-01.png",
    tag: "Opinion",
    date: "Oct 05, 2023",
    title: "Why We Still Use Mainframes",
    summary: "Legacy platforms persist when reliability, throughput, and risk outweigh novelty.",
    ratio: "1 / 1",
    readTime: 6,
    channels: ["culture", "news"],
  },
  {
    slug: "the-edge-is-the-new-center",
    image: "/assets/bluebook/news/article-10.png",
    tag: "Network",
    date: "Oct 10, 2023",
    title: "The Edge is the New Center",
    summary: "Distributed operations push decision-making closer to where work actually happens.",
    ratio: "5 / 6",
    readTime: 5,
    channels: ["news", "culture"],
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function articlesFor(channel: ArticleChannel) {
  return articles.filter((a) => !a.channels || a.channels.includes(channel));
}

export type ArticleCard = Pick<Article, "slug" | "image" | "tag" | "date" | "title" | "summary" | "readTime">;

export function toCard(article: Article): ArticleCard {
  return {
    slug: article.slug,
    image: article.image,
    tag: article.tag,
    date: article.date,
    title: article.title,
    summary: article.summary,
    readTime: article.readTime,
  };
}
