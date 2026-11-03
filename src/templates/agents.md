<!-- showpilot:start (written by `npx showpilot assistant`; edits here are replaced on update) -->
## Product videos (Showpilot)

This project makes its demo videos with [Showpilot](https://github.com/vijaykumargowdakk/showpilot). The scripts are
`cuts/<id>.ts`, and the config is `showpilot.config.ts`. When asked for a video:

1. **Agree the brief.** Read `cuts/<id>.brief.md`. If it's missing, ask the user for:
   - purpose (launch, walkthrough, tutorial, update), audience, length, and tone (energetic, professional, friendly, calm, playful)
   - narration: AI voice, their own voice, or silent with subtitles
   - what it must show

   Then run `npx showpilot new <id> --purpose … --length … --tone … --narration … --script assistant --yes`.
   For an AI voice, have them pick one with `npx showpilot voices`.
2. **Learn the app** from the code, and take stable selectors (roles, labels) from its e2e tests. Set `app.url` or
   `app.serve`, `app.ready` and `app.storage` in the config. Demo data must be fictional and say so.
3. **Write `cuts/<id>.ts`:** chapters of beats, each a line (`say`) plus actions (`do`) such as `s.click`, `s.type`,
   `s.press`, `s.focus` or `s.callout`. Add scenes: `kinetic` (with `broll`), `badges`, `cta`.
   - Fit the length: about 2.6 words a second narrated, 2.2 silent, less 15% for actions. Write in the brief's tone,
     for the ear, with delivery marks: `|`, `||`, `*stress*`, `<up>…</up>`.
   - Facts only from the code and README.
   - If the brief says `author: self` or `dictate`, keep the user's words in `cuts/<id>.script.md`, run
     `npx showpilot script <id>`, and only fill in `cuts/<id>.actions.ts`.
4. **Run, in order:** `npx showpilot check <id>`, then `voice <id>` (AI voice), `record <id>`, `frames <id> …`
   (look before rendering), `render <id> --still …`, and `render <id>`. Fix any "actions took longer than the line"
   warnings. For the user's own voice: render silent, then `npx showpilot align <id> <recording>`.

Never add watermarks or Showpilot branding to a video.
<!-- showpilot:end -->
