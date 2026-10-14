from django.utils import timezone
from datetime import date, timedelta
from typing import Any, cast
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework.response import Response
from rest_framework import status
from django.test import TestCase
from django.core.exceptions import ValidationError
from accounts.models import User, UserRole
from guests.models import Guest
from rooms.models import Room, RoomType, RoomStatus
from .models import Reservation, ReservationStatus


class ReservationConcurrencyTests(TestCase):
    def setUp(self) -> None:
        self.guest1 = Guest.objects.create(
            first_name="Zeynel",
            last_name="Test",
            tc_no="10000000146",
            birth_date=date(1990, 1, 1),
            is_main_guest=True,
        )
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
        self.today = timezone.localdate()

    def test_overlapping_reservations_are_blocked(self) -> None:
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

    def test_day_use_overlap_is_blocked(self) -> None:
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

    def test_back_to_back_reservations_are_allowed(self) -> None:
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


class ReservationDashBoardApiTests(APITestCase):
    client: APIClient

    def setUp(self) -> None:
        self.receptionist = User.objects.create_user(
            username="recep",
            email="rec@hotel.com",
            password="Pass123!",
            role=UserRole.RECEPTION,
        )
        self.guest = Guest.objects.create(
            first_name="API",
            last_name="Test",
            passport_no="P123",
            birth_date=date(1990, 1, 1),
            is_main_guest=True,
        )
        self.room_type = RoomType.objects.create(name="Std", code="STD", base_price=100)
        self.room = Room.objects.create(room_number="101", room_type=self.room_type, floor=1)
        self.today = timezone.localdate()

        # Operasyonel test kayıtları
        Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_price=200,
            status=ReservationStatus.RESERVED,
        )
        Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=self.today - timedelta(days=2),
            check_out_date=self.today,
            total_price=200,
            status=ReservationStatus.IN_HOUSE,
        )

    def test_dashboard_endpoints_and_n_plus_one(self) -> None:
        """Dashboard API endpoint'leri doğru veriyi döndürmeli ve N+1 sorgusu yaşatmamalıdır."""
        self.client.force_authenticate(user=self.receptionist)

        # 1. Gelecekler (Arrivals) Testi
        with self.assertNumQueries(2):
            raw_arrivals = self.client.get(reverse("reservations:reservation-arrivals-today"))
            res_arrivals: Response = cast(Response, raw_arrivals)
            data_arrivals: dict[str, Any] = cast(dict[str, Any], res_arrivals.data)

            self.assertEqual(res_arrivals.status_code, status.HTTP_200_OK)
            self.assertEqual(len(data_arrivals["results"]), 1)
            self.assertEqual(data_arrivals["results"][0]["status"], "RESERVED")

        # 2. Ayrılacaklar (Departures) Testi
        with self.assertNumQueries(2):
            raw_departures = self.client.get(reverse("reservations:reservation-departures-today"))
            res_departures: Response = cast(Response, raw_departures)
            data_departures: dict[str, Any] = cast(dict[str, Any], res_departures.data)

            self.assertEqual(res_departures.status_code, status.HTTP_200_OK)
            self.assertEqual(len(data_departures["results"]), 1)
            self.assertEqual(data_departures["results"][0]["status"], "IN_HOUSE")


class ReservationActionApiTests(APITestCase):
    client: APIClient

    def setUp(self) -> None:
        self.receptionist = User.objects.create_user(
            username="recep_action",
            email="rec2@hotel.com",
            password="Pass123!",
            role=UserRole.RECEPTION,
        )
        self.guest = Guest.objects.create(
            first_name="Action",
            last_name="Test",
            passport_no="ACT123",
            birth_date=date(1990, 1, 1),
            is_main_guest=True,
        )
        self.room_type = RoomType.objects.create(name="Suite", code="SUT", base_price=2000)
        self.room = Room.objects.create(room_number="201", room_type=self.room_type, floor=2)
        self.today = timezone.localdate()

        self.client.force_authenticate(user=self.receptionist)

    def test_successful_check_in_and_check_out(self) -> None:
        """Check-in ve Check-out işlemlerinin hem rezervasyon hem de ODA statüsünü (OC/VD) güncellediğini doğrular."""
        res = Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_price=4000,
            status=ReservationStatus.RESERVED,
        )

        # 1. Check-in İşlemi
        checkin_url = reverse("reservations:reservation-check-in", args=[res.pk])
        raw_response_in = self.client.post(checkin_url)
        response_in: Response = cast(Response, raw_response_in)
        self.assertEqual(response_in.status_code, status.HTTP_200_OK)
        self.assertEqual(response_in.data["status"], ReservationStatus.IN_HOUSE)  # type: ignore

        # Oda statüsü OC (Occupied Clean) olmalıdır
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, RoomStatus.OC)

        # 2. Check-out İşlemi
        checkout_url = reverse("reservations:reservation-check-out", args=[res.pk])
        raw_response_out = self.client.post(checkout_url)
        response_out: Response = cast(Response, raw_response_out)
        self.assertEqual(response_out.status_code, status.HTTP_200_OK)
        self.assertEqual(response_out.data["status"], ReservationStatus.CHECKED_OUT)  # type: ignore

        # Oda statüsü VD (Vacant Dirty) olmalıdır
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, RoomStatus.VD)

    def test_cannot_checkout_reserved_booking(self) -> None:
        res = Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_price=4000,
            status=ReservationStatus.RESERVED,
        )

        checkout_url = reverse("reservations:reservation-check-out", args=[res.pk])
        raw_response = self.client.post(checkout_url)
        response: Response = cast(Response, raw_response)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("IN_HOUSE", str(response.data))

    def test_cancel_reservation(self) -> None:
        """Bekleyen bir rezervasyonun iptal işlemini doğrular."""
        res = Reservation.objects.create(
            guest=self.guest,
            room=self.room,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_price=4000,
            status=ReservationStatus.RESERVED,
        )

        cancel_url = reverse("reservations:reservation-cancel", args=[res.pk])
        raw_response = self.client.post(cancel_url)
        response: Response = cast(Response, raw_response)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], ReservationStatus.CANCELLED)  # type: ignore