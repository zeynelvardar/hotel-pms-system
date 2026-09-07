from datetime import date
from django.db import transaction
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
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
    serializer_class = DashboardReservationSerializer

    def get_serializer_class(self):
        # Gelecekte POST/PUT işlemleri için farklı serializer'lar eklenecek (Faz 4.3)
        return DashboardReservationSerializer

    def get_queryset(self):
        # N+1 Zırhı: Ana tablo ile ilişkili verileri tek SQL sorgusunda birleştir.
        return Reservation.objects.select_related(
            "guest", "room", "room__room_type"
            ).order_by("check_in_date")


    # --- GET: Dashboard End-point'leri (4.2)
    @action(detail=False, methods=["get"], url_path="dashboard/arrivals")
    def arrivals_today(self, request):
        today = date.today()
        qs = self.get_queryset().filter(check_in_date=today, status=ReservationStatus.RESERVED)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)
        

    @action(detail=False, methods=["get"], url_path="dashboard/departures")
    def departures_today(self, request):
        today = date.today()
        qs = self.get_queryset().filter(check_out_date=today, status=ReservationStatus.IN_HOUSE)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="dashboard/in-house")
    def in_house(self, request):
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)

    # --- POST: RPC Action End-Point'leri.

    def _process_state_transition(self, pk, current_status, new_status):
        """Action uçları için merkezi satır kitleme ve statü değiştirme motoru"""
        with transaction.atomic():
            # Satırı kitleyerek eşzamanlı istekleri sıraya sokar.
            reservation = self.get_queryset().select_for_update().filter(pk=pk).first()

            if not reservation:
                return Response({"detail": "Rezervasyon bulunamadı"}, status=status.HTTP_404_NOT_FOUND)

            if reservation.status != current_status:
                return Response(
                    {"detail": f"Bu işlem sadece '{current_status}' statüsündeki kayıtlar için yapılabilir."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            reservation.status = new_status
            try:
                reservation.save()
            except ValidationError as e:
                error_data = e.message_dict if hasattr(e, 'message_dict') else {"detail": list(e)}
                return Response(error_data, status=status.HTTP_400_BAD_REQUEST)

            return Response(self.get_serializer(reservation).data)



    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        """Rezervasyonu IN_HOUSE (Konaklıyor) durumuna geçirir."""
        return self._process_state_transition(pk, ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE)

    @action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        """Rezervasyonu CHECKED_OUT (Çıkış Yaptı) durumuna geçirir (Salt-Okunur olur)."""
        return self._process_state_transition(pk, ReservationStatus.IN_HOUSE, ReservationStatus.CHECKED_OUT)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Rezervasyonu CANCELLED (İptal) durumuna geçirir (Salt-Okunur olur)."""
        return self._process_state_transition(pk, ReservationStatus.RESERVED, ReservationStatus.CANCELLED)