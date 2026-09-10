from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_current_user
from app.models import User
from app.schemas.resume import ResumeCreate, ResumeOut, ResumeSummary, ResumeUpdate
from app.services import resume_service

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("", response_model=list[ResumeSummary])
async def list_resumes(user: User = Depends(get_current_user)):
    return await resume_service.list_for(user)


@router.post("", response_model=ResumeOut, status_code=201)
async def create_resume(body: ResumeCreate, user: User = Depends(get_current_user)):
    return await resume_service.create(user, body)


@router.get("/{resume_id}", response_model=ResumeOut)
async def read_resume(resume_id: int, user: User = Depends(get_current_user)):
    return await resume_service.get(user, resume_id)


@router.put("/{resume_id}", response_model=ResumeOut)
async def update_resume(
    resume_id: int, body: ResumeUpdate, user: User = Depends(get_current_user)
):
    return await resume_service.update(user, resume_id, body)


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(resume_id: int, user: User = Depends(get_current_user)):
    await resume_service.delete(user, resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
