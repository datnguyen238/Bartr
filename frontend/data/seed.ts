/** Fictional frontend fixtures. Never submitted as authenticated marketplace records. */
import type { Item, Terms, Trade, View, Recommendations } from '@/lib/marketplace';

export const seedEnabled = process.env.NEXT_PUBLIC_USE_SEED_DATA === 'true';
const date = '2026-11-14T18:00:00Z';
const alice = { id: 'seed-alice', name: 'Alice Chen', community: 'Example Community' };
const brian = { id: 'seed-brian', name: 'Brian Patel', community: 'Example Community' };
const carol = { id: 'seed-carol', name: 'Carol Rivera', community: 'Example Community' };

function item(id: string, owner: string, title: string, category: string, value: number | null,
  condition: string, description: string, status: Item['status'] = 'available'): Item {
  return { id, owner, title, category, value_minor: value, condition, description, status,
    revision: 1, image_id: null, value_source: value === null ? 'unknown' : 'owner',
    value_set_at: value === null ? null : date, uncertainty: null, analysis: null };
}
const chair = item('seed-chair', alice.id, 'Wooden study chair', 'Furniture', 4000,
  'Good — light wear on the seat', 'Solid wooden chair suitable for a dorm desk.');
const calculator = item('seed-calculator', alice.id, 'Scientific calculator', 'Study supplies', 2000,
  'Good — working', 'Scientific calculator with protective cover.');
const monitor = item('seed-monitor', brian.id, '24-inch desktop monitor', 'Electronics', 6500,
  'Good — working, includes stand', '1080p monitor with HDMI cable and power adapter.');
const lamp = item('seed-lamp', alice.id, 'Desk lamp draft', 'Household essentials', null,
  'Condition to be reviewed', 'Draft listing with an unknown value.', 'draft');
const shelf = item('seed-shelf', alice.id, 'Small bookshelf', 'Furniture', 3500,
  'Good', 'Three-shelf unit for books and supplies.', 'reserved');
const router = item('seed-router', brian.id, 'Wi-Fi router', 'Electronics', 3500,
  'Good — power adapter included', 'Compact router for an apartment.', 'reserved');
const headphones = item('seed-headphones', alice.id, 'Over-ear headphones', 'Electronics', 4500,
  'Good — ear cushions reviewed', 'Wired headphones with case.', 'exchanged');
const keyboard = item('seed-keyboard', carol.id, 'Mechanical keyboard', 'Electronics', 4500,
  'Good — all keys working', 'Compact keyboard with USB cable.', 'exchanged');
const stand = item('seed-stand', carol.id, 'Laptop stand', 'Study supplies', 2000,
  'Excellent', 'Foldable metal stand for a study desk.');
const deskLight = item('seed-desk-light', alice.id, 'USB desk light', 'Electronics', 1500,
  'Good — brightness controls tested', 'Compact adjustable desk light with a USB power cable.');
const webcam = item('seed-webcam', brian.id, '1080p study webcam', 'Electronics', 3000,
  'Good — camera and microphone tested', 'Clip-on USB webcam for online classes and study calls.');
const usbHub = item('seed-usb-hub', brian.id, 'Four-port USB hub', 'Electronics', 1500,
  'Very good — all ports working', 'Compact hub with four USB ports and an attached laptop cable.');
const notebooks = item('seed-notebooks', carol.id, 'Unused notebook set', 'Study supplies', 1000,
  'New — unused pages', 'Three ruled notebooks and a folder for class notes.');
const speakers = item('seed-speakers', carol.id, 'Compact desktop speakers', 'Electronics', 2500,
  'Good — both speakers tested', 'Small wired stereo speakers with a volume dial and audio cable.');

function terms(left: Item[], right: Item[]): Terms {
  const total = (items: Item[]) => items.some(x => x.value_minor === null) ? null : items.reduce((sum, x) => sum + x.value_minor!, 0);
  const a = total(left), b = total(right);
  return { left_owner: left[0].owner, right_owner: right[0].owner, left, right,
    left_total_minor: a, right_total_minor: b,
    gap_percent: a === null || b === null ? null : Math.abs(a-b) / Math.max(a,b) * 100,
    value_warning: a === null || b === null };
}
const canonical = terms([chair, calculator], [monitor]);
const open: Trade = {
  id: 'seed-open-trade', participants: [alice.id, brian.id], revision: 3, status: 'open',
  offers: [
    { version: 1, sender: alice.id, terms: canonical, consents: [alice.id], created_at: date },
    { version: 2, sender: brian.id, terms: terms([monitor], [chair, calculator]), consents: [brian.id], created_at: date },
  ],
  notes: [
    { sender: alice.id, text: 'Does the monitor include its HDMI cable?', created_at: date },
    { sender: brian.id, text: 'Yes, both the HDMI cable and power adapter are included.', created_at: date },
  ], handoffs: [], cancellations: [], reason: null,
};
const awaiting: Trade = {
  id: 'seed-awaiting-trade', participants: [alice.id, brian.id], revision: 3, status: 'awaiting_handoff',
  offers: [{ version: 1, sender: alice.id, terms: terms([shelf], [router]), consents: [alice.id, brian.id], created_at: date }],
  notes: [{ sender: alice.id, text: 'I have confirmed my handoff. Waiting for your confirmation.', created_at: date }],
  handoffs: [alice.id], cancellations: [], reason: null,
};
const completed: Trade = {
  id: 'seed-completed-trade', participants: [alice.id, carol.id], revision: 4, status: 'completed',
  offers: [{ version: 1, sender: carol.id, terms: terms([keyboard], [headphones]), consents: [alice.id, carol.id], created_at: date }],
  notes: [], handoffs: [alice.id, carol.id], cancellations: [], reason: null,
};
export function createSeedView(): View {
  return structuredClone<View>({
    storage: 'temporary-memory', integrations: { gemini_configured: false, bedrock_configured: false },
    profile: { ...alice, username: 'seed-alice', interests: ['Electronics', 'Study supplies'],
      exclusions: ['Broken items'], gap_limit: 20, revision: 1 },
    members: [alice, brian, carol],
    items: [chair, calculator, deskLight, monitor, webcam, usbHub, stand, notebooks, speakers,
      lamp, shelf, router, headphones, keyboard],
    trades: [open, awaiting, completed],
  });
}
export function createSeedRecommendations(): Recommendations {
  return structuredClone<Recommendations>({ retrieval: 'frontend seed fixtures — not live AI', reason: null,
    recommendations: [{ id: 'seed-chair-calculator-monitor', terms: canonical, member: brian,
      explanation: 'Fictional example: Alice wants electronics; Brian wants furniture and study supplies. Chair + calculator ($60) for monitor ($65) has an estimated 7.7% gap. No live valuation or search was performed.' }],
  });
}
