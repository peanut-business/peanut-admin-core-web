import { expect, it } from 'vitest';
import { tabsForAction } from '../src/tabs';
it('preserves the first tab when closing other tabs', () => {
  const tabs = ['home', 'a', 'b'].map(key => ({ key, name: key, title: key, fullPath: `/${key}` }));
  expect(tabsForAction(tabs, 'b', 'left').map(tab => tab.key)).toEqual(['a']);
  expect(tabsForAction(tabs, 'b', 'other').map(tab => tab.key)).toEqual(['a']);
  expect(tabsForAction(tabs, 'b', 'all').map(tab => tab.key)).toEqual(['a', 'b']);
});
