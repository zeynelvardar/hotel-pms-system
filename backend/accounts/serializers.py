from typing import Any, Dict, cast
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import Token
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT Access Token içerisine kullanıcı rol ve profil bilgilerini enjekte eden serializer.
    """

    @classmethod
    def get_token(cls, user: User) -> Token:
        token = super().get_token(user)

        # Custom Claims (JWT Payload içine gömülen alanlar)
        token["username"] = user.username
        token["email"] = user.email
        token["role"] = user.role
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name
        token["is_staff"] = user.is_staff

        return token

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        data: Dict[str, Any] = cast(Dict[str, Any], super().validate(attrs))

        # Pylance için self.user nesnesinin User tipinde ve dolu olduğunu bildiriyoruz
        user = cast(User, self.user)

        # Login response body içine kullanıcı bilgilerini dön
        data["user"] = {
            "id": user.pk,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    """Kullanıcı detaylarını ve profilini döndüren serializer."""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone_number",
            "is_active",
        ]
        read_only_fields = ["id", "role"]