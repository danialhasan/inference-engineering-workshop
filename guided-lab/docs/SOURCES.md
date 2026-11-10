# Sources and quotations

Two rules are followed throughout this kit:

1. Anything inside quotation marks with a page or chapter reference is the source's own wording. Everything else is the workshop's explanation.
2. Page numbers are the printed page numbers of the book, not positions in any file.

## Philip Kiely, *Inference Engineering* (2026)

| Where used | Quotation | Section and printed page |
|---|---|---|
| Slides, "It's all about the workload" | "Every inference engineering decision you make will be downstream of your use case." | §1.2 About Your App, p. 27 |
| Slides, product team vs shared service | "add as many constraints as possible by getting specific with your use case" | §1.2, p. 28 |
| Slides, product team vs shared service | "need to support any model and any use case" (said of inference platforms) | §1.2, p. 28 |
| Slides, "The book's version" | Agents: "One user action triggers many inference calls" | §1.2.1 AI-Native Applications, table, p. 28 |
| same | Chat: "Time to first token makes chat feel fast" | §1.2.1, table, p. 28 |
| same | Search: "Offline corpus filling vs. online user requests" | §1.2.1, table, p. 28 |
| same | Completion: "Full completion chunk at user's typing speed" | §1.2.1, table, p. 29 |
| same | Moderation: "High throughput for cost-effective checks" | §1.2.1, table, p. 29 |
| Slides, online or offline | "Lower latency makes your application faster, but higher throughput makes it cheaper at scale" | §1.2.2 Online versus Offline, p. 29 |
| same | "each individual request would be too slow for a good user experience, but the system as a whole processes far more requests per hour" | §1.2.2, p. 29 |
| Slides, Lab 3 takeaways | "it will be more cost effective to create two separate deployments for the same model, with one optimized for latency and the other optimized for throughput" (the sentence begins "Assuming both use cases have enough volume") | §1.2.2, p. 30 |
| Slides, consumer or business | "Business-to-business products often have better margins and more stable usage but require high availability and consistently low latency." | §1.2.3 Consumer versus B2B, p. 30 |
| Slides, "The book's version"; Lab 1 | "you instead measure latency as total response time as the tokens aren't useful individually" (said of an agent's tool call) | §1.4 Measuring Latency and Throughput, p. 36 |
| Slides, "A latency target has four parts" | "It's not good enough for most interactions to feel snappy if one in every ten takes several seconds." | §1.4.1 Latency Percentiles, p. 37 |
| Slides, "Who keeps the promise"; Lab 2 | "When inference time is fast but end-to-end time is slow, turn your attention to infrastructure rather than model performance optimization." | §1.4.2 End-to-End Metrics, p. 37 |
| Slides, Lab 2 takeaways | "A high-quality benchmark simulates real life as closely as possible." | §4.5 Performance Benchmarking and Load Testing, p. 112 |
| Slides, Lab 2 mechanics | "Batching and server load depend on the number of concurrent requests." | §4.5, p. 113 |

Ideas taken from the book without quotation, and where:

- The distinction between perceived tokens per second (per user) and total tokens per second (the whole service): §1.4, p. 35. Lab 2 reports both.
- Percentiles (P50, P90, P95, P99) as "1 in every N requests is slower": §1.4.1, p. 37.
- Matching a benchmark to production on sequence lengths, volume and pattern of traffic, request contents and input parameters: §4.5, pp. 112–113.
- Running a benchmark more than once, keeping a baseline, and changing one variable at a time: §4.5.2, p. 114.

**What the book is not cited for.** This kit does not quote the book on SLAs, SLOs or contracts. The definitions of SLI, SLO and SLA below come from the SRE book. The connection the workshop draws, that enterprise agreements are kept by fitting inference engineering to the workload, is the presenter's framing.

## Google, *Site Reliability Engineering*, chapter 4, "Service Level Objectives"

Betsy Beyer, Chris Jones, Jennifer Petoff and Niall Richard Murphy (eds.), O'Reilly, 2016. Online: <https://sre.google/sre-book/service-level-objectives/> (fetched 10 November 2026).

| Term | Quotation |
|---|---|
| SLI | "a carefully defined quantitative measure of some aspect of the level of service that is provided" |
| SLO | "a target value or range of values for a service level that is measured by an SLI" |
| SLA | "an explicit or implicit contract with your users that includes consequences of meeting (or missing) the SLOs they contain" |
| Telling them apart | "what happens if the SLOs aren't met?" If there is no explicit consequence, "you are almost certainly looking at an SLO" |
| Why keep SLOs without an SLA | "Whether or not a particular service has an SLA, it's valuable to define SLIs and SLOs and use them to manage the service." |
| Percentiles | "a high-order percentile, such as the 99th or 99.9th, shows you a plausible worst-case value, while using the 50th percentile (also known as the median) emphasizes the typical case" |

The workshop's short forms ("a measurement", "a target over a window", "an agreement with consequences") are paraphrases of these.

## Research papers

Listed with their primary sources in [PAPERS.md](PAPERS.md).

## Things that are invented, and labelled as such

- **Every promise, target, price and contract term in the kit is hypothetical.** The service schedule on the slides belongs to no real vendor. The lab targets came from the author's earlier teaching trials and were held fixed while the current reference systems were recorded.
- **Company names** (Cursor, OpenCode, Factory, CodeRabbit, Harvey, Baseten, Modal, Groq, Together AI, Fireworks) appear once, as examples of kinds of product. Nothing in the kit describes their traffic, architecture or contract terms.
- **Audience projects** come from a summary of registrations. Where the kit suggests how a model might be used in one, it says "proposed". A scraper, an MCP server and a streaming platform may use no model at all, and intrusion detection is often non-generative machine learning.
- **Work items in the labs** (support documents, code snippets, calendar tasks, procurement notices, agencies) are fictional and were written for this workshop.
- **The agent's calendar** is a sandbox owned by the lab, seeded with fictional meetings. Its tools are real functions that really change it; it is not anyone's actual calendar.
