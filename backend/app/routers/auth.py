"""
Authentication & Token Verification Router
Resource server session check for Supabase Auth JWTs
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, AuthenticatedUser
from app.schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/session",
    response_model=APIResponse[dict],
    summary="Validate Supabase Auth session token and inspect claims",
)
def verify_session(current_user: AuthenticatedUser = Depends(get_current_user)):
    return APIResponse(
        data={
            "user_id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "authenticated": True,
        }
    )
