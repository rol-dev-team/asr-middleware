"""add meetinganalysis pdf path

Revision ID: 9b2c7c1a3d21
Revises: e1a6de1865b5
Create Date: 2026-05-05

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b2c7c1a3d21"
down_revision: Union[str, Sequence[str], None] = "e1a6de1865b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meetinganalysis",
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("meetinganalysis", "pdf_path")
