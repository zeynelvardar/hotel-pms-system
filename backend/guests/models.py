"""
Otel misafir profillerini, kimlik/pasaport doğrulama kurallarını
ve KBS alanlarını yöneten veritabanı modelidir.
"""

from django.db import models # Django ORM importu
from django.core.exceptions import ValidationError
from .validators import validate_tckn, validate_past_date


class Gender(models.TextChoices):
    MALE = "M", "Erkek"
    FEMALE = "F", "Kadın"
    UNSPECIFIED = "U", "Belirtilmemiş"


class Guest(models.Model): # Model = bir sınıfın veri tabanı tablosuna dönüşmesini sağlar.
    first_name = models.CharField(max_length=100, verbose_name="Ad")
    last_name = models.CharField(max_length=100, verbose_name="Soyad")

    tc_no = models.CharField(
        max_length=11,
        blank=True,
        null=True,
        unique=True,
        validators=[validate_tckn],
        verbose_name="TC Kimlik No"
    )
    
    passport_no = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        verbose_name="Passport No"
    )

    birth_date = models.DateField(
        validators=[validate_past_date],
        verbose_name="Doğum Tarihi"
    )

    gender = models.CharField(
        max_length=1,
        choices=Gender.choices,
        default=Gender.UNSPECIFIED,
        verbose_name="Cinsiyet"
    )

    email = models.EmailField(blank=True, null=True, verbose_name="E-posta")
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Telefon")
    is_main_guest = models.BooleanField(
        default=True,
        help_text="Rezervasyondan sorumlu ana misafir mi?",
        verbose_name="Ana Misafir"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Misafir"
        verbose_name_plural = "Misafirler"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint( # tc ve pasaport için database kısıtlamaları.
                condition=(
                    (models.Q(tc_no__isnull=False) & ~models.Q(tc_no=""))
                    |(models.Q(passport_no__isnull=False) & ~models.Q(passport_no=""))  
                ),
                name="require_tc_or_passport",
            )
        ]

    def __str__(self) -> str: # normalde ekranda nesne olarak gözükecek olan guest'i isim soyisim olarak dönmesini sağlar.
        return f"{self.first_name} {self.last_name}"

    def clean(self) -> None:
        # Metin alanlarını temizle ve boş string ise NULL (None) yap.
        self.tc_no = self.tc_no.strip() if self.tc_no and self.tc_no.strip() else None
        self.passport_no = self.passport_no.strip().upper() if self.passport_no and self.passport_no.strip() else None
        self.first_name = self.first_name.strip() if self.first_name else ""
        self.last_name = self.last_name.strip() if self.last_name else ""
        self.email = self.email.strip().lower() if self.email and self.email.strip() else None
        self.phone = self.phone.strip() if self.phone and self.phone.strip() else None

        super().clean() # models.Model içindeki clean metodunu bizim bu class içindeki ile override ettiğimimizden tekrar çağırmamız gerekiyor.

        # 1. Döküman Bütünlüğü: TC No veya Pasaporttan en az biri olmalı.
        if not self.tc_no and not self.passport_no:
            raise ValidationError("Misafir kaydı için TC Kimlik No veya Pasaport No zorunludur.")

    def save(self, *args, **kwargs):
        # Admin veya ORM fark etmeksizin tüm doğrulamaları zorunlu kıl.
        self.full_clean()
        super().save(*args, **kwargs)