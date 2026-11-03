# Let your AI assistant write the video

The quickest way to a good script is to hand it to the AI assistant you already code with. It can read the routes,
components and tests, so it knows what the app does and how to click through it, far better than a tool that only
sees the screen.

```sh
npx showpilot assistant
```

This installs the guide the assistant follows:

| File | Read by |
|---|---|
| `.claude/skills/showpilot/SKILL.md` | Claude Code, as a skill: used whenever you ask for a video |
| A marked section in `AGENTS.md` | Cursor, GitHub Copilot, OpenAI Codex, and others that read `AGENTS.md` |

`showpilot new` installs it too when you choose "my AI assistant writes it". Running `assistant` again updates the
guide; anything you wrote in `AGENTS.md` outside the Showpilot section is kept.

## What to ask

> Make a 90-second energetic launch video of this app with Showpilot.

or, after `showpilot new`:

> Make the launch video with Showpilot, from cuts/launch.brief.md.

## What the assistant does

The guide has it:

1. **Agree the brief.** Read `cuts/<id>.brief.md`, or ask you about purpose, audience, length, tone, narration and
   voice if there isn't one, and save your answers with `showpilot new … --yes`.
2. **Learn the app,** taking selectors from its e2e tests and setting `app.url` or `app.serve`, `app.ready` and
   `app.storage`.
3. **Shape the video** for its length (a teaser is a hook, two or three moments and a call to action; a deep dive is
   silent with chapter titles), and **write the lines** in your tone, for the ear, with delivery marks, fitted to the
   target length (about 2.6 words a second narrated, 2.2 silent).
4. **Write `cuts/<id>.ts`,** with facts only from the code and README.
5. **Make it:** `check`, `voice`, `record`, `frames` (it looks at the takes), `render --still`, then `render`. It fixes
   anything that runs long.

If you wrote or dictated the words yourself (`author: self` or `dictate` in the brief), the assistant keeps them as
they are and only fills in the on-screen actions in `cuts/<id>.actions.ts`.
