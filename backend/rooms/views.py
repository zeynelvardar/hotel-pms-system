# Oda ve Oda Tipi modelleri için; okuma işlemlerinde resepsiyon/admin, yazma işlemlerinde 
# ise sadece otel yöneticisi yetkisi arayan, optimize edilmiş CRUD görünüm setleri.

from django.db.models import Count
from rest_framework import viewsets
from accounts.permissions import IsHotelAdmin, IsReceptionOrAdmin
from .models import RoomType, Room
from .serializers import RoomTypeSerializer, RoomSerializer


class RoomTypeViewSet(viewsets.ModelViewSet):
    """
    Oda Tipi Yönetimi:
    - N+1 sorgularını önlemek için annotate(total_rooms_count=Count('rooms')) kullanır.
    - Listeleme/Detay: Resepsiyon, Housekeeping veya Admin
    - Ekleme/Düzenleme/Silme: Sadece Hotel Admin
    """
    queryset = RoomType.objects.annotate(total_rooms_count=Count("rooms")).all()
    serializer_class = RoomTypeSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsReceptionOrAdmin()]
        return [IsHotelAdmin()]


class RoomViewSet(viewsets.ModelViewSet):
    """
    Oda Yönetimi:
    - N+1 sorgularını önlemek için select_related('room_type') kullanır.
    - Filtreleme ve arama için optimize edilmiş sorgu seti sağlar.
    """
    queryset = Room.objects.select_related("room_type").all()
    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsReceptionOrAdmin()]
        return [IsHotelAdmin()]