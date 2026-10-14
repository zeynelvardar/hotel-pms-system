from datetime import date
from django.utils import timezone
from django.core.exceptions import ValidationError

def validate_tckn(value: str) -> None:
    """Gerçek Mod10 ve Mod11 kriptografik TC Kimlik algoritması."""
    if not value or len(value) != 11 or not value.isdigit():
        raise ValidationError("TC Kimlik numarası 11 haneli rakamlardan oluşmalıdır.")
    
    if value[0] == '0':
        raise ValidationError("TC Kimlik numarası 0 ile başlayamaz.")

    digits = [int(d) for d in value]
    
    # Kural 1: 1, 3, 5, 7, 9. hanelerin toplamının 7 katından, 2, 4, 6, 8. hanelerin toplamı çıkartıldığında 10'a bölümünden kalan 10. haneyi vermelidir.
    sum_odd = sum(digits[0:9:2])
    sum_even = sum(digits[1:8:2])
    digit_10 = ((sum_odd * 7) - sum_even) % 10
    
    if digits[9] != digit_10:
        raise ValidationError("Geçersiz TC Kimlik numarası (Kriptografik doğrulama başarısız).")

    # Kural 2: İlk 10 hanenin toplamının 10'a bölümünden kalan 11. haneyi vermelidir.
    digit_11 = sum(digits[:10]) % 10
    if digits[10] != digit_11:
        raise ValidationError("Geçersiz TC Kimlik numarası (Kontrol hanesi başarısız).")

def validate_past_date(value: date) -> None:
    """Tarihin gelecekte olmamasını garanti eder."""
    if value > timezone.localdate():
        raise ValidationError("Doğum tarihi veya geçmiş işlemler gelecekte bir tarih olamaz.")