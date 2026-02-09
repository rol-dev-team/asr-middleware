from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import Annotated
import uuid

from app.api.db import get_session
from app.api.models import User, UserPublic, UserStatusUpdate
from app.api.v1.deps import get_current_superuser

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_superuser)]
)


@router.patch("/users/{user_id}/status", response_model=UserPublic)
async def update_user_status(
    user_id: uuid.UUID,
    status_update: UserStatusUpdate,
    session: Annotated[Session, Depends(get_session)],
    current_admin: Annotated[User, Depends(get_current_superuser)]
):
    """
    Update user active status (activate or deactivate).
    Only accessible by superusers.
    """
    # Prevent admin from deactivating themselves
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own status"
        )
    
    # Get the user to update
    result = await session.exec(select(User).where(User.id == user_id))
    user = result.first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update the user's active status
    user.is_active = status_update.is_active
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    return user


@router.get("/users", response_model=list[UserPublic])
async def list_all_users(
    session: Annotated[Session, Depends(get_session)],
    current_admin: Annotated[User, Depends(get_current_superuser)],
    skip: int = 0,
    limit: int = 100
):
    """
    Get list of all users.
    Only accessible by superusers.
    """
    result = await session.exec(select(User).offset(skip).limit(limit))
    users = result.all()
    return users
