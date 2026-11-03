// Preloaded into every command: a failure prints its message and what to do about it, not a stack trace. Set
// SHOWPILOT_DEBUG=1 to see the full error (and please include it in a bug report).
const debug = !!process.env.SHOWPILOT_DEBUG;

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nShowpilot stopped: ${message.trim()}`);
  if (debug) console.error(`\n${error instanceof Error ? error.stack : ''}`);
  else console.error('\nNeed help? Run `showpilot doctor`, or retry with SHOWPILOT_DEBUG=1 for the full error.');
  process.exit(1);
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
