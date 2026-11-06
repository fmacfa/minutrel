# Assistants and optional AI providers

Minutrel works entirely without AI. No model is bundled in the server or clients. Connections are optional and configured by the member or administrator.

## Codex and Claude Code

The team server exposes **`/mcp`** using Streamable HTTP and the official MCP SDK. In **Connections**, create a named personal access token valid for 1–365 days. Copy its secret once; only a fingerprint is stored in SQLite. Tokens can be revoked, and account deactivation or relevant role changes revoke access as well.

| Permission | Tools |
| --- | --- |
| `projects.read` | `minutrel_list_projects`: projects personally assigned to the token owner, including administrators |
| `time.read_own` | `minutrel_get_my_timer`, `minutrel_list_my_times`: personal timer and monthly paginated entries |
| `work.read_own` | `minutrel_get_my_work_summary`: personal notes and monthly summaries |
| `work.draft_own` | `minutrel_create_work_note_draft`: a private proposal for review, never automatically shared |
| `timer.write_own` | `minutrel_start_my_timer`, `minutrel_pause_my_timer`, `minutrel_resume_my_timer`, `minutrel_stop_my_timer` |

Timer control is not selected by default. A token grants no administration, collective exports, manual duration correction or access to other members’ entries. Timer commands use the same version and idempotency checks as the app.

The same `work.draft_own` permission enables the [incoming private-note webhook](API_WEBHOOKS.md). It cannot change hours. These integrations use the team server; the standalone personal workspace exposes no network port.

**Configure my assistant** supplies Codex and Claude Code examples. Keep the secret in `MINUTREL_MCP_TOKEN`, outside the source repository. Codex configuration uses an HTTP URL and `bearer_token_env_var`. Portable examples are included in [the source snapshot](../examples/integrations/README.md).

## Ollama, vLLM and Claude

An administrator configures the profile name, API type, `/v1` base URL, available model, optional key and enabled state. No model identifier is imposed or supplied.

- Ollama and vLLM use the OpenAI-compatible `POST /v1/chat/completions` format.
- Claude uses the Anthropic messages adapter configured in this version of the source.

Only exact hostnames in `APP_AI_ALLOWED_HOSTS` are accepted; redirects are not followed. Provider keys stay on the server and are encrypted with AES-256-GCM. Changing the recipient of an existing key requires replacing or clearing that key.

## Generate a monthly summary

In **Work notes**, select the month and configured provider. The form explains that your descriptions and personal notes, including private ones, will be sent to that provider and requests explicit consent. Other members’ entries are not included.

The result becomes a private draft. Edit and approve it before inclusion in reports. References to source entries are retained; numeric totals are calculated separately. The writing provider cannot execute instructions in descriptions or write to time durations.

One generation accepts up to 500 entries and 80,000 input characters, with 1,200 output tokens and a 60-second provider request limit. Generations are serialised with bounded waiting; each member can have one in progress. The writing window can close while generation runs, and the timer stays usable.

Adapters were tested with controlled responses, and the MCP protocol was tested end to end using its official client. Real providers need configuration and validation on your infrastructure. Minutrel does not automatically read folders, screenshots or conversations in Codex/Claude. Automatic session hooks are outside V0.1.
