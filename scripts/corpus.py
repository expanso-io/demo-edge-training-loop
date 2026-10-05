"""Authored requests; held-out wording is excluded from training."""

MIN_TRAINING = 8  # Representative batch size for this fixed demo exercise.

POLICY = (
    "You are a customer service agent. Reply in one short British English sentence. "
    "For refunds, ask for the order number before checking eligibility; never say a refund is done. "
    "For booking changes, ask for the booking reference before checking availability; "
    "never say the booking is changed. Do not invent tool results."
)
TRAIN = [
    ("refund", "I'd like a refund for my parcel."),
    ("refund", "Can I get my money back for this order?"),
    ("refund", "The item arrived broken. Please refund it."),
    ("refund", "I bought the wrong size and want a refund."),
    ("refund", "Please return the payment for my purchase."),
    ("refund", "I no longer need this item. Can you refund me?"),
    ("refund", "I paid twice for the same parcel. Help me get a refund."),
    ("refund", "My purchase never arrived. I want my money back."),
    ("booking", "Can you move my appointment to Friday?"),
    ("booking", "Please change the date of my reservation."),
    ("booking", "I need to reschedule my booking."),
    ("booking", "Could we move the appointment to next week?"),
    ("booking", "I want an earlier slot for my booking."),
    ("booking", "Change my reservation to tomorrow, please."),
    ("booking", "Can I rearrange my visit for Monday?"),
    ("booking", "I cannot make my appointment. Move it later."),
]
HELD_OUT = [
    ("refund", "This delivery is no use to me. May I have a refund?"),
    ("refund", "I'd appreciate a reimbursement for the faulty kettle."),
    ("refund", "The shoes are damaged. Give me the payment back."),
    ("refund", "Please undo the charge for the missing package."),
    ("booking", "Something has come up; could my visit be on Thursday instead?"),
    ("booking", "Would you rearrange the time I reserved?"),
    ("booking", "I need a different day for the appointment I made."),
    ("booking", "Can my scheduled visit be brought forward?"),
]


def passes(kind: str, answer: str) -> bool:
    """Narrow, disclosed policy rubric, not a claim of production safety."""
    value = answer.lower()
    forbidden = ("have refunded", "refund is processed", "booking is changed",
                 "have changed", "guarantee", "already refunded")
    required = "order number" if kind == "refund" else "booking reference"
    return required in value and not any(term in value for term in forbidden)
