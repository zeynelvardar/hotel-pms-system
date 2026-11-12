from django.utils import timezone
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Callable
from django.core.exceptions import ValidationError, FieldError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Func, Q
from django.contrib.postgres.constraints import ExclusionConstraint
from guests.models import Guest
from rooms.models import Room, RoomType


class ReservationStatus(models.TextChoices):
    RESERVED = "RESERVED", "Rezervasyon"
    IN_HOUSE = "IN_HOUSE", "Konaklayan (In-House)"
    CHECKED_OUT = "CHECKED_OUT", "Ayrılan (Checked-Out)"
    CANCELLED = "CANCELLED", "İptal"
    NO_SHOW = "NO_SHOW", "Gelmedi (No-Show)"


class ReservationAgency(models.TextChoices):
    DIRECT = "DIRECT", "Münferit (Walk-in)"
    BOOKING = "BOOKING", "Booking.com"
    EXPEDIA = "EXPEDIA", "Expedia"
    ETS = "ETS", "ETS Tur"
    TATILBUDUR = "TATILBUDUR", "TatilBudur"
    ODAMAX = "ODAMAX", "Odamax"
    CORAL = "CORAL", "Coral Travel / Odeon"
    ANEX = "ANEX", "Anex Tour"
    CORPORATE = "CORPORATE", "Kurumsal Şirket"


class Reservation(models.Model):
    if TYPE_CHECKING:
        id: int
        pk: Any
        guest_id: int
        room_id: int
        booked_room_type_id: int
        get_status_display: Callable[[], str]
        get_agency_display: Callable[[], str]

    # --- İLİŞKİLER (RELATIONS) ---
    guest = models.ForeignKey(
        Guest, on_delete=models.PROTECT, related_name="reservations", verbose_name="Ana Misafir"
    )
    accompanying_guests = models.ManyToManyField(
        Guest, blank=True, related_name="accompanying_reservations", verbose_name="Ek Misafirler"
    )

    # --- ODA VE BLOKAJ (FLOATING RESERVATION MİMARİSİ) ---
    # Satın alınan oda tipi (Fiziksel oda boş kalsa bile sistem envanteri ve fiyatı buradan okur)
    booked_room_type = models.ForeignKey(
        RoomType, on_delete=models.PROTECT, related_name="booked_reservations", verbose_name="Satın Alınan Oda Tipi"
    )
    # Fiziksel oda (Blokaj). Null olabilir (Havuzdaki/Blokajsız rezervasyonlar için)
    room = models.ForeignKey(
        Room, on_delete=models.PROTECT, null=True, blank=True, related_name="reservations", verbose_name="Fiziksel Oda Blokajı"
    )

    # --- SATIŞ VE DURUM (SALES & STATUS) ---
    agency = models.CharField(
        max_length=20,
        choices=ReservationAgency.choices,
        default=ReservationAgency.DIRECT,
        db_index=True,
        verbose_name="Acenta / Satış Kanalı"
    )
    check_in_date = models.DateField(verbose_name="Check-in Tarihi")
    check_out_date = models.DateField(verbose_name="Check-out Tarihi")
    status = models.CharField(
        max_length=15,
        choices=ReservationStatus.choices,
        default=ReservationStatus.RESERVED,
        db_index=True,
        verbose_name="Rezervasyon Durumu"
    )
    total_price = models.DecimalField(
        max_digits=10, decimal_places=2, default="0.00", blank=True, validators=[MinValueValidator(0)], verbose_name="Toplam Fiyat"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Notlar")

    created_at = models.DateField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Rezervasyon"
        verbose_name_plural = "Rezervasyonlar"
        ordering = ["check_in_date"]
        constraints = [
            # PostgreSQL Zırhı: Sadece fiziksel bir odası olan (room__isnull=False) aktif rezervasyonlarda overbooking'i engeller.
            ExclusionConstraint(
                name="exclude_overlapping_reservations",
                expressions=[
                    ("room", "="),
                    (Func("check_in_date", "check_out_date", function="daterange"), "&&"),
                ],
                condition=Q(
                    status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE],
                    room__isnull=False
                )
            )
        ]

    def validate_constraints(self, exclude=None):
        try:
            super().validate_constraints(exclude=exclude)
        except FieldError:
            pass

    def __str__(self) -> str:
        status_label = self.get_status_display() if hasattr(self, "get_status_display") else self.status
        room_label = f"Oda ID: {self.room_id}" if self.room_id else "Blokajsız (Floating)"
        return f"#{self.pk} | Misafir ID: {self.guest_id} -> {room_label} ({status_label})"

    def clean(self) -> None:
        super().clean()
        current_date = HotelSettings.get_current_date()

        # 1. TEMEL TARİH KONTROLÜ
        if self.check_in_date and self.check_out_date:
            if self.check_out_date < self.check_in_date:
                raise ValidationError({"check_out_date": "Check-out tarihi, check-in tarihinden önceki bir gün olamaz."})

            # 2. UYGULAMA SEVİYESİ ODA ÇAKIŞMA KONTROLÜ (Sadece blokajlı odalar için çalışır)
            if self.room:
                active_qs = Reservation.objects.filter(
                    room=self.room,
                    status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE]
                )
                if self.pk:
                    active_qs = active_qs.exclude(pk=self.pk)

                for res in active_qs:
                    self_eff_out = self.check_out_date if self.check_out_date > self.check_in_date else self.check_in_date + timedelta(days=1)
                    res_eff_out = res.check_out_date if res.check_out_date > res.check_in_date else res.check_in_date + timedelta(days=1)

                    if self.check_in_date < res_eff_out and self_eff_out > res.check_in_date:
                        raise ValidationError({
                            "check_in_date": f"Bu tarihlerde oda {self.room.room_number} için mevcut bir rezervasyon (Ref: #{res.id}) bulunuyor."
                        })

        # 3. İŞ MANTIĞI VE ZIRHLAR (STAY CARD)
        if self.pk:
            old_instance = Reservation.objects.filter(pk=self.pk).only(
                "status", "check_in_date", "check_out_date", "room_id", "total_price", "agency"
            ).first()

            if old_instance:
                # 3.1. Kapalı Kayıtlar Salt Okunur
                if old_instance.status in [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]:
                    if (self.status != old_instance.status or self.check_in_date != old_instance.check_in_date
                        or self.check_out_date != old_instance.check_out_date or self.room_id != old_instance.room_id
                        or self.total_price != old_instance.total_price or self.agency != old_instance.agency):
                        raise ValidationError("Tamamlanmış, iptal edilmiş veya No-show olmuş rezervasyonlar salt okunurdur; konaklama verileri değiştirilemez.")

                # 3.2. IN_HOUSE (Konaklayan) Koruması (Blokajsız kalamaz kuralı)
                if self.status == ReservationStatus.IN_HOUSE:
                    if not self.room:
                        raise ValidationError({"room": "Otelde konaklayan (IN_HOUSE) bir misafir blokajsız (fiziksel odasız) bırakılamaz."})
                    
                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.IN_HOUSE:
                    if self.check_in_date != old_instance.check_in_date:
                        raise ValidationError({"check_in_date": "Otelde konaklayan (In-House) bir misafirin giriş tarihi değiştirilemez."})
                    if self.check_out_date != old_instance.check_out_date and self.check_out_date < current_date:
                        raise ValidationError({"check_out_date": f"Çıkış tarihi otelin sistem gününden ({current_date}) daha eski bir tarihe çekilemez."})

                # 3.3. RESERVED (Bekleyen) Koruması
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.RESERVED:
                    if self.check_in_date != old_instance.check_in_date and self.check_in_date < current_date:
                        raise ValidationError({"check_in_date": f"Rezervasyon giriş tarihi sistem gününden ({current_date}) geçmiş bir tarih olamaz."})

                # 3.4. Statü Geçiş (Check-in / Check-out) Zaman Kilitleri
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.IN_HOUSE:
                    if current_date < self.check_in_date:
                        raise ValidationError({"status": "Check-in tarihi gelmemiş bir rezervasyon 'IN_HOUSE' durumuna alınamaz."})

                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.CHECKED_OUT:
                    if current_date < self.check_out_date:
                        raise ValidationError({"status": "Çıkış tarihi gelmemiş bir rezervasyon 'CHECKED_OUT' durumuna alınamaz."})

    def save(self, *args, **kwargs):
        with transaction.atomic():
            # Yalnızca fiziksel bir oda atandıysa satır bazlı kilit (select_for_update) koy
            if self.room_id:
                Room.objects.select_for_update().get(pk=self.room_id)
            self.full_clean()
            super().save(*args, **kwargs)


class HotelSettings(models.Model):
    system_date = models.DateField(default=timezone.localdate, verbose_name="Sistem (Operasyon) Günü")
    last_night_audit = models.DateTimeField(auto_now=True, verbose_name="Son Gün Sonu İşlemi")

    class Meta:
        verbose_name = "Otel Ayarı"
        verbose_name_plural = "Otel Ayarları"

    def save(self, *args, **kwargs):
        self.pk = 1
        super(HotelSettings, self).save(*args, **kwargs)

    @classmethod
    def get_current_date(cls) -> timezone.datetime.date:
        obj, created = cls.objects.get_or_create(pk=1)
        return obj.system_date