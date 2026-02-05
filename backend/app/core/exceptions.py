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
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message
