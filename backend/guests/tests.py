from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from django.core.exceptions import ValidationError
from .models import Guest

class GuestModelTests(TestCase):
    def setUp(self):
        self.valid_tckn = "10000000146" # Geçerli Mod10 üreten örnek bir test numarası
        self.adult_dob = timezone.localdate() - timedelta(days=365 * 25) # 25 yaşında
        self.child_dob = timezone.localdate() - timedelta(days=365 * 10) # 10 yaşında

    def test_guest_must_have_tc_or_passport(self):
        guest = Guest(first_name="Test", last_name="User", birth_date=self.adult_dob)
        with self.assertRaisesMessage(ValidationError, "Misafir kaydı için TC Kimlik No veya Pasaport No zorunludur."):
            guest.clean()

    def test_main_guest_must_be_adult(self):
        guest = Guest(
            first_name="Test", 
            last_name="Child", 
            tc_no=self.valid_tckn, 
            birth_date=self.child_dob, 
            is_main_guest=True
        )
        with self.assertRaises(ValidationError) as context:
            guest.clean()
        self.assertIn("Ana misafir 18 yaşından küçük olamaz.", str(context.exception))

    def test_valid_guest_creation(self):
        guest = Guest(
            first_name="Valid", 
            last_name="Adult", 
            tc_no=self.valid_tckn, 
            birth_date=self.adult_dob, 
            is_main_guest=True
        )
        guest.clean() # Hata fırlatmamalı
        self.assertTrue(True)