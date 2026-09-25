interface MotionSnapshot {
  readonly key: string | undefined;
  readonly tiles: ReadonlyMap<string, DOMRect>;
  readonly visible: ReadonlySet<string>;
}

const reveals = ["exercise-feedback", "exercise-hint", "exercise-model"];

export function observeSkynjaMotionPreference(root: HTMLElement): void {
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
    if (event.matches) root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
  });
}

export function captureSkynjaMotion(root: HTMLElement): MotionSnapshot {
  return {
    key: root.querySelector<HTMLElement>("[data-view-key]")?.dataset.viewKey,
    tiles: new Map([...root.querySelectorAll<HTMLButtonElement>("button[data-tile-id]:not(:disabled)")].map((tile) => [tile.dataset.tileId!, tile.getBoundingClientRect()])),
    visible: new Set(reveals.filter((id) => root.querySelector(`#${id}`) !== null)),
  };
}

/** Motion only describes an existing change; it never advances or delays an exercise. */
export function animateSkynjaChanges(root: HTMLElement, previous: MotionSnapshot): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || typeof Element.prototype.animate !== "function") return;
  const key = root.querySelector<HTMLElement>("[data-view-key]")?.dataset.viewKey;
  if (key !== undefined && key !== previous.key) {
    const elements = [...root.querySelectorAll<HTMLElement>("main h1, .home-workspaces > section, .exercise-card, .exercise-state, .exercise-purpose")];
    elements.forEach((element, index) => element.animate([{ opacity: .25, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, delay: Math.min(index, 6) * 25, easing: "cubic-bezier(.2,.7,.2,1)" }));
    return;
  }
  for (const tile of root.querySelectorAll<HTMLButtonElement>("button[data-tile-id]:not(:disabled)")) {
    const before = previous.tiles.get(tile.dataset.tileId!);
    if (before === undefined) continue;
    const after = tile.getBoundingClientRect();
    const x = before.x - after.x; const y = before.y - after.y;
    if ((Math.abs(x) + Math.abs(y) < 2) || Math.abs(y) > innerHeight) continue;
    tile.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }], { duration: 200, easing: "cubic-bezier(.2,.7,.2,1)" });
  }
  for (const id of reveals) {
    if (!previous.visible.has(id)) root.querySelector<HTMLElement>(`#${id}`)?.animate([{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: "ease-out" });
  }
}
