// Visual check: captures the game's main screens at three screen sizes into shots/<size>/.
// Nothing here asserts on looks — the pictures are for a person (or Claude) to look over
// for things the other tests can't see: overlapping pieces, cut-off dialogs, a broken
// phone layout. Run with `npm run shots`; the folder is git-ignored.
const path = require('node:path');
const { test, play } = require('../e2e/fixtures');

const SIZES = {
  desktop: { width: 1280, height: 1100 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
};

// Each scene gets the page to one state; the test then saves a picture of it.
// Scenes that open a dialog are shot at screen size (a fixed overlay looks wrong in a
// full-page picture); the rest are full-page so nothing below the fold is missed.
const DIALOGS = new Set(['06-share-dialog', '08-tutorial-sphinx', '09-tutorial-ankh']);
const SCENES = {
  '01-start': async () => {},
  '02-piece-selected': async (page) => {
    await page.click('#board .square[data-idx="57"]');            // b1 Sphinx, showing its moves
  },
  '03-midgame': async (page) => {
    await page.goto('/index.html#g=e2e4.d7d5.e4d5.d8d5.b1c3.d5a5.d2d4.c7c6');
    await page.waitForFunction(() => game.history.length === 8);
  },
  '04-check': async (page) => {
    await play(page, 'f2-f3', 'e7-e5', 'g2-g4', 'd8-h4');   // fool's mate is only check here
  },
  '05-review-mode': async (page) => {
    await play(page, 'e2-e4', 'e7-e5', 'g1-f3');
    await page.click('#nav-prev');
    await page.click('#nav-prev');
  },
  '06-share-dialog': async (page) => {
    await play(page, 'e2-e4');
    await page.click('#share-btn');
  },
  '07-rules-open': async (page) => {
    await page.locator('.rules-box summary').click();
    await page.locator('.rules-box').scrollIntoViewIfNeeded();
  },
  '08-tutorial-sphinx': async (page) => {
    await page.click('#learn-btn');
    await page.click('#tutorial-board .square[data-idx="49"]');   // b2 selected
  },
  '09-tutorial-ankh': async (page) => {
    await page.click('#learn-btn');
    await page.click('#tutorial-board .square[data-idx="49"]');
    await page.click('#tutorial-board .square[data-idx="35"]');   // b2 → d4 completes lesson 1
    await page.click('#tutorial-next');
    await page.click('#tutorial-ankh');
  },
};

for (const [size, viewport] of Object.entries(SIZES)) {
  test.describe(size, () => {
    test.use({ viewport });
    for (const [name, setUp] of Object.entries(SCENES)) {
      test(name, async ({ page }) => {
        await page.goto('/');
        await setUp(page);
        await page.waitForTimeout(400);   // let highlights and dialog fades settle
        await page.screenshot({
          path: path.join(__dirname, '..', '..', 'shots', size, `${name}.png`),
          fullPage: !DIALOGS.has(name),
          animations: 'disabled',
        });
      });
    }
  });
}
