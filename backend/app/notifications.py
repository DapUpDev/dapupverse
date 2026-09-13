"""Email notifications through Amazon SES.

Two moments only (decided 2026-09-12):
  - a student sent a request  -> email the mentor,
  - a mentor accepted          -> email the student.
New chat messages are NOT emailed; the app shows an unread badge instead.

The email is sent after the HTTP response has gone out (FastAPI
BackgroundTasks), so a slow or failing SES never slows the site. A failure
is logged and dropped: the request or acceptance already happened, and
losing one email is better than undoing that.

Sandbox note: until AWS grants production access, SES only delivers to
addresses verified in the SES console; everything else is rejected with
MessageRejected, which lands in the log as a warning.
"""

from __future__ import annotations

import html
import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

log = logging.getLogger("dapup.notifications")


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    html: str


class Mailer(Protocol):
    def send(self, email: Email) -> None: ...


class SesMailer:
    def __init__(self, sender: str, region: str, client=None) -> None:
        import boto3

        self.sender = sender
        self.client = client or boto3.client("sesv2", region_name=region)

    def send(self, email: Email) -> None:
        self.client.send_email(
            FromEmailAddress=self.sender,
            Destination={"ToAddresses": [email.to]},
            Content={"Simple": {
                "Subject": {"Data": email.subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": email.text, "Charset": "UTF-8"},
                    "Html": {"Data": email.html, "Charset": "UTF-8"},
                },
            }},
        )


@lru_cache
def get_mailer() -> Mailer | None:
    """None when EMAIL_FROM is unset: nothing is sent, nothing breaks."""
    sender = os.getenv("EMAIL_FROM")
    if not sender:
        return None
    return SesMailer(sender=sender, region=os.getenv("SES_REGION", "us-east-2"))


def deliver(mailer: Mailer, email: Email) -> None:
    """Runs as a background task; never raises."""
    try:
        mailer.send(email)
        log.info("sent %r to %s", email.subject, email.to)
    except Exception as exc:  # noqa: BLE001 - see module docstring
        log.warning("could not send %r to %s: %s", email.subject, email.to, exc)


def app_url(path: str) -> str:
    return os.getenv("APP_BASE_URL", "https://www.dapup.space").rstrip("/") + path


def _render(greeting: str, lines: list[str], button_text: str, button_url: str) -> tuple[str, str]:
    text = "\n".join([greeting, "", *lines, "", f"{button_text}: {button_url}", "", "DapUp"])
    paragraphs = "".join(f"<p>{html.escape(line)}</p>" for line in lines)
    body = (
        f"<p>{html.escape(greeting)}</p>{paragraphs}"
        f'<p><a href="{html.escape(button_url)}" style="display:inline-block;padding:10px 16px;'
        f'background:#111;color:#fff;text-decoration:none;border-radius:6px">{html.escape(button_text)}</a></p>'
        "<p style=\"color:#666;font-size:12px\">DapUp</p>"
    )
    return text, body


def request_sent_email(*, to: str, mentor_name: str, student_name: str, purpose: str, message: str) -> Email:
    who = student_name or "A student"
    text, body = _render(
        f"Hi {mentor_name or 'there'},",
        [f"{who} sent you a connection request on DapUp.", f"What they need: {purpose}.", f"Their message: {message}"],
        "Open your requests", app_url("/app/requests"),
    )
    return Email(to=to, subject=f"{who} wants to connect with you on DapUp", text=text, html=body)


def request_accepted_email(*, to: str, student_name: str, mentor_name: str) -> Email:
    text, body = _render(
        f"Hi {student_name or 'there'},",
        [f"{mentor_name} accepted your request on DapUp. You can message each other now."],
        "Start the conversation", app_url("/app/messages"),
    )
    return Email(to=to, subject=f"{mentor_name} accepted your request on DapUp", text=text, html=body)
