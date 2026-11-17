// Turns a rendered page into a Figma-like layer tree (what a designer's file for the screen would hold):
// FRAME / TEXT / VECTOR / INSTANCE nodes with designer-style names, boxes, auto-layout, fills, strokes,
// radii and text styles, read from computed styles and bounding boxes. Nothing from the source leaks:
// no class names, test ids, ARIA attributes or component names; only geometry, colour, type and text.

/**
 * Runs in the page (`page.evaluate(collectTree, { idPrefix })`). Returns `{ tree, colours }` where
 * `colours` maps every colour used to the custom properties on :root that resolve to it.
 */
export function collectTree({ idPrefix }) {
  let counter = 0;
  const nextId = () => `${idPrefix}:${(counter += 1)}`;
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  // Any CSS colour (rgb, oklch, color-mix) to #rrggbb plus alpha, through a 1 x 1 canvas.
  const toHex = (css) => {
    if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)' || !CSS.supports('color', css)) return null;
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = '#000';
    canvas.fillStyle = css;
    canvas.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
    if (a === 0) return null;
    const hex = `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    return { hex, opacity: Math.round((a / 255) * 100) / 100 };
  };
  const px = (value) => Math.round(Number.parseFloat(value) || 0);
  const round = (value) => Math.round(value);
  const box = (rect) => ({ x: round(rect.x + window.scrollX), y: round(rect.y + window.scrollY), width: round(rect.width), height: round(rect.height) });
  // Visually hidden text (1 px clipped boxes for screen readers) is not part of a design either.
  const visible = (element, style) => {
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && element.getClientRects().length > 0 && (rect.width > 1 || rect.height > 1);
  };
  const weightName = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
  const textStyle = (style) => ({
    fontFamily: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    fontWeight: Number(style.fontWeight),
    fontStyle: weightName[Number(style.fontWeight)] ?? 'Regular',
    fontSize: px(style.fontSize),
    lineHeightPx: style.lineHeight === 'normal' ? Math.round(px(style.fontSize) * 1.2) : px(style.lineHeight),
    letterSpacing: Math.round((Number.parseFloat(style.letterSpacing) || 0) * 100) / 100,
    textAlignHorizontal: { left: 'LEFT', start: 'LEFT', right: 'RIGHT', end: 'RIGHT', center: 'CENTER', justify: 'JUSTIFIED' }[style.textAlign] ?? 'LEFT',
    fills: [toHex(style.color)].filter(Boolean).map((colour) => ({ type: 'SOLID', color: colour.hex, opacity: colour.opacity }))
  });
  const iconName = (element) => [...element.classList].find((name) => /^pi-[a-z]/.test(name))?.slice(3) ?? 'glyph';

  function shapeProps(style) {
    const props = {};
    const fill = toHex(style.backgroundColor);
    if (fill) props.fills = [{ type: 'SOLID', color: fill.hex, opacity: fill.opacity }];
    const borderWidth = px(style.borderTopWidth) || px(style.borderBottomWidth) || px(style.borderLeftWidth);
    const stroke = borderWidth ? toHex(style.borderTopWidth !== '0px' ? style.borderTopColor : style.borderBottomColor) : null;
    if (stroke) {
      props.strokes = [{ type: 'SOLID', color: stroke.hex, opacity: stroke.opacity }];
      props.strokeWeight = borderWidth;
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((side) => px(style[`border${side}Width`]) > 0);
      if (sides.length < 4) props.strokeSides = sides.map((side) => side.toUpperCase());
    }
    const radius = px(style.borderTopLeftRadius);
    if (radius) props.cornerRadius = radius;
    if (style.boxShadow && style.boxShadow !== 'none') props.effects = [{ type: 'DROP_SHADOW', css: style.boxShadow.replace(/oklab\([^)]*\)|oklch\([^)]*\)|rgba?\([^)]*\)/g, (colour) => toHex(colour)?.hex ?? colour) }];
    const padding = ['Top', 'Right', 'Bottom', 'Left'].map((side) => px(style[`padding${side}`]));
    if (padding.some(Boolean)) [props.paddingTop, props.paddingRight, props.paddingBottom, props.paddingLeft] = padding;
    if (style.display.includes('flex')) {
      props.layoutMode = style.flexDirection.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL';
      const gap = px(props.layoutMode === 'VERTICAL' ? style.rowGap : style.columnGap);
      if (gap) props.itemSpacing = gap;
      if (style.flexWrap === 'wrap') props.layoutWrap = 'WRAP';
      const align = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', 'space-between': 'SPACE_BETWEEN', baseline: 'BASELINE' };
      props.primaryAxisAlignItems = align[style.justifyContent] ?? 'MIN';
      props.counterAxisAlignItems = align[style.alignItems] ?? 'MIN';
    } else if (style.display.includes('grid')) {
      props.layoutMode = 'GRID';
      props.gridColumnCount = style.gridTemplateColumns.split(' ').filter(Boolean).length;
      const gap = px(style.columnGap);
      if (gap) props.itemSpacing = gap;
      const rowGap = px(style.rowGap);
      if (rowGap) props.counterAxisSpacing = rowGap;
    }
    return props;
  }

  function frameName(element, style, props, rect) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    if (tag === 'header' && element.closest('main') === null) return 'Top bar';
    if (tag === 'nav') return 'Navigation';
    if (tag === 'main') return 'Content';
    if (tag === 'header') return 'Header';
    if (tag === 'table') return 'Table';
    if (tag === 'thead') return 'Table/Head';
    if (tag === 'tbody') return 'Table/Body';
    if (tag === 'tr') return 'Table/Row';
    if (tag === 'th') return 'Table/Header cell';
    if (tag === 'td') return 'Table/Cell';
    if (role === 'combobox' || element.querySelector(':scope > [role="combobox"]')) return 'Dropdown';
    if (role === 'menu') return 'Menu';
    if (role === 'menuitem' || (tag === 'li' && element.closest('[role="menu"]'))) return 'Menu/Item';
    if (tag === 'button' || tag === 'a' && props.fills) return tag === 'a' ? 'Nav item' : 'Button';
    if (tag === 'a') return 'Nav item';
    if (tag === 'li') return 'List item';
    if (tag === 'ol' || tag === 'ul') return 'List';
    if (props.cornerRadius && props.cornerRadius >= rect.height / 2 - 1 && Math.abs(rect.width - rect.height) <= 2 && rect.width <= 48) return element.textContent.trim() ? 'Avatar' : 'Icon container';
    if (props.fills && props.cornerRadius && rect.height <= 32 && element.textContent.trim()) return 'Badge';
    if (props.strokes && props.cornerRadius && props.fills) {
      const heading = element.querySelector('h1, h2, h3, h4');
      return heading ? `Card/${heading.textContent.trim()}` : 'Card';
    }
    if (props.layoutMode === 'GRID') return 'Grid';
    if (props.layoutMode === 'HORIZONTAL') return 'Row';
    if (props.layoutMode === 'VERTICAL') return 'Stack';
    return 'Frame';
  }

  function walk(element) {
    const style = getComputedStyle(element);
    if (!visible(element, style)) return null;
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    if (tag === 'svg') {
      const big = rect.width > 120;
      const node = { id: nextId(), name: big ? 'Chart' : rect.width > 48 ? 'Trend line' : 'Icon', type: 'VECTOR', ...box(rect) };
      // A vector keeps its stroke colours, which the design context exposes as an asset.
      const strokes = [...element.querySelectorAll('path, line, circle, rect')].map((shape) => toHex(getComputedStyle(shape).stroke)).filter(Boolean);
      if (strokes.length) node.strokes = [{ type: 'SOLID', color: strokes[strokes.length - 1].hex, opacity: 1 }];
      if (big) {
        node.children = [...element.querySelectorAll('text')].map((text) => ({ id: nextId(), name: text.textContent.trim(), type: 'TEXT', characters: text.textContent.trim(), ...box(text.getBoundingClientRect()), style: textStyle(getComputedStyle(text)) }));
      }
      return node;
    }
    if (tag === 'i' && [...element.classList].some((name) => /^pi-[a-z]/.test(name))) {
      return { id: nextId(), name: `icon/${iconName(element)}`, type: 'INSTANCE', componentName: `icon/${iconName(element)}`, ...box(rect), fills: [toHex(style.color)].filter(Boolean).map((colour) => ({ type: 'SOLID', color: colour.hex, opacity: colour.opacity })) };
    }
    if (['script', 'style', 'input', 'template'].includes(tag)) return null;
    const props = shapeProps(style);
    const children = [];
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        const textRect = range.getBoundingClientRect();
        if (!textRect.width) continue;
        children.push({ id: nextId(), name: text.slice(0, 40), type: 'TEXT', characters: text, ...box(textRect), style: textStyle(style) });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const node = walk(child);
        if (node) children.push(node);
      }
    }
    // Wrappers without any look of their own collapse into their only child, as in a tidy design file.
    const plain = !props.fills && !props.strokes && !props.cornerRadius && !props.paddingTop && !props.paddingLeft && !props.layoutMode;
    if (plain && children.length === 1) return children[0];
    if (plain && children.length === 0) return null;
    return { id: nextId(), name: frameName(element, style, props, rect), type: 'FRAME', ...box(rect), ...props, children };
  }

  const root = document.querySelector('#app');
  const page = walk(root.firstElementChild ?? root) ?? { children: [] };
  const background = toHex(getComputedStyle(document.body).backgroundColor);
  const tree = {
    id: `${idPrefix}:0`,
    type: 'FRAME',
    name: 'Screen',
    x: 0,
    y: 0,
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    fills: background ? [{ type: 'SOLID', color: background.hex, opacity: 1 }] : [],
    children: page.type === 'FRAME' && page.name === 'Frame' ? page.children : [page]
  };
  // Overlays (menus, dropdown panels) render outside #app; they belong in the frame too.
  for (const overlay of document.body.children) {
    if (overlay === root || overlay.tagName === 'SCRIPT' || overlay.tagName === 'STYLE') continue;
    const node = walk(overlay);
    if (node) tree.children.push(node);
  }

  const colours = {};
  const rootStyle = getComputedStyle(document.documentElement);
  for (let index = 0; index < rootStyle.length; index += 1) {
    const name = rootStyle[index];
    if (!name.startsWith('--')) continue;
    const colour = toHex(rootStyle.getPropertyValue(name).trim());
    if (colour && colour.opacity === 1 && /color|primary|surface/.test(name)) (colours[colour.hex] ??= []).push(name);
  }
  return { tree, colours };
}
