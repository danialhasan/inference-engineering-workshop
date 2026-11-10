# What the research optimises for (four minutes)

This stop is optional and short. Its job in the workload-first hour is one idea: serving research states its results against a workload and an objective, the same way a service promise does. It is a reading map of four papers. It is not a ranking and not a pooled analysis.

## The map

| Paper | The promise it helps keep | How its abstract states the result | Evaluated on (per abstract) | Connects to |
|---|---|---|---|---|
| Speculative decoding (Leviathan, Kalman, Matias; ICML 2023) | Whole-response time for a single request, for example a completion or a tool call | 2–3× acceleration with identical outputs | T5-XXL against the standard T5X implementation | Lab 1 |
| Prompt Cache (Gim et al.; MLSys 2024) | Time to first words when prompts share long segments, for example documents or system prompts | 8× (GPU) to 60× (CPU) lower time to first token | Several LLMs; longer prompts such as document question answering and recommendation | Lab 1 |
| vLLM / PagedAttention (Kwon et al.; SOSP 2023) | Throughput, and so cost, without giving up latency | 2–4× throughput "with the same level of latency" | Against FasterTransformer and Orca | Labs 2 and 3 |
| Sarathi-Serve (Agrawal et al.; OSDI 2024) | Capacity while a tail-latency objective is held | 2.6× serving capacity (Mistral-7B, one A100); up to 3.7× (Yi-34B, two A100s), "under tail latency constraints" | Against vLLM | Labs 2 and 3 |

Every figure is quoted from the paper's abstract. None was reproduced for this workshop.

## A script

**Thirty seconds.** "Researchers who work on model serving frame their results the way we framed ours tonight: a workload, an objective, and a measurement."

**One minute, the two single-request papers.** Speculative decoding shortens the whole response of one request without changing what the model would have written. That matters where the whole output is the product: a completion, a tool call. Prompt Cache reuses work on prompt segments that recur, which shortens the wait for the first words when context is long and repeated. In Lab 1 the agent's later calls were faster for a simple version of the same reason.

**One minute, the two serving papers.** vLLM reports more throughput "with the same level of latency". Sarathi-Serve reports more capacity "under tail latency constraints". Both hold a latency condition fixed and ask how much more work fits. That is Lab 2 and Lab 3 done properly, at scale.

**One minute, the limits.** Say the next section aloud.

## Why the numbers cannot be compared with each other

- **Different measurements for different promises.** Single-request speed, time to first token, throughput at fixed latency, and capacity under a tail-latency limit are four different quantities.
- **Different baselines.** Each paper compares with what came before it. vLLM is the winner in one paper and the baseline in another.
- **Different models, hardware and request mixes.** "Up to" figures are best cases.
- **No stacking.** The techniques overlap. Multiplying headline numbers has no meaning.
- **Not our numbers.** The lab results come from one laptop and a 1.5-billion-parameter model. They illustrate the same kinds of trade and replicate none of these papers.

Read a paper to learn which promise an idea helps with. Measure your own workload to learn by how much.

## Primary sources

1. Yaniv Leviathan, Matan Kalman, Yossi Matias. *Fast Inference from Transformers via Speculative Decoding.* ICML 2023. <https://arxiv.org/abs/2211.17192> · proceedings: <https://proceedings.mlr.press/v202/leviathan23a.html>
2. In Gim, Guojun Chen, Seung-seob Lee, Nikhil Sarda, Anurag Khandelwal, Lin Zhong. *Prompt Cache: Modular Attention Reuse for Low-Latency Inference.* MLSys 2024. <https://arxiv.org/abs/2311.04934>
3. Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang, Ion Stoica. *Efficient Memory Management for Large Language Model Serving with PagedAttention.* SOSP 2023. <https://arxiv.org/abs/2309.06180>
4. Amey Agrawal, Nitin Kedia, Ashish Panwar, Jayashree Mohan, Nipun Kwatra, Bhargav S. Gulavani, Alexey Tumanov, Ramachandran Ramjee. *Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve.* OSDI 2024. <https://arxiv.org/abs/2403.02310> · conference page: <https://www.usenix.org/conference/osdi24/presentation/agrawal>

The arXiv records were fetched on 10 November 2026 and the abstracts' figures and phrases copied from them. The links need a network connection; nothing else in the kit does.
