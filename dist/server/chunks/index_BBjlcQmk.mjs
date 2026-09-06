globalThis.process ??= {};
globalThis.process.env ??= {};
import { c as createComponent } from "./astro-component_DoT_9Waa.mjs";
import { p as renderHead, s as renderTemplate } from "./worker-entry_D20GyTZB.mjs";
import { r as renderScript } from "./script_82iTnPv2.mjs";
const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/en/">${renderScript($$result, "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/pages/index.astro?astro&type=script&index=0&lang.ts")}<title>Bluebook</title>${renderHead()}</head> <body> <p>Redirecting to <a href="/en/">Bluebook</a>...</p> </body></html>`;
}, "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/pages/index.astro", void 0);
const $$file = "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/pages/index.astro";
const $$url = "";
const _page = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: "Module" }));
const page = () => _page;
export {
  page
};
