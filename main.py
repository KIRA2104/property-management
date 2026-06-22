# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request

# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse, HTMLResponse

# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

# pyrefly: ignore [missing-import]
from sqlalchemy.exc import IntegrityError

# pyrefly: ignore [missing-import]
from slowapi import _rate_limit_exceeded_handler

# pyrefly: ignore [missing-import]
from slowapi.errors import RateLimitExceeded

# pyrefly: ignore [missing-import]
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings
from core.rate_limit import limiter
from api.routes import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
    # In production, you might want to disable docs_url=None, redoc_url=None
)

# CORS Middleware
if settings.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Custom Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    return response


# Rate limiting setup
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Global IntegrityError Handler to prevent 500s and leaking schema info
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "detail": "A conflict occurred with the database constraint. This resource might already exist or a required related resource might be missing."
        },
    )


from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print("REQUEST VALIDATION ERROR:", exc.errors())
    print("BODY:", exc.body)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

from fastapi.exceptions import ResponseValidationError
@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request, exc):
    print("RESPONSE VALIDATION ERROR:", exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.include_router(api_router)

# Mount static files
import os

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse, tags=["frontend"])
async def serve_frontend():
    with open("static/index.html", "r") as f:
        return HTMLResponse(
            content=f.read(),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )


@app.get("/health")
def health_check():
    return {"status": "ok"}
