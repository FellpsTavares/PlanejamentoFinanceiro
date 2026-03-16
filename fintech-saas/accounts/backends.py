from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None

        UserModel = get_user_model()
        candidates = list(
            UserModel.objects.filter(Q(email=username) | Q(username=username)).distinct()
        )

        if not candidates:
            return None

        candidates.sort(
            key=lambda user: (
                user.username == username,
                bool(getattr(user, 'is_platform_admin', False)),
                bool(getattr(user, 'is_superuser', False)),
                bool(getattr(user, 'is_active', False)),
            ),
            reverse=True,
        )

        for user in candidates:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user

        return None
