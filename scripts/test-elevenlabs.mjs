import "dotenv/config";
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const textArg = process.argv.slice(2).join(" ").trim();
const text = textArg || "The first move is what sets everything in motion.";

if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY in .env");
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey });

console.log(`Generating speech with voice ${voiceId}...`);

const audio = await elevenlabs.textToSpeech.convert(voiceId, {
  text,
  modelId: "eleven_multilingual_v2",
  outputFormat: "mp3_44100_128"
});

console.log("Playback starting...");
await play(audio);
console.log("Done.");
