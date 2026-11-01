from django.utils import timezone
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Callable
from django.core.exceptions import ValidationError, FieldError
from django.core.validators import MinValueValidator # Toplam fiyatı en az 0 şeklinde sınırlandırmak için.
from django.db import models, transaction
from django.db.models import Func, Q # Q: QueryExpressions = Veri tabanına özel mantıksal sorgu yapmamızı sağlar. / Func: PostgreSQL veri tabanından veri tabanı fonksiyonu tetiklememizi sağlar.
from django.contrib.postgres.constraints import ExclusionConstraint # Belirtilen tarih aralıklarında overbooking'i önlemek için kullandığımız güvenlik duvarıdır.
from guests.models import Guest
from rooms.models import Room


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
        get_status_display: Callable[[], str]
        get_agency_display: Callable[[], str]

    # --- İLİŞKİLER (RELATIONS) ---
    guest = models.ForeignKey(Guest, on_delete=models.PROTECT, related_name="reservations", verbose_name="Ana Misafir")
    accompanying_guests = models.ManyToManyField(Guest, blank=True, related_name="accompanying_reservations", verbose_name="Ek Misafirler")
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="reservations", verbose_name="Oda")

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
            # PostgreSQL Seviyesi Zırh: Aynı oda, aynı tarihlerde, aktif iki rezervasyon barındıramaz.
            ExclusionConstraint(
                name="exclude_overlapping_reservations",
                expressions=[
                    ("room", "="), # = ile odanın içinde eşitlik arıyoruz (yani sistem 101 nolu odanın 101 nolu odayla çakışmalarını kontrol etmiş oluyor.)
                    (Func("check_in_date", "check_out_date", function="daterange"), "&&"), # giriş çıkış tarihlerini tarih aralığı (daterange) tipine dönüştür demektir. && ile dönüşülen bu tarih aralığının birbiriyle kesişip kesişmediğini kontrol eder.
                ],
                condition=Q(status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE]) # kuralın rezervasyon ve inhouse'daki odalar için devreye girmesi gerektiğini söyleriz.
            )
        ]

    def validate_constraints(self, exclude=None): # Kuralları kontrol ederken gelen rezervasyon nesnesindeki değişmeyen kısımlar için tekrar denetim çalıştırmamak için exclude=None yapıyoruz.
        """
        Django ORM'in ExclusionConstraint içindeki Q(status__in...) koşulunu 
        hafızada doğrulamaya çalışırken fırlattığı 'Choices are: _check' FieldError
        hatasını güvenle bypass eder.
        """
        try:
            super().validate_constraints(exclude=exclude) # önce aynı methodu oluşturarak yukarıda override ediyoruz, sonra tekrar çağırıyoruz ve : exclude parametresini üst sınıfa da bildiriyoruz.
        except FieldError:
            pass


    def __str__(self) -> str: # loglama/display için
        status_label = self.get_status_display() if hasattr(self, "get_status_display") else self.status
        return f"#{self.pk} | Misafir ID: {self.guest_id} -> Oda ID: {self.room_id} ({status_label})"


    def clean(self) -> None:
        super().clean()
        current_date = HotelSettings.get_current_date()

        if self.check_in_date and self.check_out_date:
            if self.check_out_date < self.check_in_date:
                raise ValidationError({"check_out_date": "Check-out tarihi, check-in tarihinden önceki bir gün olamaz."})

            # Uygulama Seviyesi Çakışma Kontrolü (Day-Use Edge Case'lerini de kapsar.)
            active_qs = Reservation.objects.filter(
                room=self.room, # seçili odanın tüm verileri
                status__in=[ReservationStatus.RESERVED, ReservationStatus.IN_HOUSE] # rezervasyon veya inhouse'lar içinde
            )
            if self.pk: # eğer pk varsa (yani güncelleme işlemiyse, pk yoksa yeni kayıttır.)
                active_qs = active_qs.exclude(pk=self.pk) # kontrolleri gerçekleştirirken kendi kaydımızla çakışmamak için, bu bir güncellemeyse exclude'luyoruz.

            for res in active_qs: # active_qs = rezervasyon sorgusu (yeni gelen oda verisinin karşılığı olan)
                self_eff_out = self.check_out_date if self.check_out_date > self.check_in_date else self.check_in_date + timedelta(days=1) # yeni gelen rezervasyonun çıkış tarihi (checkout-check'inden büyükse +1 ekle dön)
                res_eff_out = res.check_out_date if res.check_out_date > res.check_in_date else res.check_in_date + timedelta(days=1) # veri tabanındaki rezervasyonun çıkış tarihi (checkout-check'inden büyükse +1 ekle dön)

                if self.check_in_date < res_eff_out and self_eff_out > res.check_in_date: # yeni gelen misafirin giriş tarihi, veritabanındaki misafirin çıkış tarihinden önce mi? ve Yeni gelen misafirin çıkış tarihi, veritabanındaki misafirin giriş tarihinden sonra mı?
                    raise ValidationError({
                        "check_in_date": f"Bu tarihlerde oda {self.room.room_number} için mevcut bir rezervasyon (Ref: #{res.id}) bulunuyor."
                    })

        # --- MİSAFİR KARTI (STAY CARD) ZIRHLARI --- #
        if self.pk: # güncelleme işlemi ise (self.pk var ise.)
            old_instance = Reservation.objects.filter(pk=self.pk).only( # veritabanında aradığımız kaydın eşleştirmesi / only ile select*ALL sorgusu atmadan optimize bir sorgu atıyoruz. 
                "status", "check_in_date", "check_out_date", "room_id", "total_price", "agency" 
            ).first() # first() sorguyu atıp python nesnesi olarak getiriyor. 

            if old_instance:
                # 1. Kapalı Kayıtlar Salt Okunur.
                if old_instance.status in [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW]: # eğer kapalı kayıtsa:
                    if (self.status != old_instance.status or self.check_in_date != old_instance.check_in_date
                        or self.check_out_date != old_instance.check_out_date or self.room_id != old_instance.room_id
                        or self.total_price != old_instance.total_price or self.agency != old_instance.agency):
                        raise ValidationError("Tamamlanmış, iptal edilmiş veya No-show olmuş rezervasyonlar salt okunurdur; konaklama verileri değiştirilemez.")


                # 2. IN_HOUSE (Konaklayan Koruması)
                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.IN_HOUSE: # eğer inhouse ise
                    if self.check_in_date != old_instance.check_in_date:
                        raise ValidationError({"check_in_date": "Otelde konaklayan (In-House) bir misafirin giriş tarihi değiştirilemez."})
                    if self.check_out_date != old_instance.check_out_date and self.check_out_date < current_date:
                        raise ValidationError({"check_out_date": f"Çıkış tarihi otelin sistem gününden ({current_date}) daha eski bir tarihe çekilemez."})

                # 3. RESERVED (Bekleyen) Koruması
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.RESERVED:
                    if self.check_in_date != old_instance.check_in_date and self.check_in_date < current_date:
                        raise ValidationError({"check_in_date": f"Rezervasyon giriş tarihi sistem gününden ({current_date}) geçmiş bir tarih olamaz."})

                # 4. Check-in ve Check-out Zaman Kilitleri
                if old_instance.status == ReservationStatus.RESERVED and self.status == ReservationStatus.IN_HOUSE:
                    if current_date < self.check_in_date:
                        raise ValidationError({"status": "Check-in tarihi gelmemiş bir rezervasyon 'IN_HOUSE' durumuna alınamaz."})

                if old_instance.status == ReservationStatus.IN_HOUSE and self.status == ReservationStatus.CHECKED_OUT:
                    if current_date < self.check_out_date:
                        raise ValidationError({"status": "Çıkış tarihi gelmemiş bir rezervasyon 'CHECKED_OUT' durumuna alınamaz."})

    def save(self, *args, **kwargs):
        # Transaction başlatılır. select_for_update() bu işlemi atomik hale getirerek Race Condition'ı imkansız kılar.
        with transaction.atomic():
            if self.room_id:
                Room.objects.select_for_update().get(pk=self.room_id)
            self.full_clean()
            super().save(*args, **kwargs)


class HotelSettings(models.Model):
    """
    Otel PMS Sisteminin kalbi. Gerçek zamanı değil, otelin 'Operasyonel Gününü'
    tutar. Singleton pattern ile tasarlandı; veritabanında her zaman tek bir satır (id=1) olur.
    """
    system_date = models.DateField(
        default=timezone.localdate,
        verbose_name="Sistem (Operasyon) Günü"
    )
    last_night_audit = models.DateTimeField(
        auto_now=True,
        verbose_name="Son Gün Sonu İşlemi"
    )

    class Meta:
        verbose_name = "Otel Ayarı"
        verbose_name_plural = "Otel Ayarları"

    def save(self, *args, **kwargs):
        # Singleton Pattern: Yeni kayıt oluşturulmasını engelle, hep id=1'i güncelle.
        self.pk = 1
        super(HotelSettings, self).save(*args, **kwargs)

    @classmethod
    def get_current_date(cls) -> timezone.datetime.date:
        """Sistem gününü güvenli şekilde okuyan yardımcı metod."""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj.system_date