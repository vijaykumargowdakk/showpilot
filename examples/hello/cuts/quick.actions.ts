// The on-screen actions for cuts/quick.ts, one per `> do:` note in cuts/quick.script.md. This file is yours:
// `showpilot script` only adds stubs for new notes (above the end marker) and never changes what is here.
// Each action is Playwright through the Studio: s.click(), s.type(), s.press(), s.focus(), … (see Showpilot's docs).
import type { Studio } from 'showpilot';

export const actions: Record<string, (s: Studio) => Promise<void>> = {
  "type \"Call the designer\" into New task and press Enter": async (s) => {
    await s.type(s.page.getByLabel('New task'), 'Call the designer');
    await s.press('Enter');
  },
  "tick \"Plan the next sprint\"": async (s) => {
    await s.click(s.page.getByRole('checkbox', { name: 'Done: Plan the next sprint' }), 'Done');
    await s.wait(0.6);
    await s.focus(s.page.getByRole('complementary', { name: 'Progress' }), 1.6);
  },
  "show the open tasks": async (s) => {
    await s.click(s.page.getByRole('button', { name: 'Open', exact: true }), 'Open');
  },
  // showpilot:actions-end
};
