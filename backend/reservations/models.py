"""
MİMARİ NOTU:
- Bu model Reservation tablosunu temsil eder.
- Performans için Meta.indexes altında bileşik indeksler ((status, check_in_date) vb.) tanımlanmıştır.
- PostgreSQL tarafında overbooking koruması ExclusionConstraint ile güvenceye alınmıştır.
"""

from datetime import date, timedelta
from typing import TYPE_CHECKING, Any, Callable, Optional
from django.contrib.postgres.constraints import ExclusionConstraint
from django.core.exceptions import FieldError, ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Func, Q
from django.utils import timezone
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
        room_id: Optional[int]
        booked_room_type_id: int
        get_status_display: Callable[[], str]
        get_agency_display: Callable[[], str]

    # --- İLİŞKİLER (RELATIONS) --- #
    guest = models.ForeignKey(
        Guest, on_delete=models.PROTECT, related_name="reservations", verbose_name="Ana Misafir"
    )
    accompanying_guests = models.ManyToManyField(
        Guest, blank=True, related_name="accompanying_reservations", verbose_name="Ek Misafirler"
    )

    # --- ODA VE BLOKAJ (FLOATING REZERVASYON MİMARİSİ) ---
    # Satın alınan oda tipi (Fiziksel oda boş kalsa bile sistem envanteri ve fiyatı buradan okur.)
    booked_room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="booked_reservations",
        verbose_name="Satın Alınan Oda Tipi",
    )

    # Fiziksel oda (Blokaj) Null olabilir (Havuzdaki/Blokajsız rezervasyonlar için)
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reservations",
        verbose_name="Fiziksel Oda Blokajı",
    )

    # --- SATIŞ VE DURUM (SALES & STATUS) --- #
    agency = models.CharField(
        max_length=20,
        choices=ReservationAgency.choices,
        default=ReservationAgency.DIRECT,
        db_index=True,
        verbose_name="Acenta / Satış Kanalı",
    )
    check_in_date = models.DateField(verbose_name="Check-in Tarihi")
    check_out_date = models.DateField(verbose_name="Check-out Tarihi")

    # Tekil db_index kaldırıldı; Meta.indexes içindeki (status, check_in_date) B-tree öneki status sorgularını da karşılar.
    status = models.CharField(
        max_length=15,
        choices=ReservationStatus.choices,
        default=ReservationStatus.RESERVED,
        verbose_name="Rezervasyon Durumu",
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default="0.00",
        blank=True,
        validators=[MinValueValidator(0)],
        verbose_name="Toplam Fiyat",
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Notlar")

    created_at = models.DateField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Rezervasyon"
        verbose_name_plural = "Rezervasyonlar"

        # Aynı tarihteki kayıtlarda OFFSET/LIMIT kaymasını önlemek için id ikincil anahtarı eklenir.
        ordering = ["check_in_date", "id"]
        indexes = [
            # Dashboard sekmeleri (arrivals, reservations), tarih filtreleri ve Forecast için
            models.Index(fields=["status", "check_in_date"], name="res_status_check_in_idx"),
            # Departures sekmesi, çıkış filtreleri ve Forecast aralık sorguları için
            models.Index(fields=["status", "check_out_date"], name="res_status_check_out_idx"),
        ]

        constraints = [
            # PostgreSQL Zırhı: Fiziksel odası atanmış (room__isnull=False) aktif rezervasyonlarda aynı odaya çakışan tarihli blokajı (Double Booking) engeller.
            ExclusionConstraint(
                name="exclude_overlapping_reservations",
                expressions=[
                    ("room", "="),  # iki kaydın room değeri eşitse çakışma testine sok.
                    (Func("check_in_date", "check_out_date", function="daterange"), "&&"),
                ],
                condition=Q(  # çakışma kurallarının uygulanacağı kısım.
                    status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE],
                    room__isnull=False,
                ),
            )
        ]

    def validate_constraints(self, exclude=None):
        # full_clean() çalışırken Django'nun Python tarafındaki doğrulayıcısı PostgreSQL'e özel
        # 'daterange' fonksiyonunu çözemeyip FieldError fırlatır. Bu hatayı yutup asıl çakışma
        # kontrolünü doğrudan PostgreSQL ExclusionConstraint'e devrediyoruz.
        # (exclude=exclude: Form/API'de kullanıcıya sorulmayan ve arkada otomatik atanacak
        # örn. 'reservation_code', 'created_by' gibi alanların doğrulama dışı kalma bilgisini üst sınıfa aktarır.)
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
            # PMS Kuralı: Konaklama en az 1 gece olmalıdır (Day Use Kapsam Dışı)
            if self.check_out_date <= self.check_in_date:
                raise ValidationError(
                    {"check_out_date": "Check-out tarihi, check-in tarihinden sonraki bir gün olmalıdır."}
                )

            # PMS Kuralı: Yeni oluşturulan rezervasyon sistem tarihinden önceye açılamaz.
            if not self.pk and self.check_in_date < current_date:
                raise ValidationError(
                    {
                        "check_in_date": (
                            f"Geçmişe dönük rezervasyon açılamaz. "
                            f"Giriş günü sistem gününden ({current_date}) önce olamaz."
                        )
                    }
                )

            # UYGULAMA SEVİYESİ ODA ÇAKIŞMA KONTROLÜ (Sadece blokajlı odalar için çalışır.)
            if self.room:
                active_qs = Reservation.objects.filter(
                    room=self.room,
                    status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE],
                )
                if self.pk:
                    active_qs = active_qs.exclude(pk=self.pk)  # kontrole kendi kaydını dahil etme.

                for res in active_qs:
                    self_eff_out = (  # çıkış tarihi girişten büyükse al, yoksa check_in'e +1 gün ekleyip al
                        self.check_out_date
                        if self.check_out_date > self.check_in_date
                        else self.check_in_date + timedelta(days=1)
                    )
                    res_eff_out = (
                        res.check_out_date  # kontrol edilen veri tabanındaki rezervasyonun çıkış tarihi.
                        if res.check_out_date > res.check_in_date
                        else res.check_in_date + timedelta(days=1)
                    )

                    if self.check_in_date < res_eff_out and self_eff_out > res.check_in_date:  # Tarih Çakışması : yeni oluşturulan rezervasyonun girişi (oda numarası üzerinden yapılan kontrol) içerdekinin check_out tarihinden büyük olamaz. / Check-out tarihi de içeridekinin giriş tarihinden büyük olamaz!
                        raise ValidationError(
                            {
                                "check_in_date": (
                                    f"Bu tarihlerde oda {self.room.room_number} için "
                                    f"mevcut bir rezervasyon (Res: #{res.id}) bulunuyor."
                                )
                            }
                        )

        # 3. İŞ MANTIĞI VE ZIRHLAR (STAY CARD)
        if self.pk:
            old_instance = (
                Reservation.objects.filter(pk=self.pk)
                .only("status", "check_in_date", "check_out_date", "room_id", "total_price", "agency")
                .first()
            )
            if old_instance:
                # 3.1 Kapalı Kayıtlar Salt Okunur.
                if old_instance.status in [
                    ReservationStatus.CHECKED_OUT,
                    ReservationStatus.CANCELLED,
                    ReservationStatus.NO_SHOW,
                ]:
                    if (
                        self.status != old_instance.status
                        or self.check_in_date != old_instance.check_in_date
                        or self.check_out_date != old_instance.check_out_date
                        or self.room_id != old_instance.room_id
                        or self.total_price != old_instance.total_price
                        or self.agency != old_instance.agency
                    ):
                        raise ValidationError(
                            "Tamamlanmış, iptal edilmiş veya No-show olmuş rezervasyonlar "
                            "salt okunurdur; konaklama verileri değiştirilemez."
                        )

                # 3.2 IN_HOUSE (Konaklayan) Koruması (Blokajsız Kalamaz Kuralı)
                if self.status == ReservationStatus.IN_HOUSE and not self.room:
                    raise ValidationError(
                        {"room": "Otelde konaklayan (IN_HOUSE) bir misafir blokajsız (fiziksel odasız) bırakılamaz."}
                    )

                # 3.2.1 IN_HOUSE (Konaklayan) Check-in Tarihi Değiştirilemez Kuralı.
                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.IN_HOUSE:
                    if self.check_in_date != old_instance.check_in_date:
                        raise ValidationError(
                            {"check_in_date": "Otelde konaklayan (In-House) bir misafirin giriş tarihi değiştirilemez."}
                        )
                    # 3.2.2 Check-Out Tarihi Sistem Tarihinden Eski Bir Tarih Olamaz Kuralı.
                    if self.check_out_date != old_instance.check_out_date and self.check_out_date < current_date:
                        raise ValidationError(
                            {
                                "check_out_date": (
                                    f"Çıkış tarihi otelin sistem gününden ({current_date}) "
                                    f"daha eski bir tarihe çekilemez."
                                )
                            }
                        )

                # 3.3 RESERVED (Bekleyen) Koruması
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.RESERVED:
                    if self.check_in_date != old_instance.check_in_date and self.check_in_date < current_date:
                        raise ValidationError(
                            {
                                "check_in_date": (
                                    f"Rezervasyon giriş tarihi sistem gününden ({current_date}) "
                                    f"geçmiş bir tarih olamaz."
                                )
                            }
                        )

                # 3.4 Statü Geçiş (Check-in / Check-out) Zaman Kilitleri
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.IN_HOUSE:
                    if current_date < self.check_in_date:
                        raise ValidationError(
                            {"status": "Check-in tarihi gelmemiş bir rezervasyon 'IN_HOUSE' durumuna alınamaz."}
                        )

                # 3.4.1 Check-out Tarihi Sistem Tarihinden Önce Olamaz.
                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.CHECKED_OUT:
                    if current_date < self.check_out_date:
                        raise ValidationError(
                            {"status": "Çıkış tarihi gelmemiş bir rezervasyon 'CHECKED_OUT' durumuna alınamaz."}
                        )

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
    def get_current_date(cls) -> date:
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj.system_date