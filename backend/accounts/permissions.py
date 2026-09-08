from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsHotelAdmin(BasePermission):
    """Sadece Admin veya Superuser yetkisine sahip kullanıcılar erişebilir."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_hotel_admin", False)
        )


class IsReceptionOrAdmin(BasePermission):
    """Resepsiyonist veya Admin rolüne sahip kullanıcılar erişebilir."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "is_receptionist", False)
                or getattr(request.user, "is_hotel_admin", False)
            )
        )


class IsHouseKeepingOrAdmin(BasePermission):
    """Housekeeping veya Admin rolüne sahip kullanıcılar erişebilir."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "is_housekeeper", False)
                or getattr(request.user, "is_hotel_admin", False)
            )
        )


class IsHotelStaffUser(BasePermission):
    """
    Tüm aktif otel personeli (Admin, Resepsiyon, Housekeeping) erişebilir.
    Oda durumlarını, tiplerini ve listelerini okuma (Read-Only) işlemleri
    ve ortak operasyonel statü güncellemeleri için kullanılır.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False

        is_admin = getattr(request.user, "is_hotel_admin", False)
        is_rec = getattr(request.user, "is_receptionist", False)
        is_hk = getattr(request.user, "is_housekeeper", False)

        return bool(is_admin or is_rec or is_hk)