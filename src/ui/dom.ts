/** Creates an element with a class and optional text. Text always goes through textContent. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Sets text only when it changed, so screen readers and layout aren't disturbed every frame. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** The element with `id`, which the page must have as a `type`: a missing part is a broken page. */
export function getElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}`);
  }
  return found;
}
