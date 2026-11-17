// Behaviour expectations checked in the browser on a frame's page state. A test passes when every
// expectation holds. Locating is by visible text only, so any implementation the design allows passes.

async function visibleBox(page, text, contains = false) {
  const element = page.getByText(text, { exact: !contains }).filter({ visible: true }).first();
  if (!(await element.count())) return null;
  return element.boundingBox();
}

const ROW_TOLERANCE = 24; // px between centres (sameRow) or left edges (stacked)

/** Returns null when `expectation` holds, else a short reason. */
async function check(page, expectation) {
  if (expectation.visibleText !== undefined) {
    return (await visibleBox(page, expectation.visibleText, expectation.contains)) ? null : `"${expectation.visibleText}" not visible`;
  }
  if (expectation.hiddenText !== undefined) {
    return (await visibleBox(page, expectation.hiddenText, expectation.contains)) ? `"${expectation.hiddenText}" still visible` : null;
  }
  if (expectation.noHorizontalOverflow) {
    const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    return scroll <= inner + 1 ? null : `page is ${scroll}px wide at a ${inner}px viewport`;
  }
  const texts = expectation.sameRow ?? expectation.stacked;
  if (texts) {
    const boxes = [];
    for (const text of texts) {
      const box = await visibleBox(page, text);
      if (!box) return `"${text}" not visible`;
      boxes.push(box);
    }
    for (let index = 1; index < boxes.length; index += 1) {
      const [a, b] = [boxes[index - 1], boxes[index]];
      if (expectation.sameRow && (Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) > ROW_TOLERANCE || b.x <= a.x)) return `"${texts[index]}" is not in one row with "${texts[index - 1]}"`;
      if (expectation.stacked && (b.y < a.y + a.height || Math.abs(a.x - b.x) > ROW_TOLERANCE)) return `"${texts[index]}" is not stacked under "${texts[index - 1]}"`;
    }
    return null;
  }
  return `unknown expectation ${JSON.stringify(expectation)}`;
}

/** Runs a test's expectations on `page`; `{ pass, reason }`. */
export async function runBehaviour(page, test) {
  for (const expectation of test.expect) {
    const reason = await check(page, expectation);
    if (reason) return { pass: false, reason };
  }
  return { pass: true, reason: '' };
}
