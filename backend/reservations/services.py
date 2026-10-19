# Rezervasyon Durum Değişikliklerini Yönetir (CI-CO) 
# Bu değişikliklerin RoomRack'e yansımasını yönetir.

from django.db import transaction
from django.core.exceptions import ValidationError
from rooms.models import RoomStatus
from .models import Reservation, ReservationStatus, HotelSettings
from datetime import timedelta

class ReservationActionService:
    """
    Rezervasyon operasyonlarını ve bu operasyonların oda statülerine 
    olan yan etkilerini (side-effects) yöneten servis katmanı.
    """

    @staticmethod
    @transaction.atomic
    def process_state_transition(reservation_id: int, current_expected_status: str, new_status: str) -> Reservation:
        # N+1 ve Race Condition Koruması: İlgili rezervasyonu ve odayı tek sorguda kilitler
        reservation = Reservation.objects.select_for_update().select_related("room").filter(pk=reservation_id).first()

        if not reservation:
            raise ValueError("Rezervasyon bulunamadı.")

        if reservation.status != current_expected_status:
            raise ValueError(f"Bu işlem sadece '{current_expected_status}' statüsündeki kayıtlar için yapılabilir.")

        # 1. Rezervasyonun kendi statüsünü güncelle (State Machine clean() kuralları çalışır)
        reservation.status = new_status
        reservation.save() 

        # 2. Oda Statüsü Yan Etkileri (Housekeeping Otomasyonu)
        room = reservation.room
        room_status_changed = False

        if new_status == ReservationStatus.IN_HOUSE:
            # Check-in: Oda Dolu-Temiz (OC) statüsüne geçer
            room.status = RoomStatus.OC
            room_status_changed = True
            
        elif new_status == ReservationStatus.CHECKED_OUT:
            # Check-out: Oda Boş-Kirli (VD) statüsüne geçer
            room.status = RoomStatus.VD
            room_status_changed = True

        # Performans: Sadece statü ve güncellenme tarihi kolonlarını yaz (Tüm satırı tekrar yazma)
        if room_status_changed:
            room.save(update_fields=["status", "updated_at"])

        return reservation

class NightAuditService:
    @staticmethod # fonksiyonun sınıftan bağımsız metod gibi davranmasını sağlar. 
    @transaction.atomic
    def execute_end_of_day():
        """
        Night Audit tarafından tetiklenen Gün Sonu İşlemi.
        1. Tarihi geçmiş ve giriş yapmamış (RESERVED) kayıtları NO_SHOW yapar.
        2. Sistem gününü 1 gün ileri alır.
        Transaction ile korunur; hata olursa sistem günü değişmez.
        """

        settings, _ = HotelSettings.objects.get_or_create(pk=1) #ayarlar modelimiz.
        current_date = settings.system_date

        # 1. No-Show'ları yakala veya işaretle
        ghost_reservations = Reservation.objects.filter( #veritabanı filtrelemesi.
            status=ReservationStatus.RESERVED,
            check_in_date__lt=current_date # bugünün tarihi
        )

        # Tek bir SQL Update sorgusuyla toplu güncelleme (Performans / Clean Code)
        ghost_reservations.update(status=ReservationStatus.NO_SHOW)

        # 2. Sistem Gününü İleri Al
        settings.system_date = current_date + timedelta(days=1)
        settings.save()

        return {
            "new_system_date": settings.system_date,
            "no_shows_processed": ghost_reservations.count()
        }