Most developers are using AI agents to write code, but how do we know if the code they produce is any good? Research shows that AI-generated code has significantly more bugs, more security issues, and more logical errors than human-written code. So, if you're shipping AI code without a review process, you're taking a huge risk. When it comes to AI code review, the landscape is pretty confusing. There are so many different tools and options available to us as developers. It can be hard to know where to start. So, in this video, we're going to walk through the four levels of AI code review, and by the end of the video, you'll know how to write high-quality code with AI agents.

The problem is that bad code in production is really expensive. Code review is one way we can mitigate this: one developer writes code, someone else looks at it. When you think about code review, there are two things to consider. AI can spot things that humans miss. Humans have more context about the business and the outside world than AI agents do. You want both. As we scale with AI agents, we want to rely more on the automated element, so humans review when they really need to.

Four layers:

1. Automate the obvious with deterministic hooks: types, lint, formatting, tests, security scanning. Hooks trigger and the output is fed back into an agent who can self-correct.
2. Review the code locally with an AI agent. Run the code locally; don't only rely on tests. Glance the diff yourself. Then use an agent to review another agent's output. Group findings: must-fix vs minor. Evaluate correctness, security (no secrets), simplicity (AI code is often verbose), and whether it breaks under load or races.
3. Automated check on the PR (GitHub / Codex review) as a safety net before a human looks.
4. Human review. More serious changes (migrations, infra) get more human review. Small docs or bugfixes can lean on automation. Humans still have product context agents lack.

There isn't a perfect tool. The most important thing is you have a process. When you finish writing AI code, always be very suspicious. Always assume there's a problem with the code and get another agent to review it. Have automated code review built into CI so every change gets a review.
