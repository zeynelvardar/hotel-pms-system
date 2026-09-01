from datetime import date, timedelta
from django.test import TestCase
from django.core.exceptions import ValidationError
from guests.models import Guest
from rooms.models import Room, RoomType
from .models import Reservation, ReservationStatus


class ReservationStateMachineTests(TestCase):
    def setUp(self):
        self.guest = Guest.objects.create(
            first_name="Zeynel",
            last_name="Test",
            tc_no="10000000146",
            birth_date=date(1990, 1, 1),
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

    def test_checkout_cannot_be_before_checkin(self):
        """Check-out tarihi check-in tarihinden önce olamaz (Hata fırlatmalı)."""
        today = date.today()
        res = Reservation(
            guest=self.guest,
            room=self.room,
            check_in_date=today,
            check_out_date=today - timedelta(days=1),  # Check-in'den 1 gün önce
            total_price=1500,
            status=ReservationStatus.RESERVED,
        )
        with self.assertRaises(ValidationError) as context:
            res.full_clean()
        self.assertIn("check_out_date", context.exception.message_dict)

    def test_day_use_reservation_allowed(self):
        """Gündüz kullanımı (Check-in ve Check-out aynı gün) geçerli olmalıdır."""
        today = date.today()
        res = Reservation(
            guest=self.guest,
            room=self.room,
            check_in_date=today,
            check_out_date=today,  # Aynı gün (Day-Use)
            total_price=1000,
            status=ReservationStatus.RESERVED,
        )
        # Hata fırlatmamalı ve temiz şekilde kaydedilmeli
        res.full_clean()
        res.save()
        self.assertIsNotNone(res.id)

    def test_cannot_checkin_future_reservation(self):
        """Gelecek tarihli rezervasyon bugün IN_HOUSE yapılamaz."""
        future_checkin = date.today() + timedelta(days=5)
        future_checkout = date.today() + timedelta(days=7)

        res = Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=future_checkin,
            check_out_date=future_checkout,
            total_price=3000,
            status=ReservationStatus.RESERVED,
        )

        res.status = ReservationStatus.IN_HOUSE
        with self.assertRaises(ValidationError):
            res.full_clean()

    def test_immutable_past_reservations(self):
        """CHECKED_OUT statüsündeki rezervasyonun statüsü değiştirilemez."""
        past_checkin = date.today() - timedelta(days=3)
        past_checkout = date.today() - timedelta(days=1)

        res = Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=past_checkin,
            check_out_date=past_checkout,
            total_price=3000,
            status=ReservationStatus.CHECKED_OUT,
        )

        res.status = ReservationStatus.IN_HOUSE
        with self.assertRaises(ValidationError):
            res.full_clean()