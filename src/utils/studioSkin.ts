/**
 * Keep the studio's own brand off a page that is rendering a USER's brand.
 *
 * main.tsx injects a <style id="omni-studio-design-system"> so the studio wears
 * one of its own design systems. That sheet is appended to <head> LAST and is
 * :root-scoped, so on any page showing somebody else's system it is a coin
 * flip: the provider's <link>s and the studio's <style> have equal specificity,
 * and whichever lands later wins.
 *
 * Ordering alone cannot settle it, because applyStudioDesignSystem is ASYNC —
 * it fetches six files, then appends. The provider's links go in synchronously
 * when the page mounts. So on a cold load the studio's sheet arrives after
 * them and wins; on a warm navigation it is already there and loses. Which
 * brand you see depends on network timing, which is the worst kind of bug to
 * chase: nothing errors, and it reproduces about half the time.
 *
 * Disabling it once is not enough either — on a cold load the element does not
 * exist yet, getElementById returns null, and the call is a silent no-op.
 * Watching <head> closes that window however long the fetch takes.
 *
 * Lifted from AaidWorkbenchPage, which had this right and alone. Every page
 * that mounts OmniDesignProvider against a user's system needs it.
 *
 * @returns a stop function that re-enables the studio's skin.
 */
const STUDIO_STYLE_ID = 'omni-studio-design-system';

function setStudioSkinEnabled(enabled: boolean): void {
  const el = document.getElementById(STUDIO_STYLE_ID) as HTMLStyleElement | null;
  if (el) el.disabled = !enabled;
}

export function suppressStudioSkin(): () => void {
  setStudioSkinEnabled(false);
  const observer = new MutationObserver(() => setStudioSkinEnabled(false));
  observer.observe(document.head, { childList: true });
  return () => {
    observer.disconnect();
    setStudioSkinEnabled(true);
  };
}
