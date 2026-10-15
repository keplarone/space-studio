# Local (free) engine and specialist tracks

## Specialist tracks
`src/core/specialists.ts` holds six tracks: Roblox Luau systems, Blender modeling and materials, lighting/graphics/VFX,
UI and TweenService, retention and game-loop design, audio and level geometry. `classifyIntent()` scores the prompt against each
track's keywords (whole words, weighted 1–3) with a small bias toward the current workspace, and `specialistBlock()` adds that
track's instructions and reference notes to the system prompt.

- Cloud models: keplar.one classifies the prompt itself (`src/lib/space-studio/chat.ts`) and returns the `track` it used.
- Local engine: the desktop main process classifies and builds the prompt (`src/desktop/local_ai_bridge.ts`).

To change a track, edit it in `src/core/specialists.ts` (the header explains each field), add a routing example to
`test/specialists.test.ts`, run `npm test`, copy `src/core` to keplar-live's `src/lib/space-studio/core`, and release both.

## Local (free) engine
In the model picker, choose **Local (free)**. Space Studio then sends the conversation to an OpenAI-compatible server on this
computer instead of keplar.one: no account traffic, no credits, works offline.

- Ollama: install from ollama.com, `ollama pull qwen2.5-coder:7b`, default port 11434.
- llama.cpp: `llama-server -m model.gguf --port 8080`.

Only `127.0.0.1` is contacted, from the main process (the page itself still has no network access). Ports below 1024 are refused.
A connection check times out after 3 s; an answer after 180 s, because a local model on a laptop CPU can be slow. Every failure is
shown as a troubleshooting card with the real error and next steps (`src/core/troubleshoot.ts`, `chat/TroubleshootCard.tsx`).

Answer quality depends entirely on the model the person runs; small local models are noticeably weaker than Solar or Nova.

## Safety gates
`src/main/safe.ts` — `safely(label, fn, { timeoutMs })` runs any desktop-side work (file system, Blender, Roblox Studio, local
services) with a hard timeout (15 s by default), aborts it on timeout, and turns every failure into a troubleshooting card.
Any new file write, Blender background run or Luau check must go through it.
