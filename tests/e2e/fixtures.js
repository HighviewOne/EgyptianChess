// Shared helpers: every test fails if the page logs an error
const base = require('@playwright/test');

const idx = (s) => (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0]);

const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      // Web fonts come from Google; a network hiccup there is not a game error
      if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.text())) errors.push(m.text());
    });
    await use(page);
    base.expect(errors, 'browser console errors').toEqual([]);
  },
});

const square = (page, s) => page.locator(`#board .square[data-idx="${idx(s)}"]`);

async function play(page, ...moves) {
  for (const m of moves) {
    const [from, to] = m.split('-');
    await square(page, from).click();
    await square(page, to).click();
  }
}

const log = async (page) => (await page.locator('#move-log').innerText()).replace(/\s+/g, ' ').trim();
const plies = (page) => page.evaluate(() => game.history.length);
const status = (page) => page.locator('#status-text');

module.exports = { test, expect: base.expect, idx, square, play, log, plies, status };
