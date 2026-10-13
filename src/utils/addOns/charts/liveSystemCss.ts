/**
 * A design system's CSS, generated NOW from its tokens — not as last published.
 *
 * The published sheets are a snapshot: a system published before the chart
 * palette reached the CSS export paints the old pale --Chart-N, so the Charts
 * add-on drew colors that exist nowhere in its Figma file. tokens.json is the
 * exact input generateCSSFiles() runs on at publish time, so running it here
 * gives the sheets a republish WOULD produce, chart colors included.
 *
 * Only the sheets that carry the chart palette are replaced — the two mode
 * sheets (chartGroundCSS) and base.css. Foundation, core, typography and
 * styles stay published: they need inputs tokens.json does not hold (the
 * typography sheet is built from the chosen faces), and nothing in them
 * changed for charts.
 */
import { generateCSSFiles } from '../../cssgen/exportToCSS';
import { getPublicFileUrl } from '../../firebase/storage';
import { systemCssUrls, type SystemCssUrls } from '../../docs/systemCss';

export interface LiveSystemCss {
  /** Published URLs for the untouched sheets; RAW CSS TEXT for the live ones.
   *  OmniDesignProvider takes either per slot — it injects a <link> for a URL
   *  and a <style> for text. Not blob: URLs: the provider decides by the
   *  string's shape (http… / /… / ….css) and a blob: URL matches none, so it
   *  was injected as if it were CSS text and painted nothing. */
  urls: SystemCssUrls;
  /** True when the mode sheets came from tokens.json; false = published fallback. */
  live: boolean;
  /** Why it fell back, in words a person can act on. */
  reason?: string;
}

export async function liveSystemCss(designSystemId: string): Promise<LiveSystemCss> {
  const published = systemCssUrls(designSystemId);
  try {
    const res = await fetch(getPublicFileUrl(designSystemId, 'tokens.json'));
    if (!res.ok) {
      return { urls: published, live: false, reason: `This system has no tokens.json (${res.status}), so its last published CSS is shown.` };
    }
    const files = generateCSSFiles(await res.json());
    const light = files['Light-Mode.css'];
    if (!light) {
      return { urls: published, live: false, reason: 'The tokens did not produce a mode sheet, so the last published CSS is shown.' };
    }
    return {
      urls: {
        ...published,
        lightModeCSS: light,
        darkModeCSS: files['Dark-Mode.css'] || published.darkModeCSS,
        baseCSS: files['base.css'] || published.baseCSS,
      },
      live: true,
    };
  } catch (e) {
    return { urls: published, live: false, reason: `Could not generate this system's CSS (${(e as Error).message}); its last published CSS is shown.` };
  }
}
