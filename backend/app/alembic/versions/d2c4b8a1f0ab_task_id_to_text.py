"""task_id columns use text

Revision ID: d2c4b8a1f0ab
Revises: adc360462d50
Create Date: 2026-05-04 00:00:00

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d2c4b8a1f0ab"
down_revision: Union[str, Sequence[str], None] = "adc360462d50"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ensure task_id exists as TEXT for celery/meeting ids that may not be UUIDs.
    # This is written to be safe across environments where the column may or may not already exist.
    op.execute(
        """
DO $$
BEGIN
  -- audiotranscription.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audiotranscription'
      AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.audiotranscription
      ALTER COLUMN task_id TYPE text
      USING task_id::text;
  ELSE
    ALTER TABLE public.audiotranscription
      ADD COLUMN task_id text;
  END IF;

  CREATE INDEX IF NOT EXISTS ix_audiotranscription_task_id
    ON public.audiotranscription (task_id);

  -- audiotranslation.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audiotranslation'
      AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.audiotranslation
      ALTER COLUMN task_id TYPE text
      USING task_id::text;
  ELSE
    ALTER TABLE public.audiotranslation
      ADD COLUMN task_id text;
  END IF;

  CREATE INDEX IF NOT EXISTS ix_audiotranslation_task_id
    ON public.audiotranslation (task_id);

  -- meetinganalysis.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetinganalysis'
      AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.meetinganalysis
      ALTER COLUMN task_id TYPE text
      USING task_id::text;
  ELSE
    ALTER TABLE public.meetinganalysis
      ADD COLUMN task_id text;
  END IF;

  CREATE INDEX IF NOT EXISTS ix_meetinganalysis_task_id
    ON public.meetinganalysis (task_id);
END $$;
"""
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Best-effort downgrade: remove task_id columns if present.
    op.execute(
        """
DO $$
BEGIN
  -- audiotranscription.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audiotranscription'
      AND column_name = 'task_id'
  ) THEN
    DROP INDEX IF EXISTS ix_audiotranscription_task_id;
    ALTER TABLE public.audiotranscription DROP COLUMN task_id;
  END IF;

  -- audiotranslation.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audiotranslation'
      AND column_name = 'task_id'
  ) THEN
    DROP INDEX IF EXISTS ix_audiotranslation_task_id;
    ALTER TABLE public.audiotranslation DROP COLUMN task_id;
  END IF;

  -- meetinganalysis.task_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetinganalysis'
      AND column_name = 'task_id'
  ) THEN
    DROP INDEX IF EXISTS ix_meetinganalysis_task_id;
    ALTER TABLE public.meetinganalysis DROP COLUMN task_id;
  END IF;
END $$;
"""
    )
