# ElevenLabs Live App Quick Test

## Steps

1. Start backend (project root):

  npm install
  npm run dev

1. Start GUI (second terminal):

  cd gui
  npm install
  npm run dev

1. Open the app and go to GENERATE.
1. Set generator to ElevenLabs.
1. Add prompt text (or move performance dials), then click Generate Audio.

## Pass / Fail

- Pass: After player loads a playable track, or transport shows READY GENERATED.
- Fail: Check transport status codes.

## Quick fixes

- 401: invalid or missing ElevenLabs key in .env
- 404: wrong ElevenLabs generate/status path config
- 429: rate limited, retry later
- 500: provider/backend issue, check backend logs
