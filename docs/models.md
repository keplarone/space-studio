# Space Studio models

Orbit 3.8, Nebula 4.2, Solar 5.4 and Nova 5.5 are **Space Studio product names**. Their numbers are Space Studio's own version identifiers. They are **not** Anthropic model versions.

Each model is a **specialized configuration on an Anthropic Claude model**. A configuration consists of its own system instructions, tool permissions, token and spend budgets, retry limits and escalation rules. **No model has been fine-tuned or trained by Keplar.** Anthropic does not offer fine-tuning of these Claude models through the API we use, and we make no claim to have modified Claude's weights.

| Model | Underlying model (OpenRouter slug) | Purpose | Tools | Max output | Reasoning | $ cap / task | Minimum plan |
|---|---|---|---|---|---|---|---|
| Orbit 3.8 | Claude Haiku 4.5 (`anthropic/claude-haiku-4.5`) | Fast, routine work | docs, read, Luau check | 4k | none | $0.05 | Free |
| Nebula 4.2 | Claude Sonnet 5.5 (`anthropic/claude-sonnet-5.5`) | Everyday development | + propose edits | 12k | none | $0.40 | Free |
| Solar 5.4 | Claude Opus 5.5 (`anthropic/claude-opus-5.5`) | Advanced reasoning | + run tests | 20k | 4k | $1.50 | Plus |
| Nova 5.5 | Claude Opus 5.5 (`anthropic/claude-opus-5.5`) | Flagship specialist | + sandboxed Blender | 32k | 12k | $4.00 | Pro |

The slugs and prices are the ones keplar.one already uses in production. The source is the registry, `src/core/models.ts`. Each environment can override a model with `SPACE_MODEL_ORBIT` (and the equivalents for the others); only `anthropic/` slugs are accepted.

**Routing.** An explicit choice is always honored. Escalation is only *suggested*. The server switches to another model only when the person has turned on escalation, and the response always records which configuration actually answered. If the provider answers with a different model than the one requested, the answer is discarded and the person is not charged.

**Nova's flagship status** currently rests on its configuration: the strongest underlying model, the largest reasoning budget, and the security-review step. Benchmark results are not published yet, so the UI says so.

## Evaluation pipeline (not built yet)

Required before anyone claims a model is better than another:
1. Benchmark suites:
   - Luau correctness, run with `luau-analyze`;
   - Roblox API accuracy, checked against the Creator Hub reference;
   - security, such as remote validation and trust boundaries;
   - Blender Python execution, in a sandboxed Blender;
   - multi-file tasks.
2. Measure a baseline for each underlying model.
3. Score each profile against its baseline on accuracy, test pass rate, latency and **cost per successful task**.
4. Version profiles (`profileVersion`), datasets and results; reject regressions.

Customer code is never used for training or evaluation without explicit, informed permission.
