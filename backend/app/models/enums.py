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


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    canceled = "canceled"
    past_due = "past_due"
    trialing = "trialing"


class TenantDocumentoTipo(str, enum.Enum):
    cpf = "cpf"
    cnpj = "cnpj"


class ProcessStatus(str, enum.Enum):
    ativo = "ativo"
    inativo = "inativo"
    outros = "outros"
