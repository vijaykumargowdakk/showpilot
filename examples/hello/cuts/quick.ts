// Generated from cuts/quick.script.md by `showpilot script quick`: edit the script and run it again.
// The on-screen actions are in cuts/quick.actions.ts, which is yours and is never overwritten.
import { beat, chapter, cut, scene } from 'showpilot';
import { actions } from './quick.actions';

export default cut({
  id: "quick",
  title: "Taskly in 30 seconds",
  silent: false,
  chapterTitles: false,
  chapters: [
    scene("Hello", "kinetic", [
      beat({ say: "Thirty seconds. | One app. || <up>Let's go!</up>" }),
    ]),
    chapter("The basics", [
      beat({ say: "Add a task: | type it, | and press Enter.", do: actions["type \"Call the designer\" into New task and press Enter"] }),
      beat({ say: "Done? | Tick it off, | and watch the progress bar.", do: actions["tick \"Plan the next sprint\""] }),
      beat({ say: "Need focus? | Show only what's still open.", do: actions["show the open tasks"] }),
    ]),
    scene("That's it", "cta", [
      beat({ say: "That's Taskly. || Thanks for watching!" }),
    ]),
  ],
});
