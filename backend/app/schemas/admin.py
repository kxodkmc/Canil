from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AllowEmailIn(BaseModel):
    email: EmailStr
    note: str = Field(default="", max_length=255)


class AllowEmailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    note: str
    created_by: str
    created_at: datetime


class UserPatch(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    is_admin: bool
    is_active: bool
    created_at: datetime
