// Responsiveness between and beyond the design's frames: the screen rendered at widths no frame shows,
// checked for what breaks a layout that only reproduces its frames (fixed widths, absolute positions).
// Nothing here compares pixels with the design: any layout that adapts passes. See ../README.md "Metric".
import { locate } from './capture.mjs';

/** Widths no design frame shows: a large phone, a tablet, a small and a common laptop, a wide desktop. */
export const RESPONSIVE_WIDTHS = [600, 768, 1024, 1280, 1920];
export const RESPONSIVE_HEIGHT = 900;

/**
 * In-page: elements that stick out of the viewport sideways (outermost only), unless an ancestor scrolls
 * or clips horizontally (a table that scrolls inside its card is fine), and the page's own width.
 */
function overflowProblems() {
  const width = window.innerWidth;
  const clipped = (element) => {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return true;
    }
    return false;
  };
  const outside = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.right > width + 1 || rect.left < -1);
  };
  const sticking = [];
  for (const element of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') continue;
    if (!outside(element) || clipped(element)) continue;
    if (element.parentElement && element.parentElement !== document.body && outside(element.parentElement)) continue;
    const label = (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const rect = element.getBoundingClientRect();
    sticking.push(`${label || element.tagName.toLowerCase()} (${Math.round(rect.left)}..${Math.round(rect.right)} px)`);
  }
  return { pageWidth: document.documentElement.scrollWidth, width, sticking };
}

/** Area of the overlap of two boxes over the smaller box's area (0..1). */
const overlapShare = (a, b) => {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? (x * y) / smaller : 0;
};
const encloses = (a, b) => a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.width >= b.x + b.width - 1 && a.y + a.height >= b.y + b.height - 1;

/**
 * Problems at one width, as `{ kind, detail }`: the page scrolls sideways, elements stick out of the
 * viewport, key elements (`specs`: those every frame size shows) are missing, or key elements overlap.
 */
export async function responsiveProblems(page, specs) {
  const problems = [];
  const overflow = await page.evaluate(overflowProblems);
  if (overflow.pageWidth > overflow.width + 1) problems.push({ kind: 'page overflow', detail: `page is ${overflow.pageWidth}px wide` });
  for (const item of overflow.sticking.slice(0, 5)) problems.push({ kind: 'sticks out', detail: item });
  const boxes = [];
  for (const spec of specs) {
    const element = locate(page, spec);
    const box = (await element.count()) ? await element.boundingBox() : null;
    if (!box || box.width < 1 || box.height < 1) problems.push({ kind: 'missing', detail: spec.id });
    else boxes.push({ id: spec.id, box });
  }
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const [a, b] = [boxes[i].box, boxes[j].box];
      if (encloses(a, b) || encloses(b, a)) continue;
      if (overlapShare(a, b) > 0.3) problems.push({ kind: 'overlap', detail: `${boxes[i].id} and ${boxes[j].id}` });
    }
  }
  return problems;
}

/**
 * Score at one width: 0 when the layout breaks there (the page scrolls sideways, an element sticks out,
 * key elements overlap), else the share of key elements found, so an empty route scores 0 as well.
 */
export function scoreWidth(problems, keyCount) {
  if (problems.some((problem) => problem.kind !== 'missing')) return 0;
  if (!keyCount) return 1;
  return 1 - problems.filter((problem) => problem.kind === 'missing').length / keyCount;
}

/** Key elements every frame size shows: the desktop layout specs whose id the mobile layout has too. */
export function sharedSpecs(screen) {
  const mobile = new Set((screen.layout.mobile ?? []).map((spec) => spec.id));
  return (screen.layout.desktop ?? []).filter((spec) => mobile.has(spec.id));
}
