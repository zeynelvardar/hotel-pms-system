"""
Misafir (Guest) CRUD API Uçları.
Misafir Kartı (Guest Card Modal) üzerinden tekil profil güncellemelerini sağlar.
"""
from django.db.models import Count, Prefetch
from rest_framework import viewsets
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination

from .models import Guest
from .serializers import GuestSerializer
from reservations.models import Reservation


class GuestViewSet(viewsets.ModelViewSet):
    """
    Misafir profilleri için optimize edilmiş CRUD endpoint'i.
    
    N+1 Zırhı:
    - total_stays: Misafirin toplam rezervasyon sayısını SQL seviyesinde Count() ile toplar.
    - reservations & room: Geçmiş konaklamaları ve kaldıkları odaları Prefetch + select_related
      ile sadece 2 sorguda belleğe alır.
    """
    serializer_class = GuestSerializer
    permission_classes = [IsReceptionOrAdmin]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return (
            Guest.objects.annotate(total_stays=Count("reservations"))
            .prefetch_related(
                Prefetch(
                    "reservations",
                    queryset=Reservation.objects.select_related("room").order_by("-check_in_date"),
                )
            )
            .order_by("-created_at")
        )