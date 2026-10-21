"""
Sorumluluk & Mimari 
Bu dosya, PMS sisteminin Rezervasyon API Controller (View) katmanıdır.
Katman sadece Frontend ile servisler arasındaki köprü görevini üstlenir:

- HTTP İstek ve Yetki Yönetimi
  - Gelen istekleri karşılar, JWT/Oturum izinlerini denetler.
  - Dinamik serializer seçimi yapar (kayıt/güncelleme) için.

- Operasyonel Dashboard Endpointleri (GET)
  - Gelenler-Inhouse-Ayrılacaklar etc.

- Durum Değişiklikleri ( POST / RPC Aksiyonları )
  - Check-in, Check-out, İptal ve Gün Sonu gibi operasyonel butonları dinler.
"""

from django.core.exceptions import ValidationError
from rest_framework import viewsets, status # CRUD işlemleri için DRF kütüphanesi
from rest_framework.decorators import action # özel endpoint oluşturma dekoratörü
from rest_framework.response import Response # dönülen veriyi json'a çevirir.
from accounts.permissions import IsReceptionOrAdmin
from core.pagination import StandardResultsSetPagination

from .models import Reservation, ReservationStatus, HotelSettings
from .serializers import DashboardReservationSerializer, ReservationCreateSerializer
from .services import ReservationActionService, NightAuditService

class ReservationViewSet(viewsets.ModelViewSet): # ModelViewSet sınıfının özellikleri inherit (miras) alınır. [CRUD İşlemleri]
    """
    Rezervasyon temel CRUD ve Operasyonel Dashboard / Action Endpointleri.
    SoC prensibi gereği iş mantıkları 'services.py' dosyasındadır.
    Burada yalnızca HTTP routing, yetkilendirme ve serializasyon yapılır.
    """
    # Class Attirbutes
    permission_classes = [IsReceptionOrAdmin] # yetki kontrolü
    pagination_class = StandardResultsSetPagination # sayfalama kuralları

    # Serializer Sınıfı Seçimi (Create-Update veya Read)
    def get_serializer_class(self):
        # N+1 Sorgu Problemini önleyen Zırh: select_related
        if self.action in ["create", "update", "partial_update"]: # self.action = ViewSet içinde hangi isteğin (list, create, update) veya özel bir eylem işlendiğini belirten o anki işlem türü bilgisidir.
            return ReservationCreateSerializer # yazma işlemleri serializer'ı (create, update)
        return DashboardReservationSerializer # okuma işlemleri serializer'ı (read)

    # Python ve PostgreSQL arasındaki akıllı sorgu planlayıcısıdır ()
    def get_queryset(self):
        return Reservation.objects.select_related( # veriyi istenilen şekilde (sıralama/filtreleme) sonrası çeker.
            "guest", "room", "room__room_type"
        ).order_by("check_in_date")

    def _get_paginated_response_for_qs(self, qs): # _ = dışarıdan çağırılamaz, sınıfın kendi işlerinde kullanılır demektir.
        """
        DRY Prensibi:
        Aşağıdaki 8 farklı API Endpoint'inde tekrar tekrar pagination kodları
        yazmamak için kullanılan private yarımcı metod.
        """
        page = self.paginate_queryset(qs) # yerleşik DRF fonksiyonu. istedği inceler, kuralı uygular(20 sınır) veriyi keser (20-20-20).
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data) # fonksiyonu kendi içinden önce çağırır, sonra yerleşik get_serializers() fonksiyonu ile veriyi ilgili serializer'a yönlendirir, içine parametre olarak listeyi verir.
        return Response(self.get_serializer(qs, many=True).data) # yukarıda yaptığımız işlemi Response olarak dönüyoruz.

    # ==========================================
    # --- GET: OPERASYON PANOSU (DASHBOARD) UÇLARI ---
    # Not: Gerçek zamana göre değil, Otel 'Sistem Gününe' göre filtrelenir.
    # ==========================================

    @action(detail=False, methods=["get"], url_path="dashboard/reservations")
    def reservations_list(self, request):
        """Bekleyen Tüm Rezervasyonlar"""
        current_date = HotelSettings.get_current_date() # sistem tarihi
        qs = self.get_queryset().filter(status=ReservationStatus.RESERVED, check_in_date__gte=current_date) # gelen rezervasyon verisi  #__gte Django sorgu filtreleme operatörüdür: >= büyük veya eşittir anlamına gelir.
        return self._get_paginated_response_for_qs(qs) # sayfalamayı döner. (20-20)

    @action(detail=False, methods=["get"], url_path="dashboard/arrivals")
    def arrivals_today(self, request):
        """Bugün Gelecekler (Arrivals)"""
        current_date = HotelSettings.get_current_date() # sistem tarihi
        qs = self.get_queryset().filter(status=ReservationStatus.RESERVED, check_in_date=current_date) # qs ile gelen rezervasyon verisi 
        return self._get_paginated_response_for_qs(qs) # gelen qs verisini biçimlendirip döner (20-20)

    @action(detail=False, methods=["get"], url_path="dashboard/arrived-today")
    def arrived_today(self, request):
        """Gerçekleşen Girişler"""
        current_date = HotelSettings.get_current_date() # sistem tarihi
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE, check_in_date=current_date) # gelen rezervasyon verisi
        return self._get_paginated_response_for_qs(qs)  # gelen qs verisini biçimlendirip döner (20-20)
    
    @action(detail=False, methods=["get"], url_path="dashboard/in-house")
    def in_house(self, request):
        """Konaklayanlar (In-House)"""
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE) #qs ile gelen rezervasyon verisi.
        return self._get_paginated_response_for_qs(qs) # gelen qs verisini biçimlendirip döner (20-20)

    @action(detail=False, methods=["get"], url_path="dashboard/departures")
    def departures_today(self, request):
        """Bugün Ayrılacaklar (Çıkış günü tarihi sistem günü olan IN_HOUSE'lar)"""
        current_date = HotelSettings.get_current_date()
        qs = self.get_queryset().filter(status=ReservationStatus.IN_HOUSE, check_out_date=current_date)
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/checked-out")
    def checked_out(self, request):
        """Ayrılanların Hepsi (Geçmiş işlemler, en son çıkan en üstte)"""
        qs = self.get_queryset().filter(status=ReservationStatus.CHECKED_OUT).order_by("-check_out_date")
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/cancelled")
    def cancelled_list(self, request):
        """İptaller ve No-Show'lar (İşlemi başarısız olan geçmiş kayıtlar.)"""
        qs = self.get_queryset().filter(
            status__in=[ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]
        ).order_by("-updated_at")
        return self._get_paginated_response_for_qs(qs)

    @action(detail=False, methods=["get"], url_path="dashboard/all-records")
    def all_records(self, request):
        """Tüm Veritabanı Dökümü (Genel Log ve Arama Listesi için)"""
        qs = self.get_queryset().order_by("-id")
        return self._get_paginated_response_for_qs(qs)

    
    # ==========================================
    # --- POST: SİSTEM VE RPC ACTION UÇLARI ---
    # ==========================================

    @action(detail=False, methods=["post"], url_path="night-audit")
    def trigger_night_audit(self, request):
        """
        Gecenin tetiklendiği Gün Sonu / Night Audit Endpointi
        """
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
        """Statü Değişimlerinin Yan Etkilerini Servis Dosyasına Bildirir."""
        try:
            reservation = ReservationActionService.process_state_transition( # yeni statüleri servis dosyası içinde oda state'lerini yöneten bileşene gönderir.
                reservation_id=pk,
                current_expected_status=current_status,
                new_status=new_status
            )
            return Response(self.get_serializer(reservation).data) # veri front'ende döner. (react renkleri state'leri ayarlar.)
        except ValueError as e: # gelen veri biçimsel olarak doğru olsa bile, iş mantığına aykırı olabilir. Bunu yakalamak ve sebebini anlaşılır bir hata formatı olarak dönmek için valueError kullanırız.
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ValidationError as e:
            error_data = e.message_dict if hasattr(e, 'message_dict') else {"detail": list(e)} #! message_dict: çoklu hataları Django, message_dict adında özel bir dictionary formatında tutar.(birden fazla hata için çoklu dict yapısı). / hasattr(): hatada message_dict adında bir özellik var mı ona bakarız (defensive programming) / else detail: json formatında detayil olarak gönderilir.
            return Response(error_data, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None): #pk None atamaası defensive programming için: ID gönderilmezse çökmek yerine hata vermesini kodun devamında sağlarız.
        return self._execute_service_action(pk, ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE) # (pk, currentstatus, newstatus) servis fonksiyonuna gönderilir.

    @action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        return self._execute_service_action(pk, ReservationStatus.IN_HOUSE, ReservationStatus.CHECKED_OUT)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        return self._execute_service_action(pk, ReservationStatus.RESERVED, ReservationStatus.CANCELLED)