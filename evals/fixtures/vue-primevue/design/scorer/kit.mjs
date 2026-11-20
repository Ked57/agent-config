// The design kit the Figma files are built with, and the PrimeVue component that implements each kit
// component. Designers name kit components in their own words ("Dropdown", "Status chip"), so mapping a
// Figma instance to its PrimeVue component is part of the task. Shared by the frame export (instance
// names in the stub's layer trees) and the scorer (component inventory of a render).

/** PrimeVue root class → kit component name. A class matches only as a whole class token. */
export const KIT = {
  'p-button': 'Button',
  'p-splitbutton': 'Split button',
  'p-select': 'Dropdown',
  'p-multiselect': 'Multi-select dropdown',
  'p-autocomplete': 'Autocomplete',
  'p-inputtext': 'Text field',
  'p-textarea': 'Text area',
  'p-inputnumber': 'Number field',
  'p-password': 'Password field',
  'p-datepicker': 'Date picker',
  'p-iconfield': 'Field with icon',
  'p-toggleswitch': 'Toggle',
  'p-checkbox': 'Checkbox',
  'p-radiobutton': 'Radio',
  'p-selectbutton': 'Segmented control',
  'p-togglebutton': 'Toggle button',
  'p-tag': 'Status chip',
  'p-badge': 'Counter badge',
  'p-chip': 'Chip',
  'p-avatar': 'Avatar',
  'p-message': 'Alert',
  'p-datatable': 'Data table',
  'p-paginator': 'Pagination',
  'p-menu': 'Menu',
  'p-tieredmenu': 'Menu',
  'p-tabs': 'Tabs',
  'p-tab': 'Tab',
  'p-accordion': 'Accordion',
  'p-accordionpanel': 'Accordion item',
  'p-timeline': 'Timeline',
  'p-drawer': 'Side panel',
  'p-dialog': 'Modal',
  'p-card': 'Card',
  'p-progressbar': 'Progress bar',
  'p-divider': 'Divider',
  'p-breadcrumb': 'Breadcrumb',
  'p-stepper': 'Stepper',
  'p-skeleton': 'Skeleton',
  'p-slider': 'Slider'
};

/**
 * In-page: how many visible instances of each kit component the page renders, as `{ <kit name>: n }`.
 * Takes the KIT table as its argument (page functions are serialised without their module scope).
 */
export function kitInventory(kit) {
  const counts = {};
  for (const [rootClass, name] of Object.entries(kit)) {
    for (const element of document.getElementsByClassName(rootClass)) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length) continue;
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Inventory score of a render against the reference (both `{ <kit name>: n }`): the share of the
 * reference's instances that the render has (per component, min(reference, render) / reference, summed),
 * and one difference per component the reference uses whose count differs. A component the reference does
 * not use at all is no difference: library parts where the design has plain layers are a choice, not a miss.
 * Null score when the reference uses no kit component.
 */
export function scoreInventory(reference, rendered) {
  const total = Object.values(reference).reduce((sum, count) => sum + count, 0);
  const names = Object.keys(reference).sort();
  const differences = names
    .filter((name) => (reference[name] ?? 0) !== (rendered[name] ?? 0))
    .map((name) => ({ component: name, expected: reference[name] ?? 0, rendered: rendered[name] ?? 0 }));
  if (!total) return { score: null, differences };
  const matched = Object.entries(reference).reduce((sum, [name, count]) => sum + Math.min(count, rendered[name] ?? 0), 0);
  return { score: matched / total, differences };
}
