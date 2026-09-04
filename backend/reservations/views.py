from datetime import date
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination
from .models import Reservation, ReservationStatus
from .serializers import DashboardReservationSerializer

class ReservationViewSet(viewsets.ModelViewSet):
    """
    Rezervasyon temel CRUD ve Operasyonel Dashboard uçları.
    """
    permission_classes = [IsReceptionOrAdmin]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        # Gelecekte POST/PUT işlemleri için farklı serializer'lar eklenecek (Faz 4.3)
        return DashboardReservationSerializer

    def get_queryset(self):
        # N+1 Zırhı: Ana tablo ile ilişkili verileri tek SQL sorgusunda birleştir.
        return Reservation.objects.select_related("guest", "room", "room__room_type").order_by("check_in_date")

    @action(detail=False, methods=["get"], url_path="dashboard/arrivals")
    def arrivals_today(self, request):
        """Bugün giriş yapacak (Check-in bekleyen) misafirler."""
        today = date.today()
        qs = self.get_queryset().filter(check_in_date=today, status=ReservationStatus.RESERVED)
        
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="dashboard/departures")
    def departures_today(self, request):
        """Bugün çıkış yapacak (Check-out bekleyen) In-House misafirler."""
        today = date.today()
        qs = self.get_queryset().filter(check_out_date=today, status=ReservationStatus.IN_HOUSE)
        
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="dashboard/in-house")
    def in_house(self, request):
        """Anlık olarak otelde konaklayan tüm misafirler."""
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE)
        
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)