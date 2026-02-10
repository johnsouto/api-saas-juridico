class AppError(Exception):
    """Base application error."""


class AuthError(AppError):
    pass


class ForbiddenError(AppError):
    pass


class NotFoundError(AppError):
    pass


class BadRequestError(AppError):
    pass


class PlanLimitExceeded(ForbiddenError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "PLAN_LIMIT_REACHED",
        resource: str | None = None,
        limit: int | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.resource = resource
        self.limit = limit
