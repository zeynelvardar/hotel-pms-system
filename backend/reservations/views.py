"""
Sorumluluk & Mimari 
Bu dosya, PMS sisteminin Rezervasyon API Controller (View) katmanıdır.
Katman sadece Frontend ile servisler arasındaki köprü görevini üstlenir:

- HTTP İstek ve Yetki Yönetimi
  - Gelen istekleri karşılar, JWT/Oturum izinlerini denetler.
  - Dinamik serializer seçimi yapar (kayıt/güncelleme) için.

- Operasyonel Dashboard Endpointleri (GET)
  - Gelenler-Inhouse-Ayrılacaklar vb.

- Durum Değişiklikleri ( POST / RPC Aksiyonları )
  - Check-in, Check-out, İptal ve Gün Sonu gibi operasyonel butonları dinler.
"""

from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination

from .models import Reservation, ReservationStatus, HotelSettings, ReservationAgency
from .serializers import DashboardReservationSerializer, ReservationCreateUpdateSerializer
from .services import ReservationActionService, NightAuditService


class ReservationViewSet(viewsets.ModelViewSet):
    """
    Rezervasyon temel CRUD ve Operasyonel Dashboard / Action Endpointleri.
    SoC prensibi gereği iş mantıkları 'services.py' dosyasındadır.
    Burada yalnızca HTTP routing, yetkilendirme ve serializasyon yapılır.
    """
    permission_classes = [IsReceptionOrAdmin]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ReservationCreateUpdateSerializer
        return DashboardReservationSerializer

    def get_queryset(self):
        # N+1 SORGU KORUMASI:
        # room ve room__room_type (fiziksel oda varsa)
        # booked_room_type (fiziksel oda olmasa da kapasite için her zaman vardır)
        # NOT: 'room' tablosu JOIN edildiği için serializers.py'deki 'room.status' 
        # okuması veritabanına ekstra tek bir SELECT bile atmaz! (O(1) Performans)
        return Reservation.objects.select_related(
            "guest", "room", "room__room_type", "booked_room_type"
        ).prefetch_related(
            "accompanying_guests"
        ).order_by("check_in_date")

    def _get_paginated_response_for_qs(self, qs):
        """
        DRY Prensibi:
        Farklı API Endpoint'lerinde tekrar pagination kodları yazmamak için yardımcı metod.
        """
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)


    # ==========================================
    # --- GET: OPERASYON PANOSU (DASHBOARD) ---
    # ==========================================

    @action(detail=False, methods=["get"], url_path="dashboard/reservations")
    def reservations_list(self, request):
        current_date = HotelSettings.get_current_date()
        qs = self.get_queryset().filter(status=ReservationStatus.RESERVED, check_in_date__gte=current_date)
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/arrivals")
    def arrivals_today(self, request):
        current_date = HotelSettings.get_current_date()
        qs = self.get_queryset().filter(status=ReservationStatus.RESERVED, check_in_date=current_date)
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/arrived-today")
    def arrived_today(self, request):
        current_date = HotelSettings.get_current_date()
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE, check_in_date=current_date)
        return self._get_paginated_response_for_qs(qs)
    
    @action(detail=False, methods=["get"], url_path="dashboard/in-house")
    def in_house(self, request):
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE)
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/departures")
    def departures_today(self, request):
        current_date = HotelSettings.get_current_date()
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE, check_out_date=current_date)
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/checked-out")
    def checked_out(self, request):
        qs = self.get_queryset().filter(status=ReservationStatus.CHECKED_OUT).order_by("-check_out_date")
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/cancelled")
    def cancelled_list(self, request):
        qs = self.get_queryset().filter(
            status__in=[ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]
        ).order_by("-updated_at")
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/all-records")
    def all_records(self, request):
        qs = self.get_queryset().order_by("-id")
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="agency-choices")
    def get_agency_choices(self, request):
        choices = [{"value": key, "label": label} for key, label in ReservationAgency.choices]
        return Response(choices)


    # ==========================================
    # --- POST: SİSTEM VE RPC ACTION UÇLARI ---
    # ==========================================

    @action(detail=False, methods=["post"], url_path="night-audit")
    def trigger_night_audit(self, request):
        try:
            result = NightAuditService.execute_end_of_day()
            return Response({
                "message": "Gün sonu işlemi başarıyla tamamlandı.",
                "new_system_date": result["new_system_date"],
                "no_shows_processed": result["no_shows_processed"]
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    
    def _execute_service_action(self, pk, current_status, new_status):
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

    @action(detail=False, methods=["get"], url_path="system-date")
    def get_system_date(self, request):
        return Response({"system_date": HotelSettings.get_current_date()})