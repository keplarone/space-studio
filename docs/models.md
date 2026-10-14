# Space Studio models

Orbit 3.8, Nebula 4.2, Solar 5.4 and Nova 5.5 are **Space Studio product names**, and their numbers are Space Studio's own version identifiers.

Each model is a **specialized configuration of an existing foundation model**. A configuration consists of its own system instructions, tool permissions, token and spend budgets, retry limits and escalation rules. **No model has been fine-tuned or trained by Keplar**, and nothing in the product claims otherwise. Which foundation model serves each configuration is server-side configuration on keplar.one; this repository only describes the product.

| Model | Purpose | Tools | Max output | Reasoning | $ cap / task | Minimum plan |
|---|---|---|---|---|---|---|
| Orbit 3.8 | Fast, routine work | docs, read, Luau check | 4k | none | $0.05 | Free |
| Nebula 4.2 | Everyday development | + propose edits | 12k | none | $0.40 | Free |
| Solar 5.4 | Advanced reasoning | + run tests | 20k | 4k | $1.50 | Plus |
| Nova 5.5 | Flagship specialist | + sandboxed Blender | 32k | 12k | $4.00 | Pro |

**Routing.** An explicit choice is always honored. Escalation is only *suggested*. The server switches to another model only when the person has turned on escalation, and the response always records which configuration actually answered. If the provider answers with a different model than the one configured, the answer is discarded and the person is not charged.

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
