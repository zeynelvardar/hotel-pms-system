from django.db import transaction
from django.core.exceptions import ValidationError
from rooms.models import RoomStatus
from .models import Reservation, ReservationStatus

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