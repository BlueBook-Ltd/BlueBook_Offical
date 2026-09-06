globalThis.process ??= {};
globalThis.process.env ??= {};
import { c as createComponent } from "./astro-component_DoT_9Waa.mjs";
import { o as renderComponent, s as renderTemplate, n as maybeRenderHead } from "./worker-entry_D20GyTZB.mjs";
import { $ as $$BaseLayout } from "./BaseLayout_IZlRkEaD.mjs";
const $$404 = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Page Not Found | Bluebook", "lang": "en", "data-astro-cid-zetdm5md": true }, { "default": ($$result2) => renderTemplate`  ${maybeRenderHead()}<div class="err-wrap" data-astro-cid-zetdm5md> <div class="err-code" data-astro-cid-zetdm5md>404</div> <h1 data-astro-cid-zetdm5md>Page not found</h1> <p data-astro-cid-zetdm5md>Sorry, the page you are looking for does not exist. It may have been moved, renamed, or the URL may be incorrect.</p> <a href="/" class="btn-home" data-astro-cid-zetdm5md>Back to Homepage</a> </div> ` })}`;
}, "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/pages/404.astro", void 0);
const $$file = "C:/Users/dicky/AppData/Local/hermes/Bluebook Website/bluebook-official/src/pages/404.astro";
const $$url = "/404";
const _page = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: "Module" }));
const page = () => _page;
export {
  page
};
