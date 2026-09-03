from rest_framework import viewsets, filters
from django.db.models import Count, Prefetch
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination
from reservations.models import Reservation
from .models import Guest
from .serializers import GuestSerializer

class GuestViewSet(viewsets.ModelViewSet):
    """
    Misafir API Ucu:
    - Resepsiyon ve Admin tam erişime sahiptir.
    - İsim, Soyisim, TCKN, Pasaport ve Telefon numarasına göre tam metin araması destekler.
    - N+1 sorununu önlemek için geçmiş rezervasyonları Prefetch ile getirir.
    """
    serializer_class = GuestSerializer
    permission_classes = [IsReceptionOrAdmin]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ["first_name", "last_name", "tc_no", "passport_no", "phone"]
    ordering_fields = ["created_at", "first_name", "last_name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # N+1 Optimizasyonu: Rezervasyonları ve bağlı odaları tek seferde çekip, 
        # konaklama sayısını Python yerine SQL seviyesinde (Count) hesaplıyoruz.
        prefetch_reservations = Prefetch(
            "reservations",
            queryset=Reservation.objects.select_related("room").order_by("-check_in_date")
        )
        
        return Guest.objects.prefetch_related(prefetch_reservations).annotate(
            total_stays=Count("reservations")
        )