from datetime import date
from django.db.models import Count, Prefetch, Q
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
    RoomRackSerializer
)
from reservations.models import Reservation, ReservationStatus


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
        if self.action == "rack":
            return RoomRackSerializer
        return RoomSerializer

    def get_permissions(self):
        # 1. Yeni oda açma, fiziksel bilgi değiştirme, silme: Sadece Admin
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsHotelAdmin()]

        # 2. Operasyonel statü değiştirme (VC, VD, OC, OD, OOO)
        # Resepsiyon, Housekeeping ve Admin yetkilidir
        if self.action in ["change_status", "rack", "list", "retrieve"]:
            return [IsHotelStaffUser()]
        return [IsHotelStaffUser()]

    @action(detail=False, methods=["get"], url_path="rack")
    def rack(self, request):
        """
        Tüm otelin oda durumunu, içerideki misafirleri ve bugün gelecekleri
        N+1 sorgusu YAŞATMAYARAK katlara göre gruplanmış halde döndürür.
        """
        today = date.today()

        # 1. N+1 Kalkanı: Sadece ilgilendiğimiz rezervasyonları seçiyoruz. (Konaklayanlar VEYA Bugün gelecekler)
        relevant_reservations = Reservation.objects.filter(
            Q(status=ReservationStatus.IN_HOUSE) |
            Q(status=ReservationStatus.RESERVED, check_in_date=today)
        ).select_related('guest')

        # 2. Ana Sorgu: Odaları çekerken oda tipini (JOIN) veya ilgili rezervasyonları (PREFETCH) bağlıyoruz.
        rooms = Room.objects.select_related('room_type').prefetch_related(
            Prefetch(
                'reservations',
                queryset=relevant_reservations,
                to_attr='relevant_reservations',
            )
        ).order_by('floor', 'room_number')

        # 3. Backend for Frontend (BFF) JS'i yormamak için veriyi katlara (floor) göre grupla.
        rack_data = {}
        for room in rooms:
            floor_key = str(room.floor)
            if floor_key not in rack_data:
                rack_data[floor_key] = []

            # Serializer'ı sadece dict dönüştürücü olarak kullanıyoruz.
            rack_data[floor_key].append(self.get_serializer(room).data)

        return Response(rack_data, status=status.HTTP_200_OK)


    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Housekeeping, Resepsiyon veya Yönetim için hızlı statü güncelleme ucu."""
        room = self.get_object()
        serializer = self.get_serializer(room, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)