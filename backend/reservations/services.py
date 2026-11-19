"""
Rezervasyon modülünün iş mantığı (Business Logic) katmanıdır.
1. Durum Değişiklikleri (Check-in, Check-out) ve Oda statüsü yan etkileri.
2. Night Audit (Gün Sonu) işlemleri.
3. Occupancy Forecast (Doluluk Oranı Tahmini) hesaplamaları.
"""

from datetime import timedelta
from django.db import transaction
from django.utils.dateparse import parse_date
from rooms.models import RoomStatus, Room
from .models import Reservation, ReservationStatus, HotelSettings


class ReservationActionService:
    """
    Rezervasyon operasyonlarını ve bu operasyonların oda statülerine
    olan yan etkilerini (side-effects) yöneten servis katmanı.
    """

    @staticmethod
    @transaction.atomic
    def process_state_transition(
        reservation_id: int, current_expected_status: str, new_status: str
    ) -> Reservation:
        # 1. Kaydı Bul ve Kilitle
        # room alanı nullable (LEFT OUTER JOIN) olduğu için PostgreSQL yalnızca ana tabloyu (self) kilitlemeye izin verir.
        reservation = (
            Reservation.objects.select_for_update(of=("self",))
            .select_related("room")
            .filter(pk=reservation_id)
            .first()
        )

        # 2. Doğrulamalar (Validations)
        if not reservation:
            raise ValueError("Rezervasyon bulunamadı.")

        if reservation.status != current_expected_status:
            raise ValueError(
                f"Bu işlem sadece '{current_expected_status}' statüsündeki kayıtlar için yapılabilir."
            )

        # Floating Reservation Koruması: Blokajsız kayıt doğrudan check-in yapılamaz
        if new_status == ReservationStatus.IN_HOUSE and not reservation.room:
            raise ValueError("Check-in işlemi için önce odaya blokaj atılmalıdır.")

        # 3. Rezervasyon Statüsünü Güncelle (State Machine clean() kuralları çalışır)
        reservation.status = new_status
        reservation.save()

        # 4. Oda Statüsü Yan Etkileri (Housekeeping Otomasyonu)
        room = reservation.room
        room_status_changed = False

        if room:
            if new_status == ReservationStatus.IN_HOUSE:
                room.status = RoomStatus.OC
                room_status_changed = True
            elif new_status == ReservationStatus.CHECKED_OUT:
                room.status = RoomStatus.VD
                room_status_changed = True

            if room_status_changed:
                room.save(update_fields=["status", "updated_at"])

        return reservation


class NightAuditService:
    """
    Night Audit tarafından tetiklenen Gün Sonu İşlemi.
    1. Tarihi geçmiş ve giriş yapmamış (RESERVED) kayıtları NO_SHOW yapar.
    2. Sistem gününü 1 gün ileri alır.
    """

    @staticmethod
    @transaction.atomic
    def execute_end_of_day() -> dict:
        settings, _ = HotelSettings.objects.get_or_create(pk=1)
        current_date = settings.system_date

        # 1. Gelmeyen Rezervasyonları (No-Show) Güncelle
        no_shows_count = Reservation.objects.filter(
            status=ReservationStatus.RESERVED,
            check_in_date__lt=current_date,
        ).update(status=ReservationStatus.NO_SHOW)

        # 2. Sistem Tarihini İleri Sar
        settings.system_date = current_date + timedelta(days=1)
        settings.save()

        return {
            "new_system_date": settings.system_date,
            "no_shows_processed": no_shows_count,
        }


class OccupancyForecastService:
    """
    Otelin ileri veya geriye dönük doluluk raporunu hesaplayan servis.
    N+1 probleminden kaçınmak için veritabanına sadece 2 sorgu atar (Odalar ve Rezervasyonlar).
    Kalan tüm eşleştirme (In-memory aggregation) Python seviyesinde O(N) hızında yapılır.
    """

    @staticmethod
    def generate_forecast(
        start_date_str: str, end_date_str: str, room_type_id: str | None = None) -> list[dict]:
        # 1. Tarih Doğrulama
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)

        if not start_date or not end_date or start_date > end_date:
            raise ValueError(
                "Geçerli bir tarih aralığı (start_date, end_date) belirtilmelidir."
            )

        # 2. Veritabanı Sorgusu: Toplam Oda Kapasitesi
        # PMS Kuralı: Kapasiteye aktif olan tüm odalar (Arızalı/OOO dahil) eklenir.
        room_qs = Room.objects.filter(is_active=True)
        if room_type_id:
            room_qs = room_qs.filter(room_type_id=room_type_id)

        total_rooms_count = room_qs.count()
        if total_rooms_count == 0:
            return []  # Seçili tipte veya otelde oda yoksa boş döner.

        # 3. Veritabanı Sorgusu: İlgili Tarih Aralığındaki Rezervasyonlar
        # PMS Kuralı: İptal (CANCELLED) ve Gelmeyen (NO_SHOW) kayıtlar doluluktan sayılmaz.
        res_qs = Reservation.objects.filter(
            status__in=[
                ReservationStatus.RESERVED,
                ReservationStatus.IN_HOUSE,
                ReservationStatus.CHECKED_OUT,
            ],
            check_out_date__gt=start_date,
            check_in_date__lte=end_date,
        )

        if room_type_id:
            res_qs = res_qs.filter(booked_room_type_id=room_type_id)

        # Performans için yalnızca tarih sütunlarını çekip RAM'e alıyoruz
        reservations = res_qs.values_list("check_in_date", "check_out_date")

        # 4. Bellek İçi Optimizasyon (In-Memory Aggregation)
        # Gün bazlı boş bir "Takvim Sözlüğü" oluşturulur. O(D) Karmaşıklık
        forecast_dict = {}  # tarih aralıklarını tutar.
        current_day = start_date
        while current_day <= end_date:
            forecast_dict[current_day] = 0  # boş günler 0 değerini alsın diye başlangıç değeri atandı.
            current_day += timedelta(days=1)  # tarih döngünün her adımında +1 gün artar.

        # Her rezervasyonun konaklama günleri ilgili takvim gününe +1 eklenir. O(N * Kalış Süresi)
        for check_in, check_out in reservations:
            # Sadece aradığımız aralıktaki günleri saymak için sınırları (clamp) belirliyoruz
            res_start = max(check_in, start_date)  # rapor başlangıcından önceki günleri eler.
            res_end = min(check_out, end_date + timedelta(days=1))  # Check-out günü dolu SAYILMAZ (PMS Kuralı)

            curr = res_start  # rezervasyonun rapordaki başlangıç tarihi
            while curr < res_end:
                if curr in forecast_dict:  # forecast_dict içinde seçilen tarih var mı?
                    forecast_dict[curr] += 1  # var ise tarih karşısındaki sayıya +1 eklenir.
                curr += timedelta(days=1)  # döngü aynı günde takılmasın diye tarihi 1 gün ileri sarar.

        # 5. Sonuç Çıktısı (Serialization)
        result_list = []

        # dict.items() yerine while döngüsüyle tarih sırasını garanti ediyoruz.
        current_day = start_date
        while current_day <= end_date:  # başlangıç, bitişten küçük veya eşitse döngü devam eder.
            occupied_count = forecast_dict[current_day]  # takvim sözlüğüne git, current_day sayfasındaki oda sayısını getir.

            # % hesaplama: (Dolu / Toplam) * 100 (Oda yoksa %0 güvenliği)
            occupancy_rate = (
                round((occupied_count / total_rooms_count) * 100, 2)
                if total_rooms_count > 0
                else 0.0
            )

            result_list.append(
                {
                    "date": current_day.isoformat(),
                    "total_rooms": total_rooms_count,
                    "occupied_rooms": occupied_count,
                    "occupancy_rate": occupancy_rate,
                }
            )
            current_day += timedelta(days=1)

        return result_list