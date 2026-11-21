import { getSnapshot, ranked } from './_lib/market.js';

export default async function handler(_req: any, res: any) {
  try {
    const snap = await getSnapshot();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    res.status(200).json({ updatedAt: new Date(snap.at).toISOString(), ranking: ranked(snap.data), unavailable: snap.failed });
  } catch (e: any) {
    res.status(502).json({ error: 'Market data unavailable right now.' });
  }
}
