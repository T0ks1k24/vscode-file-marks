'use strict';

const vscode = require('vscode');

/**
 * VS Code keeps the colour of the decoration provider that registered *last*
 * (providers are unshifted into a list and the colours reduced right to left),
 * and every extension carries the same weight. The built-in Git extension
 * registers its provider asynchronously, once it has found a repository —
 * that is after our activation, so its colour would win.
 *
 * The fix is to re-register ourselves once git has settled, and again whenever
 * a new repository opens. Every re-registration is debounced and costs one
 * full redraw, so it happens a handful of times per session at most; it is
 * skipped entirely when `fileMarks.priorityOverGit` is off.
 *
 * Nothing here reaches into another extension's internals — we only listen to
 * the public Git API and, if it is missing or has changed shape, quietly do
 * nothing.
 */
class DecorationPriority {
  /**
   * @param {import('./decorationProvider').MarkDecorationProvider} provider
   * @param {() => boolean} isEnabled
   */
  constructor(provider, isEnabled) {
    this.provider = provider;
    this.isEnabled = isEnabled;
    this.registration = vscode.window.registerFileDecorationProvider(provider);
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._timer = undefined;
    /** @type {vscode.Disposable[]} */
    this._listeners = [];
    this._disposed = false;
  }

  /**
   * Re-registers the provider so it sits in front of git again.
   * @param {number} [delay] milliseconds to wait for git to finish registering
   * @param {boolean} [force] run even when the setting is off (manual command)
   */
  reassert(delay = 0, force = false) {
    if (this._disposed || (!force && !this.isEnabled())) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this._disposed) return;
      this.registration.dispose();
      this.registration = vscode.window.registerFileDecorationProvider(this.provider);
      this.provider.refresh(undefined);
    }, delay);
  }

  /** Hooks the Git API so newly opened repositories cannot steal the colour. */
  async watchGit() {
    try {
      const gitExt = vscode.extensions.getExtension('vscode.git');
      if (!gitExt) return;

      const exports = gitExt.isActive ? gitExt.exports : await gitExt.activate();
      if (this._disposed || !exports || typeof exports.getAPI !== 'function') return;

      const api = exports.getAPI(1);
      if (!api || typeof api.onDidOpenRepository !== 'function') return;

      this._listeners.push(api.onDidOpenRepository(() => this.reassert(500)));
    } catch (err) {
      // Git disabled, unavailable, or a different API version — then there is
      // no competitor for the colour either.
    }
  }

  dispose() {
    this._disposed = true;
    clearTimeout(this._timer);
    for (const listener of this._listeners) listener.dispose();
    this._listeners.length = 0;
    this.registration.dispose();
  }
}

module.exports = { DecorationPriority };
