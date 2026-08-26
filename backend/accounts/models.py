# Django'da accounts/models.py dosyası, genellikle kullanıcılara, 
# kimlik doğrulamaya ve profil yönetimine ait veritabanı 
# tablolarının (models) tanımlandığı yerdir.

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Yönetici"
    RECEPTION = "RECEPTION", "Resepsiyonist"
    HOUSEKEEPING = "HOUSEKEEPING", "Kat Hizmetleri"


class User(AbstractUser):
    """
    Otel PMS özel kullanıcı modeli.
    Email zorunlu ve tekildir. Rol bazlı yetkilendirme sağlar.
    """
    email = models.EmailField(unique=True, verbose_name="E-Posta Adresi")
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.RECEPTION,
        verbose_name="Kullanıcı Rolü",
        db_index=True,
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Telefon Numarası",
    )

    objects = UserManager()

    USERNAME_FIELD = "username"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email", "role"]

    class Meta:
        verbose_name = "Kullanıcı"
        verbose_name_plural = "Kullanıcılar"
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})" # type: ignore
    
    @property
    def is_hotel_admin(self) -> bool:
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_receptionist(self) -> bool:
        return self.role == UserRole.RECEPTION

    @property
    def is_housekeeper(self) -> bool:
        return self.role == UserRole.HOUSEKEEPING