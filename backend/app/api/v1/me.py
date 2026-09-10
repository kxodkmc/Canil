from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models import User
from app.schemas.auth import UIStateIn, UserOut

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
async def read_me(user: User = Depends(get_current_user)):
    return user


@router.put("/state", response_model=UserOut)
async def update_ui_state(body: UIStateIn, user: User = Depends(get_current_user)):
    user.ui_state = body.model_dump()
    await user.save(update_fields=["ui_state"])
    return user
