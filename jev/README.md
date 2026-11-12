# JEV — TypeSafeAI Decision Model

[JEV](https://typesafe.ai) is a decision model from TypeSafeAI designed for fast, structured decisions. Unlike LLMs, it doesn't generate text — it outputs typed answers (scores, choices, probabilities) with calibrated confidence values in 70–500ms at a fraction of the cost.

## Primitives

| Type | Use it for | Returns |
|---|---|---|
| `score` | Rating or ranking text against a rubric | Weighted score + confidence |
| `choice` | Classification, routing, categorization | Selected option + probabilities |
| `noul` | Yes/no confidence (probability something is true) | 0–1 probability |

## Agents

| Agent | What it does |
|---|---|
| [page-search](./page-search/) | Semantic search on any webpage — Chrome extension |

## Getting a JEV API key

Sign up at [typesafe.ai](https://typesafe.ai) → API Keys → Create key.
