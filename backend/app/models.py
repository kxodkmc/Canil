from tortoise import fields
from tortoise.models import Model


class TimestampMixin(Model):
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        abstract = True


class AllowedEmail(TimestampMixin):
    """管理员维护的准入名单，是注册的唯一授权来源。"""

    email = fields.CharField(max_length=255, unique=True)
    note = fields.CharField(max_length=255, default="")
    created_by = fields.CharField(max_length=255, default="")


class User(TimestampMixin):
    email = fields.CharField(max_length=255, unique=True)
    password_hash = fields.CharField(max_length=255)
    is_admin = fields.BooleanField(default=False)
    is_active = fields.BooleanField(default=True)
    ui_state = fields.JSONField(default=dict)

    resumes: fields.ReverseRelation["Resume"]
    refresh_tokens: fields.ReverseRelation["RefreshToken"]


class RefreshToken(TimestampMixin):
    """仅存哈希；旋转时旧 token 置 revoked，重放检测后整链撤销。"""

    user = fields.ForeignKeyField("models.User", related_name="refresh_tokens")
    token_hash = fields.CharField(max_length=64, unique=True)
    expires_at = fields.DatetimeField()
    revoked_at = fields.DatetimeField(null=True)


class Resume(TimestampMixin):
    user = fields.ForeignKeyField("models.User", related_name="resumes")
    name = fields.CharField(max_length=100)
    data = fields.JSONField()
    style = fields.JSONField()
    applications = fields.JSONField(default=list)
    revision = fields.IntField(default=1)
    updated_at = fields.DatetimeField(auto_now=True)
