export type Metrics = { ctr?: number; cvr?: number; priceOk?: boolean; attrsOk?: boolean; stockOk?: boolean };
export function healthScore(m: Metrics): number {
const ctr = (m.ctr ?? 0) * 100;
const cvr = (m.cvr ?? 0) * 100;
const price = m.priceOk ? 10 : -5;
const attrs = m.attrsOk ? 10 : -10;
const stock = m.stockOk ? 10 : -20;
const raw = ctr * 0.3 + cvr * 0.3 + price + attrs + stock;
return Math.max(0, Math.min(100, Math.round(raw)));
}