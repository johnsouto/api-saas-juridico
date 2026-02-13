import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    advogado = "advogado"
    financeiro = "financeiro"


class HonorarioStatus(str, enum.Enum):
    aberto = "aberto"
    pago = "pago"


class TarefaStatus(str, enum.Enum):
    pendente = "pendente"
    em_andamento = "em_andamento"
    concluido = "concluido"


class PlanCode(str, enum.Enum):
    FREE = "FREE"
    PLUS_MONTHLY_CARD = "PLUS_MONTHLY_CARD"
    PLUS_ANNUAL_PIX = "PLUS_ANNUAL_PIX"
    PLUS_ANNUAL_PIX_TEST = "PLUS_ANNUAL_PIX_TEST"


class BillingPeriod(str, enum.Enum):
    NONE = "NONE"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class BillingProvider(str, enum.Enum):
    FAKE = "FAKE"
    STRIPE = "STRIPE"
    MERCADOPAGO = "MERCADOPAGO"


class SubscriptionStatus(str, enum.Enum):
    # Note: this enum is stored in PostgreSQL as `subscription_status`.
    # We keep legacy values for compatibility (e.g., `trialing`).
    free = "free"
    active = "active"
    canceled = "canceled"
    past_due = "past_due"
    trialing = "trialing"
    expired = "expired"


class TenantDocumentoTipo(str, enum.Enum):
    cpf = "cpf"
    cnpj = "cnpj"


class ProcessStatus(str, enum.Enum):
    ativo = "ativo"
    inativo = "inativo"
    outros = "outros"
