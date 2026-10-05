#!/usr/bin/env node
/** Extract FigmaLanding.astro → FigmaLanding.tsx + figma-landing.css */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const astroPath = path.join(root, 'src/components/landing/FigmaLanding.astro');
const raw = fs.readFileSync(astroPath, 'utf8');

const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1].replace(/:global\(([^)]+)\)/g, '$1') : '';
fs.writeFileSync(path.join(root, 'src/styles/figma-landing.css'), css);

const templateMatch = raw.match(/---[\s\S]*?---\r?\n([\s\S]*?)<style>/);
let html = templateMatch ? templateMatch[1].trim() : '';
html = html
  .replace(/<SiteHeader currentPath=\{`\$\{prefix\}\/`\} \/>/g, '<SiteHeader currentPath={`${prefix}/`} />')
  .replace(/\bclass=/g, 'className=')
  .replace(/<SiteHeader/g, '<SiteHeader')
  .replace(/<SiteFooter \/>/g, '<SiteFooter />')
  .replace(/<br\s*\/>/g, '<br />')
  .replace(/&amp;/g, '&');

const tsx = `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getArticlesFor } from '@/utils/news';
import type { Article } from '@/data/articles';
import '@/styles/figma-landing.css';

const prefix = '/en';

const services = [
  ['01', 'DIGITAL CONSULTANCY', 'Clarify where to begin before you commit to a tool.', ['PROCESS REVIEW', 'TRANSFORMATION ROADMAP', 'SYSTEM REQUIREMENTS'], \`\${prefix}/contact/\`],
  ['02', 'WHATSAPP AI AGENT', 'Make conversations, voice notes, images, and files operationally useful.', ['CONVERSATION CAPTURE', 'SEARCHABLE RECORDS', 'TASK ROUTING'], \`\${prefix}/services/whatsapp-ai-agent/\`],
  ['03', 'AI OCR & DATA EXTRACTION', 'Turn documents into fields your team can check and export.', ['FIELD EXTRACTION', 'REVIEW WORKFLOW', 'CSV AND API OUTPUT'], \`\${prefix}/services/ai-ocr/\`],
  ['04', 'WORKFLOW AUTOMATION', 'Remove repetitive steps from approvals, notifications, and reporting.', ['AUTOMATION DESIGN', 'BUSINESS RULES', 'OPERATIONAL MONITORING'], \`\${prefix}/contact/\`],
] as const;

const advantages = [
  ['01', '01 / STRUCTURE', 'OUR TEAM IS YOURS', 'Our teams are not remote assistants you "rent by the hour." They work as an extension of your operation: mapping the real workflow, sitting with the friction, and owning the outcome with you.', '/assets/figma/edge-01.png'],
  ['02', '02 / PHILOSOPHY', 'BUSINESS MINDSET EVERYWHERE', 'At Bluebook, nobody is allowed to hide behind a narrow role. The engineer thinks about the process, not just the stack. The strategist thinks about decisions, records, and handoffs.', '/assets/figma/edge-02.png'],
  ['03', '03 / DELIVERY', 'THE SAME SERVICE STANDARDS', 'Service standards are the baseline every client can expect from us—whether the scope is one process or a broader programme. That means a clear map of the workflow and honest trade-offs.', '/assets/figma/edge-03.png'],
  ['04', '04 / INNOVATION', 'AI-ENHANCED DEVELOPMENT', 'We combine human judgment with AI where it genuinely speeds the work: structuring messy inputs, accelerating analysis, and tightening build-and-review loops.', '/assets/figma/edge-04.png'],
  ['05', '05 / COMMITMENT', 'COMMITTED FROM THE FIRST CALL', 'While others open with tools, packages, or headcount to sell, we open with the problem you are trying to remove. We listen for the real bottleneck from the first conversation.', '/assets/figma/edge-05.png'],
  ['06', '06 / PARTNERSHIP', 'WE BELIEVE IN PARTNERSHIPS', 'Most useful systems are not finished on launch day—they mature as your team, volume, and constraints change. We design for that reality: start with one process, then grow.', '/assets/figma/edge-06.png'],
];

const reviewRowA = [
  ['Chris L.', 'Operations director, logistics', 'We stopped chasing status in three WhatsApp groups. If a request stalls, you can see exactly who is holding it—and the team spends the morning closing work instead of hunting for updates.'],
  ['Mei W.', 'Programme lead, retail', 'They mapped the handoffs before touching any tools. That alone cut two weeks of back-and-forth, and everyone finally agreed on where the process actually breaks.'],
  ['Daniel K.', 'Commercial manager, B2B services', 'Less re-typing from chat into Excel. Our people actually have time to follow up with customers again, and fewer quotes go cold because a detail was missed.'],
  ['Aisha R.', 'Operations lead, field services', 'Photos and voice notes now land with the job. The next person does not have to ask the same questions twice, which makes a real difference on busy site days.'],
  ['Tom H.', 'Finance lead, professional services', 'I only review the exceptions now. The rest clears without me opening every file, so month-end feels like a check, not a scavenger hunt.'],
  ['Sarah P.', 'Delivery manager, agency', 'First release was small and usable. No six-month phase one that nobody can touch—our team could try it in week three and tell us what to fix next.'],
  ['Ken T.', 'Customer service lead, e-commerce', 'Night-shift handovers got quieter. Context is already on the ticket when the morning team logs in, so we spend less time reconstructing what the customer already said.'],
  ['Laura M.', 'Project sponsor, manufacturing', 'We knew what would ship in week three and what could wait. That made budget talks much calmer, because nobody was guessing what done looked like.'],
] as const;

const reviewRowB = [
  ['Nina C.', 'Admin lead, property', 'Contracts stopped living in someone Downloads folder. Everyone works from the same version, and we no longer email three PDFs asking which one is final.'],
  ['James O.', 'Client success, SaaS', 'When a teammate takes over an account, the conversation history is already attached. No detective work—and customers notice that we do not ask them to repeat themselves.'],
  ['Helen Y.', 'COO, mid-size trading firm', 'I can see volume, delays, and owners without waiting for Friday manual report. That weekly scramble used to burn half a day for two people.'],
  ['Ravi S.', 'Service desk lead, IT support', 'The queue is honest at 9am. We stopped building our own trackers on the side, and new joiners understand the backlog on day one.'],
  ['Olivia F.', 'Data owner, healthcare admin', 'Cleaner audit trail, and nobody had to fill in an extra form just for compliance. The record comes from the work itself, which is how it should have been.'],
  ['Marcus B.', 'Business lead, wholesale', 'Automation takes the repetitive steps. Approvals stay with people when judgement matters—so we gained speed without pretending every case is the same.'],
  ['Priya N.', 'Operations manager, logistics', 'From first message to final decision, one thread. That used to take a chase across email and chat, and exceptions often sat unnoticed until a customer chased us.'],
  ['Eric D.', 'Transformation lead, financial services', 'They were honest about what not to automate. We spent money on the bottleneck, not a shiny dashboard, and the first change stuck because the team could actually use it.'],
] as const;

const people = Array.from({ length: 12 }, (_, i) => \`/assets/people/\${String(i + 1).padStart(2, '0')}.png\`);

export default function FigmaLanding() {
  const [homeNews, setHomeNews] = useState<Article[]>([]);
  const [homeCulture, setHomeCulture] = useState<Article[]>([]);

  useEffect(() => {
    import('@/scripts/landingMotion');
    Promise.all([getArticlesFor('news'), getArticlesFor('culture')]).then(([news, culture]) => {
      setHomeNews(news.filter((a) => a.image).slice(0, 3));
      setHomeCulture(culture.slice(0, 6));
    });
  }, []);

  return (
${html
  .replace(/<a className="([^"]*)" href=\{`\$\{prefix\}([^`]+)`\}/g, '<Link className="$1" to={`${prefix}$2`}')
  .replace(/<a className="([^"]*)" href=\{href\}/g, '<Link className="$1" to={href}')
  .replace(/<a className="([^"]*)" href=\{`\$\{prefix\}\/news\/\$\{article\.slug\}\/`\}/g, '<Link className="$1" to={`${prefix}/news/${article.slug}/`}')
  .replace(/<a href=\{`\$\{prefix\}\/news\/\$\{article\.slug\}\/`\}/g, '<Link to={`${prefix}/news/${article.slug}/`}')
  .replace(/<a href=\{`\$\{prefix\}\/culture\/\$\{article\.slug\}\/`\}/g, '<Link to={`${prefix}/culture/${article.slug}/`}')
  .replace(/<a className="services__row" href=\{href\}/g, '<Link className="services__row" to={href}')
  .replace(/<\/a>/g, '</Link>') // over-replaces - need careful approach
  .split('\n').map((l) => '    ' + l).join('\n')}
  );
}
`;

// Fix: the naive </a> → </Link> breaks things. Write template manually instead.
console.log('CSS extracted. Use manual FigmaLanding.tsx');
console.log('CSS bytes:', css.length);
