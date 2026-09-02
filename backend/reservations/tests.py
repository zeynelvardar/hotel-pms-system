from datetime import date, timedelta
from django.test import TestCase
from django.core.exceptions import ValidationError
from guests.models import Guest
from rooms.models import Room, RoomType
from .models import Reservation, ReservationStatus


class ReservationConcurrencyTests(TestCase):
    def setUp(self):
        # 1. Misafir (TC Vatandaşı - Algoritmik Olarak Doğrulanmış Test TCKN: 10000000146)
        self.guest1 = Guest.objects.create(
            first_name="Zeynel",
            last_name="Test",
            tc_no="10000000146",
            birth_date=date(1990, 1, 1),
            is_main_guest=True,
        )
        # 2. Misafir (Yabancı Misafir - Pasaport Doğrulamalı)
        self.guest2 = Guest.objects.create(
            first_name="John",
            last_name="Doe",
            passport_no="U987654321",
            birth_date=date(1985, 5, 15),
            is_main_guest=True,
        )
        self.room_type = RoomType.objects.create(
            name="Standard Room",
            code="STD",
            base_price=1500,
            max_adults=2,
            max_children=1,
        )
        self.room = Room.objects.create(
            room_number="101",
            room_type=self.room_type,
            floor=1,
        )
        self.today = date.today()

    def test_overlapping_reservations_are_blocked(self):
        """Birbiriyle çakışan tarihlerdeki rezervasyonlar engellenmelidir."""
        Reservation.objects.create(
            guest=self.guest1,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=3),
            total_price=4500,
            status=ReservationStatus.RESERVED,
        )

        overlapping_res = Reservation(
            guest=self.guest2,
            room=self.room,
            check_in_date=self.today + timedelta(days=1),
            check_out_date=self.today + timedelta(days=4),
            total_price=4500,
            status=ReservationStatus.RESERVED,
        )

        with self.assertRaises(ValidationError) as context:
            overlapping_res.save()

        self.assertIn("mevcut bir rezervasyon", context.exception.message_dict.get("check_in_date", [""])[0])

    def test_day_use_overlap_is_blocked(self):
        """Aynı gün için ikinci bir Day-Use (gündüz kullanımı) engellenmelidir."""
        Reservation.objects.create(
            guest=self.guest1,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today,
            total_price=1000,
            status=ReservationStatus.RESERVED,
        )

        day_use_overlap = Reservation(
            guest=self.guest2,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today,
            total_price=1000,
            status=ReservationStatus.RESERVED,
        )

        with self.assertRaises(ValidationError):
            day_use_overlap.save()

    def test_back_to_back_reservations_are_allowed(self):
        """Bir misafirin çıkış günü diğer misafirin giriş yapmasına izin verilmelidir."""
        Reservation.objects.create(
            guest=self.guest1,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_price=3000,
            status=ReservationStatus.RESERVED,
        )

        back_to_back_res = Reservation(
            guest=self.guest2,
            room=self.room,
            check_in_date=self.today + timedelta(days=2),
            check_out_date=self.today + timedelta(days=4),
            total_price=3000,
            status=ReservationStatus.RESERVED,
        )

        back_to_back_res.save()
        self.assertIsNotNone(back_to_back_res.id)