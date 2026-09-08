from datetime import date
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination
from .models import Reservation, ReservationStatus
from .serializers import DashboardReservationSerializer
from .services import ReservationActionService

class ReservationViewSet(viewsets.ModelViewSet):
    """
    Rezervasyon temel CRUD ve Operasyonel Dashboard / Action uçları.
    """
    permission_classes = [IsReceptionOrAdmin]
    pagination_class = StandardResultsSetPagination
    serializer_class = DashboardReservationSerializer

    def get_queryset(self):
        return Reservation.objects.select_related(
            "guest", "room", "room__room_type"
        ).order_by("check_in_date")

    # --- GET: Dashboard Uçları ---
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

    # --- POST: RPC Action Uçları (Service Layer Entegrasyonu) ---
    def _execute_service_action(self, pk, current_status, new_status):
        """Servis katmanını çağırarak hataları HTTP formatına çevirir."""
        try:
            reservation = ReservationActionService.process_state_transition(
                reservation_id=pk, 
                current_expected_status=current_status, 
                new_status=new_status
            )
            return Response(self.get_serializer(reservation).data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ValidationError as e:
            error_data = e.message_dict if hasattr(e, 'message_dict') else {"detail": list(e)}
            return Response(error_data, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        return self._execute_service_action(pk, ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE)

    @action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        return self._execute_service_action(pk, ReservationStatus.IN_HOUSE, ReservationStatus.CHECKED_OUT)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        return self._execute_service_action(pk, ReservationStatus.RESERVED, ReservationStatus.CANCELLED)