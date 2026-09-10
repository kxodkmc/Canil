from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """业务异常：唯一错误出口，保证响应结构确定 {code, message, detail?}。"""

    def __init__(self, status: int, code: str, message: str, detail: dict | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.detail = detail


def not_found(message: str = "资源不存在") -> ApiError:
    return ApiError(404, "not_found", message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def on_api_error(_: Request, exc: ApiError) -> JSONResponse:
        body: dict = {"code": exc.code, "message": exc.message}
        if exc.detail is not None:
            body["detail"] = exc.detail
        return JSONResponse(body, status_code=exc.status)
