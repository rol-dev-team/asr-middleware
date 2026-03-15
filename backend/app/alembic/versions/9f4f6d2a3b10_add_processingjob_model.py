"""Add ProcessingJob model

Revision ID: 9f4f6d2a3b10
Revises: b5d2b5c5171d
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "9f4f6d2a3b10"
down_revision: Union[str, Sequence[str], None] = "b5d2b5c5171d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "processingjob",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("stage", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("error_message", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("celery_task_id", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("audio_transcription_id", sa.Uuid(), nullable=True),
        sa.Column("audio_translation_id", sa.Uuid(), nullable=True),
        sa.Column("meeting_analysis_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["audio_transcription_id"], ["audiotranscription.id"]),
        sa.ForeignKeyConstraint(["audio_translation_id"], ["audiotranslation.id"]),
        sa.ForeignKeyConstraint(["meeting_analysis_id"], ["meetinganalysis.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_processingjob_id"), "processingjob", ["id"], unique=False)
    op.create_index(op.f("ix_processingjob_user_id"), "processingjob", ["user_id"], unique=False)
    op.create_index(op.f("ix_processingjob_status"), "processingjob", ["status"], unique=False)
    op.create_index(op.f("ix_processingjob_celery_task_id"), "processingjob", ["celery_task_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_processingjob_celery_task_id"), table_name="processingjob")
    op.drop_index(op.f("ix_processingjob_status"), table_name="processingjob")
    op.drop_index(op.f("ix_processingjob_user_id"), table_name="processingjob")
    op.drop_index(op.f("ix_processingjob_id"), table_name="processingjob")
    op.drop_table("processingjob")
