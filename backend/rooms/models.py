"""
Otel odası tiplerini, fiziksel oda varlıklarını,
housekeeping durumlarını ve kat yerleşimlerini yöneten veri tabanı modelleridir.
"""

from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError


class RoomStatus(models.TextChoices):
    VC = "VC", "Vacant Clean (Boş Temiz)"
    VD = "VD", "Vacant Dirty (Boş Kirli)"
    OC = "OC", "Occupied Clean (Dolu Temiz)"
    OD = "OD", "Occupied Dirty (Dolu Kirli)"
    OOO = "OOO", "Out of Order (Arızalı/Hizmet Dışı)"


class RoomType(models.Model):
    """
    Otel oda tipleri ve taban kapasite/fiyat tanımları.
    """
    name = models.CharField(max_length=100, unique=True, verbose_name="Oda Tipi Adı")
    code = models.CharField(max_length=10, unique=True, verbose_name="Oda Tipi Kodu", db_index=True)
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name="Gecelik Fiyat",
    )
    max_adults = models.PositiveSmallIntegerField(default=2, verbose_name="Maksimum Yetişkin")
    max_children = models.PositiveSmallIntegerField(default=1, verbose_name="Maksimum Çocuk")
    description = models.TextField(blank=True, null=True, verbose_name="Açıklama")
    is_active = models.BooleanField(default=True, verbose_name="Aktif mi?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Oda Tipi"
        verbose_name_plural = "Oda Tipleri"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"

    def clean(self) -> None:
        super().clean()
        if self.max_adults < 1:
            raise ValidationError({"max_adults": "Bir oda tipinde en az 1 yetişkin kapasitesi olmalıdır."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Room(models.Model):
    """
    Fiziksel oda varlığı. Durum yönetimi ve kat yerleşimi içerir.
    """
    room_number = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        verbose_name="Oda Numarası",
    )
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name="rooms",
        verbose_name="Oda Tipi",
    )
    floor = models.IntegerField(default=1, verbose_name="Kat")
    status = models.CharField(
        max_length=5,
        choices=RoomStatus.choices,
        default=RoomStatus.VC,
        db_index=True,
        verbose_name="Oda Durumu",
    )
    is_active = models.BooleanField(default=True, verbose_name="Kullanımda mı?")
    notes = models.TextField(blank=True, null=True, verbose_name="Oda Notları")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Oda"
        verbose_name_plural = "Odalar"
        ordering = ["room_number"]

    def __str__(self) -> str:
        return f"Oda {self.room_number} - {self.room_type.code} [{self.get_status_display()}]"  # type: ignore

    def clean(self) -> None:
        super().clean()
        if self.room_number:
            self.room_number = self.room_number.strip().upper()
            if not self.room_number:
                raise ValidationError({"room_number": "Oda numarası boş bırakılamaz."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)