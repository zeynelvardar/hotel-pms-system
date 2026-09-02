from datetime import date, timedelta
from typing import TYPE_CHECKING, Any, Callable
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Func, Q
from django.contrib.postgres.constraints import ExclusionConstraint
from guests.models import Guest
from rooms.models import Room


class ReservationStatus(models.TextChoices):
    RESERVED = "RESERVED", "Rezerve (Bekliyor)"
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

    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name="reservations", verbose_name="Ana Misafir")
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="reservations", verbose_name="Oda")

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
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], verbose_name="Toplam Fiyat"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Notlar")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Rezervasyon"
        verbose_name_plural = "Rezervasyonlar"
        ordering = ["check_in_date"]
        constraints = [
            # PostgreSQL Seviyesi Zırh: Aynı oda, aynı tarihlerde, aktif iki rezervasyon barındıramaz.
            ExclusionConstraint(
                name="exclude_overlapping_reservations",
                expressions=[
                    ("room", "="),
                    (Func("check_in_date", "check_out_date", function="daterange"), "&&"),
                ],
                condition=Q(status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE]),
            )
        ]

    def __str__(self) -> str:
        status_label = self.get_status_display() if hasattr(self, "get_status_display") else self.status
        return f"#{self.pk} | Misafir ID: {self.guest_id} -> Oda ID: {self.room_id} ({status_label})"

    def clean(self) -> None:
        super().clean()

        if self.check_in_date and self.check_out_date:
            if self.check_out_date < self.check_in_date:
                raise ValidationError({"check_out_date": "Check-out tarihi, check-in tarihinden önceki bir gün olamaz."})

            # Uygulama Seviyesi Çakışma Kontrolü (Day-Use Edge Case'lerini de kapsar)
            active_qs = Reservation.objects.filter(
                room=self.room,
                status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE]
            )
            if self.pk:
                active_qs = active_qs.exclude(pk=self.pk)

            for res in active_qs:
                # Gündüz kullanımlarını (Day-Use) matematiksel olarak yakalayabilmek için sanal +1 gün eklenir
                self_eff_out = self.check_out_date if self.check_out_date > self.check_in_date else self.check_in_date + timedelta(days=1)
                res_eff_out = res.check_out_date if res.check_out_date > res.check_in_date else res.check_in_date + timedelta(days=1)

                if self.check_in_date < res_eff_out and self_eff_out > res.check_in_date:
                    raise ValidationError({
                        "check_in_date": f"Bu tarihlerde Oda {self.room.room_number} için mevcut bir rezervasyon (Ref: #{res.id}) bulunuyor."
                    })

        if self.pk:
            old_instance = Reservation.objects.filter(pk=self.pk).only("status", "check_in_date", "check_out_date").first()
            if old_instance:
                if old_instance.status in [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED]:
                    if (self.status != old_instance.status or self.check_in_date != old_instance.check_in_date or self.check_out_date != old_instance.check_out_date):
                        raise ValidationError("Check-out yapılmış veya iptal edilmiş rezervasyonlar salt okunurdur. Tarih veya statü değiştirilemez.")

                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.IN_HOUSE:
                    if date.today() < self.check_in_date:
                        raise ValidationError({"status": "Check-in tarihi gelmemiş bir rezervasyon 'IN_HOUSE' durumuna alınamaz."})

    def save(self, *args, **kwargs):
        # Transaction başlatılır. select_for_update() bu işlemi atomik hale getirerek Race Condition'ı imkansız kılar.
        with transaction.atomic():
            if self.room_id:
                Room.objects.select_for_update().get(pk=self.room_id)
            self.full_clean()
            super().save(*args, **kwargs)