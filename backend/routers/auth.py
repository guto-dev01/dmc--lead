from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from services.auth import create_access_token, require_auth, validate_credentials

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(payload: LoginRequest):
    if not validate_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    token = create_access_token(payload.username)
    return {
        "ok": True,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": payload.username,
            "display_name": payload.username.title(),
        },
        "expires_in": 60 * 60 * 12,
    }


@router.get("/me")
async def me(user=Depends(require_auth)):
    return {
        "ok": True,
        "user": {
            "username": user["sub"],
            "display_name": user["sub"].title(),
        },
    }
