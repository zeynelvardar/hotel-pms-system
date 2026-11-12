"""
Rezervasyon Durum Değişikliklerini Yönetir (CI-CO) 
Bu değişikliklerin RoomRack'e ve Oda Statülerine yansımasını yönetir.
"""

from datetime import timedelta
from django.db import transaction
from rooms.models import RoomStatus
from .models import Reservation, ReservationStatus, HotelSettings


class ReservationActionService:
    """
    Rezervasyon operasyonlarını ve bu operasyonların oda statülerine 
    olan yan etkilerini (side-effects) yöneten servis katmanı.
    """

    @staticmethod
    @transaction.atomic
    def process_state_transition(reservation_id: int, current_expected_status: str, new_status: str) -> Reservation:
        # room alanı nullable (LEFT OUTER JOIN) olduğu için PostgreSQL yalnızca ana tabloyu (self) kilitlemeye izin verir.
        # Fiziksel oda kilidi ise reservation.save() içindeki atomic blokta güvenli şekilde alınır.
        reservation = (
            Reservation.objects.select_for_update(of=("self",))
            .select_related("room")
            .filter(pk=reservation_id)
            .first()
        )

        if not reservation:
            raise ValueError("Rezervasyon bulunamadı.")

        if reservation.status != current_expected_status:
            raise ValueError(f"Bu işlem sadece '{current_expected_status}' statüsündeki kayıtlar için yapılabilir.")

        # Floating Reservation Koruması: Blokajsız kayıt doğrudan check-in yapılamaz
        if new_status == ReservationStatus.IN_HOUSE and not reservation.room:
            raise ValueError("Check-in işlemi için önce odaya blokaj atılmalıdır.")

        # 1. Rezervasyonun kendi statüsünü güncelle (State Machine clean() kuralları çalışır)
        reservation.status = new_status
        reservation.save()

        # 2. Oda Statüsü Yan Etkileri (Housekeeping Otomasyonu)
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
    @staticmethod
    @transaction.atomic
    def execute_end_of_day():
        """
        Night Audit tarafından tetiklenen Gün Sonu İşlemi.
        1. Tarihi geçmiş ve giriş yapmamış (RESERVED) kayıtları NO_SHOW yapar.
        2. Sistem gününü 1 gün ileri alır.
        """
        settings, _ = HotelSettings.objects.get_or_create(pk=1)
        current_date = settings.system_date

        ghost_reservations = Reservation.objects.filter(
            status=ReservationStatus.RESERVED,
            check_in_date__lt=current_date
        )

        ghost_reservations.update(status=ReservationStatus.NO_SHOW)

        settings.system_date = current_date + timedelta(days=1)
        settings.save()

        return {
            "new_system_date": settings.system_date,
            "no_shows_processed": ghost_reservations.count()
        }