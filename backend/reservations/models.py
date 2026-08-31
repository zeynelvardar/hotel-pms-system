from datetime import date
from typing import TYPE_CHECKING, Any, Callable
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from guests.models import Guest
from rooms.models import Room


class ReservationStatus(models.TextChoices):
    RESERVED = "RESERVATION", "Rezervasyon"
    IN_HOUSE = "IN_HOUSE", "Konaklayan (In-House)"
    CHECKED_OUT = "CHECKED_OUT", "Ayrılan (Checked-Out)"
    CANCELLED = "CANCELLED", "İptal"
    NO_SHOW = "NO_SHOW", "Gelmedi (No-Show)"


class Reservation(models.Model):
    if TYPE_CHECKING:
        id: int
        pk: Any
        guest_id: int
        room_id: int
        get_status_display: Callable[[], str]

    guest = models.ForeignKey(
        Guest,
        on_delete=models.PROTECT,
        related_name="reservations",
        verbose_name="Ana Misafir",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="reservations",
        verbose_name="Oda",
    )

    check_in_date = models.DateField(verbose_name="Check-in Tarihi")
    check_out_date = models.DateField(verbose_name="Check-out Tarihi")

    status = models.CharField(
        max_length=15,
        choices=ReservationStatus.choices,
        default=ReservationStatus.RESERVED,
        db_index=True,
        verbose_name="Rezervasyon Durumu",
    )

    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name="Toplam Fiyat",
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Notlar")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Rezervasyon"
        verbose_name_plural = "Rezervasyonlar"
        ordering = ["check_in_date"]

    def __str__(self) -> str:
        status_label = self.get_status_display() if hasattr(self, "get_status_display") else self.status
        return f"#{self.pk} | Guest ID: {self.guest_id} -> Room ID: {self.room_id} ({status_label})"

    def clean(self) -> None:
        super().clean()

        # Kural 1: Check-out tarihi check-in tarihinden sonra olmalıdır.
        if self.check_in_date and self.check_out_date:
            if self.check_out_date < self.check_in_date:
                raise ValidationError(
                    {"check_out_date": "Check-out tarihi, check-in tarihinden önce olamaz."}
                )

        # Mevcut bir kayıt güncelleniyorsa durum geçiş (State Transition) kontrolleri
        if self.pk:
            old_instance = (
                Reservation.objects.filter(pk=self.pk)
                .only("status", "check_in_date", "check_out_date")
                .first()
            )

            if old_instance:
                # Kural 2: Immutability (Salt Okunur Kilit)
                if old_instance.status in [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED]:
                    is_status_changed = self.status != old_instance.status
                    is_date_changed = (
                        self.check_in_date != old_instance.check_in_date
                        or self.check_out_date != old_instance.check_out_date
                    )
                    if is_status_changed or is_date_changed:
                        raise ValidationError(
                            "Check-out yapılmış veya iptal edilmiş rezervasyonlar salt okunurdur. "
                            "Tarih veya statü değiştirilemez."
                        )
                
                # Kural 3: Gelecek tarihli rezervasyon vaktinden önce In-House'a alınamaz.
                # (Bu kontrol Kural 2'nin dışına çıkarılarak doğru seviyeye hizalandı)
                if (
                    old_instance.status == ReservationStatus.RESERVED
                    and self.status == ReservationStatus.IN_HOUSE
                ):
                    if date.today() < self.check_in_date:
                        raise ValidationError(
                            {"status": "Check-in tarihi gelmemiş bir rezervasyon 'IN_HOUSE' durumuna alınamaz."}
                        )