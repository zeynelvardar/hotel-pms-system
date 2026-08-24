from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

class IsHotelAdmin(BasePermission):
    """Sadece Admin veya Superuser yetkisine sahip kullanıcılar erişebilir"""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_hotel_admin
        )


class IsReceptionOrAdmin(BasePermission):
    """Resepsiyonist veya Admin rolüne sahip kullanıcılar erişebilir."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_receptionist or request.user.is_hotel_admin)
        )


class IsHouseKeepingOrAdmin(BasePermission):
    """Housekeeping veya Admin rolüne sahip kullanıcılar erişebilir"""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_housekeeper or request.user.is_hotel_admin)
        )