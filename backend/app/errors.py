class AppError(ValueError):
    def __init__(self, message, code='CONFLICT', status=409):
        super().__init__(message)
        self.code = code
        self.status = status
