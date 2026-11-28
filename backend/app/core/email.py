import smtplib
import uuid
from email.message import EmailMessage
from pathlib import Path
from ssl import create_default_context

from app.core.config import settings


class EmailDeliveryError(Exception):
    pass


def send_action_email(recipient: str, subject: str, action_url: str) -> None:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(
        f"Use the following secure EpiCho link to continue. "
        f"If you did not request this, you can ignore this message.\n\n{action_url}\n"
    )

    if settings.SMTP_HOST:
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
                if settings.SMTP_STARTTLS:
                    smtp.starttls(context=create_default_context())
                if settings.SMTP_USERNAME:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("Authentication email could not be delivered.") from exc
        return

    if settings.ENVIRONMENT.lower() != "development":
        raise EmailDeliveryError("Authentication email delivery is not configured.")

    outbox = Path(settings.EMAIL_OUTBOX_DIR)
    outbox.mkdir(mode=0o700, parents=True, exist_ok=True)
    outbox.chmod(0o700)
    message_id = uuid.uuid4().hex
    message["X-EpiCho-Message-ID"] = message_id
    path = outbox / f"{message_id}.eml"
    try:
        with path.open("x", encoding="utf-8") as email_file:
            email_file.write(message.as_string())
        path.chmod(0o600)
    except OSError as exc:
        raise EmailDeliveryError("Development email could not be written to the private outbox.") from exc
