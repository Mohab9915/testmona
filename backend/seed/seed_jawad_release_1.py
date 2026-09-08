#!/usr/bin/env python3
"""Seed TestMona with the Jawad Release 1.0 test plan: suites, sections, detailed
multi-step test cases, shared steps, requirements, an execution environment, a
release milestone/test plan, and per-suite test runs assigned to the QA team.

Idempotent-ish: re-running skips users/suites/sections that already exist by
name, but will duplicate test cases/requirements/plan/runs if run twice against
the same project. Intended to be run once against a fresh Jawad project.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app import models, crud, schemas

PROJECT_ID = 1
TEMP_PASSWORD = "Jawad@TestMona2026"
BUILD = "1.0.0-rc1"

TESTERS = [
    {"username": "thamadneh", "email": "thamadneh@asaltech.com", "full_name": "Taleed"},
    {"username": "ahamdan", "email": "AHamdan@asaltech.com", "full_name": "Ayah"},
    {"username": "gqandeel", "email": "gqandeel@asaltech.com", "full_name": "Ghassan"},
    {"username": "leenah", "email": "leenah@asaltech.com", "full_name": "Leena Abu Hammad"},
    {"username": "labureesh", "email": "labureesh@asaltech.com", "full_name": "Lina Abu Reesh"},
    {"username": "mjafar", "email": "MJafar@asaltech.com", "full_name": "Mayar"},
    {"username": "ohussain", "email": "OHussain@asaltech.com", "full_name": "Omar"},
]

ENVIRONMENTS = [
    {
        "name": "Local Dev (ngrok tunnel)",
        "environment_type": "development",
        "description": "Local FastAPI/bot process exposed via an ngrok public HTTPS URL so Meta's WhatsApp/Messenger webhooks can reach it. Used for quick negative/security webhook checks.",
        "config_data": {"webhook_https_required": True, "tunnel": "ngrok"},
        "is_active": True,
    },
    {
        "name": "Staging (Azure Container Apps)",
        "environment_type": "staging",
        "description": "Primary QA target for this release. Hosted on Azure Container Apps, which has no direct UDP ingress, so WebRTC calls must relay through Twilio NTS TURN. Meta apps run in development/test mode.",
        "config_data": {"host": "azure_container_apps", "turn_relay": "twilio_nts_mandatory", "meta_app_mode": "development"},
        "is_active": True,
    },
    {
        "name": "Production",
        "environment_type": "production",
        "description": "Live environment. Only used as a behavioral reference baseline for the WhatsApp regression suite — do not run destructive/negative test cases here.",
        "config_data": {"host": "azure_container_apps", "meta_app_mode": "live"},
        "is_active": True,
    },
]

SHARED_STEPS = {
    "open_landing": {
        "name": "Open Landing Page (Staging)",
        "description": "Common entry point for every web-chat and voice-call scenario.",
        "action": "Navigate to the staging landing page URL in a supported browser (latest Chrome).",
        "expected_result": "The landing page loads fully within ~3s with no console errors, and the قنوات التواصل (Channels) section renders.",
    },
    "send_whatsapp_inbound": {
        "name": "Send Inbound WhatsApp Message From Test Number",
        "description": "Standard way to trigger a WhatsApp webhook for any WhatsApp scenario.",
        "action": "From the QA WhatsApp test device/number, send a text message to the configured WhatsApp Business test number.",
        "expected_result": "Meta's Cloud API delivers a webhook POST to /whatsapp within a few seconds.",
    },
    "send_messenger_inbound": {
        "name": "Send Inbound Messenger Message From Test Page",
        "description": "Standard way to trigger a Messenger webhook for any Messenger scenario.",
        "action": "From a Facebook test user account, open Messenger and send a text message to the QA Facebook Page.",
        "expected_result": "Meta delivers a webhook POST to /messenger carrying the sender's PSID and message text.",
    },
    "idle_past_ttl": {
        "name": "Let Session Idle Past the 10-Minute TTL",
        "description": "Reusable wait step for every channel's SESSION_TTL=600s expiry scenario.",
        "action": "After the last message in the conversation, wait 10 minutes plus a ~15 second buffer without sending anything further.",
        "expected_result": "The channel's SESSION_TTL (600.0s) elapses and the session manager marks the session expired.",
    },
    "join_voice_call": {
        "name": "Join a Voice Call via the Landing Page",
        "description": "Standard way to start a browser WebRTC call for any CallModal scenario.",
        "action": "On the landing page, click the call button to open CallModal and grant microphone permission when prompted.",
        "expected_result": "CallModal moves from 'idle' to 'connecting' (جاري الاتصال), a WebRTC SDP offer is POSTed to /api/offer, and ICE/DTLS negotiation completes.",
    },
    "forge_webhook_signature": {
        "name": "Replay a Webhook With a Mismatched HMAC Signature",
        "description": "Reusable negative-security step for any channel that verifies X-Hub-Signature-256.",
        "action": "Using a REST client (Postman/curl), capture a legitimate webhook payload, modify its body, and POST it to the channel's webhook endpoint while keeping the original X-Hub-Signature-256 header.",
        "expected_result": "The request is rejected before any reply is generated, since the signature no longer matches the (now different) body.",
    },
    "reset_test_identity": {
        "name": "Reset Test Customer/Conversation State",
        "description": "Ensures a scenario starts from a genuinely fresh identity, not leftover state from a previous test.",
        "action": "Use a fresh test phone number / Facebook test user / browser session (clear cookies/local storage) before starting the scenario.",
        "expected_result": "The next inbound message is treated as a brand-new session with no residual name/phone captured from an earlier test.",
    },
    "inspect_logs": {
        "name": "Inspect Backend/Container Logs for the Turn",
        "description": "Used whenever the pass/fail signal isn't purely visible in the UI (e.g. fail_open degradation, which model actually loaded).",
        "action": "Tail the backend/bot application logs (or the Azure Container Apps log stream) for the timeframe of the test action just performed.",
        "expected_result": "Logs confirm what actually happened underneath (e.g. RNNoise/SmartTurn init success or fail_open fallback, app_secret_source, debounce join).",
    },
}


def step(action, expected, step_type="manual"):
    return {"action": action, "expected_result": expected, "step_type": step_type}


def case(title, priority, tags, preconditions, description, steps, section, shared=None, test_type="manual"):
    return {
        "title": title,
        "priority": priority,
        "tags": tags,
        "preconditions": preconditions,
        "description": description,
        "test_type": test_type,
        "section": section,
        "shared": shared or [],
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# Suite 1: Messenger Chat
# ---------------------------------------------------------------------------
SEC_MSG = ["Configuration & Enablement", "Webhook Verification & Security", "Core Conversation Flow",
           "Message Formatting & Limits", "Session Behavior", "Negative & Isolation"]

CASES_MESSENGER = [
    case(
        "Meta webhook verification handshake succeeds regardless of MessengerConfig.enabled",
        "critical", ["messenger", "webhook", "smoke"],
        "MESSENGER_VERIFY_TOKEN is configured on staging.",
        "Meta calls GET /messenger during app setup and whenever the webhook config is re-verified; this must always answer, even if the channel is otherwise disabled.",
        [
            step("Send GET /messenger?hub.mode=subscribe&hub.verify_token=<correct token>&hub.challenge=<value>.",
                 "Response status is 200."),
            step("Inspect the response body.",
                 "Body is exactly <value> — the challenge echoed back verbatim."),
            step("Unset MESSENGER_PAGE_ACCESS_TOKEN (so MessengerConfig.enabled becomes false) and repeat the identical GET request.",
                 "Response status is still 200."),
            step("Inspect the response body again.",
                 "The challenge is still echoed back — verification is independent of `enabled`."),
        ],
        SEC_MSG[0],
    ),
    case(
        "GET /messenger verification rejects an incorrect hub.verify_token",
        "high", ["messenger", "webhook", "security"],
        "MESSENGER_VERIFY_TOKEN is configured on staging.",
        "A wrong token must not be able to complete the handshake.",
        [
            step("Construct a GET /messenger request with hub.mode=subscribe, hub.verify_token=WRONG_TOKEN, and hub.challenge=12345.",
                 "Request is ready to send."),
            step("Send the request and check the response status code.",
                 "Status is non-200 (rejection), not 200."),
            step("Inspect the response body.",
                 "The challenge value (12345) is not echoed back anywhere in the response."),
        ],
        SEC_MSG[0],
    ),
    case(
        "Inbound message is silently dropped (but webhook still acked) when MessengerConfig.enabled is false",
        "critical", ["messenger", "config", "edge-case"],
        "One of MESSENGER_PAGE_ACCESS_TOKEN, MESSENGER_APP_SECRET, or MESSENGER_VERIFY_TOKEN is unset so `enabled` is false.",
        "MessengerConfig.enabled = bool(page_access_token and verify_token and app_secret); when false the app must ack Meta but drop the message, not crash or silently misbehave.",
        [
            step("Confirm one of the three required Messenger secrets is unset.",
                 "MessengerConfig.enabled evaluates to false."),
            step("Send a valid, correctly-signed inbound text message webhook POST to /messenger.",
                 "The endpoint responds 200 quickly (so Meta doesn't retry)."),
            step("Check the Facebook test user's Messenger thread.",
                 "No reply is received from the bot."),
            step("Check the Send API / outbound logs and the conversation store.",
                 "No outbound Send API call was made and no new conversation/session record was created."),
        ],
        SEC_MSG[0], shared=["inspect_logs"],
    ),
    case(
        "HMAC signature verification rejects a tampered/forged webhook payload",
        "critical", ["messenger", "security", "negative"],
        "MESSENGER_APP_SECRET (or its META_APP_SECRET fallback) is configured; MessengerConfig.enabled is true.",
        "verify_signature() must protect every inbound webhook against payload forgery.",
        [
            step("Capture one legitimate, correctly-signed inbound webhook payload (e.g. via a proxy/log).",
                 "Payload and its X-Hub-Signature-256 header are captured intact."),
            step("Modify the message body of the captured payload without recomputing the signature.",
                 "A tampered payload is ready, still carrying the original signature header."),
            step("POST the tampered payload with the mismatched signature header to /messenger.",
                 "The request is rejected (4xx) before any processing or reply."),
            step("Check the Send API / outbound logs and the test user's Messenger thread.",
                 "No message reaches the Send API; no reply was generated for the tampered payload."),
        ],
        SEC_MSG[1], shared=["forge_webhook_signature"],
    ),
    case(
        "MESSENGER_APP_SECRET falls back to META_APP_SECRET when unset, and app_secret_source reflects it",
        "high", ["messenger", "config"],
        "META_APP_SECRET is configured (shared WhatsApp Meta app config); MESSENGER_APP_SECRET is left unset.",
        "The fallback exists so Messenger doesn't need its own dedicated app secret if it shares a Meta app with WhatsApp.",
        [
            step("Unset MESSENGER_APP_SECRET while keeping META_APP_SECRET configured, then restart the service.",
                 "The service starts cleanly with no crash or missing-config error."),
            step("Inspect startup/config logs.",
                 "Logs show app_secret_source pointing at META_APP_SECRET."),
            step("Sign a sample inbound webhook payload using META_APP_SECRET and POST it to /messenger.",
                 "Signature verification passes."),
            step("Confirm the message is processed normally.",
                 "The bot proceeds with its normal conversation flow and replies to the message."),
        ],
        SEC_MSG[0], shared=["inspect_logs"],
    ),
    case(
        "New anonymous PSID: bot proactively asks for the customer's phone number",
        "critical", ["messenger", "core-flow", "critical-path"],
        "A fresh Facebook test user (new PSID) with no prior conversation history.",
        "Messenger only exposes an anonymous PSID, never a phone number, unlike WhatsApp where the number is the channel identity itself — the flow must explicitly collect it.",
        [
            step("Confirm the fresh Facebook test user has no existing session/customer record.",
                 "No prior state exists for this PSID."),
            step("Send a first greeting message (e.g. مرحبا) from the fresh test user.",
                 "The webhook is received and the bot sends a reply."),
            step("Read the bot's first reply.",
                 "The reply explicitly asks for the customer's phone number, since Messenger only exposes an anonymous PSID."),
            step("Reply with a valid phone number.",
                 "The bot accepts it and proceeds with the conversation without asking again."),
            step("Inspect the backend conversation/customer record for this PSID.",
                 "The phone number just provided is stored against this PSID for the rest of the session."),
        ],
        SEC_MSG[2], shared=["send_messenger_inbound", "reset_test_identity"],
    ),
    case(
        "Replying with an invalid/malformed phone number re-prompts instead of accepting it",
        "medium", ["messenger", "validation"],
        "Conversation is at the point where the bot is asking for a phone number.",
        "Garbage input must not be silently accepted as a phone number.",
        [
            step("From a fresh PSID, send a greeting so the bot reaches the point of asking for a phone number.",
                 "Bot asks for the phone number."),
            step("Reply with a clearly invalid string, e.g. 'abc123'.",
                 "The bot does not accept it as a valid phone number."),
            step("Read the bot's next reply.",
                 "The bot re-asks for the phone number or shows a validation message, rather than proceeding as if it were accepted."),
        ],
        SEC_MSG[2],
    ),
    case(
        "Long reply over MESSENGER_TEXT_LIMIT (2000 chars) is split via split_text()",
        "medium", ["messenger", "formatting"],
        "A bot response that would exceed 2000 characters can be triggered (e.g. a long property listing description).",
        "Messenger's Send API has message-length limits; long replies must be chunked, not truncated or rejected.",
        [
            step("Identify or construct a scenario where the bot's response would exceed 2000 characters.",
                 "The triggering message/scenario is ready to send."),
            step("Send the triggering message to the bot via Messenger.",
                 "The bot begins responding."),
            step("Count the outbound Send API calls made for this single bot turn.",
                 "Multiple sequential Send API calls are made, not one oversized call."),
            step("Inspect the content and order of each sent message.",
                 "Each message is ≤2000 characters, messages appear in correct reading order, and no sentence is cut mid-word unexpectedly."),
        ],
        SEC_MSG[3],
    ),
    case(
        "Outbound Send API call exceeding _SEND_TIMEOUT (10s) is handled gracefully",
        "high", ["messenger", "resilience"],
        "Ability to simulate or observe a slow Send API call (staging network throttling, or log inspection).",
        "A hung outbound call must not hang or crash the whole webhook handler.",
        [
            step("Configure or simulate a delay of more than 10 seconds on the next outbound Send API call.",
                 "The delay is in place for the next call."),
            step("Send an inbound message that triggers a bot reply.",
                 "The webhook handler does not hang indefinitely; it returns without crashing once the timeout is hit."),
            step("Send a second, unrelated inbound message afterward.",
                 "The conversation continues normally, confirming the earlier timeout didn't leave the session broken."),
        ],
        SEC_MSG[4], shared=["inspect_logs"],
    ),
    case(
        "MessengerSessionManager enforces the same session TTL/expiry behavior as web chat",
        "high", ["messenger", "session"],
        "An active conversation with name and phone already captured.",
        "Messenger's TextSessionManager-based session manager should behave consistently with the other text channels.",
        [
            step("Start a conversation and get the bot to capture the customer's name and phone number.",
                 "Name and phone are stored against the session."),
            step("Idle for 10 minutes plus a ~15 second buffer without sending anything further.",
                 "The session's SESSION_TTL (600s) elapses."),
            step("Send a new message after the idle period.",
                 "The session is recycled automatically rather than requiring an explicit new session."),
            step("Read the bot's reply.",
                 "The bot re-asks for the customer's name, rather than crashing or silently ignoring the message."),
        ],
        SEC_MSG[4], shared=["idle_past_ttl"],
    ),
    case(
        "MessengerConfig.enabled is not required at startup",
        "critical", ["messenger", "config", "startup"],
        "None of the MESSENGER_* environment variables are set.",
        "MESSENGER_* fields are deliberately excluded from _REQUIRED_SECRET_FIELDS so a deployment without Messenger configured must still boot.",
        [
            step("Unset all MESSENGER_* environment variables on the deployment.",
                 "Configuration is ready for a clean-slate startup test."),
            step("Start/restart the service.",
                 "The service starts cleanly with no crash, and startup logs show no fatal error related to Messenger config."),
            step("Confirm WhatsApp and web chat still function by sending one test message on each.",
                 "Both channels reply normally, unaffected by Messenger being unconfigured."),
            step("Send a GET /messenger verification request with any token.",
                 "The endpoint responds (rejecting the mismatched/absent token) rather than raising a 500 due to missing config."),
        ],
        SEC_MSG[0], shared=["inspect_logs"],
    ),
    case(
        "CHANNEL_NAME 'messenger_text' is correctly tagged on stored conversation records",
        "medium", ["messenger", "data-integrity"],
        "A completed Messenger conversation exists.",
        "Records must be distinguishable per channel for reporting/dashboards.",
        [
            step("Complete one full conversation via Messenger (greeting through to name/phone capture).",
                 "The conversation completes without error."),
            step("Locate the corresponding session/conversation record in the backend store.",
                 "A record exists for this PSID."),
            step("Inspect the record's channel field.",
                 "It equals 'messenger_text', distinct from whatsapp_text/web-chat sessions in the same store."),
        ],
        SEC_MSG[5],
    ),
    case(
        "Two concurrent PSIDs are kept fully isolated (no session bleed)",
        "medium", ["messenger", "session", "isolation"],
        "Two distinct Facebook test user accounts available.",
        "Concurrent conversations must never leak state between users.",
        [
            step("Prepare two distinct Facebook test user accounts, each with no prior conversation history.",
                 "Both PSIDs start fresh."),
            step("Have both test users message the bot with overlapping timing, each giving a different name/phone when asked.",
                 "Both conversations proceed independently without errors."),
            step("Inspect each PSID's stored session/customer record.",
                 "Each PSID's record contains only its own name/phone — not the other test user's values."),
            step("Continue both conversations with one more follow-up message each.",
                 "Each conversation responds using only its own prior context, with no cross-talk between the two PSIDs."),
        ],
        SEC_MSG[5],
    ),
]

# ---------------------------------------------------------------------------
# Suite 2: Web Chat Widget
# ---------------------------------------------------------------------------
SEC_WEB = ["Widget Rendering & Launch", "Channels Section (Landing Page)", "Core Conversation Flow",
           "Limits & Validation", "Session & Timeout Behavior", "Consistency Checks"]

CASES_WEB = [
    case(
        "ChatLauncher renders on the landing page and opens ChatPanel on click",
        "critical", ["web-chat", "ui", "smoke"],
        "Staging landing page is reachable.",
        "The floating launcher is the primary entry point into the widget.",
        [
            step("Navigate to the staging landing page.", "Page loads fully with no console errors."),
            step("Locate the floating chat launcher button.",
                 "Button is visible with aria-label='دردش مع جواد' and the same visible text."),
            step("Click the launcher button.", "ChatPanel/ChatSurface opens."),
            step("Confirm the chat surface is interactive.", "The message input is ready to accept text."),
        ],
        SEC_WEB[0], shared=["open_landing"],
    ),
    case(
        "Launcher is hidden while the chat panel is open, and reappears after closing",
        "high", ["web-chat", "ui"],
        "Chat panel can be opened and closed.",
        "Two overlapping entry points would be confusing UI.",
        [
            step("Open the chat via the launcher button.", "ChatPanel opens."),
            step("Check for the floating launcher button while the panel is open.",
                 "The launcher button is hidden/not rendered."),
            step("Close the chat panel via its close control.", "The launcher button reappears."),
        ],
        SEC_WEB[0],
    ),
    case(
        "Channels section: Phone option is always visible regardless of build",
        "critical", ["web-chat", "channels"],
        "Landing page loaded, Channels ('قنوات التواصل') section reachable.",
        "Voice calling is the one channel meant for every visitor, dev or prod.",
        [
            step("Navigate to the landing page.", "Page loads."),
            step("Open the Channels section.", "The Channels list renders."),
            step("Locate the phone/voice-call entry.",
                 "'المحادثة الصوتيّة' (Phone) item is present, regardless of build type."),
        ],
        SEC_WEB[1],
    ),
    case(
        "Channels section: WhatsApp entry is gated behind isDev",
        "critical", ["web-chat", "channels", "config"],
        "Ability to load both a dev build and a customer-facing (non-dev) build of the landing page.",
        "Real customers must not see the WhatsApp entry on this branch — it's dev-only visibility.",
        [
            step("Load the landing page as a non-dev (customer-facing) build.", "Page loads normally."),
            step("Open the Channels section.", "WhatsApp item is NOT rendered."),
            step("Load the landing page as a dev build.", "Page loads normally."),
            step("Open the Channels section again.", "WhatsApp item IS visible."),
        ],
        SEC_WEB[1],
    ),
    case(
        "Channels section: 'ابدأ الدردشة' opens the chat via a working button, not a dead link",
        "critical", ["web-chat", "channels"],
        "Channels section open.",
        "An earlier, unrelated branch (origin/aqalalwa/landing) shipped 'Coming soon' text and a dead WhatsApp link — this branch must not regress to that.",
        [
            step("Open the Channels section on the landing page.",
                 "The 'الدردشة على الموقع' (chat on the website) entry with its 'ابدأ الدردشة' button is visible."),
            step("Click the 'ابدأ الدردشة' button.", "openChat() fires (verify via network/console or app state)."),
            step("Observe the chat surface.",
                 "The chat panel actually opens and is usable — not a placeholder/'Coming soon' label or dead link."),
        ],
        SEC_WEB[1],
    ),
    case(
        "ChatSurface enforces a 2000-character input limit",
        "high", ["web-chat", "validation"],
        "Chat panel open with an active session.",
        "characterLimit is set to 2000 on the message input.",
        [
            step("Open the chat panel with an active session.", "Message input is available."),
            step("Attempt to type or paste text longer than 2000 characters into the input.",
                 "Input is capped at 2000 characters, or a clear validation indicator appears."),
            step("Attempt to send the over-limit text.", "The message cannot be sent while over the limit."),
        ],
        SEC_WEB[3],
    ),
    case(
        "requestBodyLimits maxMessages:1 blocks queuing a second message mid-turn",
        "high", ["web-chat", "validation"],
        "Chat panel open with an active session.",
        "The widget should not let a user pile up multiple in-flight turns.",
        [
            step("Open the chat and send a message.", "The message is sent and a reply is pending."),
            step("Immediately attempt to send a second message before any reply arrives.",
                 "The UI blocks or queues the second message rather than sending it immediately."),
            step("Wait for the first reply to arrive, then attempt to send a message again.",
                 "Sending now succeeds normally."),
        ],
        SEC_WEB[3],
    ),
    case(
        "Session recycles automatically on the next message after SESSION_TTL (600s) expiry",
        "critical", ["web-chat", "session"],
        "A conversation with the customer's name already captured.",
        "get_session recycles an expired session rather than requiring an explicit new one.",
        [
            step("Start a conversation and get the bot to capture the customer's name.",
                 "Name is stored for the session."),
            step("Idle past the TTL without sending anything further.",
                 "Nothing crashes; the session is internally marked expired."),
            step("Send another message after the idle period.",
                 "EXPIRY_MESSAGE ('جلستك انتهت بسبب عدم النشاط...') is shown."),
            step("Read the bot's next reply after the expiry message.",
                 "The bot re-asks for the full name, confirming the session recycled rather than dead-ending."),
        ],
        SEC_WEB[4], shared=["idle_past_ttl"],
    ),
    case(
        "PIPELINE_START_TIMEOUT (20s) shows TURN_TIMEOUT_MESSAGE when the backend is slow",
        "high", ["web-chat", "resilience"],
        "Ability to simulate a slow backend pipeline start in staging.",
        "A hung pipeline start must give the user an explicit message, not an infinite spinner.",
        [
            step("Force/simulate the backend pipeline taking longer than 20s to start (staging only).",
                 "The delay is in place."),
            step("Send a message in the chat widget.", "The UI shows a waiting/loading state initially."),
            step("Wait past the 20-second threshold.",
                 "User sees 'عذراً، تأخر الرد. جرب مرة ثانية.' rather than hanging indefinitely."),
        ],
        SEC_WEB[4],
    ),
    case(
        "ChatContext keeps open/close state consistent across launcher, panel, and Channels button",
        "medium", ["web-chat", "state"],
        "Landing page loaded.",
        "There are two ways to open chat (launcher, Channels button) and they must not desync.",
        [
            step("Load the landing page and open the Channels section.",
                 "Channels list renders with the 'ابدأ الدردشة' entry."),
            step("Click 'ابدأ الدردشة' inside the Channels entry instead of the floating launcher.",
                 "ChatPanel opens."),
            step("Check the floating launcher button's visibility.",
                 "It is hidden, exactly as if the chat had been opened from the launcher itself."),
        ],
        SEC_WEB[5],
    ),
    case(
        "Web chat's shared base behaves the same as Messenger's for a basic greeting flow",
        "high", ["web-chat", "regression", "cross-channel"],
        "Both the web-widget and Messenger test suites are runnable in the same staging build.",
        "This branch's channels/text_channel.py (749 lines) and Messenger's (570 lines) are two *independently written* copies of the same base class — behavior should still match.",
        [
            step("On the web widget, send a greeting and observe the bot's request for identity, then provide it.",
                 "The web widget completes this flow and shows the expected session/expiry behavior."),
            step("Repeat the identical script (greeting → identity request → provide identity) on Messenger.",
                 "Messenger completes the same flow shape."),
            step("Compare the two flows' behavior (prompts shown, session/expiry timing).",
                 "Both channels produce an equivalent flow shape despite the base class being duplicated rather than shared at this point."),
        ],
        SEC_WEB[5],
    ),
    case(
        "Widget UI renders correctly on a narrow/mobile viewport",
        "low", ["web-chat", "ui", "responsive"],
        "Landing page loaded on a mobile-width viewport (or device emulation).",
        "Chat must be usable on mobile, the majority of real traffic.",
        [
            step("Resize the browser (or use device emulation) to a mobile width, e.g. 375px.",
                 "The landing page re-renders responsively."),
            step("Open the chat launcher and the chat panel.",
                 "Both remain fully usable and are not clipped or overlapping other content."),
            step("Open the Channels section.", "The Channels list remains usable and readable at this width."),
        ],
        SEC_WEB[0],
    ),
    case(
        "Closing and reopening mid-conversation preserves the still-active session",
        "high", ["web-chat", "session"],
        "An active conversation within TTL.",
        "Closing the panel is a UI action, not a session-ending one.",
        [
            step("Start a conversation and exchange at least one message.", "Conversation context exists."),
            step("Close the chat panel without idling past TTL.", "Panel closes without error."),
            step("Reopen the chat within the TTL window.",
                 "Conversation context/history is still present; the flow is not restarted from scratch."),
        ],
        SEC_WEB[4],
    ),
]

# ---------------------------------------------------------------------------
# Suite 3: Noise Cancellation & Turn Analysis
# ---------------------------------------------------------------------------
SEC_VOICE = ["Noise Filter Behavior & Config", "Turn Analysis / SmartTurn Behavior",
             "Fail-Open & Resilience", "Cross-Transport Consistency", "Resource Sharing"]

CASES_VOICE = [
    case(
        "RNNOISE_ENABLED=true measurably reduces background noise on inbound mic audio",
        "critical", ["voice", "noise-cancellation"],
        "A staging WebRTC call can be placed with controllable background noise (fan/office noise) on the caller side; RNNOISE_ENABLED=true.",
        "A tester perceiving 'no difference' could mean either 'working subtly' or 'not actually loaded' — this case explicitly checks logs, not just subjective listening.",
        [
            step("Set up a staging call environment with RNNOISE_ENABLED=true and a controllable background noise source on the caller side.",
                 "Setup is ready."),
            step("Place a webrtc call with steady background noise present and speak a short phrase.",
                 "The call connects and the phrase is captured."),
            step("Inspect the backend STT transcript / recorded inbound audio for the call.",
                 "The bot correctly understands/transcribes the phrase despite the background noise."),
            step("Inspect backend logs for the call's timeframe.",
                 "Logs confirm the RNNoise engine actually initialized (not merely that the flag is true)."),
        ],
        SEC_VOICE[0], shared=["join_voice_call", "inspect_logs"],
    ),
    case(
        "Noise filter is not applied to the bot's own TTS output",
        "high", ["voice", "noise-cancellation"],
        "An active call with the bot speaking.",
        "RNNoise filters only the caller's inbound mic audio; the bot's outbound TTS path must be untouched.",
        [
            step("Place a call and wait for the bot to speak (TTS).", "Bot's TTS audio plays."),
            step("Record or inspect the bot's outbound TTS audio stream.", "Audio is captured for inspection."),
            step("Compare it against a known-clean TTS reference for filtering artifacts.",
                 "TTS audio is clean and unaffected by the RNNoise filter, confirming it only applies inbound."),
        ],
        SEC_VOICE[0],
    ),
    case(
        "fail_open=True: RNNoise engine init failure degrades to passthrough, not a crash",
        "critical", ["voice", "resilience", "fail-open"],
        "Ability to simulate the RNNoise engine failing to load (e.g. missing pyrnnoise / binary load error) in a staging build.",
        "A missing native dependency must never take down the whole pipeline.",
        [
            step("Simulate the RNNoise dependency being unavailable (e.g. missing pyrnnoise / broken binary load).",
                 "The environment is set up to fail RNNoise init."),
            step("Start the bot process.", "The process starts without crashing despite the RNNoise failure."),
            step("Place a call and speak.",
                 "The call connects and functions normally with unfiltered (passthrough) audio."),
            step("Check backend logs for the timeframe of startup and the call.",
                 "Logs show the fail-open/degrade event was recorded."),
        ],
        SEC_VOICE[2], shared=["join_voice_call", "inspect_logs"],
    ),
    case(
        "RNNOISE_QUALITY (QQ/HQ/VHQ) all connect and produce usable audio",
        "medium", ["voice", "noise-cancellation", "config"],
        "Ability to override RNNOISE_QUALITY per test run.",
        "The resampler quality knob trades latency for quality between RNNoise's 48kHz and the transport's 16kHz.",
        [
            step("Configure RNNOISE_QUALITY=QQ and place a short call, speaking a test phrase.",
                 "Call connects; speech is audible/transcribable."),
            step("Configure RNNOISE_QUALITY=HQ and repeat the same call/phrase.",
                 "Call connects; speech is audible/transcribable."),
            step("Configure RNNOISE_QUALITY=VHQ and repeat the same call/phrase.",
                 "Call connects; speech is audible/transcribable, subjectively the best quality of the three."),
            step("Compare the three runs for latency and crashes.",
                 "No crashes on any setting; QQ has the lowest latency, VHQ the best quality."),
        ],
        SEC_VOICE[0],
    ),
    case(
        "SmartTurn ends the caller's turn promptly when the utterance sounds complete",
        "critical", ["voice", "turn-analysis"],
        "SMART_TURN_ENABLED=true; an active call.",
        "SmartTurn should recognize completeness, not just rely on a fixed silence duration like the old Silero-only approach.",
        [
            step("Place a call with SMART_TURN_ENABLED=true.", "Call connects normally."),
            step("Speak one clearly complete sentence (e.g. أنا مهتم بالشقة رقم خمسة) and then stop.",
                 "The utterance is captured."),
            step("Time how quickly the bot responds after the sentence ends.",
                 "Bot responds promptly, without an unnecessarily long fixed pause."),
        ],
        SEC_VOICE[1], shared=["join_voice_call"],
    ),
    case(
        "SMART_TURN_STOP_SECS (2.0s) hard ceiling ends the turn regardless of model confidence",
        "critical", ["voice", "turn-analysis"],
        "An active call.",
        "The hard ceiling exists so an ambiguous utterance can never hang the conversation.",
        [
            step("Place an active call.", "Call connects normally."),
            step("Speak a sentence that trails off ambiguously (as if more speech is coming), then go fully silent.",
                 "The utterance is captured mid-sentence."),
            step("Time how long it takes for end-of-turn to fire.",
                 "End-of-turn fires no later than ~2 seconds of silence, regardless of what the model would otherwise judge."),
        ],
        SEC_VOICE[1],
    ),
    case(
        "SMART_TURN_PRE_SPEECH_MS (500ms) prevents consonant-onset clipping",
        "high", ["voice", "turn-analysis"],
        "An active call.",
        "500ms of audio is prepended to the analysis window specifically to catch onsets the VAD tends to trim.",
        [
            step("Place an active call and let a silence gap of at least a second pass.",
                 "Call is idle/listening."),
            step("Speak a phrase starting with a hard consonant sound immediately after the silence gap.",
                 "The utterance is captured."),
            step("Inspect the STT transcript/logs for this utterance.",
                 "The leading consonant is present in the transcript, not clipped."),
        ],
        SEC_VOICE[1], shared=["inspect_logs"],
    ),
    case(
        "SMART_TURN_MAX_DURATION_SECS (8.0s) caps an unusually long utterance",
        "medium", ["voice", "turn-analysis"],
        "An active call; ability to speak continuously for >8s.",
        "Prevents unbounded buffering for one very long utterance.",
        [
            step("Place an active call.", "Call connects."),
            step("Speak continuously for more than 8 seconds without pausing.",
                 "Speech is captured for the full duration attempted."),
            step("Inspect logs/behavior for how the analyzer handled the utterance.",
                 "Analysis is capped at ~8 seconds rather than buffering indefinitely."),
        ],
        SEC_VOICE[1], shared=["inspect_logs"],
    ),
    case(
        "Barge-in during bot speech is handled by Silero VAD independent of SmartTurn",
        "high", ["voice", "interruption"],
        "An active call with the bot mid-TTS.",
        "Interruption/barge-in is a separate mechanism from SmartTurn's end-of-turn detection and must be unaffected by it.",
        [
            step("Place a call and wait until the bot begins speaking (TTS playing).",
                 "Bot's TTS is audibly in progress."),
            step("Start talking over the bot's speech (barge-in).",
                 "Caller's speech is captured while the bot is still speaking."),
            step("Observe the bot's behavior immediately after.",
                 "The bot stops/yields (interruption handled), confirming barge-in still works alongside the new turn analyzer."),
        ],
        SEC_VOICE[1],
    ),
    case(
        "fail_open=True: SmartTurn model load failure falls back to silence-duration turn-taking",
        "critical", ["voice", "resilience", "fail-open"],
        "Ability to point SMART_TURN_MODEL_PATH at a missing/corrupt file in staging.",
        "A missing/broken ONNX model must degrade gracefully, not crash the call pipeline.",
        [
            step("Set SMART_TURN_MODEL_PATH to a missing/corrupt file path in a staging build.",
                 "Configuration is set for a forced model-load failure."),
            step("Start the bot process.", "Process starts without crashing despite the model load failure."),
            step("Place a call and complete a short conversation.",
                 "The call connects and completes end-to-end using plain silence-duration turn-taking."),
            step("Check backend logs.", "Logs show the fail-open fallback event."),
        ],
        SEC_VOICE[2], shared=["join_voice_call", "inspect_logs"],
    ),
    case(
        "Noise filter and turn analyzer are each built once and shared (ServiceFactory)",
        "high", ["voice", "performance"],
        "Access to process startup logs.",
        "Both the transport (bot()) and the pipeline (run_bot()) must reuse one instance rather than loading the ONNX/RNNoise models twice.",
        [
            step("Restart the bot process fresh.", "Process starts."),
            step("Capture the full startup log output.", "Startup logs are available for inspection."),
            step("Count RNNoise init and SmartTurn/ONNX model load log lines.",
                 "Exactly one of each appears per process, not two (which would indicate accidental double-instantiation)."),
        ],
        SEC_VOICE[4], shared=["inspect_logs"],
    ),
    case(
        "Identical noise-cancellation and turn-analysis behavior on webrtc vs twilio transports",
        "critical", ["voice", "cross-transport"],
        "Ability to place both a browser (webrtc) call and a real phone (twilio) call to the bot.",
        "Both transports are wired to the same ServiceFactory-built components and should behave identically.",
        [
            step("Run the noisy-background + interruption + long-pause script via a webrtc landing-page call.",
                 "Record the turn-ending, interruption, and degraded-audio behavior observed."),
            step("Run the identical script via a real Twilio phone call to the bot's number.",
                 "Record the same set of behaviors for this transport."),
            step("Compare the two sets of observations.",
                 "Both transports show equivalent behavior across all three checks."),
        ],
        SEC_VOICE[3], shared=["join_voice_call"],
    ),
    case(
        "SMART_TURN_CPU_COUNT stays low and doesn't starve LLM/TTS under concurrent calls",
        "medium", ["voice", "performance"],
        "Ability to place 2-3 concurrent calls in staging.",
        "SMART_TURN_CPU_COUNT defaults to 1 specifically to leave CPU headroom for the LLM/TTS.",
        [
            step("Place 2-3 concurrent calls in staging (mix of webrtc/twilio).", "All calls connect."),
            step("Monitor CPU/thread usage and end-to-end response latency during the concurrent calls.",
                 "Metrics are captured for all calls."),
            step("Compare latency against a single-call baseline.",
                 "No severe latency regression is observed that's attributable to the turn model competing for CPU."),
        ],
        SEC_VOICE[4],
    ),
    case(
        "RNNOISE_ENABLED and SMART_TURN_ENABLED can be toggled independently",
        "low", ["voice", "config"],
        "Ability to override each flag independently per test run.",
        "The two features must not be coupled to each other.",
        [
            step("Configure RNNOISE_ENABLED=false and SMART_TURN_ENABLED=true, then place a call.",
                 "Call connects and functions with noise cancellation off, turn analysis on."),
            step("Configure RNNOISE_ENABLED=true and SMART_TURN_ENABLED=false, then place a call.",
                 "Call connects and functions with noise cancellation on, turn analysis off."),
            step("Compare both runs for crashes or cross-feature effects.",
                 "Each feature disables independently without affecting the other or crashing the pipeline."),
        ],
        SEC_VOICE[0],
    ),
]

# ---------------------------------------------------------------------------
# Suite 4: WhatsApp Chat — Production Regression
# ---------------------------------------------------------------------------
SEC_WA = ["Core Conversation Flow (Baseline)", "Message Bundling & Debounce", "Phone Number Handling",
          "Session & Expiry", "Meta Cloud API Integration", "Post-Refactor Regression"]

CASES_WHATSAPP = [
    case(
        "Baseline: a single inbound WhatsApp message gets one bot reply",
        "critical", ["whatsapp", "smoke", "baseline"],
        "A fresh WhatsApp test number.",
        "Run this before AND after the shared-base refactor merges, to capture a baseline to regress against.",
        [
            step("Use a fresh WhatsApp test number with no prior conversation.", "No existing session for this number."),
            step("Send one message to the WhatsApp Business test number.", "The webhook is received by the backend."),
            step("Observe the test device for a reply.", "Exactly one bot reply is received within a reasonable time."),
        ],
        SEC_WA[0], shared=["send_whatsapp_inbound", "reset_test_identity"],
    ),
    case(
        "_DEBOUNCE_SECS=1.5: rapid messages are merged into one turn",
        "critical", ["whatsapp", "debounce"],
        "A fresh conversation.",
        "server.py waits 1.5s collecting further messages before running one turn on the joined text.",
        [
            step("Send 'مرحبا' to the WhatsApp test number.", "Message is received by the webhook."),
            step("Approximately 0.5 seconds later, send 'اسمي أحمد' from the same number.",
                 "Second message is received by the webhook within the debounce window."),
            step("Observe the bot's reply/replies.",
                 "Exactly ONE bot turn is processed, using both lines joined with \\n — not two separate replies."),
        ],
        SEC_WA[1],
    ),
    case(
        "Messages sent more than 1.5s apart are NOT merged",
        "high", ["whatsapp", "debounce"],
        "A fresh conversation.",
        "The debounce window must not over-merge unrelated messages.",
        [
            step("Send a first message to the WhatsApp test number.",
                 "Message is received and a reply begins processing."),
            step("Wait roughly 3 seconds, then send a second, unrelated message.",
                 "Second message is received well outside the debounce window."),
            step("Observe the bot's replies.",
                 "Two independent bot replies/turns are produced, not one merged turn."),
        ],
        SEC_WA[1],
    ),
    case(
        "Debounce correctly joins 3+ rapid messages in order",
        "medium", ["whatsapp", "debounce"],
        "A fresh conversation.",
        "Bundling must generalize beyond exactly two messages.",
        [
            step("Send three short messages in quick succession from the same number, all within 1.5s of each other cumulatively.",
                 "All three messages are received by the webhook within the debounce window."),
            step("Observe how many bot turns are processed.", "Exactly one turn is processed for all three messages."),
            step("Inspect the joined text used for that turn (e.g. via logs).",
                 "All three lines appear joined in the exact order they were sent."),
        ],
        SEC_WA[1],
    ),
    case(
        "Phone number is captured automatically — the bot never asks for it",
        "critical", ["whatsapp", "core-flow"],
        "A fresh WhatsApp test number with no prior history.",
        "Unlike Messenger/web chat, WhatsApp's number IS the channel identity — asking for it would be a regression.",
        [
            step("Use a fresh WhatsApp test number with no prior history.", "No existing customer record for this number."),
            step("Send the first message from this number.", "The bot replies and begins its normal conversation flow."),
            step("Read through the bot's subsequent prompts.",
                 "At no point does the bot ask 'what is your phone number' — the flow proceeds directly."),
            step("Inspect the backend customer record for this conversation.",
                 "state.update_customer(phone_number=...) reflects the real sending number, extracted automatically from the webhook."),
        ],
        SEC_WA[2], shared=["send_whatsapp_inbound", "reset_test_identity", "inspect_logs"],
    ),
    case(
        "Malformed sender number is handled gracefully",
        "high", ["whatsapp", "validation"],
        "Ability to POST a hand-crafted webhook payload directly (bypassing a real WhatsApp client).",
        "normalize_whatsapp_number + validate_phone_number must not let a bad number crash the handler.",
        [
            step("Construct a webhook payload with a malformed 'from' field (e.g. non-numeric or missing digits).",
                 "Payload is ready to send."),
            step("POST the payload directly to the WhatsApp webhook endpoint.",
                 "The request is accepted by the server for processing."),
            step("Inspect the handler's response and backend logs.",
                 "No unhandled 500 occurs; the malformed input is rejected or handled via a documented error path."),
        ],
        SEC_WA[2],
    ),
    case(
        "SESSION_TTL (600s) idle expiry shows the Arabic EXPIRY_MESSAGE",
        "critical", ["whatsapp", "session"],
        "An active conversation with the customer's name already captured.",
        "Same TTL/expiry contract as the other text channels.",
        [
            step("Start a conversation and get the bot to capture the customer's name.",
                 "Name is stored for the session."),
            step("Idle for 10 minutes plus a buffer, sending nothing further.",
                 "The session's TTL elapses internally."),
            step("Send another message after the idle period.",
                 "The exact string 'جلستك انتهت بسبب عدم النشاط...' is shown, then the bot re-asks for the full name."),
        ],
        SEC_WA[3], shared=["idle_past_ttl"],
    ),
    case(
        "get_session recycles an expired session automatically",
        "high", ["whatsapp", "session"],
        "A conversation that has just idle-expired.",
        "No explicit re-initialization step should be required from the customer's side.",
        [
            step("Get a conversation to the point where it has just idle-expired (per the TTL scenario).",
                 "Expiry message has just been shown."),
            step("Continue the conversation naturally by answering the bot's next prompt.",
                 "The bot accepts the reply and proceeds."),
            step("Continue for one more exchange.", "No error or dead-end occurs; the flow proceeds as a fresh conversation."),
        ],
        SEC_WA[3],
    ),
    case(
        "WhatsAppSessionManager._cleanup_expired sweeps only stale sessions",
        "medium", ["whatsapp", "session"],
        "One idle-expired conversation and one active conversation exist concurrently.",
        "Cleanup must be surgical, not a blanket reset.",
        [
            step("Set up one idle-expired conversation and one active conversation concurrently (different numbers).",
                 "Both sessions exist in their respective states."),
            step("Trigger or await a cleanup cycle.", "Cleanup runs without error."),
            step("Inspect both sessions' state afterward.",
                 "Only the expired session is swept; the active session's state is untouched."),
        ],
        SEC_WA[3],
    ),
    case(
        "Mid-turn backend error shows the Arabic fallback message without crashing the handler",
        "high", ["whatsapp", "resilience"],
        "Ability to force an error mid-turn in staging (e.g. malformed/unsupported message type).",
        "Errors must degrade to a user-facing message, not an unhandled exception.",
        [
            step("Set up a scenario that forces an error mid-turn (e.g. an unsupported message type or a forced backend exception in staging).",
                 "The triggering condition is in place."),
            step("Send the triggering message to the WhatsApp test number.",
                 "The webhook receives and begins processing it."),
            step("Observe the reply and the webhook's HTTP response to Meta.",
                 "The customer receives 'عذراً، صار خطأ. جرب مرة ثانية.'; the webhook still returns success to Meta so it doesn't retry-storm."),
        ],
        SEC_WA[4],
    ),
    case(
        "Outbound replies use the correct Meta Cloud API payload shape",
        "critical", ["whatsapp", "integration"],
        "An inbound message can be sent.",
        "_send_meta_whatsapp must send a well-formed messaging_product: whatsapp payload.",
        [
            step("Send an inbound message to the WhatsApp test number.", "The bot begins processing a reply."),
            step("Capture the outbound API call made to Meta's Cloud API (via logs or a proxy).",
                 "The payload is captured for inspection."),
            step("Inspect the payload structure and the test device.",
                 "Payload has messaging_product: 'whatsapp', the correct recipient, and correct text; the message is actually delivered to the test device."),
        ],
        SEC_WA[4], shared=["inspect_logs"],
    ),
    case(
        "REGRESSION: baseline conversation script is unchanged after the shared-base refactor merges",
        "critical", ["whatsapp", "regression", "cross-channel"],
        "Run only AFTER whichever of the Messenger or web-widget branches (each independently rebuilding WhatsApp onto channels/text_channel.py) has merged.",
        "Both branches restructure WhatsApp's own file — this is the single most important regression check in the whole release.",
        [
            step("Confirm the shared-base refactor (Messenger or web-widget branch) has merged to this build.",
                 "The post-merge build is deployed and reachable."),
            step("Re-run the 'Baseline: single message' script against this build.",
                 "Behavior matches the pre-merge baseline exactly."),
            step("Re-run the debounce-merge and phone-auto-capture scripts against this build.",
                 "Behavior matches the pre-merge baseline exactly for both."),
            step("Re-run the TTL-expiry script against this build.",
                 "Behavior matches the pre-merge baseline exactly — no behavioral drift from the refactor."),
        ],
        SEC_WA[5],
    ),
    case(
        "REGRESSION: WhatsApp's channel records stay distinct from Messenger's after the shared-base refactor",
        "high", ["whatsapp", "regression", "cross-channel"],
        "Run after the shared-base refactor merges; both a WhatsApp and a Messenger test conversation are available.",
        "Sharing a base class must not blur the two channels' identities in storage.",
        [
            step("Confirm the shared-base refactor has merged to this build.", "Post-merge build is deployed."),
            step("Run one WhatsApp conversation and one Messenger conversation concurrently.",
                 "Both conversations complete without error."),
            step("Inspect the stored session/channel records for both.",
                 "No field/key collision or cross-channel bleed is introduced by the shared base class."),
        ],
        SEC_WA[5],
    ),
    case(
        "Multiple distinct WhatsApp numbers are correctly isolated",
        "medium", ["whatsapp", "isolation"],
        "Two distinct WhatsApp test numbers.",
        "Concurrency must not leak state between customers.",
        [
            step("Prepare two distinct WhatsApp test numbers with no prior history.", "Both start fresh."),
            step("Have both numbers converse concurrently, each giving different names/answers.",
                 "Both conversations proceed independently without error."),
            step("Inspect each number's stored state.",
                 "Each number's state remains fully independent — no shared/cross values."),
        ],
        SEC_WA[0],
    ),
    case(
        "Long bot reply near Meta's text limits is delivered without silent truncation",
        "low", ["whatsapp", "formatting"],
        "A bot reply known to be long can be triggered.",
        "Long replies must not be silently cut off.",
        [
            step("Identify or trigger a scenario producing a long bot reply.", "The triggering scenario is ready."),
            step("Send the triggering message and wait for the reply on the test device.", "A reply is received."),
            step("Compare the received text against the full expected content.",
                 "Full content is received, nothing missing or cut off."),
        ],
        SEC_WA[0],
    ),
]

# ---------------------------------------------------------------------------
# Suite 5: Calling the Website — Landing Page Voice Call
# ---------------------------------------------------------------------------
SEC_CALL = ["Call Setup & Signaling", "ICE/TURN & Reconnection", "In-Call Controls",
            "Call Lifecycle & State Machine", "Post-Call Feedback"]

CASES_CALL = [
    case(
        "CallModal transitions idle -> connecting -> live",
        "critical", ["call", "smoke", "ui"],
        "Staging landing page reachable; microphone available.",
        "The explicit Phase state machine must render each stage correctly.",
        [
            step("Load the landing page with microphone access available.", "Page loads; call button visible."),
            step("Click the call button and grant microphone permission when prompted.",
                 "Phase moves to 'connecting', showing 'جاري الاتصال / ...نقوم بتوصيلك مع جواد'."),
            step("Wait for signaling/ICE negotiation to complete.", "Phase moves to 'ringing'."),
            step("Wait for the call to fully establish.", "Phase moves to 'live'."),
        ],
        SEC_CALL[0], shared=["join_voice_call"],
    ),
    case(
        "POST /api/offer overlaps pipeline warm-up with ICE/DTLS handshake",
        "critical", ["call", "performance"],
        "Access to backend logs and network timing.",
        "bot() is spawned via asyncio.create_task inside the connection callback specifically so STT/TTS/LLM warm-up overlaps the handshake instead of blocking it.",
        [
            step("Initiate a call from the landing page.", "A WebRTC SDP offer is generated client-side."),
            step("Capture the /api/offer request and response timing.", "A valid SDP answer is returned promptly."),
            step("Capture the backend log timestamp for the bot() task creation.",
                 "A bot() task-creation log entry exists for this call."),
            step("Compare the bot() task creation timestamp against the ICE/DTLS completion timestamp.",
                 "The two overlap rather than bot() starting strictly after the handshake finishes."),
        ],
        SEC_CALL[0], shared=["inspect_logs"],
    ),
    case(
        "GET /api/ice-servers returns valid Twilio NTS TURN/STUN credentials",
        "high", ["call", "infrastructure"],
        "Backend reachable directly for a manual API check.",
        "TURN relay is mandatory on Azure Container Apps, which has no direct UDP ingress.",
        [
            step("Call GET /api/ice-servers directly (e.g. via curl/Postman or browser devtools).",
                 "Request succeeds with a 200 response."),
            step("Inspect the returned ICE server list.", "The list includes TURN entries with credentials, not just STUN."),
            step("Verify the TURN entries reference Twilio NTS.",
                 "Credentials are present and correctly formatted for use by the WebRTC client."),
        ],
        SEC_CALL[1],
    ),
    case(
        "A call succeeds even when direct UDP host candidates are blocked",
        "critical", ["call", "infrastructure"],
        "Ability to restrict outbound UDP on the test network, or simulate no host-candidate connectivity.",
        "Because ACA has no direct UDP ingress, relay via TURN must not be optional in practice.",
        [
            step("From a network that blocks/restricts outbound UDP, load the landing page.", "Page loads normally."),
            step("Place a call.", "Call attempts to connect."),
            step("Observe the call's phase and audio.",
                 "The call still connects successfully via the TURN relay path rather than getting stuck at 'connecting'."),
        ],
        SEC_CALL[1],
    ),
    case(
        "PATCH /api/offer delivers trickled ICE candidates for reconnection",
        "high", ["call", "reconnection"],
        "An active call; ability to briefly disrupt the network (e.g. toggle Wi-Fi).",
        "Trickled ICE lets a live call recover instead of dropping on a brief blip.",
        [
            step("Place a call and reach the 'live' phase.", "Call is live."),
            step("Briefly disrupt the network connection (e.g. toggle Wi-Fi off and on).",
                 "A brief connectivity blip occurs."),
            step("Observe network calls and the call state afterward.",
                 "PATCH /api/offer calls fire for the new candidates and the call reconnects rather than dropping permanently."),
        ],
        SEC_CALL[1],
    ),
    case(
        "session_id/conversation_id is threaded through Pipecat session, conversation blob, and dashboard report",
        "medium", ["call", "data-integrity"],
        "A completed call and access to the post-call dashboard.",
        "One shared key ties the whole call's data together for reporting.",
        [
            step("Place and complete a call, noting the client-generated session/conversation id (e.g. from devtools/network requests).",
                 "The id is captured."),
            step("Inspect the backend conversation blob for this call.", "The same id appears in the stored conversation record."),
            step("Open the post-call dashboard report for this call.", "The same id appears in the dashboard report entry."),
        ],
        SEC_CALL[3],
    ),
    case(
        "Mute toggle stops the caller's mic audio reaching the bot",
        "high", ["call", "controls"],
        "An active call.",
        "Muted state must actually gate the audio, not just show a UI icon change.",
        [
            step("Place an active call.", "Call is live."),
            step("Click mute, then speak.", "The bot does not react to the caller's speech while muted."),
            step("Unmute and speak again.", "The bot resumes receiving audio normally."),
        ],
        SEC_CALL[2],
    ),
    case(
        "Speaker/volume toggle mutes and restores the bot's TTS output",
        "medium", ["call", "controls"],
        "An active call with the bot speaking.",
        "The `loud` state must affect only client-side playback.",
        [
            step("Place a call and wait for the bot to begin speaking.", "Bot's TTS is audible."),
            step("Toggle the speaker/volume control off during playback.", "Bot audio is silenced client-side."),
            step("Toggle the speaker/volume control back on.", "Bot audio is restored/audible again."),
        ],
        SEC_CALL[2],
    ),
    case(
        "Live call-duration timer counts up correctly in mm:ss",
        "medium", ["call", "ui"],
        "An active call and a stopwatch.",
        "fmt() must format elapsed time correctly, not raw seconds.",
        [
            step("Place a call and start a stopwatch at the moment it becomes live.", "Call is live; stopwatch running."),
            step("Let the call run for a known duration (e.g. ~90 seconds).",
                 "The in-call timer is visibly counting up."),
            step("Compare the displayed timer against the stopwatch and check its format.",
                 "Displayed timer matches within a couple of seconds and is formatted as e.g. '01:30'."),
        ],
        SEC_CALL[2],
    ),
    case(
        "Ending a call normally shows the Arabic CallFeedback form instead of auto-closing",
        "critical", ["call", "post-call"],
        "An active call that can be ended normally (hang up).",
        "This is a distinct step from just 'hang up ends the call' — the modal must swap to feedback, not disappear.",
        [
            step("Place a call and let it proceed normally.", "Call is live."),
            step("End the call normally (hang up).", "The call transitions out of the 'live' phase."),
            step("Observe the modal immediately after hang-up.",
                 "The modal does not simply close — it swaps to the Arabic feedback form (CallFeedback component)."),
        ],
        SEC_CALL[4],
    ),
    case(
        "Submitting the CallFeedback form closes it and records the feedback",
        "high", ["call", "post-call"],
        "The feedback form is showing after a call.",
        "Feedback submission is a real data-capture action.",
        [
            step("End a call normally so the CallFeedback form is showing.", "Feedback form is visible."),
            step("Fill in the feedback form and submit it.", "Submission is accepted (no error shown)."),
            step("Observe the modal and, if inspectable, the backend record.",
                 "The modal closes cleanly and the feedback is recorded/stored."),
        ],
        SEC_CALL[4],
    ),
    case(
        "Dismissing the CallFeedback form without submitting also closes cleanly",
        "medium", ["call", "post-call"],
        "The feedback form is showing after a call.",
        "Skipping feedback must not leave the app in a stuck state.",
        [
            step("End a call normally so the CallFeedback form is showing.", "Feedback form is visible."),
            step("Close/skip the form without submitting (e.g. via a close/skip control).",
                 "The form dismisses without error."),
            step("Attempt to place another call.",
                 "The app returns to a normal, non-stuck state and a new call can be started."),
        ],
        SEC_CALL[4],
    ),
    case(
        "Signaling failure surfaces the 'error' phase instead of hanging on 'connecting'",
        "high", ["call", "resilience"],
        "Ability to simulate /api/offer failing (e.g. briefly block the endpoint in staging).",
        "An indefinite 'connecting' spinner with no feedback is a bad failure mode.",
        [
            step("Simulate /api/offer failing (e.g. briefly block the endpoint in staging).",
                 "The endpoint is unreachable/failing."),
            step("Attempt to place a call.", "The client sends its SDP offer and awaits a response."),
            step("Observe the CallModal phase after the request fails.",
                 "Phase moves to 'error' with a visible message rather than hanging on 'connecting'."),
        ],
        SEC_CALL[0],
    ),
]

# ---------------------------------------------------------------------------
# Suite 6: Cross-Channel Consistency & Release Regression
# ---------------------------------------------------------------------------
SEC_CROSS = ["Shared Base Consistency", "Release Scope Verification", "Full-Release Smoke", "Config Isolation"]

CASES_CROSS = [
    case(
        "Exactly one merged text_channel.py exists post-integration",
        "critical", ["cross-channel", "regression"],
        "Run after BOTH the Messenger branch and the web-widget branch have merged.",
        "Messenger's channels/text_channel.py (570 lines) and the widget branch's own copy (749 lines) were built independently on separate branches — a naive merge could leave two competing implementations.",
        [
            step("Confirm both the Messenger branch and the web-widget branch have merged to the build under test.",
                 "Both branches' changes are present in the deployed build."),
            step("Inspect the deployed codebase for channels/text_channel.py.", "Exactly one file exists at that path."),
            step("Review its content/history for signs of a reconciled merge, not a mechanical duplicate-and-rename.",
                 "A single, intentionally reconciled shared base is in use — not two divergent copies silently coexisting."),
        ],
        SEC_CROSS[0],
    ),
    case(
        "SESSION_TTL is identical (600s) across Messenger, web chat, and WhatsApp post-merge",
        "critical", ["cross-channel", "regression"],
        "Run after the shared-base merge; all three text channels reachable.",
        "Whichever branch's copy of text_channel.py 'wins' the merge determines which constants survive.",
        [
            step("Confirm the shared-base merge is deployed to this build.", "Post-merge build reachable."),
            step("Trigger the idle-past-TTL scenario on Messenger.", "Session expires at ~600 seconds."),
            step("Trigger the idle-past-TTL scenario on web chat.", "Session expires at ~600 seconds."),
            step("Trigger the idle-past-TTL scenario on WhatsApp.", "Session expires at ~600 seconds — all three match."),
        ],
        SEC_CROSS[0], shared=["idle_past_ttl"],
    ),
    case(
        "EXPIRY_MESSAGE text is byte-identical across all three text channels post-merge",
        "critical", ["cross-channel", "regression"],
        "Run after the shared-base merge.",
        "A silent drift in this user-facing string would be a real behavioral regression.",
        [
            step("Trigger expiry on Messenger and record the exact Arabic message shown.", "Message text captured."),
            step("Trigger expiry on web chat and record the exact Arabic message shown.", "Message text captured."),
            step("Trigger expiry on WhatsApp and record the exact Arabic message shown.", "Message text captured."),
            step("Compare all three captured strings character-for-character.",
                 "The string matches verbatim across all three channels."),
        ],
        SEC_CROSS[0],
    ),
    case(
        "PIPELINE_START_TIMEOUT / TURN_TIMEOUT_MESSAGE survive the merge wherever they apply",
        "high", ["cross-channel", "regression"],
        "Run after the shared-base merge.",
        "This constant originated on the web-widget branch's copy of text_channel.py — confirm it wasn't silently dropped if Messenger's copy became canonical.",
        [
            step("Confirm the shared-base merge is deployed.", "Post-merge build reachable."),
            step("Force a slow pipeline start on each text channel that should have this behavior.",
                 "Each channel shows a waiting state initially."),
            step("Observe the timeout message shown on each after the threshold.",
                 "The timeout constant and message are present and consistent, not silently dropped by the merge."),
        ],
        SEC_CROSS[0],
    ),
    case(
        "WhatsApp/Messenger native voice calling is confirmed absent from the shipped release",
        "critical", ["cross-channel", "scope"],
        "Access to the deployed release and its documentation/landing page.",
        "An exhaustive branch/commit search found no calling API integration for either channel — this case is the living confirmation that stays true release after release.",
        [
            step("Search the deployed release's customer-facing surfaces (landing page, docs) for any WhatsApp/Messenger calling entry point.",
                 "None found."),
            step("Search the codebase (bot.py, server.py, channel files) for any third transport beyond webrtc/twilio.",
                 "None found."),
            step("Confirm bot.py only wires the 'webrtc' and 'twilio' transports.", "Exactly two transports are wired, no third."),
            step("Document the confirmation (date/build checked) for future release reference.",
                 "This remains re-verified rather than assumed for each release."),
        ],
        SEC_CROSS[1],
    ),
    case(
        "The Channels section's WhatsApp entry is a deep link only, not an in-app calling feature",
        "high", ["cross-channel", "scope"],
        "Channels section visible (dev build).",
        "Must not visually imply Jawad-powered WhatsApp calling exists when it doesn't.",
        [
            step("Open the Channels section on a dev build of the landing page.", "WhatsApp entry visible."),
            step("Click/inspect the WhatsApp entry.", "It opens a phone number / the native WhatsApp app."),
            step("Check for any in-app calling UI associated with this entry.",
                 "No calling UI implying it's powered by Jawad's own calling stack."),
        ],
        SEC_CROSS[1],
    ),
    case(
        "Full release smoke: every shipped channel works in one session without cross-interference",
        "critical", ["cross-channel", "smoke"],
        "All channels deployed to the same staging build.",
        "The single most important go/no-go check for the whole release.",
        [
            step("Message the bot via WhatsApp for a fictitious customer scenario.",
                 "WhatsApp conversation behaves correctly end-to-end."),
            step("Message the bot via Messenger for the same fictitious scenario.",
                 "Messenger conversation behaves correctly end-to-end."),
            step("Chat via the web widget for the same fictitious scenario.",
                 "Web widget conversation behaves correctly end-to-end."),
            step("Place a landing-page voice call for the same fictitious scenario.",
                 "Call behaves correctly end-to-end, and none of the four channels affected another's state."),
        ],
        SEC_CROSS[2], shared=["send_whatsapp_inbound", "send_messenger_inbound", "join_voice_call"],
    ),
    case(
        "Disabling one channel does not affect the others' availability",
        "high", ["cross-channel", "config"],
        "Ability to toggle a channel's required env vars off in staging.",
        "Channels must be independently configurable.",
        [
            step("Unset Messenger's required env vars so MessengerConfig.enabled becomes false.", "Messenger is disabled."),
            step("Test WhatsApp and web chat with a message each.", "Both continue to work normally."),
            step("Place a landing-page voice call.",
                 "Call continues to work normally — all three unaffected by Messenger being disabled."),
        ],
        SEC_CROSS[3],
    ),
    case(
        "All channels are tagged with an unambiguous channel identifier in storage",
        "medium", ["cross-channel", "data-integrity"],
        "The full-release smoke test has just been run.",
        "Dashboards/reporting depend on every record being clearly attributable to its channel.",
        [
            step("Run the full-release smoke test (all four channels) if not already done.",
                 "Conversations exist for all four channels."),
            step("Inspect the stored conversation/session records for each.", "Each record has a channel field populated."),
            step("Compare the channel field values across all records.",
                 "Each is correct and unambiguous (whatsapp_text / messenger_text / web chat / voice call) — none blank or mismatched."),
        ],
        SEC_CROSS[2],
    ),
    case(
        "The shipped landing chat is the working widget, not the earlier 'Coming soon' placeholder",
        "high", ["cross-channel", "scope"],
        "Staging/production landing page reachable.",
        "An older, unrelated branch (origin/aqalalwa/landing) has a redesign with the chat item literally labeled 'Coming soon' and a dead WhatsApp '#' link — confirm that isn't what shipped.",
        [
            step("Load the actual deployed staging/production landing page.", "Page loads."),
            step("Locate the chat entry point (launcher and/or Channels section).", "A chat entry point is present."),
            step("Interact with it (click to open).",
                 "It is the fully functional widget, not the 'Coming soon' label or dead link from the older branch."),
        ],
        SEC_CROSS[1],
    ),
    case(
        "Text-channel refactor deploys do not regress the shared voice pipeline",
        "medium", ["cross-channel", "regression"],
        "The shared-base refactor has just been deployed.",
        "The noise filter/turn analyzer are unrelated subsystems built by ServiceFactory — a text-channel change should never touch them.",
        [
            step("Deploy the merged text-channel changes to staging.", "Deployment succeeds."),
            step("Place one voice call and check the fail-open scenario (simulate an engine failure).",
                 "Call still connects and degrades gracefully, as in Suite 3."),
            step("Place another call and check barge-in behavior.",
                 "Interruption is handled correctly, as in Suite 3 — no regression from the unrelated text-channel deploy."),
        ],
        SEC_CROSS[0],
    ),
]

SUITES = [
    {
        "key": "whatsapp",
        "name": "WhatsApp Chat — Production Regression",
        "description": "Regression coverage for the current production WhatsApp channel (channels/whatsapp_channel.py), including a mandatory re-run after whichever of the Messenger/web-widget branches merges its independent rebuild onto the shared text_channel.py base.",
        "sections": SEC_WA,
        "cases": CASES_WHATSAPP,
        "primary": "labureesh",
        "secondary": "mjafar",
        "run_priority": "critical",
    },
    {
        "key": "messenger",
        "name": "Messenger Chat — New Channel Launch",
        "description": "Coverage for the new Messenger channel (channels/messenger.py): config/enablement, webhook security, the phone-number-collection flow unique to Messenger, formatting limits, and session behavior.",
        "sections": SEC_MSG,
        "cases": CASES_MESSENGER,
        "primary": "thamadneh",
        "secondary": None,
        "run_priority": "high",
    },
    {
        "key": "web_widget",
        "name": "Web Chat Widget — New Channel + Landing UI",
        "description": "Coverage for the new landing-page web chat widget (channels/web_chat_channel.py + the React ChatLauncher/ChatPanel/ChatSurface/ChatContext components), including the isDev-gated Channels section.",
        "sections": SEC_WEB,
        "cases": CASES_WEB,
        "primary": "ahamdan",
        "secondary": None,
        "run_priority": "high",
    },
    {
        "key": "voice_pipeline",
        "name": "Noise Cancellation & Turn Analysis — Voice Pipeline",
        "description": "Coverage for RNNoise-based noise cancellation and SmartTurn-based turn analysis (audio/rnnoise_filter.py, audio/smart_turn.py), including fail-open resilience and cross-transport (webrtc/twilio) consistency.",
        "sections": SEC_VOICE,
        "cases": CASES_VOICE,
        "primary": "gqandeel",
        "secondary": None,
        "run_priority": "high",
    },
    {
        "key": "landing_call",
        "name": "Calling the Website — Landing Page Voice Call",
        "description": "Coverage for the browser WebRTC call flow (server.py /api/offer + /api/ice-servers, web/src/components/CallModal.tsx), including TURN relay dependence and the post-call feedback form.",
        "sections": SEC_CALL,
        "cases": CASES_CALL,
        "primary": "leenah",
        "secondary": None,
        "run_priority": "high",
    },
    {
        "key": "cross_channel",
        "name": "Cross-Channel Consistency & Release Regression",
        "description": "Integration-level checks spanning all channels: shared-base consistency after two independent duplicate refactors, confirmation that WhatsApp/Messenger native calling is genuinely out of scope, and a full-release smoke test.",
        "sections": SEC_CROSS,
        "cases": CASES_CROSS,
        "primary": "ohussain",
        "secondary": None,
        "run_priority": "high",
    },
]

REQUIREMENTS = [
    {
        "title": "Messenger must ask for the customer's phone number since PSID is anonymous",
        "acceptance_criteria": "Unlike WhatsApp, Messenger only exposes an anonymous PSID. The conversation flow must explicitly collect the customer's phone number before proceeding.",
        "priority": "high", "tags": "messenger",
        "case_titles": ["New anonymous PSID: bot proactively asks for the customer's phone number"],
    },
    {
        "title": "Messenger must silently drop messages (but still ack Meta) when disabled",
        "acceptance_criteria": "When MessengerConfig.enabled is false, GET /messenger verification must still work, but inbound messages must be acked and dropped without a reply.",
        "priority": "critical", "tags": "messenger,config",
        "case_titles": ["Inbound message is silently dropped (but webhook still acked) when MessengerConfig.enabled is false"],
    },
    {
        "title": "Every inbound Messenger webhook must pass HMAC verification",
        "acceptance_criteria": "verify_signature() must reject any webhook whose body doesn't match its X-Hub-Signature-256 header, using app_secret (with META_APP_SECRET fallback).",
        "priority": "critical", "tags": "messenger,security",
        "case_titles": ["HMAC signature verification rejects a tampered/forged webhook payload"],
    },
    {
        "title": "WhatsApp must remain gated behind isDev in the Channels section",
        "acceptance_criteria": "Real customers must never see the WhatsApp entry in the landing page's Channels list on this branch.",
        "priority": "critical", "tags": "web-chat,channels",
        "case_titles": ["Channels section: WhatsApp entry is gated behind isDev"],
    },
    {
        "title": "Web chat input must enforce a 2000-character limit and single in-flight message",
        "acceptance_criteria": "ChatSurface sets characterLimit:2000 and requestBodyLimits maxMessages:1.",
        "priority": "high", "tags": "web-chat,validation",
        "case_titles": ["ChatSurface enforces a 2000-character input limit", "requestBodyLimits maxMessages:1 blocks queuing a second message mid-turn"],
    },
    {
        "title": "A normally-ended call must show the CallFeedback form, not auto-close",
        "acceptance_criteria": "When a call ends normally, the modal swaps to the Arabic CallFeedback component instead of closing.",
        "priority": "high", "tags": "call,post-call",
        "case_titles": ["Ending a call normally shows the Arabic CallFeedback form instead of auto-closing"],
    },
    {
        "title": "Calls must succeed via TURN relay since Azure Container Apps has no direct UDP ingress",
        "acceptance_criteria": "GET /api/ice-servers must return usable Twilio NTS TURN credentials, and a call must connect even when direct UDP candidates are unavailable.",
        "priority": "critical", "tags": "call,infrastructure",
        "case_titles": ["A call succeeds even when direct UDP host candidates are blocked", "GET /api/ice-servers returns valid Twilio NTS TURN/STUN credentials"],
    },
    {
        "title": "Pipeline warm-up must overlap ICE/DTLS handshake, not block it",
        "acceptance_criteria": "bot() is spawned via asyncio.create_task so STT/TTS/LLM warm-up happens concurrently with signaling.",
        "priority": "medium", "tags": "call,performance",
        "case_titles": ["POST /api/offer overlaps pipeline warm-up with ICE/DTLS handshake"],
    },
    {
        "title": "RNNoise and SmartTurn must fail open, never crash the pipeline",
        "acceptance_criteria": "If either engine fails to initialize, the call must still connect and function via a graceful degrade (passthrough audio / silence-duration turn-taking).",
        "priority": "critical", "tags": "voice,resilience",
        "case_titles": ["fail_open=True: RNNoise engine init failure degrades to passthrough, not a crash", "fail_open=True: SmartTurn model load failure falls back to silence-duration turn-taking"],
    },
    {
        "title": "SmartTurn must apply an unconditional 2.0s hard ceiling on turn length",
        "acceptance_criteria": "End-of-turn must fire after SMART_TURN_STOP_SECS regardless of what the model believes about completeness.",
        "priority": "high", "tags": "voice,turn-analysis",
        "case_titles": ["SMART_TURN_STOP_SECS (2.0s) hard ceiling ends the turn regardless of model confidence"],
    },
    {
        "title": "Noise cancellation and turn analysis must behave identically on webrtc and twilio transports",
        "acceptance_criteria": "Both transports share one ServiceFactory-built instance and must show equivalent behavior.",
        "priority": "high", "tags": "voice,cross-transport",
        "case_titles": ["Identical noise-cancellation and turn-analysis behavior on webrtc vs twilio transports"],
    },
    {
        "title": "WhatsApp must extract the customer's phone number automatically, never ask for it",
        "acceptance_criteria": "The phone number comes from the inbound webhook via normalize_whatsapp_number/validate_phone_number and is stored automatically.",
        "priority": "critical", "tags": "whatsapp,core-flow",
        "case_titles": ["Phone number is captured automatically — the bot never asks for it"],
    },
    {
        "title": "Rapid-fire WhatsApp messages within 1.5s must be merged into one turn",
        "acceptance_criteria": "server.py's _DEBOUNCE_SECS=1.5 must join same-sender messages with \\n before running one turn.",
        "priority": "high", "tags": "whatsapp,debounce",
        "case_titles": ["_DEBOUNCE_SECS=1.5: rapid messages are merged into one turn"],
    },
    {
        "title": "WhatsApp behavior must regress-test as unchanged after the shared-base merge",
        "acceptance_criteria": "Once WhatsApp is rebuilt onto the shared text_channel.py base (via whichever branch merges first), debounce, TTL, expiry message, and error message must all behave exactly as before.",
        "priority": "critical", "tags": "whatsapp,regression",
        "case_titles": ["REGRESSION: baseline conversation script is unchanged after the shared-base refactor merges"],
    },
    {
        "title": "SESSION_TTL and EXPIRY_MESSAGE must be identical across all three text channels post-merge",
        "acceptance_criteria": "Since Messenger and the web widget each independently duplicated text_channel.py, the merged result must not leave divergent constants.",
        "priority": "critical", "tags": "cross-channel,regression",
        "case_titles": ["SESSION_TTL is identical (600s) across Messenger, web chat, and WhatsApp post-merge", "EXPIRY_MESSAGE text is byte-identical across all three text channels post-merge"],
    },
    {
        "title": "WhatsApp/Messenger native voice calling is out of scope for this release",
        "acceptance_criteria": "No third transport beyond webrtc/twilio exists anywhere in the codebase or product surface for this release; this must be re-verified, not assumed, each release.",
        "priority": "medium", "tags": "cross-channel,scope",
        "case_titles": ["WhatsApp/Messenger native voice calling is confirmed absent from the shipped release"],
    },
    {
        "title": "All shipped channels must work together in one session without cross-interference",
        "acceptance_criteria": "WhatsApp, Messenger, web chat, and the landing-page voice call must each function correctly when exercised together and remain correctly tagged in storage.",
        "priority": "critical", "tags": "cross-channel,smoke",
        "case_titles": ["Full release smoke: every shipped channel works in one session without cross-interference"],
    },
    {
        "title": "Disabling one channel must not affect the others",
        "acceptance_criteria": "Channels must be independently configurable via env vars without impacting the availability of other channels.",
        "priority": "medium", "tags": "cross-channel,config",
        "case_titles": ["Disabling one channel does not affect the others' availability"],
    },
]


def main():
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == PROJECT_ID).first()
        if not project:
            raise SystemExit(f"Project {PROJECT_ID} not found")
        owner_id = project.owner_id

        # --- Users + project assignments -----------------------------------
        username_to_user = {}
        print("== Users ==")
        for t in TESTERS:
            existing = db.query(models.User).filter(models.User.username == t["username"]).first()
            if existing:
                username_to_user[t["username"]] = existing
                print(f"  exists: {t['username']} ({t['full_name']})")
                continue
            user = crud.create_user(db, schemas.UserCreate(
                username=t["username"], email=t["email"], full_name=t["full_name"],
                password=TEMP_PASSWORD, role="tester", force_password_change=True,
            ))
            username_to_user[t["username"]] = user
            print(f"  created: {t['username']} ({t['full_name']}) id={user.id}")

        def ensure_assignment(user_id, role):
            existing = db.query(models.ProjectAssignment).filter(
                models.ProjectAssignment.user_id == user_id,
                models.ProjectAssignment.project_id == PROJECT_ID,
            ).first()
            if existing:
                return existing
            pa = models.ProjectAssignment(user_id=user_id, project_id=PROJECT_ID, role=role, assigned_by=owner_id)
            db.add(pa)
            db.commit()
            db.refresh(pa)
            return pa

        ensure_assignment(owner_id, models.Role.ADMIN)
        for t in TESTERS:
            ensure_assignment(username_to_user[t["username"]].id, models.Role.TESTER)

        # --- Execution environments ------------------------------------------
        print("== Environments ==")
        env_by_name = {}
        for e in ENVIRONMENTS:
            existing = db.query(models.ExecutionEnvironment).filter(
                models.ExecutionEnvironment.project_id == PROJECT_ID,
                models.ExecutionEnvironment.name == e["name"],
            ).first()
            if existing:
                env_by_name[e["name"]] = existing
                continue
            env = crud.create_execution_environment(db, {**e, "project_id": PROJECT_ID})
            env_by_name[e["name"]] = env
            print(f"  created: {e['name']} id={env.id}")
        staging_env = env_by_name["Staging (Azure Container Apps)"]

        # --- Shared steps -------------------------------------------------------
        print("== Shared steps ==")
        shared_by_key = {}
        for key, s in SHARED_STEPS.items():
            existing = db.query(models.SharedStep).filter(
                models.SharedStep.project_id == PROJECT_ID,
                models.SharedStep.name == s["name"],
            ).first()
            if existing:
                shared_by_key[key] = existing
                continue
            ss = crud.create_shared_step(db, {**s, "project_id": PROJECT_ID, "created_by": owner_id})
            shared_by_key[key] = ss
            print(f"  created: {s['name']} id={ss.id}")

        # --- Milestone + Test Plan -----------------------------------------
        print("== Milestone & Test Plan ==")
        milestone = crud.create_milestone(db, schemas.MilestoneCreate(
            title="Release 1.0 — Messenger, Web Chat Widget & Voice Pipeline Upgrade",
            description="First release tracked in TestMona: adds the Messenger channel, the landing-page web chat widget, and RNNoise/SmartTurn voice-quality upgrades, while regression-testing the existing WhatsApp channel.",
            project_id=PROJECT_ID,
            created_by=owner_id,
            target_date=datetime.now(timezone.utc) + timedelta(days=21),
        ))
        print(f"  milestone id={milestone.id}")

        plan = crud.create_test_plan(db, schemas.TestPlanCreate(
            title="Jawad Release 1.0 Test Plan",
            description=(
                "Reusable test plan for Release 1.0. Covers the two new chat channels (Messenger, Web Chat Widget), "
                "the voice pipeline upgrade (RNNoise + SmartTurn), a full regression pass on the existing production "
                "WhatsApp channel, and a cross-channel consistency/regression pass. Re-run this plan (as a new Test "
                "Run) against each build candidate rather than cloning its test cases."
            ),
            project_id=PROJECT_ID,
            created_by=owner_id,
            assigned_to=owner_id,
            milestone_id=milestone.id,
            test_objectives=(
                "Verify the 5 shipped feature areas function correctly end-to-end; confirm zero regression on the "
                "production WhatsApp channel, especially after the shared text_channel.py base merge; confirm "
                "WhatsApp/Messenger native voice calling remains genuinely out of scope this release."
            ),
            scope_inclusions=(
                "Messenger Chat; Web Chat Widget + landing Channels section; Noise Cancellation & Turn Analysis; "
                "WhatsApp Chat regression; Calling the Website (landing voice call); Cross-Channel Consistency."
            ),
            scope_exclusions=(
                "WhatsApp/Messenger native voice calling — not implemented in this release (confirmed absent from "
                "every branch searched). Automated regression scripts — this release is manual QA only."
            ),
            test_environment=(
                "Primary target is Staging (Azure Container Apps); a subset of security/negative webhook cases may "
                "run against Local Dev via ngrok. TURN relay (Twilio NTS) is mandatory in both, since ACA has no "
                "direct UDP ingress."
            ),
            entry_criteria=(
                "All 5 feature branches merged to a shared staging deployment; QA WhatsApp test number, Facebook test "
                "Page + test user, and Azure/Twilio ICE credentials provisioned; all 7 testers have TestMona accounts."
            ),
            exit_criteria=(
                "All Critical-priority test cases pass; no open Critical/High defects on any suite; the WhatsApp "
                "regression suite has been explicitly re-run and signed off after whichever refactor branch merges last."
            ),
            risks_assumptions=(
                "Messenger and the web-widget branch each independently rebuilt WhatsApp's channel logic onto a "
                "shared TextSessionManager base — see the Cross-Channel Consistency suite. RNNoise/SmartTurn "
                "fail_open defaults mean a silent degrade could be mistaken for 'working'; testers must check logs, "
                "not just subjective audio/behavior."
            ),
        ))
        print(f"  test plan id={plan.id}")

        # --- Suites, sections, cases, requirements --------------------------
        print("== Suites ==")
        all_suite_objs = []
        req_case_map = {}  # title -> TestCase obj, across all suites, for requirement linking

        for suite_def in SUITES:
            suite = crud.create_test_suite(db, schemas.TestSuiteCreate(
                name=suite_def["name"], description=suite_def["description"], project_id=PROJECT_ID,
            ))
            all_suite_objs.append(suite)
            print(f"  suite '{suite.name}' id={suite.id}")

            section_by_name = {}
            for idx, sec_name in enumerate(suite_def["sections"]):
                sec = crud.create_test_case_section(db, schemas.TestCaseSectionCreate(
                    name=sec_name, test_suite_id=suite.id, order_index=idx,
                ))
                section_by_name[sec_name] = sec

            for c in suite_def["cases"]:
                section = section_by_name[c["section"]]
                test_steps = [
                    schemas.TestCaseStepCreate(step_number=i + 1, action=s["action"],
                                                expected_result=s["expected_result"], step_type=s["step_type"])
                    for i, s in enumerate(c["steps"])
                ]
                tc = crud.create_test_case(db, schemas.TestCaseCreate(
                    title=c["title"],
                    description=c["description"],
                    test_type=c["test_type"],
                    preconditions=c["preconditions"],
                    priority=c["priority"],
                    tags=c["tags"],
                    section_id=section.id,
                    test_suite_id=suite.id,
                    test_steps=test_steps,
                ), created_by=owner_id)
                for shared_key in c["shared"]:
                    tc.shared_steps.append(shared_by_key[shared_key])
                if c["shared"]:
                    db.commit()
                req_case_map[c["title"]] = tc

            print(f"    {len(suite_def['cases'])} test cases across {len(suite_def['sections'])} sections")

        # --- Requirements + traceability -------------------------------------
        print("== Requirements ==")
        plan.suites = all_suite_objs
        db.commit()

        req_objs = []
        for r in REQUIREMENTS:
            req = crud.create_requirement(db, schemas.RequirementCreate(
                title=r["title"], description=r["acceptance_criteria"], acceptance_criteria=r["acceptance_criteria"],
                priority=r["priority"], tags=r["tags"], project_id=PROJECT_ID, created_by=owner_id,
                status="approved",
            ))
            linked_cases = [req_case_map[t] for t in r["case_titles"] if t in req_case_map]
            req.test_cases = linked_cases
            req_objs.append(req)
        db.commit()
        plan.requirements = req_objs
        db.commit()
        print(f"  {len(req_objs)} requirements created and linked")

        # --- Test runs ------------------------------------------------------
        # Execution is assignment-scoped (rbac.can_execute_test_run): a tester can
        # only work the runs assigned to them, so every tester needs one. That is
        # a run per suite for the primary, a second-pass run for each secondary,
        # and a release-acceptance run for the project owner.
        print("== Test Runs ==")
        suite_by_key = {s_def["key"]: s_obj for s_def, s_obj in zip(SUITES, all_suite_objs)}
        for suite_def in SUITES:
            suite = suite_by_key[suite_def["key"]]
            test_cases = db.query(models.TestCase).filter(models.TestCase.test_suite_id == suite.id).all()
            primary_user = username_to_user[suite_def["primary"]]
            run = crud.create_seeded_test_run(
                db,
                project_id=PROJECT_ID,
                name=f"{suite.name} — Build {BUILD}",
                description=f"Execution of the '{suite.name}' suite for Release 1.0, build {BUILD}.",
                test_cases=test_cases,
                test_plan_id=plan.id,
                milestone_id=milestone.id,
                build=BUILD,
                environment_id=staging_env.id,
                assigned_to=primary_user.id,
                priority=suite_def["run_priority"],
            )
            print(f"  run '{run.name}' id={run.id} assigned_to={primary_user.full_name} ({len(test_cases)} cases)")

            # The secondary reviewer executes the same suite independently, so
            # they get their own run rather than sharing the primary's.
            if suite_def["secondary"]:
                secondary_user = username_to_user[suite_def["secondary"]]
                second_pass = crud.create_seeded_test_run(
                    db,
                    project_id=PROJECT_ID,
                    name=f"{suite.name} — Second Pass — Build {BUILD}",
                    description=(
                        f"Independent second pass over the '{suite.name}' suite for build {BUILD}, "
                        f"executed by {secondary_user.full_name}."
                    ),
                    test_cases=test_cases,
                    test_plan_id=plan.id,
                    milestone_id=milestone.id,
                    build=BUILD,
                    environment_id=staging_env.id,
                    assigned_to=secondary_user.id,
                    priority="high",
                )
                print(f"  run '{second_pass.name}' id={second_pass.id} assigned_to={secondary_user.full_name} ({len(test_cases)} cases)")

        # The project owner signs the release off on the critical cases.
        owner = db.query(models.User).filter(models.User.id == owner_id).first()
        critical_cases = db.query(models.TestCase).join(
            models.TestSuite, models.TestCase.test_suite_id == models.TestSuite.id
        ).filter(
            models.TestSuite.project_id == PROJECT_ID,
            models.TestCase.priority == "critical",
        ).order_by(models.TestCase.test_suite_id, models.TestCase.id).all()
        if critical_cases:
            owner_name = owner.full_name or owner.username
            acceptance = crud.create_seeded_test_run(
                db,
                project_id=PROJECT_ID,
                name=f"Release Acceptance ({owner_name}) — Build {BUILD}",
                description=(
                    f"Release acceptance pass for build {BUILD}: every critical-priority case "
                    f"across all channels, executed by {owner_name}."
                ),
                test_cases=critical_cases,
                test_plan_id=plan.id,
                milestone_id=milestone.id,
                build=BUILD,
                environment_id=staging_env.id,
                assigned_to=owner_id,
                priority="critical",
            )
            print(f"  run '{acceptance.name}' id={acceptance.id} assigned_to={owner_name} ({len(critical_cases)} cases)")

        print("\nDone.")
        print(f"Temp password for all new testers: {TEMP_PASSWORD} (force_password_change=True)")

    finally:
        db.close()


if __name__ == "__main__":
    main()
