# Write-up: BookLeaf Author Support Portal

## Approach and priorities

I read the brief as an operations problem: authors waiting on answers, and a small team answering the same questions inconsistently. So I optimised for the **time between "author asks" and "author gets a correct, specific answer"**. I built the system in this order:

1. **A ticket flow you can trust.** RBAC is enforced in the service layer. Another author's data returns 404. Internal notes live in a separate collection, so they can't leak through a forgotten filter. Every RBAC rule has a test.
2. **AI that helps without being a single point of failure.** Every ticket gets instant keyword triage, then the LLM refines it in the background. Drafts are grounded in the real KB section and the author's actual royalty figures, with payout dates computed in code, not by the model. An admin always reviews before anything is sent. If Groq is down, nothing breaks: triage falls back and the admin writes the reply by hand.
3. **A queue that tells ops what to do next.** It sorts by priority and then age, flags stale tickets and tickets awaiting a reply, and shows the author's books and royalties next to the ticket, so an agent rarely needs another tool.
4. **Real-time updates** that can't leak data. Socket events only say "ticket X changed", and the page re-fetches through the same access-controlled API.

## Trade-offs

- **Groq (gpt-oss 20b/120b) over OpenAI or Anthropic.** I chose it for sub-second latency and a free tier. The provider sits behind an interface, so switching is one file. A frontier model would write slightly better prose. Instead, strict prompt rules and code-computed facts carry most of the quality.
- **Separate Express API** instead of Next.js route handlers. This costs one extra hop and two deployments, but it gives long-lived sockets, background jobs and a cleanly testable API.
- **In-process background jobs and draft cache coalescing.** They are simple and correct for one instance, and they would need a queue to scale out.
- **Attachments are metadata only**, as the brief allowed. I put the time into the AI and the ticket lifecycle instead.
- **Invalidate-and-refetch real-time** instead of pushing data. It is slightly chattier, but authorisation lives in exactly one place.

## Path to production

1. **Scale and reliability:**
   - BullMQ on Redis for AI jobs, with retries and a dead-letter queue.
   - The Socket.IO Redis adapter so the API can run more than one instance.
   - A paid plan with no cold starts.
2. **AI quality loop:**
   - An eval set of real past tickets with expected category, priority and key facts, run in CI whenever a prompt or model changes.
   - Store how much admins edit each draft. Heavy edits flag weak KB sections or prompts.
   - A per-category model and cost dashboard built from the token logs.
3. **Ops features:**
   - SLA timers and escalation per priority.
   - Canned macros for top questions.
   - Auto-resolve after a period of author silence.
   - Duplicate detection, since ISBN reports often arrive as several tickets.
4. **Author features:**
   - Email and WhatsApp notifications.
   - Real attachments, using S3 with pre-signed URLs and scanning.
   - The per-platform royalty breakdown the KB promises.
   - Password reset and self-service bank details.
5. **Operations:**
   - Structured logs and tracing.
   - Error alerting.
   - An audit log of status, priority and assignee changes.
   - PII retention rules for ticket text sent to the LLM.
