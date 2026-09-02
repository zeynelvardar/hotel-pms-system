"""
Otel misafir profillerini, kimlik/pasaport doğrulama kurallarını
ve yaş kontrollerini yöneten veri tabanı modelleridir.
"""

from datetime import date
from django.db import models
from django.core.exceptions import ValidationError
from .validators import validate_tckn, validate_past_date


class Guest(models.Model):
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
        verbose_name="Pasaport No"
    )
    
    birth_date = models.DateField(
        validators=[validate_past_date], 
        verbose_name="Doğum Tarihi"
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
            models.CheckConstraint(
                condition=(
                    (models.Q(tc_no__isnull=False) & ~models.Q(tc_no=""))
                    | (models.Q(passport_no__isnull=False) & ~models.Q(passport_no=""))
                ),
                name="require_tc_or_passport",
            )
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def clean(self) -> None:
        # Metin alanlarını temizle ve boş string ise NULL (None) yap
        if self.tc_no:
            self.tc_no = self.tc_no.strip() or None
        else:
            self.tc_no = None

        if self.passport_no:
            self.passport_no = self.passport_no.strip().upper() or None
        else:
            self.passport_no = None

        if self.first_name:
            self.first_name = self.first_name.strip()

        if self.last_name:
            self.last_name = self.last_name.strip()

        if self.email:
            self.email = self.email.strip().lower() or None
        else:
            self.email = None

        if self.phone:
            self.phone = self.phone.strip() or None
        else:
            self.phone = None

        super().clean()
        
        # 1. Doküman Bütünlüğü: TC No veya Pasaporttan en az biri olmalı
        if not self.tc_no and not self.passport_no:
            raise ValidationError("Misafir kaydı için TC Kimlik No veya Pasaport No zorunludur.")

        # 2. Yaş Kuralı: Ana misafir 18 yaşından küçük olamaz
        if self.is_main_guest and self.birth_date:
            today = date.today()
            age = (
                today.year 
                - self.birth_date.year 
                - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
            )
            if age < 18:
                raise ValidationError({
                    "birth_date": "Ana misafir 18 yaşından küçük olamaz."
                })

    def save(self, *args, **kwargs):
        # Admin veya ORM fark etmeksizin tüm doğrulamaları zorunlu kıl
        self.full_clean()
        super().save(*args, **kwargs)