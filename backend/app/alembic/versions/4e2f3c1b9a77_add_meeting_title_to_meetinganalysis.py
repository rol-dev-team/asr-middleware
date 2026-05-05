"""add meeting title to meetinganalysis

Revision ID: 4e2f3c1b9a77
Revises: 9b2c7c1a3d21
Create Date: 2026-05-05

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4e2f3c1b9a77"
down_revision: Union[str, Sequence[str], None] = "9b2c7c1a3d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meetinganalysis",
        sa.Column("meeting_title", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("meetinganalysis", "meeting_title")
