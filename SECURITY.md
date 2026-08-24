# Security Policy

## Current boundary

The deployed demonstrator does not execute generated code, invoke a shell, access user MCP tools, call GitHub, or use a live sandbox. Its verifier evaluates a known in-memory invariant under a timeout and captures the result as a bounded record.

## Approval boundary

External actions are simulated. The server validates that a mission is `WAITING_APPROVAL`, its request is pending and unexpired, and no prior action exists before recording the simulation. Rejecting approval sets the mission to `REJECTED` and appends an event; it never creates an action.

## Future live integrations

Keep credentials server-side, scope tools to the selected repository, enforce workspace paths, use provider sandbox limits, validate inputs, persist idempotency keys, and log no secrets. An invalid verification or approval state must fail closed.
