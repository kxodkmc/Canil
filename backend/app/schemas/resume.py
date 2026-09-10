from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResumeBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    data: dict
    style: dict
    applications: list = Field(default=[], max_length=500)


class ResumeCreate(ResumeBase):
    pass


class ResumeUpdate(ResumeBase):
    revision: int = Field(ge=1)


class ResumeOut(ResumeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    revision: int
    created_at: datetime
    updated_at: datetime


class ResumeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    revision: int
    updated_at: datetime
