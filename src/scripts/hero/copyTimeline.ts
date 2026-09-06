export type CopyStage = {
  id: string;
  label: string;
  titleHtml: string;
  bodyHtml: string;
};

export const COPY_STAGES: CopyStage[] = [
  {
    id: "guide",
    label: "01 — Bluebook",
    titleHtml: `A GUIDE TO<br /><span class="outline">DIGITAL</span><br />WORLD`,
    bodyHtml: `We turn complex work into clear, connected systems — helping teams <strong>imagine the future</strong>, today.`,
  },
];

export function showCopyStage(stages: HTMLElement[]) {
  stages.forEach((stage, index) => {
    const active = index === 0;
    stage.style.opacity = active ? "1" : "0";
    stage.style.transform = active ? "translateY(0)" : "translateY(18px)";
    stage.setAttribute("aria-hidden", active ? "false" : "true");
  });
}
