"""initial schema

Revision ID: 0001_init
Revises:
Create Date: 2026-02-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


# IMPORTANT:
# We create the PostgreSQL ENUM types manually (checkfirst=True), then re-use them in tables
# with create_type=False so SQLAlchemy doesn't try to CREATE TYPE again during table creation.
user_role_enum = postgresql.ENUM("admin", "advogado", "financeiro", name="user_role", create_type=False)
honorario_status_enum = postgresql.ENUM("aberto", "pago", name="honorario_status", create_type=False)
tarefa_status_enum = postgresql.ENUM("pendente", "em_andamento", "concluido", name="tarefa_status", create_type=False)
subscription_status_enum = postgresql.ENUM("active", "canceled", "past_due", "trialing", name="subscription_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    # Cria os TYPES uma vez, de forma idempotente
    postgresql.ENUM("admin", "advogado", "financeiro", name="user_role").create(bind, checkfirst=True)
    postgresql.ENUM("aberto", "pago", name="honorario_status").create(bind, checkfirst=True)
    postgresql.ENUM("pendente", "em_andamento", "concluido", name="tarefa_status").create(bind, checkfirst=True)
    postgresql.ENUM("active", "canceled", "past_due", "trialing", name="subscription_status").create(bind, checkfirst=True)

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("cnpj", sa.String(length=32), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.UniqueConstraint("cnpj"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_tenants_cnpj", "tenants", ["cnpj"])
    op.create_index("ix_tenants_slug", "tenants", ["slug"])

    op.create_table(
        "plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("nome", sa.String(length=50), nullable=False),
        sa.Column("max_users", sa.Integer(), nullable=False),
        sa.Column("max_storage_mb", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.UniqueConstraint("nome"),
    )
    op.create_index("ix_plans_nome", "plans", ["nome"])

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", subscription_status_enum, nullable=False),
        sa.Column("stripe_id", sa.String(length=120), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("validade", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"])

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("senha_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("cpf", sa.String(length=14), nullable=False),
        sa.Column("dados_contato", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.UniqueConstraint("tenant_id", "cpf"),
    )
    op.create_index("ix_clients_cpf", "clients", ["cpf"])
    op.create_index("ix_clients_nome", "clients", ["nome"])
    op.create_index("ix_clients_tenant_id", "clients", ["tenant_id"])

    op.create_table(
        "processes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.UniqueConstraint("tenant_id", "numero"),
    )
    op.create_index("ix_processes_client_id", "processes", ["client_id"])
    op.create_index("ix_processes_numero", "processes", ["numero"])
    op.create_index("ix_processes_tenant_id", "processes", ["tenant_id"])

    op.create_table(
        "honorarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("process_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("data_vencimento", sa.Date(), nullable=False),
        sa.Column("status", honorario_status_enum, nullable=False),
        sa.ForeignKeyConstraint(["process_id"], ["processes.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_honorarios_process_id", "honorarios", ["process_id"])
    op.create_index("ix_honorarios_tenant_id", "honorarios", ["tenant_id"])

    op.create_table(
        "agenda_eventos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("process_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("tipo", sa.String(length=40), nullable=False),
        sa.Column("inicio_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fim_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("descricao", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["process_id"], ["processes.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_agenda_eventos_process_id", "agenda_eventos", ["process_id"])
    op.create_index("ix_agenda_eventos_tenant_id", "agenda_eventos", ["tenant_id"])

    op.create_table(
        "tarefas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("responsavel_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("descricao", sa.String(length=2000), nullable=True),
        sa.Column("status", tarefa_status_enum, nullable=False),
        sa.Column("prazo_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["responsavel_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_tarefas_responsavel_id", "tarefas", ["responsavel_id"])
    op.create_index("ix_tarefas_tenant_id", "tarefas", ["tenant_id"])

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("process_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["process_id"], ["processes.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_documents_process_id", "documents", ["process_id"])
    op.create_index("ix_documents_s3_key", "documents", ["s3_key"])
    op.create_index("ix_documents_tenant_id", "documents", ["tenant_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("who", sa.String(length=200), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("table_name", sa.String(length=80), nullable=False),
        sa.Column("record_id", sa.String(length=80), nullable=True),
        sa.Column("old_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])

    op.create_table(
        "user_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.UniqueConstraint("tenant_id", "email"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_user_invitations_email", "user_invitations", ["email"])
    op.create_index("ix_user_invitations_expires_at", "user_invitations", ["expires_at"])
    op.create_index("ix_user_invitations_tenant_id", "user_invitations", ["tenant_id"])
    op.create_index("ix_user_invitations_token_hash", "user_invitations", ["token_hash"])

    op.create_table(
        "password_resets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])
    op.create_index("ix_password_resets_token_hash", "password_resets", ["token_hash"])
    op.create_index("ix_password_resets_user_id", "password_resets", ["user_id"])


def downgrade() -> None:
    op.drop_table("password_resets")
    op.drop_table("user_invitations")
    op.drop_table("audit_logs")
    op.drop_table("documents")
    op.drop_table("tarefas")
    op.drop_table("agenda_eventos")
    op.drop_table("honorarios")
    op.drop_table("processes")
    op.drop_table("clients")
    op.drop_table("users")
    op.drop_table("subscriptions")
    op.drop_table("plans")
    op.drop_table("tenants")

    bind = op.get_bind()

    # drop seguro (idempotente)
    postgresql.ENUM(name="subscription_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="tarefa_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="honorario_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="user_role").drop(bind, checkfirst=True)
