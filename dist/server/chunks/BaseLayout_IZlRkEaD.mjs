globalThis.process ??= {};
globalThis.process.env ??= {};
import { c as createComponent } from "./astro-component_DoT_9Waa.mjs";
import { i as addAttribute, s as renderTemplate, p as renderHead, q as renderSlot } from "./worker-entry_D20GyTZB.mjs";
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description, lang = "zh-Hant" } = Astro2.props;
  return renderTemplate`<html${addAttribute(lang, "lang")}> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${description && renderTemplate`<meta name="description"${addAttribute(description, "content")}>`}<title>${title}</title>${renderHead()}</head> <body> ${renderSlot($$result, $$slots["default"])} </body></html>`;
}, "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/layouts/BaseLayout.astro", void 0);
export {
  $$BaseLayout as $
};
