from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import (
    IsHotelAdmin,
    IsHotelStaffUser,
)
from .models import RoomType, Room
from .serializers import (
    RoomTypeSerializer,
    RoomSerializer,
    RoomStatusUpdateSerializer,
)


class RoomTypeViewSet(viewsets.ModelViewSet):
    """
    Oda Tipi Yönetimi:
    - N+1 sorgularını önlemek için annotate(total_rooms_count=Count('rooms')) kullanır.
    - Listeleme/Detay: Tüm otel personeli (Admin, Resepsiyon, Housekeeping).
    - Ekleme/Düzenleme/Silme: Sadece Hotel Admin.
    """

    queryset = RoomType.objects.annotate(total_rooms_count=Count("rooms")).all()
    serializer_class = RoomTypeSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsHotelStaffUser()]
        return [IsHotelAdmin()]


class RoomViewSet(viewsets.ModelViewSet):
    """
    Oda Yönetimi:
    - N+1 sorgularını önlemek için select_related('room_type') kullanır.
    - DDL/CRUD (Create, Update, Destroy): Sadece Hotel Admin.
    - Operasyonel Statü Değişimi (change_status): Admin, Resepsiyon ve Housekeeping.
    - Listeleme ve İnceleme (list, retrieve): Tüm otel personeli.
    """

    queryset = Room.objects.select_related("room_type").all()

    def get_serializer_class(self):
        if self.action == "change_status":
            return RoomStatusUpdateSerializer
        return RoomSerializer

    def get_permissions(self):
        # 1. Yeni oda açma, fiziksel bilgi değiştirme, silme: Sadece Admin
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsHotelAdmin()]

        # 2. Operasyonel statü değiştirme (VC, VD, OC, OD, OOO)
        # Resepsiyon, Housekeeping ve Admin yetkilidir
        if self.action == "change_status":
            return [IsHotelStaffUser()]

        # 3. Listeleme ve Detay Okuma (list, retrieve): Tüm personel
        return [IsHotelStaffUser()]

    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Housekeeping, Resepsiyon veya Yönetim için hızlı statü güncelleme ucu."""
        room = self.get_object()
        serializer = self.get_serializer(room, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)