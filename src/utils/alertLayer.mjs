// Native modal dialogs outrank every normal z-index. Keep alerts inside the
// active modal (so they are not inert) and promote them above its content.
export function alertLayer(document) {
  const focusedDialog = document.activeElement?.closest?.('dialog[open]');
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  const target = focusedDialog || dialogs.at(-1) || document.body;
  return {
    target,
    topLayer: typeof document.defaultView?.HTMLElement?.prototype.showPopover === 'function',
    keydownListenerCapture: true
  };
}

export function fireLayeredAlert(swal, args, document) {
  const options = swal.argsToParams(args);
  const layer = alertLayer(document);
  let observer;
  const result = swal.fire({ ...options, ...layer });
  const container = swal.getContainer();
  if (layer.target !== document.body && container) {
    // A successful save may close its account form while its toast is still
    // visible. Move the notification out before the removed form takes it away.
    const keepVisible = () => {
      if (layer.target.isConnected && layer.target.hasAttribute('open')) return;
      document.body.appendChild(container);
      if (layer.topLayer) container.showPopover();
      observer?.disconnect();
      if (!options.toast) swal.getPopup()?.focus({ preventScroll: true });
    };
    const Observer = document.defaultView?.MutationObserver;
    if (Observer) {
      observer = new Observer(keepVisible);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    }
    keepVisible();
  }
  return Promise.resolve(result).finally(() => observer?.disconnect());
}
