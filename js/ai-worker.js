// Runs the computer's search off the main thread (used when the page is served over http/https)
self.window = self;
importScripts('engine.js', 'game.js', 'ai.js');

self.onmessage = (e) => {
  const { id, game, level } = e.data;
  self.PharaohAI.think(game, level, turn => self.postMessage({ id, turn }));
};
